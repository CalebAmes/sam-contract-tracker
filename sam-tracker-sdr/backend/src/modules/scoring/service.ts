import { Router } from "express";
import { z } from "zod";
import { SDRScoringRepository, SDRScoringQueueRepository } from "../../db/entities";
import { scoringQueue } from "./queue";

const submitScoreSchema = z.object({
  opportunityId: z.string(),
  reviewer: z.string(),
  technicalFit: z.number().min(0).max(5),
  contractViability: z.number().min(0).max(5),
  competitiveness: z.number().min(0).max(5),
  summary: z.string().optional(),
});

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message);
  }
  return fallback;
}

export function createScoringRouter(): Router {
  const router = Router();

  router.get("/scorecards", async (_req, res) => {
    const entities = await SDRScoringRepository.listEntities();
    res.json({ data: entities });
  });

  router.get("/metrics", async (_req, res) => {
    const metrics = await SDRScoringRepository.listMetricDefinitions();
    res.json({ data: metrics });
  });

  router.post("/scan", async (req, res) => {
    try {
      const { entityIds, authToken } =
        (req.body || {}) as { entityIds?: string[]; authToken?: string };
      const token = authToken?.trim();
      if (!token) {
        return res.status(400).json({ error: "authToken is required" });
      }
      const result = await scoringQueue.enqueue(entityIds, token);
      const jobs = result.jobs.map(({ authToken: _token, ...rest }) => rest);
      res.json({ requested: result.requested, jobs });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to start scoring scan");
      res.status(500).json({ error: message });
    }
  });

  router.get("/queue", async (_req, res) => {
    try {
      const state = await scoringQueue.getState();
      res.json(state);
    } catch (error) {
      const message = toErrorMessage(error, "Unable to load scoring queue");
      res.status(500).json({ error: message });
    }
  });

  router.post("/queue/stop", async (_req, res) => {
    try {
      await scoringQueue.stop();
      res.json({ stopped: true });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to stop scoring queue");
      res.status(500).json({ error: message });
    }
  });

  router.delete("/queue/failed", async (_req, res) => {
    try {
      await SDRScoringQueueRepository.clearFailedJobs();
      res.json({ cleared: true });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to clear failed jobs");
      res.status(500).json({ error: message });
    }
  });

  router.delete("/entities", async (_req, res) => {
    try {
      await SDRScoringRepository.clearAllEntities();
      res.status(200).json({ message: "All scoring entities removed." });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to clear scoring entities");
      res.status(500).json({ error: message });
    }
  });

  router.post("/reset", async (_req, res) => {
    try {
      await SDRScoringRepository.markAllEntitiesStale();
      await SDRScoringQueueRepository.resetQueuedJobs();
      res.json({ reset: true });
    } catch (error) {
      const message = toErrorMessage(error, "Unable to reset scoring state");
      res.status(500).json({ error: message });
    }
  });

  router.get("/entities/:entityId", async (req, res) => {
    try {
      const { entityId } = req.params;
      const detail = await SDRScoringRepository.getEntityDetail(entityId);
      if (!detail) {
        return res.status(404).json({ error: "Entity not found" });
      }
      res.json(detail);
    } catch (error) {
      const message = toErrorMessage(error, "Unable to load entity detail");
      res.status(500).json({ error: message });
    }
  });

  router.post("/scorecards", (_req, res) => {
    res.status(501).json({
      error: "Scorecard submissions are not yet enabled in the SDR skeleton.",
    });
  });

  return router;
}
