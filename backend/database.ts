import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';

// Backend types - duplicated for now to avoid shared dependency
export enum ContractStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  INTERESTED = 'interested',
  DISMISSED = 'dismissed',
  APPLIED = 'applied'
}

export enum AnalysisStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum NoteType {
  GENERAL = 'general',
  STRATEGY = 'strategy',
  RESEARCH = 'research',
  CONTACT = 'contact',
  DECISION = 'decision',
  FOLLOW_UP = 'follow_up'
}

export enum ContractPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ActivityType {
  CONTRACT_CREATED = 'contract_created',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  FLAGS_UPDATED = 'flags_updated',
  NOTE_ADDED = 'note_added',
  NOTE_UPDATED = 'note_updated',
  NOTE_DELETED = 'note_deleted',
  CONTRACT_ARCHIVED = 'contract_archived',
  CONTRACT_UNARCHIVED = 'contract_unarchived',
  ANALYSIS_STARTED = 'analysis_started',
  ANALYSIS_COMPLETED = 'analysis_completed'
}

export interface ContractNote {
  id: string;
  contractId: string;
  content: string;
  type: NoteType;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisNote {
  id: string;
  contractId: string;
  analysisVersion: number;
  content: string;
  type: NoteType;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  contractId: string;
  contractTitle: string;
  activityType: ActivityType;
  description: string;
  metadata?: any;
  createdAt: string;
}

export interface Contract {
  id: string;
  title: string;
  url: string;
  description: string;
  postedDate: string;
  deadline: string;
  status: ContractStatus;
  aiScore: number;
  aiAnalysis?: any;
  attachments: any[];
  flags: string[];
  priority?: ContractPriority;
  internalNotes?: ContractNote[];
  organizationId?: string;
  solicitationNumber?: string;
  classificationCode?: string;
  setAside?: string;
  naicsCodes?: string[];
  fetchMethod?: string;
  apiSource?: string;
  fetchDurationMs?: number;
  lastViewedAt?: string;
  viewCount?: number;
  analysisStatus?: AnalysisStatus;
  isArchived?: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  downloaded: boolean;
  downloadedAt?: string;
  content?: string;
}

export interface AIAnalysis {
  wrapperScore: number;
  indicators: any[];
  summary: string;
  recommendation: string;
  analyzedAt: string;
}

const DB_PATH = path.join(__dirname, 'contracts.db');

class DatabaseService {
  private db: Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.serialize(() => {
      // Contracts table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contracts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          posted_date TEXT NOT NULL,
          deadline TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'new',
          ai_score INTEGER DEFAULT 0,
          organization_id TEXT,
          solicitation_number TEXT,
          classification_code TEXT,
          set_aside TEXT,
          naics_codes TEXT,
          fetch_method TEXT,
          api_source TEXT,
          fetch_duration_ms INTEGER,
          last_viewed_at TEXT,
          view_count INTEGER DEFAULT 0,
          analysis_status TEXT DEFAULT 'pending',
          flags TEXT DEFAULT '[]',
          priority TEXT DEFAULT 'medium',
          is_archived BOOLEAN DEFAULT 0,
          archived_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // Contract notes table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contract_notes (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'general',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
        )
      `);

      // Analysis Notes table (version-specific notes)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS analysis_notes (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          analysis_version INTEGER NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'general',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
        )
      `);

      // Attachments table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          type TEXT NOT NULL,
          size INTEGER,
          downloaded BOOLEAN DEFAULT 0,
          downloaded_at TEXT,
          content TEXT,
          FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
        )
      `);

      // AI Analysis table with versioning support
      this.db.run(`
        CREATE TABLE IF NOT EXISTS ai_analysis (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          type TEXT DEFAULT 'analysis',
          version INTEGER DEFAULT 1,
          is_current BOOLEAN DEFAULT 1,
          wrapper_score INTEGER,
          indicators TEXT NOT NULL,
          summary TEXT,
          recommendation TEXT,
          documents_analyzed TEXT,
          ai_model TEXT DEFAULT '2.0-flash',
          analyzed_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
        )
      `);

      // Add aiModel column if it doesn't exist (migration)
      this.db.run(`
        ALTER TABLE ai_analysis ADD COLUMN ai_model TEXT DEFAULT '2.0-flash'
      `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error adding ai_model column:', err);
        }
      });

      // Search history table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS search_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          search_url TEXT NOT NULL,
          total_found INTEGER NOT NULL,
          scraped_at TEXT NOT NULL
        )
      `);

      // Activity log table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL,
          contract_title TEXT NOT NULL,
          activity_type TEXT NOT NULL,
          description TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
        )
      `);
    });
  }

  async saveContract(contract: Contract): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO contracts 
         (id, title, url, description, posted_date, deadline, status, ai_score, 
          organization_id, solicitation_number, classification_code, set_aside, naics_codes,
          fetch_method, api_source, fetch_duration_ms, last_viewed_at, view_count, 
          analysis_status, flags, priority, is_archived, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contract.id,
          contract.title,
          contract.url,
          contract.description,
          contract.postedDate,
          contract.deadline,
          contract.status,
          contract.aiScore,
          contract.organizationId || null,
          contract.solicitationNumber || null,
          contract.classificationCode || null,
          contract.setAside || null,
          contract.naicsCodes ? JSON.stringify(contract.naicsCodes) : null,
          contract.fetchMethod || null,
          contract.apiSource || null,
          contract.fetchDurationMs || null,
          contract.lastViewedAt || null,
          contract.viewCount || 0,
          contract.analysisStatus || AnalysisStatus.PENDING,
          contract.flags ? JSON.stringify(contract.flags) : '[]',
          contract.priority || ContractPriority.MEDIUM,
          contract.isArchived ? 1 : 0,
          contract.archivedAt || null,
          contract.createdAt,
          contract.updatedAt,
        ],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Log contract creation activity
            await this.logActivity({
              id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              contractId: contract.id,
              contractTitle: contract.title,
              activityType: ActivityType.CONTRACT_CREATED,
              description: `Contract "${contract.title}" was added to the system`,
              metadata: {
                fetchMethod: contract.fetchMethod,
                apiSource: contract.apiSource,
                organizationId: contract.organizationId
              },
              createdAt: new Date().toISOString()
            });
            resolve();
          }
        }
      );
    });
  }

  async saveAttachment(attachment: Attachment, contractId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO attachments 
         (id, contract_id, name, url, type, size, downloaded, downloaded_at, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attachment.id,
          contractId,
          attachment.name,
          attachment.url,
          attachment.type,
          attachment.size,
          attachment.downloaded ? 1 : 0,
          attachment.downloadedAt,
          attachment.content,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async saveAIAnalysis(analysis: AIAnalysis, contractId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO ai_analysis 
         (id, contract_id, wrapper_score, indicators, summary, recommendation, analyzed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `analysis-${contractId}`,
          contractId,
          analysis.wrapperScore,
          JSON.stringify(analysis.indicators),
          analysis.summary,
          analysis.recommendation,
          analysis.analyzedAt,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getContracts(limit: number = 100): Promise<Contract[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM contracts ORDER BY created_at DESC LIMIT ?`,
        [limit],
        async (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const contracts: Contract[] = [];
            for (const row of rows) {
              const attachments = await this.getAttachments(row.id);
              const aiAnalysis = await this.getAIAnalysis(row.id);
              const internalNotes = await this.getContractNotes(row.id);
              
              contracts.push({
                id: row.id,
                title: row.title,
                url: row.url,
                description: row.description,
                postedDate: row.posted_date,
                deadline: row.deadline,
                status: row.status as ContractStatus,
                aiScore: row.ai_score,
                attachments,
                aiAnalysis,
                flags: row.flags ? JSON.parse(row.flags) : [],
                priority: row.priority as ContractPriority,
                internalNotes,
                organizationId: row.organization_id,
                solicitationNumber: row.solicitation_number,
                classificationCode: row.classification_code,
                setAside: row.set_aside,
                naicsCodes: row.naics_codes ? JSON.parse(row.naics_codes) : [],
                fetchMethod: row.fetch_method,
                apiSource: row.api_source,
                fetchDurationMs: row.fetch_duration_ms,
                lastViewedAt: row.last_viewed_at,
                viewCount: row.view_count,
                analysisStatus: row.analysis_status as AnalysisStatus,
                isArchived: row.is_archived === 1,
                archivedAt: row.archived_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              });
            }
            resolve(contracts);
          }
        }
      );
    });
  }

  async getContract(id: string): Promise<Contract | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM contracts WHERE id = ?`,
        [id],
        async (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            const attachments = await this.getAttachments(row.id);
            const aiAnalysis = await this.getAIAnalysis(row.id);
            const internalNotes = await this.getContractNotes(row.id);
            
            resolve({
              id: row.id,
              title: row.title,
              url: row.url,
              description: row.description,
              postedDate: row.posted_date,
              deadline: row.deadline,
              status: row.status as ContractStatus,
              aiScore: row.ai_score,
              attachments,
              aiAnalysis,
              flags: row.flags ? JSON.parse(row.flags) : [],
              priority: row.priority as ContractPriority,
              internalNotes,
              organizationId: row.organization_id,
              solicitationNumber: row.solicitation_number,
              classificationCode: row.classification_code,
              setAside: row.set_aside,
              naicsCodes: row.naics_codes ? JSON.parse(row.naics_codes) : [],
              fetchMethod: row.fetch_method,
              apiSource: row.api_source,
              fetchDurationMs: row.fetch_duration_ms,
              lastViewedAt: row.last_viewed_at,
              viewCount: row.view_count,
              analysisStatus: row.analysis_status as AnalysisStatus,
              isArchived: row.is_archived === 1,
              archivedAt: row.archived_at,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          }
        }
      );
    });
  }

  async getAttachments(contractId: string): Promise<Attachment[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM attachments WHERE contract_id = ?`,
        [contractId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const attachments: Attachment[] = rows.map(row => ({
              id: row.id,
              name: row.name,
              url: row.url,
              type: row.type,
              size: row.size,
              downloaded: row.downloaded === 1,
              downloadedAt: row.downloaded_at,
              content: row.content,
            }));
            resolve(attachments);
          }
        }
      );
    });
  }

  async getAIAnalysis(contractId: string, version?: number): Promise<AIAnalysis | undefined> {
    return new Promise((resolve, reject) => {
      const query = version 
        ? `SELECT * FROM ai_analysis WHERE contract_id = ? AND type = 'analysis' AND version = ?`
        : `SELECT * FROM ai_analysis WHERE contract_id = ? AND type = 'analysis' AND is_current = 1`;
      const params = version ? [contractId, version] : [contractId];
      
      this.db.get(
        query,
        params,
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(undefined);
          } else {
            // The indicators field contains the full analysis JSON
            try {
              const fullAnalysis = JSON.parse(row.indicators);
              // Add version and document info to the analysis
              fullAnalysis.version = row.version;
              fullAnalysis.documentsAnalyzed = row.documents_analyzed ? JSON.parse(row.documents_analyzed) : [];
              fullAnalysis.aiModel = row.ai_model || '2.0-flash';
              resolve(fullAnalysis);
            } catch (parseError) {
              // Fallback to old format if parsing fails
              resolve({
                wrapperScore: row.wrapper_score,
                indicators: [],
                summary: row.summary,
                recommendation: row.recommendation,
                analyzedAt: row.analyzed_at,
                aiModel: row.ai_model || '2.0-flash',
              } as any);
            }
          }
        }
      );
    });
  }

  async updateContractStatus(id: string, status: ContractStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET status = ?, updated_at = ? WHERE id = ?`,
        [status, new Date().toISOString(), id],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get contract title for logging
            const contract = await this.getContract(id);
            if (contract) {
              await this.logActivity({
                id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                contractId: id,
                contractTitle: contract.title,
                activityType: ActivityType.STATUS_CHANGED,
                description: `Status changed to "${status}"`,
                metadata: { newStatus: status },
                createdAt: new Date().toISOString()
              });
            }
            resolve();
          }
        }
      );
    });
  }

  async updateAnalysisStatus(id: string, analysisStatus: AnalysisStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET analysis_status = ?, updated_at = ? WHERE id = ?`,
        [analysisStatus, new Date().toISOString(), id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async incrementViewCount(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET view_count = view_count + 1, last_viewed_at = ?, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), new Date().toISOString(), id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async deleteContract(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM contracts WHERE id = ?`,
        [id],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async saveSearchHistory(searchUrl: string, totalFound: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO search_history (search_url, total_found, scraped_at)
         VALUES (?, ?, ?)`,
        [searchUrl, totalFound, new Date().toISOString()],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Notes management
  async getContractNotes(contractId: string): Promise<ContractNote[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM contract_notes WHERE contract_id = ? ORDER BY created_at DESC`,
        [contractId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const notes: ContractNote[] = rows.map(row => ({
              id: row.id,
              contractId: row.contract_id,
              content: row.content,
              type: row.type as NoteType,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            }));
            resolve(notes);
          }
        }
      );
    });
  }

  async addContractNote(note: ContractNote): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO contract_notes (id, contract_id, content, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [note.id, note.contractId, note.content, note.type, note.createdAt, note.updatedAt],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get contract title for logging
            const contract = await this.getContract(note.contractId);
            if (contract) {
              await this.logActivity({
                id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                contractId: note.contractId,
                contractTitle: contract.title,
                activityType: ActivityType.NOTE_ADDED,
                description: `Added ${note.type} note`,
                metadata: { noteType: note.type },
                createdAt: new Date().toISOString()
              });
            }
            resolve();
          }
        }
      );
    });
  }

  async updateContractNote(noteId: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contract_notes SET content = ?, updated_at = ? WHERE id = ?`,
        [content, new Date().toISOString(), noteId],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get note details for logging
            const notes = await this.getContractNotes('');
            const note = notes.find(n => n.id === noteId);
            if (note) {
              const contract = await this.getContract(note.contractId);
              if (contract) {
                await this.logActivity({
                  id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  contractId: note.contractId,
                  contractTitle: contract.title,
                  activityType: ActivityType.NOTE_UPDATED,
                  description: `Updated ${note.type} note`,
                  metadata: { noteType: note.type },
                  createdAt: new Date().toISOString()
                });
              }
            }
            resolve();
          }
        }
      );
    });
  }

  async deleteContractNote(noteId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get note details before deletion for logging
      this.db.get(
        `SELECT * FROM contract_notes WHERE id = ?`,
        [noteId],
        async (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.db.run(
            `DELETE FROM contract_notes WHERE id = ?`,
            [noteId],
            async (err) => {
              if (err) {
                reject(err);
              } else {
                // Log the deletion
                if (row) {
                  const contract = await this.getContract(row.contract_id);
                  if (contract) {
                    await this.logActivity({
                      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      contractId: row.contract_id,
                      contractTitle: contract.title,
                      activityType: ActivityType.NOTE_DELETED,
                      description: `Deleted ${row.type} note`,
                      metadata: { noteType: row.type },
                      createdAt: new Date().toISOString()
                    });
                  }
                }
                resolve();
              }
            }
          );
        }
      );
    });
  }

  // Flags management
  async updateContractFlags(contractId: string, flags: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET flags = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(flags), new Date().toISOString(), contractId],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get contract title for logging
            const contract = await this.getContract(contractId);
            if (contract) {
              await this.logActivity({
                id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                contractId: contractId,
                contractTitle: contract.title,
                activityType: ActivityType.FLAGS_UPDATED,
                description: `Contract flags updated (${flags.length} flags)`,
                metadata: { flags },
                createdAt: new Date().toISOString()
              });
            }
            resolve();
          }
        }
      );
    });
  }

  // Priority management
  async updateContractPriority(contractId: string, priority: ContractPriority): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET priority = ?, updated_at = ? WHERE id = ?`,
        [priority, new Date().toISOString(), contractId],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get contract title for logging
            const contract = await this.getContract(contractId);
            if (contract) {
              await this.logActivity({
                id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                contractId: contractId,
                contractTitle: contract.title,
                activityType: ActivityType.PRIORITY_CHANGED,
                description: `Priority changed to "${priority}"`,
                metadata: { newPriority: priority },
                createdAt: new Date().toISOString()
              });
            }
            resolve();
          }
        }
      );
    });
  }

  // Archive management
  async archiveContract(contractId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET is_archived = 1, archived_at = ?, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), new Date().toISOString(), contractId],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get contract title for logging
            const contract = await this.getContract(contractId);
            if (contract) {
              await this.logActivity({
                id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                contractId: contractId,
                contractTitle: contract.title,
                activityType: ActivityType.CONTRACT_ARCHIVED,
                description: `Contract archived`,
                metadata: {},
                createdAt: new Date().toISOString()
              });
            }
            resolve();
          }
        }
      );
    });
  }

  async unarchiveContract(contractId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET is_archived = 0, archived_at = NULL, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), contractId],
        async (err) => {
          if (err) {
            reject(err);
          } else {
            // Get contract title for logging
            const contract = await this.getContract(contractId);
            if (contract) {
              await this.logActivity({
                id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                contractId: contractId,
                contractTitle: contract.title,
                activityType: ActivityType.CONTRACT_UNARCHIVED,
                description: `Contract unarchived`,
                metadata: {},
                createdAt: new Date().toISOString()
              });
            }
            resolve();
          }
        }
      );
    });
  }

  // Dashboard metrics
  async getContractMetrics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    archived: number;
    recentlyAdded: number;
    dueSoon: number;
  }> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as archived,
          SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as recentlyAdded,
          SUM(CASE WHEN deadline > datetime('now') AND deadline <= datetime('now', '+7 days') THEN 1 ELSE 0 END) as dueSoon
         FROM contracts`,
        [],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const baseMetrics = rows[0];
            
            // Get status breakdown
            this.db.all(
              `SELECT status, COUNT(*) as count FROM contracts WHERE is_archived = 0 GROUP BY status`,
              [],
              (err, statusRows: any[]) => {
                if (err) {
                  reject(err);
                } else {
                  const byStatus: Record<string, number> = {};
                  statusRows.forEach(row => {
                    byStatus[row.status] = row.count;
                  });

                  // Get priority breakdown
                  this.db.all(
                    `SELECT priority, COUNT(*) as count FROM contracts WHERE is_archived = 0 GROUP BY priority`,
                    [],
                    (err, priorityRows: any[]) => {
                      if (err) {
                        reject(err);
                      } else {
                        const byPriority: Record<string, number> = {};
                        priorityRows.forEach(row => {
                          byPriority[row.priority] = row.count;
                        });

                        resolve({
                          total: baseMetrics.total,
                          archived: baseMetrics.archived,
                          recentlyAdded: baseMetrics.recentlyAdded,
                          dueSoon: baseMetrics.dueSoon,
                          byStatus,
                          byPriority,
                        });
                      }
                    }
                  );
                }
              }
            );
          }
        }
      );
    });
  }

  // Activity logging methods
  async logActivity(activity: ActivityLog): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO activity_log (id, contract_id, contract_title, activity_type, description, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          activity.id,
          activity.contractId,
          activity.contractTitle,
          activity.activityType,
          activity.description,
          activity.metadata ? JSON.stringify(activity.metadata) : null,
          activity.createdAt
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getRecentActivity(limit: number = 20): Promise<ActivityLog[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?`,
        [limit],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const activities: ActivityLog[] = rows.map(row => ({
              id: row.id,
              contractId: row.contract_id,
              contractTitle: row.contract_title,
              activityType: row.activity_type as ActivityType,
              description: row.description,
              metadata: row.metadata ? JSON.parse(row.metadata) : null,
              createdAt: row.created_at
            }));
            resolve(activities);
          }
        }
      );
    });
  }

  async updateContractAnalysisStatus(contractId: string, analysisStatus: AnalysisStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE contracts SET analysis_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [analysisStatus, contractId],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async updateAnalysisProgress(contractId: string, progress: number, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const progressData = {
        progress,
        message,
        timestamp: new Date().toISOString()
      };
      
      this.db.run(
        `INSERT OR REPLACE INTO ai_analysis (id, contract_id, type, indicators, created_at, updated_at) 
         VALUES (?, ?, 'progress', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [`${contractId}-progress`, contractId, JSON.stringify(progressData)],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getAnalysisProgress(contractId: string): Promise<{ progress: number; message: string } | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT indicators FROM ai_analysis WHERE contract_id = ? AND type = "progress"',
        [contractId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row || !row.indicators) {
            resolve(null);
          } else {
            try {
              resolve(JSON.parse(row.indicators));
            } catch (e) {
              resolve(null);
            }
          }
        }
      );
    });
  }

  async getAnalysisHistory(contractId: string): Promise<Array<{ version: number; analyzedAt: string; documentCount: number; wrapperScore?: number }>> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT version, analyzed_at, documents_analyzed, wrapper_score 
         FROM ai_analysis 
         WHERE contract_id = ? AND type = 'analysis' 
         ORDER BY version DESC`,
        [contractId],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const history = rows.map(row => ({
              version: row.version,
              analyzedAt: row.analyzed_at,
              documentCount: row.documents_analyzed 
                ? JSON.parse(row.documents_analyzed).length 
                : 0,
              wrapperScore: row.wrapper_score
            }));
            resolve(history);
          }
        }
      );
    });
  }

  // Analysis Notes methods
  async getAnalysisNotes(contractId: string, version: number): Promise<AnalysisNote[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM analysis_notes WHERE contract_id = ? AND analysis_version = ? ORDER BY created_at DESC`,
        [contractId, version],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const notes: AnalysisNote[] = rows.map(row => ({
              id: row.id,
              contractId: row.contract_id,
              analysisVersion: row.analysis_version,
              content: row.content,
              type: row.type as NoteType,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }));
            resolve(notes);
          }
        }
      );
    });
  }

  async addAnalysisNote(note: AnalysisNote): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO analysis_notes (id, contract_id, analysis_version, content, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [note.id, note.contractId, note.analysisVersion, note.content, note.type, note.createdAt, note.updatedAt],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async updateAnalysisNote(noteId: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE analysis_notes SET content = ?, updated_at = ? WHERE id = ?`,
        [content, new Date().toISOString(), noteId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async deleteAnalysisNote(noteId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM analysis_notes WHERE id = ?`,
        [noteId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async updateContractAnalysis(contractId: string, analysis: any, documentsAnalyzed?: any[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // First get the latest version number
      this.db.get(
        `SELECT MAX(version) as maxVersion FROM ai_analysis WHERE contract_id = ? AND type = 'analysis'`,
        [contractId],
        async (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          const newVersion = (row?.maxVersion || 0) + 1;
          const wrapperScore = analysis.wrapperScore || 0;
          
          // Mark all previous analyses as not current
          this.db.run(
            `UPDATE ai_analysis SET is_current = 0 WHERE contract_id = ? AND type = 'analysis'`,
            [contractId],
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              // Update the ai_score in contracts table
              this.db.run(
                `UPDATE contracts SET ai_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [wrapperScore, contractId],
                (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  // Insert new analysis version
                  this.db.run(
                    `INSERT INTO ai_analysis 
                     (id, contract_id, type, version, is_current, wrapper_score, indicators, summary, recommendation, documents_analyzed, ai_model, analyzed_at)
                     VALUES (?, ?, 'analysis', ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      `analysis-${contractId}-v${newVersion}`,
                      contractId,
                      newVersion,
                      wrapperScore,
                      JSON.stringify(analysis),
                      analysis.summary || '',
                      analysis.recommendedAction || '',
                      documentsAnalyzed ? JSON.stringify(documentsAnalyzed) : null,
                      analysis.aiModel || '2.0-flash',
                      analysis.analyzedAt || new Date().toISOString()
                    ],
                    async (err) => {
                      if (err) {
                        reject(err);
                      } else {
                        // Log analysis completion
                        await this.logActivity({
                          id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          contractId: contractId,
                          contractTitle: '',
                          activityType: ActivityType.ANALYSIS_COMPLETED,
                          description: `Contract analysis completed with wrapper score: ${wrapperScore}% (Version ${newVersion})`,
                          metadata: {
                            wrapperScore: wrapperScore,
                            contractType: analysis.contractType,
                            version: newVersion,
                            documentCount: documentsAnalyzed?.length || 0
                          },
                          createdAt: new Date().toISOString()
                        });
                        resolve();
                      }
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }

  // Search history management (method already exists, keeping existing implementation)

  async getSearchHistory(limit: number = 50): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM search_history ORDER BY scraped_at DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Search contracts in database
  async searchContracts(query: string, filters: any = {}): Promise<Contract[]> {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT * FROM contracts 
        WHERE (title LIKE ? OR description LIKE ? OR solicitation_number LIKE ?)
      `;
      let params: any[] = [`%${query}%`, `%${query}%`, `%${query}%`];
      
      // Add filters
      if (filters.status) {
        sql += ` AND status = ?`;
        params.push(filters.status);
      }
      
      if (filters.isArchived !== undefined) {
        sql += ` AND is_archived = ?`;
        params.push(filters.isArchived ? 1 : 0);
      }
      
      if (filters.priority) {
        sql += ` AND priority = ?`;
        params.push(filters.priority);
      }
      
      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(filters.limit || 100);
      
      this.db.all(sql, params, async (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const contracts: Contract[] = [];
          for (const row of rows) {
            const attachments = await this.getAttachments(row.id);
            const aiAnalysis = await this.getAIAnalysis(row.id);
            
            contracts.push({
              id: row.id,
              title: row.title,
              url: row.url,
              description: row.description,
              postedDate: row.posted_date,
              deadline: row.deadline,
              status: row.status,
              aiScore: row.ai_score,
              aiAnalysis: aiAnalysis,
              attachments: attachments,
              flags: row.flags ? JSON.parse(row.flags) : [],
              priority: row.priority,
              organizationId: row.organization_id,
              solicitationNumber: row.solicitation_number,
              classificationCode: row.classification_code,
              setAside: row.set_aside,
              naicsCodes: row.naics_codes ? JSON.parse(row.naics_codes) : [],
              fetchMethod: row.fetch_method,
              apiSource: row.api_source,
              fetchDurationMs: row.fetch_duration_ms,
              lastViewedAt: row.last_viewed_at,
              viewCount: row.view_count,
              analysisStatus: row.analysis_status,
              isArchived: row.is_archived === 1,
              archivedAt: row.archived_at,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            });
          }
          resolve(contracts);
        }
      });
    });
  }

  // Check if contracts exist in database
  async contractsExist(contractIds: string[]): Promise<{ [key: string]: boolean }> {
    return new Promise((resolve, reject) => {
      const placeholders = contractIds.map(() => '?').join(',');
      this.db.all(
        `SELECT id FROM contracts WHERE id IN (${placeholders})`,
        contractIds,
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const existingIds = new Set(rows.map((row: any) => row.id));
            const results: { [key: string]: boolean } = {};
            
            contractIds.forEach(id => {
              results[id] = existingIds.has(id);
            });
            
            resolve(results);
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export default DatabaseService;