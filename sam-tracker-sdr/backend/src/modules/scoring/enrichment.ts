import { SDRScoringJob, SDRIntakeOpportunity } from "../../db/schema";
import { SDRIntakeRepository, SDRScoringQueueRepository, SDRScoringRepository } from "../../db/entities";
import { fetchAwardsForEntity, fetchAwardDetail } from "../../services/sam-entity-awards";
import { mapSearchResultToOpportunity, SamSearchResult } from "../../services/intakeFetcher";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const size = Math.min(concurrency, items.length);
  const runners = Array.from({ length: size }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const item = items[currentIndex];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function mergeAwardDetail(base: any, detail: any) {
  const data2 = detail?.data2;
  const awardInfo = data2?.award;
  const poc = data2?.pointOfContact?.find((contact: any) => contact?.type === "primary") || data2?.pointOfContact?.[0];
  const place = data2?.placeOfPerformance;
  const solicitation = data2?.solicitation;
  const naicsCandidates: string[] = [];

  const awardNaics = awardInfo?.naics as any;
  if (awardNaics?.code) {
    if (Array.isArray(awardNaics.code)) {
      naicsCandidates.push(...awardNaics.code.map(String));
    } else {
      naicsCandidates.push(String(awardNaics.code));
    }
  }

  if (Array.isArray(data2?.naics)) {
    for (const entry of data2.naics) {
      const code = entry?.code as any;
      if (!code) {
        continue;
      }
      if (Array.isArray(code)) {
        naicsCandidates.push(...code.map(String));
      } else {
        naicsCandidates.push(String(code));
      }
    }
  }

  const detailNaics = naicsCandidates.find((value) => value && value.trim().length > 0);

  return {
    ...base,
    title: data2?.title ?? base.title,
    awardDate: awardInfo?.date ?? base.awardDate,
    value: awardInfo?.amount ?? base.value,
    awardAmount: awardInfo?.amount ?? base.awardAmount,
    naics: detailNaics ?? base.naics,
    setAside: solicitation?.setAside ?? base.setAside,
    placeCity: place?.city?.name ?? base.placeCity,
    placeState: place?.state?.code ?? base.placeState,
    placeCountry: place?.country?.name ?? base.placeCountry,
    contactName: poc?.fullName ?? base.contactName,
    contactEmail: poc?.email ?? base.contactEmail,
  };
}

export async function processScoringJob(job: SDRScoringJob) {
  if (!job.authToken) {
    throw new Error("No auth token available for scoring job");
  }

  console.info(
    `[scoring] starting enrichment for job ${job.id} (entity ${job.entityId})`
  );

  const entity = await SDRScoringRepository.getEntityById(job.entityId);
  if (!entity) {
    throw new Error(`Entity ${job.entityId} not found`);
  }
  if (!entity.uei) {
    throw new Error(`Entity ${job.entityId} missing UEI`);
  }

  const cutoffIso = new Date(Date.now() - ONE_YEAR_MS).toISOString();
  const authToken = job.authToken!;

  const results = await fetchAwardsForEntity({
    uei: entity.uei,
    authToken,
    cutoffIso,
  });

  type Target = { result: SamSearchResult; base: SDRIntakeOpportunity };
  const targets: Target[] = [];

  for (const result of results) {
    if (!result._id) {
      continue;
    }
    const base = mapSearchResultToOpportunity(result);
    if (!base) {
      continue;
    }
    targets.push({ result, base });
  }

  await runWithConcurrency(targets, 4, async ({ result, base }) => {
    try {
      const detail = await fetchAwardDetail(result._id!, authToken);
      const merged = mergeAwardDetail(base, detail);
      await SDRIntakeRepository.ingestOpportunity(merged);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[scoring] unable to enrich award ${result._id} for entity ${job.entityId}`,
        error
      );
      throw new Error(`[sam] enrichment failed for award ${result._id}: ${message}`);
    }
  });

  await SDRScoringQueueRepository.markEntityRescored(job.entityId);
  console.info(
    `[scoring] completed enrichment for job ${job.id} (entity ${job.entityId}) with ${targets.length} awards`
  );
}
