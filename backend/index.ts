import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import DatabaseService from "./database";
import {
  fetchSingle,
  fetchClientApi,
  previewContractClient,
  getContracts,
  getContractById,
  healthCheckHandler,
  updateContractStatus,
  updateContractFlags,
  updateContractPriority,
  updateAnalysisStatus,
  archiveContract,
  unarchiveContract,
  getContractNotes,
  addContractNote,
  updateContractNote,
  deleteContractNote,
  getContractMetrics,
  getRecentActivity,
  fetchContractAttachments,
  uploadDocuments,
  analyzeContract,
  getAnalysisProgress,
  getAnalysisHistory,
  getAnalysisVersion,
  getAnalysisNotes,
  addAnalysisNote,
  updateAnalysisNote,
  deleteAnalysisNote,
  searchFromUrl,
  searchDirect,
  addContractsFromSearch,
  checkContractsInDatabase,
} from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const db = new DatabaseService();

// Middleware
// app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log("Request body:", req.body);
  next();
});

// Global error handling middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("GLOBAL ERROR HANDLER:", err.message);
  console.error("Stack:", err.stack);
  res
    .status(500)
    .json({ error: "Internal server error", details: err.message });
});

// API Routes
app.post("/api/fetch-contract", fetchSingle(db));
app.post("/api/fetch-contract-client", fetchClientApi(db));
app.post("/api/preview-contract-client", previewContractClient(db));
app.get("/api/contracts", getContracts(db));
app.get("/api/contracts/:id", getContractById(db));

// Search routes
app.post("/api/search", searchFromUrl(db));
app.post("/api/search-direct", searchDirect(db));
app.post("/api/contracts/add-from-search", addContractsFromSearch(db));
app.post("/api/contracts/check-in-database", checkContractsInDatabase(db));
app.post("/api/contracts/:id/fetch-attachments", fetchContractAttachments(db));
app.post("/api/contracts/:id/upload-documents", ...uploadDocuments(db));
app.post("/api/contracts/:id/analyze", analyzeContract(db));
app.get("/api/contracts/:id/analysis-progress", getAnalysisProgress(db));
app.get("/api/contracts/:id/analysis-history", getAnalysisHistory(db));
app.get("/api/contracts/:id/analysis/:version", getAnalysisVersion(db));
app.get("/api/contracts/:id/analysis/:version/notes", getAnalysisNotes(db));
app.post("/api/contracts/:id/analysis/:version/notes", addAnalysisNote(db));
app.put("/api/analysis-notes/:noteId", updateAnalysisNote(db));
app.delete("/api/analysis-notes/:noteId", deleteAnalysisNote(db));

// Contract lifecycle management routes
app.put("/api/contracts/:id/status", updateContractStatus(db));
app.put("/api/contracts/:id/analysis-status", updateAnalysisStatus(db));
app.put("/api/contracts/:id/flags", updateContractFlags(db));
app.put("/api/contracts/:id/priority", updateContractPriority(db));
app.put("/api/contracts/:id/archive", archiveContract(db));
app.put("/api/contracts/:id/unarchive", unarchiveContract(db));

// Notes management routes
app.get("/api/contracts/:id/notes", getContractNotes(db));
app.post("/api/contracts/:id/notes", addContractNote(db));
app.put("/api/contracts/notes/:noteId", updateContractNote(db));
app.delete("/api/contracts/notes/:noteId", deleteContractNote(db));

// Dashboard metrics route
app.get("/api/dashboard/metrics", getContractMetrics(db));
app.get("/api/dashboard/activity", getRecentActivity(db));

app.get("/api/health", healthCheckHandler);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`SAM Contract Tracker server running on port ${PORT}`);
  const key1 = process.env.SAM_API_KEY_1;
  const key2 = process.env.SAM_API_KEY_2;
  const key3 = process.env.SAM_API_KEY_3;
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log(
    `SAM API Keys configured: ${key1 ? "Key 1: Yes" : "Key 1: No"}, ${
      key2 ? "Key 2: Yes" : "Key 2: No"
    }, ${key3 ? "Key 3: Yes" : "Key 3: No"}`
  );
  console.log(`Gemini API Key configured: ${geminiKey ? "Yes" : "No"}`);
});
