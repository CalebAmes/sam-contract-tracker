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
    // Chat endpoints
    createChatSession: `${API_BASE_URL}/api/chat/sessions`,
    listChatSessions: (contractId: string) =>
      `${API_BASE_URL}/api/chat/sessions/${contractId}`,
    getChatMessages: (sessionId: string) =>
      `${API_BASE_URL}/api/chat/messages/${sessionId}`,
    sendChatMessage: (sessionId: string) =>
      `${API_BASE_URL}/api/chat/messages/${sessionId}`,
    streamChat: (sessionId: string) =>
      `${API_BASE_URL}/api/chat/stream/${sessionId}`,
    streamChatContinue: (sessionId: string) =>
      `${API_BASE_URL}/api/chat/continue/${sessionId}`,
    chatFeedback: (messageId: string) =>
      `${API_BASE_URL}/api/chat/messages/${messageId}/feedback`,
    solicitationStatus: (solicitationId: string) =>
      `${API_BASE_URL}/api/solicitations/${solicitationId}/status`,
    solicitationIngest: (solicitationId: string) =>
      `${API_BASE_URL}/api/solicitations/${solicitationId}/ingest`,
  },
};

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  return endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
};
