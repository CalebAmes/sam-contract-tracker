import {
  SDRIntakeOpportunity,
  SDRIntakeNote,
  SDRScoreMetricDefinition,
  SDRScorecard,
} from "./schema";

const intakeOpportunities: SDRIntakeOpportunity[] = [];
const intakeNotes: SDRIntakeNote[] = [];
const scoringMetrics: SDRScoreMetricDefinition[] = [
  {
    id: "tech-fit",
    label: "Technical Fit",
    description: "How well the opportunity aligns with our product capabilities.",
  },
  {
    id: "contract-viability",
    label: "Contract Viability",
    description: "Likelihood that we can compliantly pursue the opportunity.",
  },
  {
    id: "competitiveness",
    label: "Competitiveness",
    description: "How competitive we are compared to the incumbent landscape.",
  },
];
const scorecards: SDRScorecard[] = [];

export const SDRIntakeRepository = {
  async list(): Promise<SDRIntakeOpportunity[]> {
    return intakeOpportunities;
  },

  async getById(id: string): Promise<SDRIntakeOpportunity | undefined> {
    return intakeOpportunities.find((item) => item.id === id);
  },

  async listNotes(opportunityId: string): Promise<SDRIntakeNote[]> {
    return intakeNotes.filter((note) => note.opportunityId === opportunityId);
  },
};

export const SDRScoringRepository = {
  async listScorecards(): Promise<SDRScorecard[]> {
    return scorecards;
  },

  async listMetricDefinitions(): Promise<SDRScoreMetricDefinition[]> {
    return scoringMetrics;
  },
};
