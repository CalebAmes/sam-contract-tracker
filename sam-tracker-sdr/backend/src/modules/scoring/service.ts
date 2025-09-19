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
    const scorecards = await SDRScoringRepository.listScorecards();
    res.json({ data: scorecards });
  });

  router.get("/metrics", async (_req, res) => {
    const metrics = await SDRScoringRepository.listMetricDefinitions();
    res.json({ data: metrics });
  });

  router.post("/scorecards", (req, res) => {
    const parsed = submitScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    console.warn(
      "[scoring] submission received but persistence not implemented"
    );
    res.status(202).json({
      message: "Scorecard submission accepted. Persistence pending.",
      data: parsed.data,
    });
  });

  return router;
}
