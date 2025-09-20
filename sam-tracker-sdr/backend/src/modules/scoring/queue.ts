import { SDRScoringQueueRepository } from "../../db/entities";
import { SDRScoringJob } from "../../db/schema";
import { processScoringJob } from "./enrichment";

class ScoringQueue {
  private running = false;
  private stopRequested = false;
  private recentFailures: SDRScoringJob[] = [];

  async enqueue(
    entityIds: string[] | undefined,
    authToken: string
  ): Promise<{ requested: string[]; jobs: SDRScoringJob[] }> {
    const targetIds = entityIds && entityIds.length > 0
      ? Array.from(new Set(entityIds))
      : await SDRScoringQueueRepository.listStaleEntityIds();

    if (targetIds.length === 0) {
      return { requested: [], jobs: [] };
    }

    const jobs = await SDRScoringQueueRepository.enqueueScoringJobs(targetIds, authToken);
    this.stopRequested = false;
    void this.run();
    return { requested: targetIds, jobs };
  }

  private async run() {
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      while (true) {
        if (this.stopRequested) {
          break;
        }
        const job = await SDRScoringQueueRepository.getNextQueuedJob();
        if (!job) {
          break;
        }

        await SDRScoringQueueRepository.markJobProcessing(job.id);
        await SDRScoringQueueRepository.setEntityStatus(job.entityId, "processing");

        try {
          await processScoringJob(job);
          await SDRScoringQueueRepository.markJobCompleted(job.id);
        } catch (error: any) {
          const message = error?.message ?? String(error);
          console.error(
            `[scoring] job ${job.id} for entity ${job.entityId} failed`,
            error
          );
          await SDRScoringQueueRepository.markJobFailed(job.id, message);
          await SDRScoringQueueRepository.setEntityStatus(job.entityId, "pending", true);
          this.recentFailures.push({
            ...job,
            status: "failed",
            completedAt: new Date().toISOString(),
            error: message,
            authToken: undefined,
          });
          await SDRScoringQueueRepository.removeJob(job.id);
        }
      }
    } finally {
      const shouldReset = this.stopRequested;
      this.running = false;
      if (shouldReset) {
        await SDRScoringQueueRepository.resetQueuedJobs();
        this.stopRequested = false;
      }
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (!this.running) {
      await SDRScoringQueueRepository.resetQueuedJobs();
      this.stopRequested = false;
      await SDRScoringQueueRepository.clearStaleRunningFlags();
      return;
    }

    await new Promise<void>((resolve) => {
      const check = () => {
        if (!this.running) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
    await SDRScoringQueueRepository.clearStaleRunningFlags();
  }

  async getState() {
    const state = await SDRScoringQueueRepository.getQueueSummary();
    const scrub = (jobs: SDRScoringJob[]) =>
      jobs.map(({ authToken, ...rest }) => ({ ...rest }));
    const failures = this.recentFailures.length > 0
      ? this.recentFailures
      : state.failedJobs;
    this.recentFailures = [];
    return {
      activeJob: state.activeJob
        ? { ...state.activeJob, authToken: undefined }
        : undefined,
      queuedJobs: scrub(state.queuedJobs),
      recentJobs: scrub(state.recentJobs),
      failedJobs: scrub(failures),
      running: this.running && !this.stopRequested,
    };
  }
}

export const scoringQueue = new ScoringQueue();
