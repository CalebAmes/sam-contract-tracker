export interface Contract {
  id: string;
  title: string;
  url: string;
  description: string;
  postedDate: string;
  deadline: string;
  status: ContractStatus;
  aiScore: number;
  aiAnalysis?: AIAnalysis;
  attachments: Attachment[];
  // Lifecycle tracking
  flags: ContractFlag[];
  priority?: ContractPriority;
  internalNotes?: ContractNote[];
  // New tracking fields
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

export interface ContractNote {
  id: string;
  contractId: string;
  content: string;
  type: NoteType;
  createdAt: string;
  updatedAt: string;
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

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size?: number;
  downloaded: boolean;
  downloadedAt?: string;
  content?: string; // Extracted text content
}

export interface AIAnalysis {
  wrapperScore: number; // 0-100 score for wrapper contract likelihood
  contractType: 'SaaS Reseller' | 'Hardware Reseller' | 'Professional Services' | 'Hybrid' | 'Custom Development' | 'Unknown';
  summary: string;
  redFlags: Array<{
    flag: string;
    detail: string;
    severity: 'high' | 'medium' | 'low';
  }>;
  incumbentInfo: {
    vendor: string | null;
    contractNumber: string | null;
    expirationDate: string | null;
  };
  recommendedAction: string;
  keyDates: {
    currentDeadline: string;
    contractStart: string;
    urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  };
  estimatedValue: string;
  competitionLevel: 'low' | 'medium' | 'high';
  competitionNotes: string;
  analyzedAt: string;
}

export interface WrapperIndicator {
  type: WrapperIndicatorType;
  found: boolean;
  evidence: string[];
  confidence: number; // 0-1
}

export enum WrapperIndicatorType {
  INCUMBENT_REFERENCE = 'incumbent_reference',
  FOLLOW_ON_LANGUAGE = 'follow_on_language',
  ENTERPRISE_REQUIREMENTS = 'enterprise_requirements',
  SHORT_TIMELINE = 'short_timeline',
  MULTIPLE_EXTENSIONS = 'multiple_extensions',
  MIDDLEMAN_TERMS = 'middleman_terms',
  UNREALISTIC_SMALL_BIZ = 'unrealistic_small_biz'
}

export enum ContractStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  INTERESTED = 'interested',
  DISMISSED = 'dismissed',
  APPLIED = 'applied',
  ARCHIVED = 'archived'
}

// Disqualifying Flags (Red)
export enum DisqualifyingFlag {
  NOT_FIT_TECH_STACK = 'not_fit_tech_stack',
  NOT_FIT_COMPLIANCE = 'not_fit_compliance', 
  NOT_FIT_TIMELINE = 'not_fit_timeline',
  NOT_FIT_TOO_COMPLEX = 'not_fit_too_complex',
  REQUIRES_PARTNER = 'requires_partner',
  NO_BUDGET_CEILING = 'no_budget_ceiling'
}

// Strategic Flags (Green)
export enum StrategicFlag {
  STRONG_FIT = 'strong_fit',
  REPEAT_BUYER = 'repeat_buyer',
  GREAT_CASE_STUDY = 'great_case_study',
  AGENCY_BREAK_INTO = 'agency_break_into',
  NO_INCUMBENT = 'no_incumbent',
  LOW_COMPETITION = 'low_competition'
}

// Post-Award Flags (Gray)
export enum PostAwardFlag {
  BID_SUBMITTED = 'bid_submitted',
  AWARDED = 'awarded',
  LOST_COMPETITIVE = 'lost_competitive',
  LOST_DISQUALIFIED = 'lost_disqualified',
  FOLLOW_UP_LATER = 'follow_up_later',
  FEEDBACK_RECEIVED = 'feedback_received'
}

export type ContractFlag = DisqualifyingFlag | StrategicFlag | PostAwardFlag;

export enum AnalysisStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface ContractContextState {
  contracts: Contract[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

export interface ContractContextActions {
  addContracts: (contracts: Contract[]) => void;
  updateContract: (id: string, updates: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
  updateStatus: (id: string, status: ContractStatus) => void;
  refreshContracts: () => void;
  clearError: () => void;
}

export interface SAMSearchParams {
  url: string;
  maxResults?: number;
}

export interface SAMSearchResult {
  contracts: Contract[];
  totalFound: number;
  searchUrl: string;
  scrapedAt: string;
}

export interface GeminiAnalysisRequest {
  contractText: string;
  attachmentTexts: string[];
  contractTitle: string;
}

export interface ThemeMode {
  mode: 'light' | 'dark' | 'system';
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

export interface ActivityLog {
  id: string;
  contractId: string;
  contractTitle: string;
  activityType: ActivityType;
  description: string;
  metadata?: any;
  createdAt: string;
}