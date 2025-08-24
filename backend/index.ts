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
  getContractNavigation,
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
  addToWaitlist,
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
  createChatSession,
  listChatSessions,
  getChatMessages,
  sendChatMessage,
  streamChatMessage,
  continueChatMessage,
  setChatMessageFeedback,
  ingestSolicitation,
  solicitationStatus,
} from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const db = new DatabaseService();

// CORS configuration for VPN and local access
const corsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // List of allowed origins
    const defaultOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://spicymini:3000",
      "http://spicymini:3001",
      "http://spicymini:4333", // Production React server
      "http://localhost:4333", // Local testing on prod port
    ];

    // Add any additional origins from environment variable
    const envOrigins = process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : [];

    const allowedOrigins = [...defaultOrigins, ...envOrigins];

    // Check if the origin matches any allowed pattern
    const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

    // Also allow any origin that matches your VPN subnet (example)
    // Adjust this regex to match your VPN IP range
    const vpnPattern =
      /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
    const isVpnOrigin = vpnPattern.test(origin);

    // Allow if explicitly listed or from VPN
    if (isAllowed || isVpnOrigin) {
      callback(null, true);
    } else {
      // In development, log rejected origins to help debugging
      if (process.env.NODE_ENV === "development") {
        console.log("CORS: Rejected origin:", origin);
      }
      // For production, you might want to be more permissive or restrictive
      // For now, allow all origins but log them
      console.log("CORS: Allowing origin:", origin);
      callback(null, true);
    }
  },
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

// Middleware
app.use(cors(corsOptions));
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
app.get("/api/contracts/:id/navigation", getContractNavigation(db));

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

// Marketing / waitlist route
app.post("/api/waitlist", addToWaitlist(db));

// Chat routes
app.post("/api/chat/sessions", createChatSession(db));
app.get("/api/chat/sessions/:contractId", listChatSessions(db));
app.get("/api/chat/messages/:sessionId", getChatMessages(db));
app.post("/api/chat/messages/:sessionId", sendChatMessage(db));
app.post("/api/chat/stream/:sessionId", streamChatMessage(db));
app.post("/api/chat/continue/:sessionId", continueChatMessage(db));
app.post("/api/chat/messages/:messageId/feedback", setChatMessageFeedback(db));

// Solicitation context routes
app.get("/api/solicitations/:solicitationId/status", solicitationStatus(db));
app.post("/api/solicitations/:solicitationId/ingest", ingestSolicitation(db));

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
