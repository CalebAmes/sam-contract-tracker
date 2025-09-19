import { Router } from "express";
import { z } from "zod";
import { SDRIntakeRepository } from "../../db/entities";
import { getIntakeDetail } from "../../db/entityDetails";
import { fetchRecentAwards } from "../../services/intakeFetcher";

const createOpportunitySchema = z.object({
  title: z.string(),
  solicitationNumber: z.string().min(1),
  agency: z.string(),
  naics: z.string().optional(),
  postedDate: z.string().optional(),
  responseDate: z.string().optional(),
});

export function createIntakeRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const items = await SDRIntakeRepository.list();
    res.json({ data: items });
  });

  router.get("/:id", async (req, res) => {
    const detail = await getIntakeDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: "Intake opportunity not found" });
    }
    res.json({ data: detail });
  });

  router.post("/", async (req, res) => {
    const parsed = createOpportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    console.warn(
      "[intake] create endpoint invoked but persistence not implemented"
    );
    res.status(202).json({
      message: "Request accepted. Persistence layer not implemented in skeleton.",
      data: parsed.data,
    });
  });

  router.post("/fetch", async (_req, res) => {
    try {
      const summary = await fetchRecentAwards();
      console.log("[intake] /api/intake/fetch summary", summary);
      res.status(200).json({
        message: "SAM intake fetch completed.",
        summary,
      });
    } catch (error: any) {
      console.error("[intake] fetch failed", error);
      res.status(500).json({
        error: "Failed to fetch recent awards from SAM.gov",
        details: error?.message ?? String(error),
      });
    }
  });

  router.post("/fetch/latest", async (_req, res) => {
    try {
      const summary = await fetchRecentAwards({ limit: 5 });
      console.log("[intake] /api/intake/fetch latest summary", summary);
      res.status(200).json({
        message: "Fetched the latest 5 SAM awards.",
        summary,
      });
    } catch (error: any) {
      console.error("[intake] fetch latest failed", error);
      res.status(500).json({
        error: "Failed to fetch the latest awards from SAM.gov",
        details: error?.message ?? String(error),
      });
    }
  });

  router.delete("/", async (_req, res) => {
    await SDRIntakeRepository.clearAllAwards();
    res.status(200).json({ message: "All intake awards removed." });
  });

  router.post("/:id/notes", (_req, res) => {
    res.status(501).json({
      error: "Notes API is not yet implemented in the SDR skeleton.",
    });
  });

  return router;
}
