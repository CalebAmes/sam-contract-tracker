import { SDRScoringJob } from "../../db/schema";
import { SDRIntakeRepository, SDRScoringQueueRepository, SDRScoringRepository } from "../../db/entities";
import { fetchAwardsForEntity, fetchAwardDetail } from "../../services/sam-entity-awards";
import { mapSearchResultToOpportunity } from "../../services/intakeFetcher";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function mergeAwardDetail(base: any, detail: any) {
  const data2 = detail?.data2;
  const awardInfo = data2?.award;
  const poc = data2?.pointOfContact?.find((contact: any) => contact?.type === "primary") || data2?.pointOfContact?.[0];
  const place = data2?.placeOfPerformance;
  const solicitation = data2?.solicitation;

  return {
    ...base,
    title: data2?.title ?? base.title,
    awardDate: awardInfo?.date ?? base.awardDate,
    value: awardInfo?.amount ?? base.value,
    awardAmount: awardInfo?.amount ?? base.awardAmount,
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

  const entity = await SDRScoringRepository.getEntityById(job.entityId);
  if (!entity) {
    throw new Error(`Entity ${job.entityId} not found`);
  }
  if (!entity.uei) {
    throw new Error(`Entity ${job.entityId} missing UEI`);
  }

  const cutoffIso = new Date(Date.now() - ONE_YEAR_MS).toISOString();
  const results = await fetchAwardsForEntity({
    uei: entity.uei,
    authToken: job.authToken,
    cutoffIso,
  });

  for (const result of results) {
    if (!result._id) {
      continue;
    }
    const base = mapSearchResultToOpportunity(result);
    if (!base) {
      continue;
    }
    const detail = await fetchAwardDetail(result._id, job.authToken);
    const merged = mergeAwardDetail(base, detail);
    await SDRIntakeRepository.ingestOpportunity(merged);
  }

  await SDRScoringQueueRepository.markEntityRescored(job.entityId);
}
