import { Router } from "express";
import { z } from "zod";
import { SDRScoringRepository } from "../../db/entities";

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

  router.delete("/entities", async (_req, res) => {
    await SDRScoringRepository.clearAllEntities();
    res.status(200).json({ message: "All scoring entities removed." });
  });

  router.post("/scorecards", (_req, res) => {
    res.status(501).json({
      error: "Scorecard submissions are not yet enabled in the SDR skeleton.",
    });
  });

  return router;
}
