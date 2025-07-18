import { Request, Response } from "express";
import DatabaseService from "./database";
import { fetchSingleOpportunity } from "./src/services/samApi";
import { ClientApiParser } from "./src/services/clientApiParser";
import axios from "axios";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { AnalysisStatus } from "./database";
import { GeminiAnalyzer } from "./src/services/geminiAnalyzer";

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
      
      // Fetch attachments using the official SAM.gov API
      const attachmentsUrl = `https://api.sam.gov/opportunities/v2/attachments/${id}`;
      
      const response = await axios.get(attachmentsUrl, {
        headers: {
          'X-API-Key': process.env.SAM_API_KEY_1 || '',
          'User-Agent': 'sam-contract-tracker/0.1',
          'Accept': 'application/json'
        },
        timeout: 30000
      });
      
      const attachmentData = response.data;
      
      // Parse the attachment data into our format
      const attachments = attachmentData.attachments?.map((att: any) => ({
        id: att.id || `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: att.name || att.filename || 'Unknown',
        url: att.url || att.downloadUrl || att.link || '',
        type: att.type || att.mimeType || 'application/octet-stream',
        size: att.size || att.fileSize || 0,
        downloaded: false,
        downloadedAt: null,
        content: null
      })) || [];
      
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
      if (error.response) {
        console.error(`${error.response.status} - SAM API error:`, error.response.statusText);
        res.status(error.response.status).json({ 
          error: `SAM API error: ${error.response.status} - ${error.response.statusText}` 
        });
      } else {
        console.error("500 - Error fetching contract attachments:", error.message);
        res.status(500).json({ error: error.message });
      }
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

export const analyzeContract = 
  (db: DatabaseService) => async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { uploadedFiles } = req.body;
      
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
      
      // Update contract status to IN_PROGRESS
      await db.updateContractAnalysisStatus(id, AnalysisStatus.IN_PROGRESS);
      console.log(`Started analysis for contract ${id}`);
      
      // Start async analysis process
      (async () => {
        const uploadDir = path.join(__dirname, 'uploads', 'tmp', 'contract-analysis', id);
        
        try {
          // Clean up any existing directory first (in case of re-analysis)
          try {
            await fs.rm(uploadDir, { recursive: true, force: true });
            console.log(`Cleaned up existing upload directory for contract ${id} before analysis`);
          } catch (cleanupError) {
            // Directory might not exist, that's okay
          }
          
          // Get uploaded file paths
          let uploadedFilePaths: string[] = [];
          
          try {
            const files = await fs.readdir(uploadDir);
            uploadedFilePaths = files.map(file => path.join(uploadDir, file));
          } catch (dirError) {
            console.log(`No uploaded files found for contract ${id}`);
          }
          
          // Use Gemini API if configured, otherwise use mock data
          let analysisResult;
          
          if (process.env.GEMINI_API_KEY) {
            console.log(`Starting Gemini analysis for contract ${id} with ${uploadedFilePaths.length} documents`);
            
            try {
              const geminiAnalysis = await GeminiAnalyzer.analyzeContract(contract, uploadedFilePaths, process.env.GEMINI_API_KEY!);
              
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
                analyzedAt: new Date().toISOString()
              };
            } catch (geminiError) {
              console.error(`Gemini analysis failed for contract ${id}:`, geminiError);
              throw geminiError;
            }
          } else {
            console.log(`Using mock analysis for contract ${id} (no GEMINI_API_KEY configured)`);
            
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
              analyzedAt: new Date().toISOString()
            };
          }
          
          // Update contract with analysis results
          await db.updateContractAnalysis(id, analysisResult);
          await db.updateContractAnalysisStatus(id, AnalysisStatus.COMPLETED);
          
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
