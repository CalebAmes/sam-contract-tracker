export type SDRIntakeStatus = "new" | "triaged" | "in_review" | "completed";

export interface SDRIntakeOpportunity {
  id: string;
  solicitationNumber: string;
  title: string;
  agency: string;
  naics: string;
  postedDate: string;
  responseDate?: string;
  status: SDRIntakeStatus;
  contractType?: string;
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
