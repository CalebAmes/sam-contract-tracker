export type SDRIntakeStatus = "new" | "triaged" | "in_review" | "completed";

export interface SDRIntakeOpportunity {
  id: string;
  solicitationNumber: string;
  title: string;
  agency: string;
  naics: string;
  postedDate?: string;
  responseDate?: string;
  status: SDRIntakeStatus;
  contractType?: string;
  awardDate?: string;
  modifiedDate?: string;
  awardeeName?: string;
  awardeeUei?: string;
  awardingOffice?: string;
  value?: string;
  awardAmount?: string;
  setAside?: string;
  placeCity?: string;
  placeState?: string;
  placeCountry?: string;
  contactName?: string;
  contactEmail?: string;
}

export interface SDRIntakeNote {
  id: string;
  opportunityId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface SDRScorecard {
  id: string;
  opportunityId: string;
  reviewer: string;
  technicalFit: number;
  contractViability: number;
  competitiveness: number;
  summary: string;
  createdAt: string;
}

export interface SDRScoreMetricDefinition {
  id: string;
  label: string;
  description: string;
}

export interface SDRNaicsEntry {
  code: string;
  description: string;
  isRelevant: boolean;
}

export interface SDRAwardRecord {
  id: string;
  vendorName: string;
  duns: string;
  agency: string;
  naics: string;
  title: string;
  awardDate: string;
}

export interface SDRScoringEntity {
  id: string;
  entityName: string;
  uei: string;
  primaryNaics: string;
  recentAwardDate: string;
  awardsLastYear: number;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  status: "pending" | "queued" | "processing" | "ready";
  stale: boolean;
}

export type SDRScoringJobStatus = "queued" | "processing" | "completed" | "failed";

export interface SDRScoringJob {
  id: string;
  entityId: string;
  status: SDRScoringJobStatus;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  entityName?: string;
  entityUei?: string;
  authToken?: string | null;
}
