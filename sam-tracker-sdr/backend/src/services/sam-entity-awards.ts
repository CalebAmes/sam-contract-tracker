import axios from "axios";
import qs from "qs";
import { SamSearchResult, SamSearchResponse } from "./intakeFetcher";

const SEARCH_BASE_URL = process.env.SAM_API_SEARCH_URL || "https://sam.gov/api/prod/sgs/v1/search";
const OPPORTUNITY_BASE_URL = "https://sam.gov/api/prod/opps/v2/opportunities";
const DEFAULT_PAGE_SIZE = 100;

interface SearchAwardsOptions {
  uei: string;
  authToken: string;
  cutoffIso: string;
  pageSize?: number;
  maxPages?: number;
}

interface AwardDetailResponse {
  data2?: {
    award?: {
      date?: string;
      amount?: string;
      number?: string;
      awardee?: {
        name?: string;
        ueiSAM?: string;
        location?: {
          city?: { name?: string };
          state?: { code?: string };
          country?: { name?: string };
        };
      };
    };
    naics?: Array<{ code?: string[]; type?: string }>;
    title?: string;
    solicitation?: {
      setAside?: string;
    };
    pointOfContact?: Array<{
      type?: string;
      fullName?: string;
      email?: string;
    }>;
    placeOfPerformance?: {
      city?: { name?: string };
      state?: { code?: string };
      country?: { name?: string };
    };
  };
  solicitationNumber?: string;
  description?: Array<{ body?: string }>;
}

function createHeaders(token: string) {
  return {
    "x-auth-token": token,
    Accept: "application/json",
  };
}

export async function fetchAwardsForEntity({
  uei,
  authToken,
  cutoffIso,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = 10,
}: SearchAwardsOptions): Promise<SamSearchResult[]> {
  const results: SamSearchResult[] = [];
  let page = 0;
  let stop = false;

  while (!stop && page < maxPages) {
    const response = await axios.get<SamSearchResponse>(SEARCH_BASE_URL, {
      headers: createHeaders(authToken),
      params: {
        random: Date.now(),
        index: "opp",
        page,
        sort: "-modifiedDate",
        size: pageSize,
        mode: "search",
        responseType: "json",
        q: "",
        qMode: "ALL",
        notice_type: "a",
        ueiSAM: uei,
        // Optionally reuse set-aside filters from env if configured
        set_aside: process.env.SAM_API_SET_ASIDE,
      },
      paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
    });

    const pageResults = response.data?._embedded?.results ?? [];
    if (pageResults.length === 0) {
      break;
    }

    for (const result of pageResults) {
      const modifiedTime = result.modifiedDate ? new Date(result.modifiedDate).getTime() : Number.NaN;
      if (!Number.isNaN(modifiedTime) && modifiedTime < new Date(cutoffIso).getTime()) {
        stop = true;
        break;
      }
      results.push(result);
    }

    const totalPages = response.data?.page?.totalPages ?? page + 1;
    if (stop || page + 1 >= totalPages) {
      break;
    }
    page += 1;
  }

  return results;
}

export async function fetchAwardDetail(
  opportunityId: string,
  authToken: string
): Promise<AwardDetailResponse | undefined> {
  try {
    const response = await axios.get<AwardDetailResponse>(`${OPPORTUNITY_BASE_URL}/${opportunityId}`, {
      headers: createHeaders(authToken),
      params: {
        api_key: "null",
        random: Date.now(),
      },
    });
    return response.data;
  } catch (error) {
    console.warn(`[sam] unable to fetch award detail for ${opportunityId}`, error);
    return undefined;
  }
}
