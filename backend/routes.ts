import { Request, Response } from "express";
import DatabaseService from "./database";
import { fetchSingleOpportunity } from "./src/services/samApi";
import { ClientApiParser } from "./src/services/clientApiParser";
import SAMSearchService, { SearchFilters } from "./src/services/samSearch";
import axios from "axios";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { AnalysisStatus } from "./database";
import { GeminiAnalyzer, GeminiModel } from "./src/services/geminiAnalyzer";

// Helper function to download attachments
async function downloadAttachments(attachments: any[], downloadDir: string): Promise<string[]> {
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
      
      const response = await axios.get(attachment.url, {
        responseType: 'stream',
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "referer": "https://sam.gov/",
          ...(sessionTokens.cookies && { "cookie": sessionTokens.cookies }),
          ...(sessionTokens.authToken && { "x-auth-token": sessionTokens.authToken }),
        },
      });
      
      if (response.status === 200) {
        // Create a safe filename
        const safeFilename = attachment.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = path.join(downloadDir, safeFilename);
        
        // Create write stream and pipe the response
        const writer = createWriteStream(filePath);
        response.data.pipe(writer);
        
        // Wait for the download to complete
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        downloadedFiles.push(filePath);
        console.log(`Successfully downloaded: ${attachment.name}`);
      } else {
        console.error(`Failed to download ${attachment.name}: HTTP ${response.status}`);
        throw new Error(`Failed to download ${attachment.name}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`Error downloading attachment ${attachment.name}:`, error);
      throw new Error(`Failed to download attachment ${attachment.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return downloadedFiles;
}

export const fetchSingle =
  (_db: DatabaseService) => async (req: Request, res: Response) => {
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
        console.error(`${error.response.status} - SAM API Error:`, error.response.data);
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
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "referer": `https://sam.gov/opp/${opportunityId}/view`,
          ...(sessionTokens.cookies && { "cookie": sessionTokens.cookies }),
          ...(sessionTokens.authToken && { "x-auth-token": sessionTokens.authToken }),
        },
        params: {
          random: Date.now(), // Add random parameter like the client does
        },
      });

      if (response.status !== 200) {
        console.error(`${response.status} - SAM.gov client API error`);
        return res.status(response.status).json({ error: `SAM.gov client API returned ${response.status}` });
      }

      const apiResponse = response.data;
      const fetchDurationMs = Date.now() - startTime;
      console.log(`Successfully fetched from client API in ${fetchDurationMs}ms`);

      // Validate the API response
      if (!ClientApiParser.validateApiResponse(apiResponse)) {
        console.error("Invalid API response structure");
        return res.status(500).json({ error: "Invalid API response structure" });
      }

      // Parse the contract data
      const parsedData = ClientApiParser.extractAllData(apiResponse, opportunityId, 'client-api', fetchDurationMs);
      const contract = parsedData.contract;
      const metadata = parsedData.metadata;

      // Fetch attachments using the correct v3 resources endpoint
      const attachments = await ClientApiParser.fetchAttachmentsFromClientApi(opportunityId, sessionTokens);
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
        attachmentSource: attachments.length > 0 ? 'client-api' : 'none'
      });
    } catch (error: any) {
      if (error.response) {
        console.error(`${error.response.status} - SAM.gov client API error:`, error.response.statusText);
        res.status(error.response.status).json({ error: `SAM.gov client API failed: ${error.response.statusText}` });
      } else {
        console.error("500 - Client API error:", error.message);
        res.status(500).json({ error: error.message });
      }
    }
  };

// Preview contract from SAM.gov client API without saving to database
export const previewContractClient = (db: DatabaseService) => async (req: Request, res: Response) => {
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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "referer": `https://sam.gov/opp/${opportunityId}/view`,
        ...(sessionTokens.cookies && { "cookie": sessionTokens.cookies }),
        ...(sessionTokens.authToken && { "x-auth-token": sessionTokens.authToken }),
      },
      params: {
        random: Date.now(), // Add random parameter like the client does
      },
    });

    if (response.status !== 200) {
      console.error(`${response.status} - SAM.gov client API error`);
      return res.status(response.status).json({ error: `SAM.gov client API returned ${response.status}` });
    }

    const apiResponse = response.data;
    const fetchDurationMs = Date.now() - startTime;
    console.log(`Successfully fetched from client API in ${fetchDurationMs}ms`);

    // Validate the API response
    if (!ClientApiParser.validateApiResponse(apiResponse)) {
      console.error("Invalid API response structure");
      return res.status(500).json({ error: "Invalid API response structure" });
    }

    // Parse the contract data
    const parsedData = ClientApiParser.extractAllData(apiResponse, opportunityId, 'client-api', fetchDurationMs);
    const contract = parsedData.contract;
    const metadata = parsedData.metadata;

    // Fetch attachments using the correct v3 resources endpoint
    const attachments = await ClientApiParser.fetchAttachmentsFromClientApi(opportunityId, sessionTokens);
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
      attachmentSource: attachments.length > 0 ? 'client-api' : 'none',
      preview: true // Flag to indicate this is preview data
    });
  } catch (error: any) {
    if (error.response) {
      console.error(`${error.response.status} - SAM.gov client API error:`, error.response.statusText);
      res.status(error.response.status).json({ error: `SAM.gov client API failed: ${error.response.statusText}` });
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
        offset
      });
    } catch (error: any) {
      console.error("500 - Error fetching contracts:", error.message);
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
        return res.status(400).json({ error: "Contract ID and status are required" });
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
        return res.status(400).json({ error: "Contract ID and flags array are required" });
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
        return res.status(400).json({ error: "Contract ID and priority are required" });
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
        return res.status(400).json({ error: "Contract ID, content, and type are required" });
      }
      
      const note = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        contractId: id,
        content,
        type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        return res.status(400).json({ error: "Note ID and content are required" });
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
      const attachments = await ClientApiParser.fetchAttachmentsFromClientApi(id, sessionTokens);
      console.log(`Fetched ${attachments.length} attachments for retry`);
      
      // Save attachments to database
      for (const attachment of attachments) {
        await db.saveAttachment(attachment, id);
      }
      
      console.log(`Fetched and saved ${attachments.length} attachments for contract ${id}`);
      
      // Update contract with new attachments
      const updatedContract = await db.getContract(id);
      
      res.json({ 
        attachments,
        message: `Successfully fetched ${attachments.length} attachments`,
        contract: updatedContract
      });
    } catch (error: any) {
      console.error("500 - Error fetching contract attachments:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const contractId = req.params.id;
    const uploadDir = path.join(__dirname, 'uploads', 'tmp', 'contract-analysis', contractId);
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const basename = path.basename(file.originalname, extension);
    const uniqueFilename = `${basename}-${timestamp}${extension}`;
    cb(null, uniqueFilename);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLSX, and TXT files are allowed.'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB limit
  }
});

export const uploadDocuments = 
  (db: DatabaseService) => [
    upload.single('document'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        
        if (!id) {
          console.error("400 - Contract ID is required");
          return res.status(400).json({ error: "Contract ID is required" });
        }
        
        if (!req.file) {
          console.error("400 - No file uploaded");
          return res.status(400).json({ error: "No file uploaded" });
        }
        
        // Verify contract exists
        const contract = await db.getContract(id);
        if (!contract) {
          console.error(`404 - Contract not found: ${id}`);
          return res.status(404).json({ error: "Contract not found" });
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
            path: req.file.path
          }
        });
      } catch (error: any) {
        console.error("500 - Error uploading document:", error.message);
        res.status(500).json({ error: error.message });
      }
    }
  ];

export const updateAnalysisStatus = 
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { analysisStatus } = req.body;
      
      if (!id || !analysisStatus) {
        console.error("400 - Contract ID and analysis status are required");
        return res.status(400).json({ error: "Contract ID and analysis status are required" });
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
      
      res.json({ progress: progress || { progress: 0, message: 'Starting analysis...' } });
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
        return res.status(400).json({ error: "Contract ID and version are required" });
      }
      
      const analysis = await db.getAIAnalysis(id, parseInt(version));
      
      if (!analysis) {
        console.error(`404 - Analysis version ${version} not found for contract ${id}`);
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
        return res.status(400).json({ error: "Contract ID and version are required" });
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
        return res.status(400).json({ error: "Contract ID, version, and content are required" });
      }
      
      const note = {
        id: `analysis-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        contractId: id,
        analysisVersion: parseInt(version),
        content,
        type: type || 'general',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
        return res.status(400).json({ error: "Note ID and content are required" });
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
      const model: GeminiModel = selectedModel || '2.0-flash';
      
      // Update contract status to IN_PROGRESS
      await db.updateContractAnalysisStatus(id, AnalysisStatus.IN_PROGRESS);
      await db.updateAnalysisProgress(id, 5, 'Initializing analysis...');
      console.log(`Started analysis for contract ${id}, model: ${model}, bypassAttachments: ${bypassAttachments}`);
      
      // Start async analysis process
      (async () => {
        const uploadDir = path.join(__dirname, 'uploads', 'tmp', 'contract-analysis', id);
        
        try {
          // Get uploaded file paths
          let uploadedFilePaths: string[] = [];
          
          await db.updateAnalysisProgress(id, 10, 'Locating uploaded documents...');
          
          try {
            const files = await fs.readdir(uploadDir);
            uploadedFilePaths = files.map(file => path.join(uploadDir, file));
            console.log(`Found ${uploadedFilePaths.length} uploaded files for contract ${id}`);
            await db.updateAnalysisProgress(id, 15, `Found ${uploadedFilePaths.length} document${uploadedFilePaths.length !== 1 ? 's' : ''} to analyze`);
          } catch (dirError) {
            console.log(`No uploaded files found for contract ${id} - directory may not exist`);
          }
          
          // Download attachments if not bypassed
          let attachmentFilePaths: string[] = [];
          if (!bypassAttachments && contract.attachments && contract.attachments.length > 0) {
            await db.updateAnalysisProgress(id, 20, `Downloading ${contract.attachments.length} attachment${contract.attachments.length !== 1 ? 's' : ''}...`);
            
            try {
              attachmentFilePaths = await downloadAttachments(contract.attachments, uploadDir);
              console.log(`Downloaded ${attachmentFilePaths.length} attachments for contract ${id}`);
              await db.updateAnalysisProgress(id, 25, `Downloaded ${attachmentFilePaths.length} attachment${attachmentFilePaths.length !== 1 ? 's' : ''}`);
            } catch (downloadError) {
              console.error(`Attachment download failed for contract ${id}:`, downloadError);
              await db.updateContractAnalysisStatus(id, AnalysisStatus.FAILED);
              await db.updateAnalysisProgress(id, 0, 'Attachment download failed');
              return;
            }
          } else if (bypassAttachments) {
            console.log(`Bypassing attachment downloads for contract ${id}`);
            await db.updateAnalysisProgress(id, 20, 'Bypassing attachment downloads...');
          }
          
          // Combine uploaded files and downloaded attachments
          const allFilePaths = [...uploadedFilePaths, ...attachmentFilePaths];
          console.log(`Total files for analysis: ${allFilePaths.length} (${uploadedFilePaths.length} uploaded, ${attachmentFilePaths.length} downloaded)`);
          
          if (allFilePaths.length === 0) {
            console.error(`No files available for analysis for contract ${id}`);
            await db.updateContractAnalysisStatus(id, AnalysisStatus.FAILED);
            await db.updateAnalysisProgress(id, 0, 'No documents available for analysis');
            return;
          }
          
          // Use Gemini API if configured, otherwise use mock data
          let analysisResult;
          
          if (process.env.GEMINI_API_KEY) {
            console.log(`Starting Gemini analysis for contract ${id} with ${allFilePaths.length} documents`);
            await db.updateAnalysisProgress(id, 30, 'Connecting to Gemini AI service...');
            
            try {
              await db.updateAnalysisProgress(id, 40, 'Uploading documents to Gemini...');
              const geminiAnalysis = await GeminiAnalyzer.analyzeContract(contract, allFilePaths, process.env.GEMINI_API_KEY!, async (progress, message) => {
                // Progress callback
                await db.updateAnalysisProgress(id, progress, message);
              }, model);
              
              await db.updateAnalysisProgress(id, 90, 'Processing analysis results...');
              
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
                analyzedAt: new Date().toISOString()
              };
            } catch (geminiError) {
              console.error(`Gemini analysis failed for contract ${id}:`, geminiError);
              throw geminiError;
            }
          } else {
            console.log(`Using mock analysis for contract ${id} (no GEMINI_API_KEY configured)`);
            
            // Simulate progress updates for mock analysis
            await db.updateAnalysisProgress(id, 30, 'Starting mock analysis...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await db.updateAnalysisProgress(id, 50, 'Processing contract data...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            await db.updateAnalysisProgress(id, 70, 'Analyzing wrapper indicators...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            await db.updateAnalysisProgress(id, 85, 'Generating recommendations...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await db.updateAnalysisProgress(id, 90, 'Finalizing analysis...');
            
            // Mock analysis results
            analysisResult = {
              wrapperScore: Math.floor(Math.random() * 100),
              contractType: 'Unknown',
              summary: 'This is a mock analysis. Configure GEMINI_API_KEY to enable real AI analysis.',
              redFlags: [
                {
                  flag: 'Mock Flag',
                  detail: 'This is mock data',
                  severity: 'low'
                }
              ],
              incumbentInfo: {
                vendor: null,
                contractNumber: null,
                expirationDate: null
              },
              recommendedAction: 'Configure Gemini API for real analysis',
              keyDates: {
                currentDeadline: contract.deadline,
                contractStart: new Date(new Date(contract.deadline).getTime() + 86400000).toISOString().split('T')[0],
                urgencyLevel: 'medium'
              },
              estimatedValue: 'Unknown',
              competitionLevel: 'medium',
              competitionNotes: 'Mock analysis - no real assessment available',
              aiModel: model,
              analyzedAt: new Date().toISOString()
            };
          }
          
          // Prepare document list
          const documentsAnalyzed: Array<{ filename: string; type: string }> = [];
          
          // Add uploaded files info
          if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach((file: any) => {
              documentsAnalyzed.push({
                filename: file.name,
                type: file.type
              });
            });
          }
          
          // Add downloaded attachments info only if they were actually downloaded
          if (!bypassAttachments && contract.attachments && contract.attachments.length > 0) {
            contract.attachments.forEach((attachment: any) => {
              documentsAnalyzed.push({
                filename: attachment.name,
                type: attachment.type
              });
            });
          }
          
          // Update contract with analysis results
          await db.updateAnalysisProgress(id, 95, 'Saving analysis results...');
          await db.updateContractAnalysis(id, analysisResult, documentsAnalyzed);
          await db.updateContractAnalysisStatus(id, AnalysisStatus.COMPLETED);
          await db.updateAnalysisProgress(id, 100, 'Analysis complete!');
          
          // Clean up uploaded files
          try {
            await fs.rm(uploadDir, { recursive: true, force: true });
            console.log(`Cleaned up upload directory for contract ${id}`);
          } catch (cleanupError) {
            console.error(`Error cleaning up upload directory: ${cleanupError}`);
          }
          
          console.log(`Analysis completed for contract ${id}`);
        } catch (error) {
          console.error(`Error completing analysis for contract ${id}:`, error);
          await db.updateContractAnalysisStatus(id, AnalysisStatus.FAILED);
          
          // Clean up uploaded files even on error
          try {
            await fs.rm(uploadDir, { recursive: true, force: true });
            console.log(`Cleaned up upload directory for contract ${id} after error`);
          } catch (cleanupError) {
            console.error(`Error cleaning up upload directory after failure: ${cleanupError}`);
          }
        }
      })();
      
      res.json({ 
        message: "Analysis started",
        contractId: id,
        status: AnalysisStatus.IN_PROGRESS,
        estimatedDuration: 20000
      });
    } catch (error: any) {
      console.error("500 - Error starting analysis:", error.message);
      res.status(500).json({ error: error.message });
    }
  };

export const healthCheckHandler = (_req: Request, res: Response) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
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
      console.log('Parsed filters:', JSON.stringify(filters, null, 2));
      
      // Perform search with pagination
      const searchResult = await SAMSearchService.searchWithPagination(
        filters,
        maxPages,
        delayMs
      );
      
      const searchDuration = Date.now() - startTime;
      searchResult.searchDuration = searchDuration;
      
      console.log(`Search completed in ${searchDuration}ms: ${searchResult.contracts.length} contracts found`);
      
      // Save search to history
      await db.saveSearchHistory(url, searchResult.pagination.totalElements);
      
      res.json({
        ...searchResult,
        message: `Found ${searchResult.contracts.length} contracts (Page ${searchResult.pagination.page + 1} of ${searchResult.pagination.totalPages}, ${searchResult.pagination.totalElements} total)`
      });
    } catch (error: any) {
      const searchDuration = Date.now() - startTime;
      console.error(`Search failed after ${searchDuration}ms:`, error.message);
      
      if (error.response) {
        res.status(error.response.status).json({ 
          error: `SAM.gov search failed: ${error.response.statusText}`,
          details: error.response.data 
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
      
      if (!filters || typeof filters !== 'object') {
        console.error("400 - No search filters provided");
        return res.status(400).json({ error: "No search filters provided" });
      }
      
      console.log('Direct search with filters:', JSON.stringify(filters, null, 2));
      
      // Perform search with pagination
      const searchResult = await SAMSearchService.searchWithPagination(
        filters as SearchFilters,
        maxPages,
        delayMs
      );
      
      const searchDuration = Date.now() - startTime;
      searchResult.searchDuration = searchDuration;
      
      console.log(`Direct search completed in ${searchDuration}ms: ${searchResult.contracts.length} contracts found`);
      
      // Save search to history (construct URL from filters)
      const searchUrl = `Direct search: ${JSON.stringify(filters)}`;
      await db.saveSearchHistory(searchUrl, searchResult.pagination.totalElements);
      
      res.json({
        ...searchResult,
        message: `Found ${searchResult.contracts.length} contracts (Page ${searchResult.pagination.page + 1} of ${searchResult.pagination.totalPages}, ${searchResult.pagination.totalElements} total)`
      });
    } catch (error: any) {
      const searchDuration = Date.now() - startTime;
      console.error(`Direct search failed after ${searchDuration}ms:`, error.message);
      
      if (error.response) {
        res.status(error.response.status).json({ 
          error: `SAM.gov search failed: ${error.response.statusText}`,
          details: error.response.data 
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
      
      console.log(`Adding ${contracts.length} contracts from search to database`);
      
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
          errors.push(`${contract.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      const message = `Processed ${contracts.length} contracts: ${addedCount} added, ${existingCount} already exist`;
      console.log(message);
      
      res.json({
        message,
        added: addedCount,
        existing: existingCount,
        errors: errors.length > 0 ? errors : undefined
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
        return res.status(400).json({ error: "Contract IDs array is required" });
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
      
      const existingCount = Object.values(results).filter(exists => exists).length;
      console.log(`Found ${existingCount}/${contractIds.length} contracts in database`);
      
      res.json({
        results,
        summary: {
          total: contractIds.length,
          existing: existingCount,
          new: contractIds.length - existingCount
        }
      });
    } catch (error: any) {
      console.error("500 - Error checking contracts in database:", error.message);
      res.status(500).json({ error: error.message });
    }
  };
