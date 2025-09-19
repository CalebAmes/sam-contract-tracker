import { Router } from "express";
import { z } from "zod";
import { SDRScoringRepository } from "../../db/entities";
import { scoringQueue } from "./queue";

const submitScoreSchema = z.object({
  opportunityId: z.string(),
  reviewer: z.string(),
  technicalFit: z.number().min(0).max(5),
  contractViability: z.number().min(0).max(5),
  competitiveness: z.number().min(0).max(5),
  summary: z.string().optional(),
});

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
    const { entityIds, authToken } =
      (req.body || {}) as { entityIds?: string[]; authToken?: string };
    const token = authToken?.trim();
    if (!token) {
      return res.status(400).json({ error: "authToken is required" });
    }
    const result = await scoringQueue.enqueue(entityIds, token);
    const jobs = result.jobs.map(({ authToken: _token, ...rest }) => rest);
    res.json({ requested: result.requested, jobs });
  });

  router.get("/queue", async (_req, res) => {
    const state = await scoringQueue.getState();
    res.json(state);
  });

  router.delete("/entities", async (_req, res) => {
    await SDRScoringRepository.clearAllEntities();
    res.status(200).json({ message: "All scoring entities removed." });
  });

  router.get("/entities/:entityId", async (req, res) => {
    const { entityId } = req.params;
    const detail = await SDRScoringRepository.getEntityDetail(entityId);
    if (!detail) {
      return res.status(404).json({ error: "Entity not found" });
    }
    res.json(detail);
  });

  router.post("/scorecards", (_req, res) => {
    res.status(501).json({
      error: "Scorecard submissions are not yet enabled in the SDR skeleton.",
    });
  });

  return router;
}
