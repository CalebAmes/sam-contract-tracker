import axios from "axios";
import { samApiKeyManager } from "./samApiKeyManager";

const SAM_API_BASE = "https://api.sam.gov";

export const fetchSingleOpportunity = async (opportunityId: string) => {
  const apiUrl = `${SAM_API_BASE}/opportunities/v2/${opportunityId}`;

  // First attempt with current key
  try {
    const params = {
      api_key: samApiKeyManager.getCurrentKey(),
    };

    console.log(
      `Making SAM API call with key ${
        samApiKeyManager.getCurrentKeyIndex() + 1
      }`
    );

    const response = await axios.get(apiUrl, {
      params,
      timeout: 30000,
      headers: {
        "User-Agent": "sam-contract-tracker/0.1",
        Accept: "application/json",
      },
    });

    return response.data;
  } catch (error: any) {
    // If 429 error and we have more keys, rotate and retry
    if (error.response?.status === 429 && samApiKeyManager.hasMoreKeys()) {
      console.log("Received 429 error, rotating API key and retrying...");
      samApiKeyManager.rotateKey();

      // Retry with new key
      const params = {
        api_key: samApiKeyManager.getCurrentKey(),
      };

      console.log(
        `Retrying SAM API call with key ${
          samApiKeyManager.getCurrentKeyIndex() + 1
        }`
      );

      const response = await axios.get(apiUrl, {
        params,
        timeout: 30000,
        headers: {
          "User-Agent": "sam-contract-tracker/0.1",
          Accept: "application/json",
        },
      });

      return response.data;
    }

    // Re-throw original error if not 429 or no more keys
    throw error;
  }
};
