import axios from "axios";
import qs from "qs";
import { createRateLimiter, describeAxiosError } from "../lib/rateLimiter";
import { SamSearchResult, SamSearchResponse } from "./intakeFetcher";

const SEARCH_BASE_URL =
  process.env.SAM_API_SEARCH_URL || "https://sam.gov/api/prod/sgs/v1/search";
const OPPORTUNITY_BASE_URL = "https://sam.gov/api/prod/opps/v2/opportunities";
const ENTITY_DETAILS_BASE_URL =
  process.env.SAM_ENTITY_DETAILS_URL ||
  "https://sam.gov/api/prod/view-entity-details/v4/api/entity";
const DEFAULT_PAGE_SIZE = 100;

const samApiLimiter = createRateLimiter({
  concurrency: 4,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  maxRetries: 5,
});

async function requestSam<T>(
  context: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await samApiLimiter.schedule(fn);
  } catch (error) {
    console.error(`${context} failed`, error);
    throw describeAxiosError(error, context);
  }
}

interface SearchAwardsOptions {
  uei: string;
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

interface EntityDetailResponse {
  coreData?: any;
  entityData?: {
    coreData?: any;
  };
}

function createHeaders() {
  return {
    Accept: "application/hal+json, application/json",
  };
}

function createAuthorizedHeaders(token: string) {
  return {
    ...createHeaders(),
    "x-auth-token": token,
  };
}

export async function fetchAwardsForEntity({
  uei,
  cutoffIso,
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = 10,
}: SearchAwardsOptions): Promise<SamSearchResult[]> {
  const results: SamSearchResult[] = [];
  let page = 0;
  let stop = false;

  while (!stop && page < maxPages) {
    const response = await requestSam(`[sam] fetch awards for UEI ${uei}`, () =>
      axios.get<SamSearchResponse>(SEARCH_BASE_URL, {
        headers: createHeaders(),
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
        paramsSerializer: (params) =>
          qs.stringify(params, { arrayFormat: "repeat" }),
      })
    );

    const pageResults = response.data?._embedded?.results ?? [];
    if (pageResults.length === 0) {
      break;
    }

    for (const result of pageResults) {
      const modifiedTime = result.modifiedDate
        ? new Date(result.modifiedDate).getTime()
        : Number.NaN;
      if (
        !Number.isNaN(modifiedTime) &&
        modifiedTime < new Date(cutoffIso).getTime()
      ) {
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
    const response = await requestSam(
      `[sam] fetch award detail ${opportunityId}`,
      () =>
        axios.get<AwardDetailResponse>(
          `${OPPORTUNITY_BASE_URL}/${opportunityId}`,
          {
            headers: createHeaders(),
            params: {
              api_key: "null",
              random: Date.now(),
            },
          }
        )
    );
    return response.data;
  } catch (error) {
    const enhanced =
      error instanceof Error
        ? error
        : describeAxiosError(
            error,
            `[sam] fetch award detail ${opportunityId}`
          );
    console.warn(enhanced.message);
    throw enhanced;
  }
}

export async function fetchEntityCoreData(
  uei: string,
  authToken?: string
): Promise<EntityDetailResponse | undefined> {
  if (!authToken) {
    return undefined;
  }
  try {
    const response = await requestSam(
      `[sam] fetch entity detail ${uei}`,
      () =>
        axios.get<EntityDetailResponse>(`${ENTITY_DETAILS_BASE_URL}/${uei}`, {
          headers: createAuthorizedHeaders(authToken),
          params: {
            sort: "name",
            sectionName: "coreData",
            status: "Active",
            responseType: "json",
            api_key: "null",
            random: Date.now(),
          },
        })
    );
    return response.data;
  } catch (error) {
    const enhanced =
      error instanceof Error
        ? error
        : describeAxiosError(error, `[sam] fetch entity detail ${uei}`);
    console.warn(enhanced.message);
    return undefined;
  }
}
