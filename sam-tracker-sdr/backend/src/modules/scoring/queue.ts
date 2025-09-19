import { SDRScoringQueueRepository } from "../../db/entities";
import { SDRScoringJob } from "../../db/schema";
import { processScoringJob } from "./enrichment";

class ScoringQueue {
  private running = false;

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
          await SDRScoringQueueRepository.markJobFailed(job.id, message);
          await SDRScoringQueueRepository.setEntityStatus(job.entityId, "pending", true);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async getState() {
    const state = await SDRScoringQueueRepository.getQueueSummary();
    const scrub = (jobs: SDRScoringJob[]) =>
      jobs.map(({ authToken, ...rest }) => ({ ...rest }));
    return {
      activeJob: state.activeJob
        ? { ...state.activeJob, authToken: undefined }
        : undefined,
      queuedJobs: scrub(state.queuedJobs),
      recentJobs: scrub(state.recentJobs),
      failedJobs: scrub(state.failedJobs),
    };
  }
}

export const scoringQueue = new ScoringQueue();
