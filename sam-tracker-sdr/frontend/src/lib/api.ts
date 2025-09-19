import axios from "axios";

const baseURL = process.env.REACT_APP_SDR_API_URL || "http://localhost:4301/api";

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
});

export async function fetchIntakeOpportunities() {
  const { data } = await apiClient.get("/intake");
  return data?.data ?? [];
}

export async function fetchScoringSummary() {
  const { data } = await apiClient.get("/scoring/scorecards");
  return data?.data ?? [];
}

export async function fetchScoringColumns() {
  const { data } = await apiClient.get("/scoring/metrics");
  return data?.data ?? [];
}
