import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createIntakeRouter } from "./src/modules/intake/service";
import { createScoringRouter } from "./src/modules/scoring/service";

dotenv.config();

const app = express();
const PORT = process.env.SDR_PORT || 4301;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "sam-tracker-sdr" });
});

app.use("/api/intake", createIntakeRouter());
app.use("/api/scoring", createScoringRouter());

app.listen(PORT, () => {
  console.log(`SAM Tracker SDR API listening on port ${PORT}`);
});
