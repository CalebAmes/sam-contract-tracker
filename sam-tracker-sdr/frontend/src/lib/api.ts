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

export async function triggerIntakeFetch() {
  const { data } = await apiClient.post("/intake/fetch");
  return data;
}

export async function triggerIntakeFetchLatest() {
  const { data } = await apiClient.post("/intake/fetch/latest");
  return data;
}

export async function deleteAllIntakeAwards() {
  const { data } = await apiClient.delete("/intake");
  return data;
}

export async function fetchScoringSummary() {
  const { data } = await apiClient.get("/scoring/scorecards");
  return data?.data ?? [];
}

export async function fetchScoringColumns() {
  const { data } = await apiClient.get("/scoring/metrics");
  return data?.data ?? [];
}

export async function deleteAllScoringEntities() {
  const { data } = await apiClient.delete("/scoring/entities");
  return data;
}
