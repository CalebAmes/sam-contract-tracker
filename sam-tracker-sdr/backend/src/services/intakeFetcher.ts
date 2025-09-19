import axios, { isAxiosError } from "axios";
import { SDRIntakeRepository } from "../db/entities";
import { SDRIntakeOpportunity } from "../db/schema";

const DEFAULT_SEARCH_URL = "https://sam.gov/api/prod/sgs/v1/search";
const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 200;
const LOOKBACK_DAYS = 7;
const MAX_PAGES = 20;
const MAX_RECORDS = PAGE_SIZE * MAX_PAGES;

type SamSearchResult = {
  _id?: string;
  title?: string;
  solicitationNumber?: string;
  modifiedDate?: string;
  publishDate?: string;
  type?: { code?: string; value?: string };
  award?: {
    awardDate?: string;
    awardee?: {
      ueiSAM?: string;
      name?: string;
    };
  };
  naics?: Array<{ code?: string }>;
  naicsCodes?: Array<{ code?: string }>;
  organizationHierarchy?: Array<{
    level?: number;
    name?: string;
    type?: string;
  }>;
  totalObligatedAmount?: number;
  totalContractValue?: number;
};

type SamSearchResponse = {
  _embedded?: {
    results?: SamSearchResult[];
  };
  page?: {
    number?: number;
    totalPages?: number;
  };
};

function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function parseValue(result: SamSearchResult): string | undefined {
  const raw =
    (result as any)?.award?.amount ||
    result.totalObligatedAmount ||
    result.totalContractValue;
  if (typeof raw === "number") {
    return `$${raw.toLocaleString()}`;
  }
  return undefined;
}

function composeAgency(result: SamSearchResult): string {
  const nodes = result.organizationHierarchy ?? [];
  if (nodes.length === 0) {
    return "Unknown";
  }
  const department = nodes.find((node) => node.level === 1)?.name;
  const agency = nodes.find((node) => node.level === 2)?.name;
  if (department && agency) {
    return `${department} / ${agency}`;
  }
  return nodes.map((node) => node.name).filter(Boolean).join(" / ") || "Unknown";
}

function composeAwardingOffice(result: SamSearchResult): string | undefined {
  const nodes = result.organizationHierarchy ?? [];
  if (nodes.length === 0) {
    return undefined;
  }
  const deepest = [...nodes].sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
  return deepest?.name ?? undefined;
}

function pickNaics(result: SamSearchResult): string {
  const candidates = [
    ...(result.naicsCodes ?? []).map((entry) => entry.code),
    ...(result.naics ?? []).map((entry) => entry.code),
  ].filter(Boolean);
  if (candidates.length > 0) {
    return candidates[0] as string;
  }
  return "Unknown";
}

function coerceIsoDate(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function mapResultToOpportunity(result: SamSearchResult): SDRIntakeOpportunity | undefined {
  const id = result._id;
  if (!id) {
    return undefined;
  }
  const modifiedDate = coerceIsoDate(result.modifiedDate);
  const awardDate = coerceIsoDate(result.award?.awardDate);

  return {
    id,
    solicitationNumber: result.solicitationNumber ?? "",
    title: result.title ?? "Untitled Award",
    agency: composeAgency(result),
    naics: pickNaics(result),
    postedDate: coerceIsoDate(result.publishDate) ?? undefined,
    awardDate,
    modifiedDate,
    status: "new",
    contractType: result.type?.value,
    awardeeName: result.award?.awardee?.name,
    awardeeUei: result.award?.awardee?.ueiSAM,
    awardingOffice: composeAwardingOffice(result),
    value: parseValue(result),
  };
}

interface FetchOptions {
  limit?: number;
}

export async function fetchRecentAwards(options: FetchOptions = {}) {
  const baseURL = process.env.SAM_API_SEARCH_URL || DEFAULT_SEARCH_URL;
  const setAside = (process.env.SAM_API_SET_ASIDE || "SBA").trim();
  const statusParam = process.env.SAM_API_STATUS
    ? process.env.SAM_API_STATUS
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(",")
    : undefined;
  const client = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      Accept: "application/hal+json, application/json",
    },
  });

  const existingIds = await SDRIntakeRepository.existingIds();
  const cutoffTime = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  let page = 0;
  let stop = false;
  let created = 0;
  let pageCapReached = false;
  const limit = options.limit ?? Infinity;
  const effectiveMaxRecords = options.limit ? Math.min(limit, MAX_RECORDS) : MAX_RECORDS;

  console.log("[intake] fetchRecentAwards starting", {
    baseURL,
    pageSize: PAGE_SIZE,
    lookbackDays: LOOKBACK_DAYS,
    maxPages: MAX_PAGES,
    maxRecords: effectiveMaxRecords,
    setAside,
    status: statusParam,
    limit,
  });

  while (!stop) {
    let response: { data: SamSearchResponse };
    try {
      response = await client.get<SamSearchResponse>("", {
        params: {
          random: Date.now(),
          index: "opp",
          page,
          sort: "-modifiedDate",
          size: PAGE_SIZE,
          mode: "search",
          responseType: "json",
          q: "",
          qMode: "ALL",
          notice_type: "a",
          set_aside: setAside,
          ...(statusParam ? { status: statusParam } : {}),
        },
      });
    } catch (error) {
      const details = isAxiosError(error)
        ? {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          }
        : { message: (error as Error)?.message };
      console.error("[intake] SAM.gov request failed", {
        page,
        ...details,
      });
      throw error;
    }

    const results = response.data?._embedded?.results ?? [];
    console.log("[intake] SAM.gov request succeeded", {
      page,
      count: results.length,
      firstId: results[0]?._id,
      lastId: results[results.length - 1]?._id,
    });
    if (results.length === 0) {
      break;
    }

    for (const result of results) {
      const id = result._id;
      if (!id) {
        continue;
      }
      if (existingIds.has(id)) {
        stop = true;
        break;
      }

      const modifiedTime = result.modifiedDate ? new Date(result.modifiedDate).getTime() : Number.NaN;
      if (Number.isNaN(modifiedTime) || modifiedTime < cutoffTime) {
        stop = true;
        break;
      }

      const opportunity = mapResultToOpportunity(result);
      if (!opportunity) {
        continue;
      }

      await SDRIntakeRepository.ingestOpportunity(opportunity);
      existingIds.add(id);
      created += 1;

       if (created >= limit) {
         stop = true;
         break;
       }
    }

    const lastResult = results[results.length - 1];
    if (!lastResult?.modifiedDate) {
      stop = true;
    } else {
      const lastModifiedTime = new Date(lastResult.modifiedDate).getTime();
      if (!Number.isNaN(lastModifiedTime) && lastModifiedTime < cutoffTime) {
        stop = true;
      }
    }

    const totalPages = response.data?.page?.totalPages ?? page + 1;
    const nextPageIndex = page + 1;
    const reachedTotalPages = nextPageIndex >= totalPages;
    const reachedCap = nextPageIndex >= MAX_PAGES;
    if (stop || reachedTotalPages || reachedCap) {
      if (reachedCap && !stop && !reachedTotalPages) {
        pageCapReached = true;
      }
      break;
    }

    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  const summary = {
    created,
    totalStored: (await SDRIntakeRepository.list()).length,
    pagesProcessed: page + 1,
  };
  console.log("[intake] fetchRecentAwards completed", summary);
  if (pageCapReached && !options.limit) {
    throw new Error(
      `SAM.gov fetch stopped after ${MAX_RECORDS} records without reaching the lookback threshold. Refine filters to narrow results.`
    );
  }
  return summary;
}
