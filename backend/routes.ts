import { NextFunction, Request, RequestHandler, Response } from "express";
import DatabaseService from "./database";
import { fetchSingleOpportunity } from "./src/services/samApi";
import { ClientApiParser } from "./src/services/clientApiParser";
import SAMSearchService, { SearchFilters } from "./src/services/samSearch";
import axios from "axios";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { FileConverter } from "./src/services/fileConverter";
import { AnalysisStatus } from "./database";
import { GeminiAnalyzer, GeminiModel } from "./src/services/geminiAnalyzer";
import GeminiChatService, { GeminiChatModel } from "./src/services/geminiChat";
import crypto from "crypto";

// Simple helper to hash IP-like strings without bringing crypto heavy deps
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return `h${Math.abs(hash)}`;
}

// Chat-specific system prompt (separate from analysis prompt)
const CHAT_SYSTEM_PROMPT = `You are a contracts analyst for U.S. government solicitations.
  Your job: analyze VAR and small business set-aside opportunities, and draft outputs grounded in the provided solicitation text.
  Rules:
  - Always use actual details from context (POC names, emails, solicitation numbers, dates, requirements).
  - Do not generate placeholders like [POC Name] unless the information is genuinely missing.
  - If information is missing, say so in one short sentence before providing the draft.
  - Drafts must be professional, concise, and directly usable.`;

// Build chat context parts (duplicate of analyzer logic but with chat system prompt)
async function buildChatContextParts(
  contractData: any,
  filePaths: string[]
): Promise<any[]> {
  const today = new Date().toISOString().split("T")[0];
  const parts: any[] = [
    {
      text: `${CHAT_SYSTEM_PROMPT}\n\nContract Information:\nTitle: ${
        contractData?.title || "Unknown"
      }\nOrganization: ${
        contractData?.organizationId || "Unknown"
      }\nPosted Date: ${contractData?.postedDate || ""}\nDeadline: ${
        contractData?.deadline || ""
      }\nDescription: ${
        contractData?.description || "No description"
      }\nSet Aside: ${contractData?.setAside || "Unknown"}\nClassification: ${
        contractData?.classificationCode || "Unknown"
      }\nCurrent date: ${today}`,
    },
  ];

  const convertedFiles: Array<{ convertedPath: string }> = [];
  try {
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      let actualFilePath = filePath;
      let mimeType = FileConverter.getMimeType(filePath);
      if (!FileConverter.isSupportedByGemini(mimeType)) {
        const converted = await FileConverter.convertFile(filePath);
        if (converted) {
          convertedFiles.push(converted);
          actualFilePath = converted.convertedPath;
          mimeType = converted.convertedMimeType;
        }
      }
      const data = await fs.readFile(actualFilePath);
      parts.push({
        inline_data: { mime_type: mimeType, data: data.toString("base64") },
      });
    }
  } finally {
    if (convertedFiles.length > 0) {
      await FileConverter.cleanupConversions(convertedFiles as any);
    }
  }
  return parts;
}

// Local helper to send contents to Gemini
async function sendGeminiContents(
  contents: Array<{ role: string; parts: any[] }>,
  apiKey: string,
  model: GeminiChatModel
): Promise<string> {
  const endpoint = ((): string => {
    const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
    const map: Record<string, string> = {
      "2.0-flash": "gemini-2.0-flash",
      "2.5-flash": "gemini-2.5-flash",
      "2.5-pro": "gemini-2.5-pro",
    };
    return `${BASE}/${map[model]}:generateContent`;
  })();
  const generationConfig = {
    temperature: 0.2,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 10000,
  };
  const resp = await axios.post(
    `${endpoint}?key=${apiKey}`,
    {
      contents,
      generationConfig,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
    },
    { headers: { "Content-Type": "application/json" } }
  );
  const candidate = (resp.data?.candidates || [])[0];
  const text: string | undefined = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Invalid Gemini response");
  if (text.includes("```")) {
    const m = text.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
    return m?.[1] || text;
  }
  return text;
}
export const addToWaitlist =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { email, samUrl, source } = req.body || {};
      if (
        !email ||
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      const userAgent = req.headers["user-agent"] || "";
      const ip =
        (req.headers["x-forwarded-for"] as string) ||
        req.socket.remoteAddress ||
        "";
      const ipHash = ip
        ? simpleHash(Array.isArray(ip) ? ip[0] : ip)
        : undefined;
      await db.addToWaitlist({ email, samUrl, source, userAgent, ipHash });
      return res.json({ ok: true });
    } catch (err: any) {
      if (err?.message?.includes("UNIQUE constraint failed")) {
        return res.json({ ok: true, duplicate: true });
      }
      console.error("Waitlist error:", err);
      return res.status(500).json({ error: "Failed to join waitlist" });
    }
  };

// Helper function to download attachments
async function downloadAttachments(
  attachments: any[],
  downloadDir: string
): Promise<string[]> {
  const downloadedFiles: string[] = [];

  // Ensure download directory exists
  await fs.mkdir(downloadDir, { recursive: true });

  // Get session tokens from environment variables
  const sessionTokens = {
    session: process.env.CLIENT_API_SESSION,
    xsrfToken: process.env.CLIENT_API_XSRF_TOKEN,
    authToken: process.env.CLIENT_API_AUTH_TOKEN,
    cookies: process.env.CLIENT_API_COOKIES,
  };

  for (const attachment of attachments) {
    try {
      console.log(`Downloading attachment: ${attachment.name}`);
      // Create a safe filename and absolute path
      const safeFilename = attachment.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = path.join(downloadDir, safeFilename);

      // If file already exists in tmp dir, reuse it (no re-download)
      try {
        await fs.access(filePath);
        downloadedFiles.push(filePath);
        console.log(`Reusing existing file: ${attachment.name}`);
        continue;
      } catch {}

      const response = await axios.get(attachment.url, {
        responseType: "stream",
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "sec-ch-ua":
            '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          referer: "https://sam.gov/",
          ...(sessionTokens.cookies && { cookie: sessionTokens.cookies }),
          ...(sessionTokens.authToken && {
            "x-auth-token": sessionTokens.authToken,
          }),
        },
      });

      if (response.status === 200) {
        // Create write stream and pipe the response
        const writer = createWriteStream(filePath);
        response.data.pipe(writer);

        // Wait for the download to complete
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        downloadedFiles.push(filePath);
        console.log(`Successfully downloaded: ${attachment.name}`);
      } else {
        console.error(
          `Failed to download ${attachment.name}: HTTP ${response.status}`
        );
        throw new Error(
          `Failed to download ${attachment.name}: HTTP ${response.status}`
        );
      }
    } catch (error) {
      console.error(`Error downloading attachment ${attachment.name}:`, error);
      throw new Error(
        `Failed to download attachment ${attachment.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return downloadedFiles;
}

export const fetchSingle =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { opportunityId } = req.body;

      if (!opportunityId) {
        console.error("400 - No opportunity ID provided");
        return res.status(400).json({ error: "No opportunity ID provided" });
      }

      const contractData = await fetchSingleOpportunity(opportunityId);
      res.json(contractData);
    } catch (error: any) {
      if (error.response) {
        console.error(
          `${error.response.status} - SAM API Error:`,
          error.response.data
        );
        res.status(error.response.status).json({ error: error.response.data });
      } else {
        console.error("500 - Error:", error.message);
        res.status(500).json({ error: error.message });
      }
    }
  };

export const fetchClientApi =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { opportunityId } = req.body;

      if (!opportunityId) {
        console.error("400 - No opportunity ID provided");
        return res.status(400).json({ error: "No opportunity ID provided" });
      }

      const clientApiUrl = `https://sam.gov/api/prod/opps/v2/opportunities/${opportunityId}`;
      console.log(`Fetching from client API: ${clientApiUrl}`);

      // Get session tokens from environment variables
      const sessionTokens = {
        session: process.env.CLIENT_API_SESSION,
        xsrfToken: process.env.CLIENT_API_XSRF_TOKEN,
        authToken: process.env.CLIENT_API_AUTH_TOKEN,
        cookies: process.env.CLIENT_API_COOKIES,
      };

      const response = await axios.get(clientApiUrl, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "sec-ch-ua":
            '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          referer: `https://sam.gov/opp/${opportunityId}/view`,
          ...(sessionTokens.cookies && { cookie: sessionTokens.cookies }),
          ...(sessionTokens.authToken && {
            "x-auth-token": sessionTokens.authToken,
          }),
        },
        params: {
          random: Date.now(), // Add random parameter like the client does
        },
      });

      if (response.status !== 200) {
        console.error(`${response.status} - SAM.gov client API error`);
        return res
          .status(response.status)
          .json({ error: `SAM.gov client API returned ${response.status}` });
      }

      const apiResponse = response.data;
      const fetchDurationMs = Date.now() - startTime;
      console.log(
        `Successfully fetched from client API in ${fetchDurationMs}ms`
      );

      // Validate the API response
      if (!ClientApiParser.validateApiResponse(apiResponse)) {
        console.error("Invalid API response structure");
        return res
          .status(500)
          .json({ error: "Invalid API response structure" });
      }

      // Parse the contract data
      const parsedData = ClientApiParser.extractAllData(
        apiResponse,
        opportunityId,
        "client-api",
        fetchDurationMs
      );
      const contract = parsedData.contract;
      const metadata = parsedData.metadata;

      // Fetch attachments using the correct v3 resources endpoint
      const attachments = await ClientApiParser.fetchAttachmentsFromClientApi(
        opportunityId,
        sessionTokens
      );
      console.log(`Fetched ${attachments.length} attachments`);

      // Update contract with attachments
      contract.attachments = attachments;

      // Save to database
      try {
        await db.saveContract(contract);

        // Save attachments to database
        for (const attachment of attachments) {
          await db.saveAttachment(attachment, contract.id);
        }

        console.log(`Contract ${opportunityId} saved to database`);
      } catch (dbError) {
        console.error("Database save error:", dbError);
        // Continue and return the data even if database save fails
      }

      res.json({
        contract: contract,
        metadata: metadata,
        attachments: attachments,
        fetchedAt: new Date().toISOString(),
        method: "client-api",
        attachmentSource: attachments.length > 0 ? "client-api" : "none",
      });
    } catch (error: any) {
      if (error.response) {
        console.error(
          `${error.response.status} - SAM.gov client API error:`,
          error.response.statusText
        );
        res.status(error.response.status).json({
          error: `SAM.gov client API failed: ${error.response.statusText}`,
        });
      } else {
        console.error("500 - Client API error:", error.message);
        res.status(500).json({ error: error.message });
      }
    }
  };

// Preview contract from SAM.gov client API without saving to database
export const previewContractClient =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { opportunityId } = req.body;

      if (!opportunityId) {
        console.error("400 - No opportunity ID provided");
        return res.status(400).json({ error: "No opportunity ID provided" });
      }

      const clientApiUrl = `https://sam.gov/api/prod/opps/v2/opportunities/${opportunityId}`;
      console.log(`Previewing from client API: ${clientApiUrl}`);

      // Get session tokens from environment variables
      const sessionTokens = {
        session: process.env.CLIENT_API_SESSION,
        xsrfToken: process.env.CLIENT_API_XSRF_TOKEN,
        authToken: process.env.CLIENT_API_AUTH_TOKEN,
        cookies: process.env.CLIENT_API_COOKIES,
      };

      const response = await axios.get(clientApiUrl, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "sec-ch-ua":
            '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          referer: `https://sam.gov/opp/${opportunityId}/view`,
          ...(sessionTokens.cookies && { cookie: sessionTokens.cookies }),
          ...(sessionTokens.authToken && {
            "x-auth-token": sessionTokens.authToken,
          }),
        },
        params: {
          random: Date.now(), // Add random parameter like the client does
        },
      });

      if (response.status !== 200) {
        console.error(`${response.status} - SAM.gov client API error`);
        return res
          .status(response.status)
          .json({ error: `SAM.gov client API returned ${response.status}` });
      }

      const apiResponse = response.data;
      const fetchDurationMs = Date.now() - startTime;
      console.log(
        `Successfully fetched from client API in ${fetchDurationMs}ms`
      );

      // Validate the API response
      if (!ClientApiParser.validateApiResponse(apiResponse)) {
        console.error("Invalid API response structure");
        return res
          .status(500)
          .json({ error: "Invalid API response structure" });
      }

      // Parse the contract data
      const parsedData = ClientApiParser.extractAllData(
        apiResponse,
        opportunityId,
        "client-api",
        fetchDurationMs
      );
      const contract = parsedData.contract;
      const metadata = parsedData.metadata;

      // Fetch attachments using the correct v3 resources endpoint
      const attachments = await ClientApiParser.fetchAttachmentsFromClientApi(
        opportunityId,
        sessionTokens
      );
      console.log(`Fetched ${attachments.length} attachments`);

      // Update contract with attachments
      contract.attachments = attachments;

      // Return preview data WITHOUT saving to database
      res.json({
        contract: contract,
        metadata: metadata,
        attachments: attachments,
        fetchedAt: new Date().toISOString(),
        method: "client-api",
        attachmentSource: attachments.length > 0 ? "client-api" : "none",
        preview: true, // Flag to indicate this is preview data
      });
    } catch (error: any) {
      if (error.response) {
        console.error(
          `${error.response.status} - SAM.gov client API error:`,
          error.response.statusText
        );
        res.status(error.response.status).json({
          error: `SAM.gov client API failed: ${error.response.statusText}`,
        });
      } else {
        console.error("500 - Client API preview error:", error.message);
        res.status(500).json({ error: error.message });
      }
    }
  };

export const getContracts =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const contracts = await db.getContracts(limit);

      res.json({
        contracts: contracts.slice(offset, offset + limit),
        total: contracts.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error("500 - Error fetching contracts:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getContractNavigation =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - No contract ID provided");
        return res.status(400).json({ error: "No contract ID provided" });
      }

      // Get all contract IDs in order
      const contractIds = await db.getContractIds();

      // Find current contract index
      const currentIndex = contractIds.findIndex((cid) => cid === id);

      if (currentIndex === -1) {
        console.error(`404 - Contract not found in navigation: ${id}`);
        return res.status(404).json({ error: "Contract not found" });
      }

      // Calculate previous and next IDs
      const previousId =
        currentIndex > 0 ? contractIds[currentIndex - 1] : null;
      const nextId =
        currentIndex < contractIds.length - 1
          ? contractIds[currentIndex + 1]
          : null;

      res.json({
        currentId: id,
        previousId,
        nextId,
        currentIndex: currentIndex + 1, // 1-based index for display
        totalContracts: contractIds.length,
      });
    } catch (error: any) {
      console.error("500 - Error fetching contract navigation:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getContractById =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - No contract ID provided");
        return res.status(400).json({ error: "No contract ID provided" });
      }

      const contract = await db.getContract(id);

      if (!contract) {
        console.error(`404 - Contract not found: ${id}`);
        return res.status(404).json({ error: "Contract not found" });
      }

      // Increment view count
      await db.incrementViewCount(id);

      res.json({ contract });
    } catch (error: any) {
      console.error("500 - Error fetching contract:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

// Contract lifecycle management endpoints

export const updateContractStatus =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || !status) {
        console.error("400 - Contract ID and status are required");
        return res
          .status(400)
          .json({ error: "Contract ID and status are required" });
      }

      await db.updateContractStatus(id, status);

      res.json({ message: "Contract status updated successfully" });
    } catch (error: any) {
      console.error("500 - Error updating contract status:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const updateContractFlags =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { flags } = req.body;

      if (!id || !Array.isArray(flags)) {
        console.error("400 - Contract ID and flags array are required");
        return res
          .status(400)
          .json({ error: "Contract ID and flags array are required" });
      }

      await db.updateContractFlags(id, flags);

      res.json({ message: "Contract flags updated successfully" });
    } catch (error: any) {
      console.error("500 - Error updating contract flags:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const updateContractPriority =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      if (!id || !priority) {
        console.error("400 - Contract ID and priority are required");
        return res
          .status(400)
          .json({ error: "Contract ID and priority are required" });
      }

      await db.updateContractPriority(id, priority);

      res.json({ message: "Contract priority updated successfully" });
    } catch (error: any) {
      console.error("500 - Error updating contract priority:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const archiveContract =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      await db.archiveContract(id);

      res.json({ message: "Contract archived successfully" });
    } catch (error: any) {
      console.error("500 - Error archiving contract:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const unarchiveContract =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      await db.unarchiveContract(id);

      res.json({ message: "Contract unarchived successfully" });
    } catch (error: any) {
      console.error("500 - Error unarchiving contract:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

// Notes management endpoints

export const getContractNotes =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      const notes = await db.getContractNotes(id);

      res.json({ notes });
    } catch (error: any) {
      console.error("500 - Error fetching contract notes:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const addContractNote =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { content, type } = req.body;

      if (!id || !content || !type) {
        console.error("400 - Contract ID, content, and type are required");
        return res
          .status(400)
          .json({ error: "Contract ID, content, and type are required" });
      }

      const note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        contractId: id,
        content,
        type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.addContractNote(note);

      res.json({ note, message: "Note added successfully" });
    } catch (error: any) {
      console.error("500 - Error adding contract note:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const updateContractNote =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { noteId } = req.params;
      const { content } = req.body;

      if (!noteId || !content) {
        console.error("400 - Note ID and content are required");
        return res
          .status(400)
          .json({ error: "Note ID and content are required" });
      }

      await db.updateContractNote(noteId, content);

      res.json({ message: "Note updated successfully" });
    } catch (error: any) {
      console.error("500 - Error updating contract note:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const deleteContractNote =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { noteId } = req.params;

      if (!noteId) {
        console.error("400 - Note ID is required");
        return res.status(400).json({ error: "Note ID is required" });
      }

      await db.deleteContractNote(noteId);

      res.json({ message: "Note deleted successfully" });
    } catch (error: any) {
      console.error("500 - Error deleting contract note:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

// Dashboard metrics endpoint

export const getContractMetrics =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const metrics = await db.getContractMetrics();

      res.json({ metrics });
    } catch (error: any) {
      console.error("500 - Error fetching contract metrics:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getRecentActivity =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const activities = await db.getRecentActivity(limit);

      res.json({ activities });
    } catch (error: any) {
      console.error("500 - Error fetching recent activity:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const fetchContractAttachments =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      // First, get the contract to make sure it exists
      const contract = await db.getContract(id);
      if (!contract) {
        console.error(`404 - Contract not found: ${id}`);
        return res.status(404).json({ error: "Contract not found" });
      }

      // Get session tokens from environment variables
      const sessionTokens = {
        session: process.env.CLIENT_API_SESSION,
        xsrfToken: process.env.CLIENT_API_XSRF_TOKEN,
        authToken: process.env.CLIENT_API_AUTH_TOKEN,
        cookies: process.env.CLIENT_API_COOKIES,
      };

      // Fetch attachments using the v3 client API
      const attachments = await ClientApiParser.fetchAttachmentsFromClientApi(
        id,
        sessionTokens
      );
      console.log(`Fetched ${attachments.length} attachments for retry`);

      // Save attachments to database
      for (const attachment of attachments) {
        await db.saveAttachment(attachment, id);
      }

      console.log(
        `Fetched and saved ${attachments.length} attachments for contract ${id}`
      );

      // Update contract with new attachments
      const updatedContract = await db.getContract(id);

      res.json({
        attachments,
        message: `Successfully fetched ${attachments.length} attachments`,
        contract: updatedContract,
      });
    } catch (error: any) {
      console.error(
        "500 - Error fetching contract attachments:",
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  };

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const contractId = req.params.id;
    const uploadDir = path.join(
      __dirname,
      "uploads",
      "tmp",
      "contract-analysis",
      contractId
    );

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    const uniqueFilename = `${basename}-${timestamp}${extension}`;
    cb(null, uniqueFilename);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, DOC, DOCX, XLSX, and TXT files are allowed."
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
});

type UploadDocumentsMiddleware = [
  RequestHandler,
  (req: Request, res: Response, next: NextFunction) => Promise<void>
];

export const uploadDocuments: (
  db: DatabaseService
) => UploadDocumentsMiddleware = (db) => [
  upload.single("document"),
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        res.status(400).json({ error: "Contract ID is required" });
        return;
      }

      if (!req.file) {
        console.error("400 - No file uploaded");
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const contract = await db.getContract(id);
      if (!contract) {
        console.error(`404 - Contract not found: ${id}`);
        res.status(404).json({ error: "Contract not found" });
        return;
      }

      console.log(`File uploaded for contract ${id}: ${req.file.filename}`);

      res.json({
        message: "Document uploaded successfully",
        file: {
          id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          type: req.file.mimetype,
          path: req.file.path,
        },
      });
    } catch (error: any) {
      console.error("500 - Error uploading document:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
];

export const updateAnalysisStatus =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { analysisStatus } = req.body;

      if (!id || !analysisStatus) {
        console.error("400 - Contract ID and analysis status are required");
        return res
          .status(400)
          .json({ error: "Contract ID and analysis status are required" });
      }

      await db.updateAnalysisStatus(id, analysisStatus);

      res.json({ message: "Analysis status updated successfully" });
    } catch (error: any) {
      console.error("500 - Error updating analysis status:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getAnalysisProgress =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      const progress = await db.getAnalysisProgress(id);

      res.json({
        progress: progress || { progress: 0, message: "Starting analysis..." },
      });
    } catch (error: any) {
      console.error("500 - Error getting analysis progress:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getAnalysisHistory =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      const history = await db.getAnalysisHistory(id);

      res.json({ history });
    } catch (error: any) {
      console.error("500 - Error getting analysis history:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getAnalysisVersion =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id, version } = req.params;

      if (!id || !version) {
        console.error("400 - Contract ID and version are required");
        return res
          .status(400)
          .json({ error: "Contract ID and version are required" });
      }

      const analysis = await db.getAIAnalysis(id, parseInt(version));

      if (!analysis) {
        console.error(
          `404 - Analysis version ${version} not found for contract ${id}`
        );
        return res.status(404).json({ error: "Analysis version not found" });
      }

      res.json({ analysis });
    } catch (error: any) {
      console.error("500 - Error getting analysis version:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

// Analysis Notes routes
export const getAnalysisNotes =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id, version } = req.params;

      if (!id || !version) {
        console.error("400 - Contract ID and version are required");
        return res
          .status(400)
          .json({ error: "Contract ID and version are required" });
      }

      const notes = await db.getAnalysisNotes(id, parseInt(version));

      res.json({ notes });
    } catch (error: any) {
      console.error("500 - Error getting analysis notes:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const addAnalysisNote =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id, version } = req.params;
      const { content, type } = req.body;

      if (!id || !version || !content) {
        console.error("400 - Contract ID, version, and content are required");
        return res
          .status(400)
          .json({ error: "Contract ID, version, and content are required" });
      }

      const note = {
        id: `analysis-note-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        contractId: id,
        analysisVersion: parseInt(version),
        content,
        type: type || "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.addAnalysisNote(note);

      res.json({ note });
    } catch (error: any) {
      console.error("500 - Error adding analysis note:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const updateAnalysisNote =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { noteId } = req.params;
      const { content } = req.body;

      if (!noteId || !content) {
        console.error("400 - Note ID and content are required");
        return res
          .status(400)
          .json({ error: "Note ID and content are required" });
      }

      await db.updateAnalysisNote(noteId, content);

      res.json({ message: "Analysis note updated successfully" });
    } catch (error: any) {
      console.error("500 - Error updating analysis note:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const deleteAnalysisNote =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { noteId } = req.params;

      if (!noteId) {
        console.error("400 - Note ID is required");
        return res.status(400).json({ error: "Note ID is required" });
      }

      await db.deleteAnalysisNote(noteId);

      res.json({ message: "Analysis note deleted successfully" });
    } catch (error: any) {
      console.error("500 - Error deleting analysis note:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const analyzeContract =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { uploadedFiles, bypassAttachments, selectedModel } = req.body;

      if (!id) {
        console.error("400 - Contract ID is required");
        return res.status(400).json({ error: "Contract ID is required" });
      }

      // Verify contract exists
      const contract = await db.getContract(id);
      if (!contract) {
        console.error(`404 - Contract not found: ${id}`);
        return res.status(404).json({ error: "Contract not found" });
      }

      // Default to 2.0-flash if no model specified
      const model: GeminiModel = selectedModel || "2.0-flash";

      // Update contract status to IN_PROGRESS
      await db.updateContractAnalysisStatus(id, AnalysisStatus.IN_PROGRESS);
      await db.updateAnalysisProgress(id, 5, "Initializing analysis...");
      console.log(
        `Started analysis for contract ${id}, model: ${model}, bypassAttachments: ${bypassAttachments}`
      );

      // Start async analysis process
      (async () => {
        const uploadDir = path.join(
          __dirname,
          "uploads",
          "tmp",
          "contract-analysis",
          id
        );

        try {
          // Get uploaded file paths
          let uploadedFilePaths: string[] = [];

          await db.updateAnalysisProgress(
            id,
            10,
            "Locating uploaded documents..."
          );

          try {
            const files = await fs.readdir(uploadDir);
            uploadedFilePaths = files.map((file) => path.join(uploadDir, file));
            console.log(
              `Found ${uploadedFilePaths.length} uploaded files for contract ${id}`
            );
            await db.updateAnalysisProgress(
              id,
              15,
              `Found ${uploadedFilePaths.length} document${
                uploadedFilePaths.length !== 1 ? "s" : ""
              } to analyze`
            );
          } catch (dirError) {
            console.log(
              `No uploaded files found for contract ${id} - directory may not exist`
            );
          }

          // Use shared helper for document gathering
          const attachmentFilePaths = await getDocumentFilePaths(
            db,
            contract,
            bypassAttachments,
            uploadDir
          );
          if (attachmentFilePaths.length > 0) {
            await db.updateAnalysisProgress(
              id,
              22,
              `Using ${attachmentFilePaths.length} documents`
            );
          } else if (bypassAttachments) {
            await db.updateAnalysisProgress(
              id,
              20,
              "Bypassing attachment downloads..."
            );
          } else {
            await db.updateAnalysisProgress(id, 20, "No documents available");
          }

          // Combine uploaded files and downloaded/cached attachments
          const allFilePaths = [...uploadedFilePaths, ...attachmentFilePaths];
          console.log(
            `Total files for analysis: ${allFilePaths.length} (${uploadedFilePaths.length} uploaded, ${attachmentFilePaths.length} attachments)`
          );

          if (allFilePaths.length === 0) {
            console.error(`No files available for analysis for contract ${id}`);
            await db.updateContractAnalysisStatus(id, AnalysisStatus.FAILED);
            await db.updateAnalysisProgress(
              id,
              0,
              "No documents available for analysis"
            );
            return;
          }

          // Use Gemini API if configured, otherwise use mock data
          let analysisResult;

          if (process.env.GEMINI_API_KEY) {
            console.log(
              `Starting Gemini analysis for contract ${id} with ${allFilePaths.length} documents`
            );
            await db.updateAnalysisProgress(
              id,
              30,
              "Connecting to Gemini AI service..."
            );

            try {
              await db.updateAnalysisProgress(
                id,
                40,
                "Uploading documents to Gemini..."
              );
              const geminiAnalysis = await GeminiAnalyzer.analyzeContract(
                contract,
                allFilePaths,
                process.env.GEMINI_API_KEY!,
                async (progress, message) => {
                  // Progress callback
                  await db.updateAnalysisProgress(id, progress, message);
                },
                model
              );

              await db.updateAnalysisProgress(
                id,
                90,
                "Processing analysis results..."
              );

              // Convert Gemini analysis to our database format
              analysisResult = {
                wrapperScore: geminiAnalysis.wrapperScore,
                contractType: geminiAnalysis.contractType,
                summary: geminiAnalysis.summary,
                redFlags: geminiAnalysis.redFlags,
                incumbentInfo: geminiAnalysis.incumbentInfo,
                recommendedAction: geminiAnalysis.recommendedAction,
                keyDates: geminiAnalysis.keyDates,
                estimatedValue: geminiAnalysis.estimatedValue,
                competitionLevel: geminiAnalysis.competitionLevel,
                competitionNotes: geminiAnalysis.competitionNotes,
                aiModel: model,
                analyzedAt: new Date().toISOString(),
              };
            } catch (geminiError) {
              // Log cleaner error message for Gemini API errors
              if (
                axios.isAxiosError(geminiError) &&
                geminiError.response?.data?.error
              ) {
                const apiError = geminiError.response.data.error;
                console.error(
                  `Gemini API error for contract ${id}:`,
                  `\n  Status: ${geminiError.response.status}`,
                  `\n  Message: ${apiError.message || apiError}`,
                  apiError.code ? `\n  Code: ${apiError.code}` : ""
                );
              } else {
                console.error(
                  `Gemini analysis failed for contract ${id}:`,
                  geminiError instanceof Error
                    ? geminiError.message
                    : geminiError
                );
              }
              throw geminiError;
            }
          } else {
            console.log(
              `Using mock analysis for contract ${id} (no GEMINI_API_KEY configured)`
            );

            // Simulate progress updates for mock analysis
            await db.updateAnalysisProgress(
              id,
              30,
              "Starting mock analysis..."
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));

            await db.updateAnalysisProgress(
              id,
              50,
              "Processing contract data..."
            );
            await new Promise((resolve) => setTimeout(resolve, 1500));

            await db.updateAnalysisProgress(
              id,
              70,
              "Analyzing wrapper indicators..."
            );
            await new Promise((resolve) => setTimeout(resolve, 1500));

            await db.updateAnalysisProgress(
              id,
              85,
              "Generating recommendations..."
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));

            await db.updateAnalysisProgress(id, 90, "Finalizing analysis...");

            // Mock analysis results
            analysisResult = {
              wrapperScore: Math.floor(Math.random() * 100),
              contractType: "Unknown",
              summary:
                "This is a mock analysis. Configure GEMINI_API_KEY to enable real AI analysis.",
              redFlags: [
                {
                  flag: "Mock Flag",
                  detail: "This is mock data",
                  severity: "low",
                },
              ],
              incumbentInfo: {
                vendor: null,
                contractNumber: null,
                expirationDate: null,
              },
              recommendedAction: "Configure Gemini API for real analysis",
              keyDates: {
                currentDeadline: contract.deadline,
                contractStart: new Date(
                  new Date(contract.deadline).getTime() + 86400000
                )
                  .toISOString()
                  .split("T")[0],
                urgencyLevel: "medium",
              },
              estimatedValue: "Unknown",
              competitionLevel: "medium",
              competitionNotes: "Mock analysis - no real assessment available",
              aiModel: model,
              analyzedAt: new Date().toISOString(),
            };
          }

          // Prepare document list
          const documentsAnalyzed: Array<{ filename: string; type: string }> =
            [];

          // Add attachments info from DB if available
          if (contract.attachments && contract.attachments.length > 0) {
            (contract.attachments || []).forEach((attachment: any) => {
              documentsAnalyzed.push({
                filename: attachment.name,
                type: attachment.type,
              });
            });
          }

          // Update contract with analysis results
          await db.updateAnalysisProgress(id, 95, "Saving analysis results...");
          await db.updateContractAnalysis(
            id,
            analysisResult,
            documentsAnalyzed
          );
          await db.updateContractAnalysisStatus(id, AnalysisStatus.COMPLETED);
          await db.updateAnalysisProgress(id, 100, "Analysis complete!");

          // Do not delete tmp docs; keep for reuse

          console.log(`Analysis completed for contract ${id}`);
        } catch (error) {
          // Extract meaningful error information
          let errorMessage = "Unknown error";
          let errorDetails = "";

          if (axios.isAxiosError(error)) {
            errorMessage = `API Error: ${
              error.response?.status || "Unknown status"
            }`;

            // Extract the actual error message from Gemini API response
            if (error.response?.data?.error) {
              const apiError = error.response.data.error;
              errorDetails = `\n  Message: ${apiError.message || apiError}`;
              if (apiError.code) {
                errorDetails += `\n  Code: ${apiError.code}`;
              }
              if (apiError.status) {
                errorDetails += `\n  Status: ${apiError.status}`;
              }
            } else if (error.response?.statusText) {
              errorDetails = `\n  Status Text: ${error.response.statusText}`;
            }

            // Add request details for debugging
            if (error.config?.url) {
              errorDetails += `\n  URL: ${error.config.url}`;
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
            // Only include stack trace in development
            if (process.env.NODE_ENV === "development") {
              errorDetails = `\n  Stack: ${error.stack
                ?.split("\n")
                .slice(0, 3)
                .join("\n  ")}`;
            }
          }

          console.error(
            `Error completing analysis for contract ${id}: ${errorMessage}${errorDetails}`
          );
          await db.updateContractAnalysisStatus(id, AnalysisStatus.FAILED);

          // Do not delete tmp docs on error either; aids debugging and reuse
        }
      })();

      res.json({
        message: "Analysis started",
        contractId: id,
        status: AnalysisStatus.IN_PROGRESS,
        estimatedDuration: 20000,
      });
    } catch (error: any) {
      console.error("500 - Error starting analysis:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const healthCheckHandler = (_req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
};

// Chat endpoints (no document context yet)
export const createChatSession =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { contractId, title } = req.body || {};
      if (!contractId) {
        return res.status(400).json({ error: "contractId is required" });
      }

      const contract = await db.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }

      const sessionId = await db.createChatSession(contractId, title);
      res.json({ sessionId });
    } catch (error: any) {
      console.error("Error creating chat session:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const listChatSessions =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { contractId } = req.params;
      if (!contractId) {
        return res.status(400).json({ error: "contractId is required" });
      }
      const sessions = await db.getChatSessions(contractId);
      res.json({ sessions });
    } catch (error: any) {
      console.error("Error listing chat sessions:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const getChatMessages =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }
      const messages = await db.getChatMessages(sessionId, 500);
      res.json({ messages });
    } catch (error: any) {
      console.error("Error getting chat messages:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const sendChatMessage =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { contractId, message, model } =
        req.body ||
        ({} as {
          contractId: string;
          message: string;
          model?: GeminiChatModel;
        });
      if (!sessionId || !contractId || !message) {
        return res
          .status(400)
          .json({ error: "sessionId, contractId and message are required" });
      }

      const session = await db.getChatSession(sessionId);
      if (!session || session.contractId !== contractId) {
        return res.status(404).json({ error: "Chat session not found" });
      }

      // Persist user message
      await db.addChatMessage(sessionId, contractId, "user", message);

      // Prepare simple conversation (last N messages)
      const history = await db.getChatMessages(sessionId, 50);
      const messages = history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      // Generate reply
      const reply = await GeminiChatService.generateReply(
        messages.concat([{ role: "user", content: message }]),
        process.env.GEMINI_API_KEY || "",
        (model as GeminiChatModel) || "2.0-flash"
      );

      await db.addChatMessage(sessionId, contractId, "assistant", reply);

      res.json({ reply });
    } catch (error: any) {
      console.error("Error sending chat message:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

// Helpers to compute sha256
function sha256OfBuffer(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Shared: get document file paths from per-contract tmp directory
async function getDocumentFilePaths(
  db: DatabaseService,
  contract: any,
  bypassAttachments: boolean = false,
  uploadDir?: string
): Promise<string[]> {
  const paths: string[] = [];
  if (uploadDir) {
    try {
      // Include any existing files in the tmp dir
      const files = await fs.readdir(uploadDir);
      for (const f of files) {
        paths.push(path.join(uploadDir, f));
      }
    } catch {}
  }

  // Download attachments to tmp dir if not bypassed
  if (
    !bypassAttachments &&
    contract.attachments &&
    contract.attachments.length > 0 &&
    uploadDir
  ) {
    try {
      const downloaded = await downloadAttachments(
        contract.attachments,
        uploadDir
      );
      // Merge and de-duplicate
      const set = new Set<string>([...paths, ...downloaded]);
      return Array.from(set);
    } catch (downloadError) {
      console.error(
        `Attachment download failed for contract ${contract.id}:`,
        downloadError
      );
      // Return whatever we already had
      return paths;
    }
  }

  return paths;
}

// Build chat prompt with lighter system prompt, latest analysis, and doc context
async function buildChatPrompt(
  db: DatabaseService,
  params: {
    contractId: string;
    sessionId: string;
    solicitationId?: string;
    userMessage: string;
  }
) {
  const convo: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];
  // Light system prompt
  convo.push({
    role: "system",
    content: `You are a contracts analyst for U.S. government solicitations.
  Your job: analyze VAR and small business set-aside opportunities, and draft outputs grounded in the provided solicitation text.
  Rules:
  - Always use actual details from context (POC names, emails, solicitation numbers, dates, requirements).
  - Do not generate placeholders like [POC Name] unless the information is genuinely missing.
  - If information is missing, say so in one short sentence before providing the draft.
  - Drafts must be professional, concise, and directly usable.`,
  });

  // Latest analysis summary if available
  const latestAnalysis = await db.getAIAnalysis(params.contractId);
  if (latestAnalysis?.summary) {
    const v = (latestAnalysis as any)?.version;
    convo.push({
      role: "system",
      content: `Latest analysis summary${v ? ` (v${v})` : ""}:\n${
        latestAnalysis.summary
      }`,
    });
    // Provide full analysis JSON for precise data (score, flags, action plan, etc.)
    try {
      const json = JSON.stringify(latestAnalysis);
      convo.push({
        role: "system",
        content: `Latest analysis: ${json}`,
      });
    } catch {}
  }

  // Document context listing from per-contract tmp dir
  try {
    const uploadDir = path.join(
      __dirname,
      "uploads",
      "tmp",
      "contract-analysis",
      params.contractId
    );
    const files = await fs.readdir(uploadDir);
    if (files && files.length > 0) {
      convo.push({
        role: "system",
        content: `Available sources: ${files.join(
          ", "
        )}. Use the file explicitly named by the user.`,
      });
    }
  } catch {}

  // Conversation history (most recent first from DB, capped at 50)
  try {
    const history = await db.getChatMessages(params.sessionId, 50);
    for (const message of history) {
      // Trust DB roles and contents as-is
      const role = message.role as "system" | "user" | "assistant";
      convo.push({ role, content: message.content });
    }
  } catch {}

  // If the latest history doesn't already include this exact user message, append it
  try {
    const last = convo[convo.length - 1];
    if (
      !(last && last.role === "user" && last.content === params.userMessage)
    ) {
      convo.push({ role: "user", content: params.userMessage });
    }
  } catch {}
  return convo;
}

// Ingest solicitation docs from existing attachments for a contract
export const ingestSolicitation =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { solicitationId } = req.params as { solicitationId?: string };
      const { contractId } = (req.body || {}) as { contractId?: string };
      if (!solicitationId || !contractId) {
        return res
          .status(400)
          .json({ error: "solicitationId and contractId required" });
      }
      // Prepare per-contract tmp directory and download attachments there
      const contract = await db.getContract(contractId);
      if (!contract)
        return res.status(404).json({ error: "Contract not found" });
      const uploadDir = path.join(
        __dirname,
        "uploads",
        "tmp",
        "contract-analysis",
        contractId
      );
      await fs.mkdir(uploadDir, { recursive: true });
      let countBefore = 0;
      try {
        countBefore = (await fs.readdir(uploadDir)).length;
      } catch {}
      if (contract.attachments && contract.attachments.length > 0) {
        try {
          await downloadAttachments(contract.attachments, uploadDir);
        } catch (e) {
          console.warn("Prepare Chat download failed", e);
        }
      }
      let countAfter = countBefore;
      try {
        countAfter = (await fs.readdir(uploadDir)).length;
      } catch {}
      return res.json({
        ok: true,
        ingested: Math.max(0, countAfter - countBefore),
      });
    } catch (e: any) {
      console.error("Ingest failed", e);
      return res.status(500).json({ error: e.message });
    }
  };

function exists(p: string): Promise<boolean> {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false);
}

export const solicitationStatus =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { solicitationId } = req.params as { solicitationId?: string };
      if (!solicitationId)
        return res.status(400).json({ error: "solicitationId required" });
      // Map solicitationId -> contract by solicitationNumber, then inspect tmp dir
      const contracts = await db.getContracts(1000);
      const match = contracts.find(
        (c: any) => (c.solicitationNumber || "").trim() === solicitationId
      );
      if (!match) return res.json({ count: 0, docs: [] });
      const uploadDir = path.join(
        __dirname,
        "uploads",
        "tmp",
        "contract-analysis",
        match.id
      );
      try {
        const files = await fs.readdir(uploadDir);
        res.json({ count: files.length, docs: files });
      } catch {
        res.json({ count: 0, docs: [] });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

// Streaming chat (NDJSON) with phases
export const streamChatMessage =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { contractId, message, model, solicitationId } = req.body || {};
      if (!sessionId || !contractId || !message) {
        res
          .status(400)
          .json({ error: "sessionId, contractId and message are required" });
        return;
      }
      const session = await db.getChatSession(sessionId);
      if (!session || session.contractId !== contractId) {
        res.status(404).json({ error: "Chat session not found" });
        return;
      }

      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const writeEvent = (obj: any) => {
        try {
          res.write(JSON.stringify(obj) + "\n");
        } catch (_) {}
      };

      // queued phase
      writeEvent({ type: "status", phase: "queued" });

      await db.addChatMessage(sessionId, contractId, "user", message);

      // thinking phase
      writeEvent({ type: "status", phase: "thinking" });

      // Ensure per-contract tmp documents exist similar to analysis
      try {
        const contract = await db.getContract(contractId);
        if (contract) {
          const uploadDir = path.join(
            __dirname,
            "uploads",
            "tmp",
            "contract-analysis",
            contractId
          );
          try {
            await fs.mkdir(uploadDir, { recursive: true });
          } catch {}
          if (contract.attachments && contract.attachments.length > 0) {
            try {
              await downloadAttachments(contract.attachments, uploadDir);
            } catch (e) {
              console.warn("Chat attachment ensure failed", e);
            }
          }
        }
      } catch (e) {
        console.warn("Chat doc ensure flow failed", e);
      }

      // Build multimodal contents (contract+docs) + conversation
      const contract = await db.getContract(contractId);
      const uploadDir = path.join(
        __dirname,
        "uploads",
        "tmp",
        "contract-analysis",
        contractId
      );
      let filePaths: string[] = [];
      try {
        const files = await fs.readdir(uploadDir);
        filePaths = files.map((f) => path.join(uploadDir, f));
      } catch {}

      const contextParts = await buildChatContextParts(
        contract || {},
        filePaths
      );
      const history = await db.getChatMessages(sessionId, 50);
      const convoContents = history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const contents = [
        { role: "user", parts: contextParts },
        ...convoContents,
        { role: "user", parts: [{ text: message }] },
      ];

      const modelName: GeminiChatModel =
        (model as GeminiChatModel) || "2.0-flash";
      const startTime = Date.now();

      const full = await sendGeminiContents(
        contents,
        process.env.GEMINI_API_KEY || "",
        modelName
      );
      const endTime = Date.now();

      console.log("full", full);

      // responding phase
      writeEvent({ type: "status", phase: "responding" });

      // Split into small tokens (roughly words with spaces preserved)
      const tokens = full.split(/(\s+)/).filter((t) => t.length > 0);
      let sent = 0;
      for (const t of tokens) {
        writeEvent({ type: "token", data: t });
        sent += t.length;
        // Throttle so the client can animate; ~25–40 tokens/sec
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 25));
      }

      // Persist assistant message with internal metadata
      await db.addChatMessage(sessionId, contractId, "assistant", full, {
        model: modelName,
        // We don't have exact token counts from LLM here; approximate with token length
        inputTokens: Math.ceil(message.length / 4),
        outputTokens: Math.ceil(full.length / 4),
        durationMs: endTime - startTime,
      });
      writeEvent({ type: "done" });
      res.end();
    } catch (error: any) {
      try {
        res.write(
          JSON.stringify({
            type: "error",
            error: error.message || String(error),
          }) + "\n"
        );
      } catch {}
      res.end();
    }
  };

// Continue a previous assistant message by streaming additional tokens and appending to the message
export const continueChatMessage =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { contractId, messageId, model, solicitationId } = req.body || {};
      if (!sessionId || !contractId || !messageId) {
        res
          .status(400)
          .json({ error: "sessionId, contractId and messageId are required" });
        return;
      }

      const session = await db.getChatSession(sessionId);
      if (!session || session.contractId !== contractId) {
        res.status(404).json({ error: "Chat session not found" });
        return;
      }

      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const writeEvent = (obj: any) => {
        try {
          res.write(JSON.stringify(obj) + "\n");
        } catch (_) {}
      };

      // queued
      writeEvent({ type: "status", phase: "queued" });

      // Validate that messageId points to an assistant message in this session/contract
      try {
        const msg = await db.getChatMessageById(messageId);
        if (
          !msg ||
          msg.sessionId !== sessionId ||
          msg.contractId !== contractId ||
          msg.role !== "assistant"
        ) {
          writeEvent({
            type: "error",
            error:
              "Invalid continuation target. Only the last assistant message can be continued.",
          });
          res.end();
          return;
        }
      } catch (e) {
        writeEvent({
          type: "error",
          error: "Unable to validate continuation target.",
        });
        res.end();
        return;
      }

      // Build multimodal contents (contract+docs) + conversation and continue instruction
      const contract = await db.getContract(contractId);
      const uploadDir = path.join(
        __dirname,
        "uploads",
        "tmp",
        "contract-analysis",
        contractId
      );
      let filePaths: string[] = [];
      try {
        const files = await fs.readdir(uploadDir);
        filePaths = files.map((f) => path.join(uploadDir, f));
      } catch {}

      const contextParts = await buildChatContextParts(
        contract || {},
        filePaths
      );
      const history = await db.getChatMessages(sessionId, 50);
      const convoContents = history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      // Add a short user instruction to continue the previous assistant message
      const continueInstruction =
        "Continue the previous assistant response where it left off. Do not repeat earlier content.";

      const modelName: GeminiChatModel =
        (model as GeminiChatModel) || "2.0-flash";
      const startTime = Date.now();
      const contents = [
        { role: "user", parts: contextParts },
        ...convoContents,
        { role: "user", parts: [{ text: continueInstruction }] },
      ];

      const full = await sendGeminiContents(
        contents,
        process.env.GEMINI_API_KEY || "",
        modelName
      );
      const endTime = Date.now();

      writeEvent({ type: "status", phase: "responding" });

      // Stream tokens
      const tokens = full.split(/(\s+)/).filter((t) => t.length > 0);
      let accumulated = "";
      for (const t of tokens) {
        writeEvent({ type: "token", data: t });
        accumulated += t;
        // throttle
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 25));
      }

      // Append full continuation to the original assistant message in DB
      try {
        await db.appendChatMessageContent(messageId, accumulated, {
          model: modelName,
          outputTokens: Math.ceil(accumulated.length / 4),
          durationMs: Math.max(1, endTime - startTime),
        });
      } catch (e) {
        console.error("Failed to append chat message content:", e);
      }

      writeEvent({ type: "done" });
      res.end();
    } catch (error: any) {
      try {
        res.write(
          JSON.stringify({
            type: "error",
            error: error.message || String(error),
          }) + "\n"
        );
      } catch (_) {}
      res.end();
    }
  };

// Feedback endpoint for chat messages
export const setChatMessageFeedback =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { messageId } = req.params as { messageId?: string };
      const { value } = (req.body || {}) as { value?: number };
      if (!messageId || (value !== 1 && value !== -1 && value !== 0)) {
        return res
          .status(400)
          .json({ error: "messageId and value (1|-1|0) are required" });
      }
      await db.setChatMessageFeedback(messageId, value);
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("Feedback save failed", e);
      return res.status(500).json({ error: e.message });
    }
  };
// Search endpoints

export const searchFromUrl =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { url, maxPages = 1, delayMs = 2000 } = req.body;

      if (!url) {
        console.error("400 - No search URL provided");
        return res.status(400).json({ error: "No search URL provided" });
      }

      console.log(`Searching SAM.gov from URL: ${url}`);

      // Parse URL to extract filters
      const filters = SAMSearchService.parseSearchUrl(url);
      console.log("Parsed filters:", JSON.stringify(filters, null, 2));

      // Perform search with pagination
      const searchResult = await SAMSearchService.searchWithPagination(
        filters,
        maxPages,
        delayMs
      );

      const searchDuration = Date.now() - startTime;
      searchResult.searchDuration = searchDuration;

      console.log(
        `Search completed in ${searchDuration}ms: ${searchResult.contracts.length} contracts found`
      );

      // Save search to history
      await db.saveSearchHistory(url, searchResult.pagination.totalElements);

      res.json({
        ...searchResult,
        message: `Found ${searchResult.contracts.length} contracts (Page ${
          searchResult.pagination.page + 1
        } of ${searchResult.pagination.totalPages}, ${
          searchResult.pagination.totalElements
        } total)`,
      });
    } catch (error: any) {
      const searchDuration = Date.now() - startTime;
      console.error(`Search failed after ${searchDuration}ms:`, error.message);

      if (error.response) {
        res.status(error.response.status).json({
          error: `SAM.gov search failed: ${error.response.statusText}`,
          details: error.response.data,
        });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

export const searchDirect =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { filters, maxPages = 1, delayMs = 2000 } = req.body;

      if (!filters || typeof filters !== "object") {
        console.error("400 - No search filters provided");
        return res.status(400).json({ error: "No search filters provided" });
      }

      console.log(
        "Direct search with filters:",
        JSON.stringify(filters, null, 2)
      );

      // Perform search with pagination
      const searchResult = await SAMSearchService.searchWithPagination(
        filters as SearchFilters,
        maxPages,
        delayMs
      );

      const searchDuration = Date.now() - startTime;
      searchResult.searchDuration = searchDuration;

      console.log(
        `Direct search completed in ${searchDuration}ms: ${searchResult.contracts.length} contracts found`
      );

      // Save search to history (construct URL from filters)
      const searchUrl = `Direct search: ${JSON.stringify(filters)}`;
      await db.saveSearchHistory(
        searchUrl,
        searchResult.pagination.totalElements
      );

      res.json({
        ...searchResult,
        message: `Found ${searchResult.contracts.length} contracts (Page ${
          searchResult.pagination.page + 1
        } of ${searchResult.pagination.totalPages}, ${
          searchResult.pagination.totalElements
        } total)`,
      });
    } catch (error: any) {
      const searchDuration = Date.now() - startTime;
      console.error(
        `Direct search failed after ${searchDuration}ms:`,
        error.message
      );

      if (error.response) {
        res.status(error.response.status).json({
          error: `SAM.gov search failed: ${error.response.statusText}`,
          details: error.response.data,
        });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  };

export const addContractsFromSearch =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { contracts } = req.body;

      if (!contracts || !Array.isArray(contracts)) {
        console.error("400 - No contracts provided");
        return res.status(400).json({ error: "Contracts array is required" });
      }

      console.log(
        `Adding ${contracts.length} contracts from search to database`
      );

      let addedCount = 0;
      let existingCount = 0;
      const errors: string[] = [];

      for (const contract of contracts) {
        try {
          // Check if contract already exists
          const existingContract = await db.getContract(contract.id);
          if (existingContract) {
            existingCount++;
            continue;
          }

          // Save contract to database
          await db.saveContract(contract);
          addedCount++;
          console.log(`Added contract ${contract.id}: ${contract.title}`);
        } catch (error) {
          console.error(`Error processing contract ${contract.id}:`, error);
          errors.push(
            `${contract.id}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      const message = `Processed ${contracts.length} contracts: ${addedCount} added, ${existingCount} already exist`;
      console.log(message);

      res.json({
        message,
        added: addedCount,
        existing: existingCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error("500 - Error adding contracts from search:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const checkContractsInDatabase =
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { contractIds } = req.body;

      if (!contractIds || !Array.isArray(contractIds)) {
        console.error("400 - No contract IDs provided");
        return res
          .status(400)
          .json({ error: "Contract IDs array is required" });
      }

      console.log(`Checking ${contractIds.length} contracts in database`);

      const results: { [key: string]: boolean } = {};

      for (const contractId of contractIds) {
        try {
          const contract = await db.getContract(contractId);
          results[contractId] = contract !== null;
        } catch (error) {
          console.error(`Error checking contract ${contractId}:`, error);
          results[contractId] = false;
        }
      }

      const existingCount = Object.values(results).filter(
        (exists) => exists
      ).length;
      console.log(
        `Found ${existingCount}/${contractIds.length} contracts in database`
      );

      res.json({
        results,
        summary: {
          total: contractIds.length,
          existing: existingCount,
          new: contractIds.length - existingCount,
        },
      });
    } catch (error: any) {
      console.error(
        "500 - Error checking contracts in database:",
        error.message
      );
      res.status(500).json({ error: error.message });
    }
  };
