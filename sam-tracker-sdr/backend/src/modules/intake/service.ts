import { Router } from "express";
import { z } from "zod";
import { SDRIntakeRepository } from "../../db/entities";
import { getIntakeDetail } from "../../db/entityDetails";

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

  router.post("/:id/notes", (_req, res) => {
    res.status(501).json({
      error: "Notes API is not yet implemented in the SDR skeleton.",
    });
  });

  return router;
}
