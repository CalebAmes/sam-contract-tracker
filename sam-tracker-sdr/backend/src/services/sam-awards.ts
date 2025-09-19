import axios from "axios";
import { SDRAwardRecord } from "../db/schema";

export interface AwardLookupParams {
  duns?: string;
  naics?: string;
  keyword?: string;
}

export async function fetchAwards(
  _params: AwardLookupParams
): Promise<SDRAwardRecord[]> {
  if (process.env.DEBUG_SDR_HTTP === "true") {
    console.log("[sam-awards] skipping remote call in skeleton build");
  }
  await Promise.resolve();
  return [];
}

export async function pingAwardsApi(): Promise<boolean> {
  try {
    if (process.env.SAM_AWARDS_HEALTHCHECK_URL) {
      await axios.get(process.env.SAM_AWARDS_HEALTHCHECK_URL);
    }
    return true;
  } catch (err) {
    console.warn("[sam-awards] healthcheck failed", err);
    return false;
  }
}
