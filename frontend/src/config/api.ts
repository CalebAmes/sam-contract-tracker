// API configuration for different environments
const isDevelopment = process.env.NODE_ENV === "development";

// Allow override via environment variable, otherwise use defaults
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (isDevelopment ? "http://localhost:3001" : "http://spicymini:3001");

// Debug logging
console.log("API Configuration:", {
  NODE_ENV: process.env.NODE_ENV,
  REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
  isDevelopment,
  API_BASE_URL,
});

// Export for use throughout the app
export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  endpoints: {
    // Contract endpoints
    fetchContractClient: `${API_BASE_URL}/api/fetch-contract-client`,
    previewContractClient: `${API_BASE_URL}/api/preview-contract-client`,
    checkInDatabase: `${API_BASE_URL}/api/contracts/check-in-database`,
    contractStatus: (id: string) =>
      `${API_BASE_URL}/api/contracts/${id}/status`,

    // Search endpoints
    search: `${API_BASE_URL}/api/search`,
    searchDirect: `${API_BASE_URL}/api/search-direct`,

    // Analysis endpoints
    analyze: `${API_BASE_URL}/api/analyze`,

    // Contract management
    contracts: `${API_BASE_URL}/api/contracts`,
    contract: (id: string) => `${API_BASE_URL}/api/contracts/${id}`,
  },
};

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  return endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
};
