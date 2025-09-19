import axios from "axios";
import { SDRNaicsEntry } from "../db/schema";

export async function searchNaics(
  _query: string
): Promise<SDRNaicsEntry[]> {
  if (process.env.DEBUG_SDR_HTTP === "true") {
    console.log("[sam-naics] search skipped in skeleton build");
  }
  await Promise.resolve();
  return [];
}

export async function loadDefaultNaics(): Promise<SDRNaicsEntry[]> {
  if (!process.env.SDR_NAICS_SOURCE_URL) {
    return [];
  }
  try {
    const { data } = await axios.get<SDRNaicsEntry[]>(
      process.env.SDR_NAICS_SOURCE_URL
    );
    return data;
  } catch (err) {
    console.warn("[sam-naics] unable to load default NAICS set", err);
    return [];
  }
}
