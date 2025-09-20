import { SDRScoringJob, SDRIntakeOpportunity } from "../../db/schema";
import { SDRIntakeRepository, SDRScoringQueueRepository, SDRScoringRepository } from "../../db/entities";
import {
  fetchAwardsForEntity,
  fetchAwardDetail,
  fetchEntityCoreData,
} from "../../services/sam-entity-awards";
import { mapSearchResultToOpportunity, SamSearchResult } from "../../services/intakeFetcher";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function extractEntityProfile(detail: any) {
  const core = detail?.coreData ?? detail?.entityData?.coreData ?? {};
  const businessInfo = core?.businessInformation ?? {};
  const pocList: any[] = Array.isArray(core?.pointOfContact)
    ? core.pointOfContact
    : [];

  const pickString = (value: any) =>
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;

  const buildName = (entry: any) => {
    const direct = pickString(entry?.pocName);
    if (direct) {
      return direct;
    }
    const first = pickString(entry?.pocFirstName);
    const last = pickString(entry?.pocLastName);
    if (first || last) {
      return [first, last].filter(Boolean).join(" ");
    }
    const alt = pickString(entry?.pocNameAlt);
    if (alt) {
      return alt;
    }
    const altFirst = pickString(entry?.pocFirstNameAlt);
    const altLast = pickString(entry?.pocLastNameAlt);
    if (altFirst || altLast) {
      return [altFirst, altLast].filter(Boolean).join(" ");
    }
    return undefined;
  };

  const primaryPoc =
    pocList.find((entry) => {
      const email = pickString(entry?.pocEmail) ?? pickString(entry?.pocEmailAlt);
      return Boolean(email);
    }) || pocList[0] || {};

  const email =
    pickString(primaryPoc?.pocEmail) ?? pickString(primaryPoc?.pocEmailAlt);

  const phone =
    pickString(primaryPoc?.pocUSPhone) ??
    pickString(primaryPoc?.pocUSPhoneAlt) ??
    pickString(primaryPoc?.pocNonUSPhone);

  const website = pickString(businessInfo?.url);

  const pointsOfContact = pocList
    .map((entry) => {
      const pocEmail = pickString(entry?.pocEmail) ?? pickString(entry?.pocEmailAlt);
      const pocPhone =
        pickString(entry?.pocUSPhone) ??
        pickString(entry?.pocUSPhoneAlt) ??
        pickString(entry?.pocNonUSPhone);
      const pocTitle = pickString(entry?.pocTitle) ?? pickString(entry?.pocTitleAlt);
      const pocName = buildName(entry);
      const hasValues = pocEmail || pocPhone || pocTitle || pocName;
      if (!hasValues) {
        return null;
      }
      const address = entry?.pocAddressAlt ?? entry?.pocAddress ?? null;
      return {
        type: pickString(entry?.pocType) ?? null,
        name: pocName ?? null,
        title: pocTitle ?? null,
        email: pocEmail ?? null,
        phone: pocPhone ?? null,
        address: address ?? null,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const socioEconomic: Array<{
    category: string;
    code?: string | null;
    description?: string | null;
  }> = [];

  const pushStringEntry = (category: string, value: any) => {
    const desc = pickString(value);
    if (desc) {
      socioEconomic.push({ category, description: desc });
    }
  };

  const pushObjectEntry = (
    category: string,
    entry: any,
    codeKey?: string,
    descKey?: string
  ) => {
    if (!entry) {
      return;
    }
    const code = codeKey ? pickString(entry?.[codeKey]) : undefined;
    let description: string | undefined;
    if (descKey) {
      description = pickString(entry?.[descKey]);
    }
    if (!description) {
      description = pickString(entry?.description ?? entry?.desc ?? entry?.type);
    }
    if (!description && typeof entry === "string") {
      description = pickString(entry);
    }
    if (!description && code) {
      description = code;
    }
    if (!description && typeof entry === "object") {
      const text = JSON.stringify(entry);
      if (text !== "{}") {
        description = text;
      }
    }
    if (!description && !code) {
      return;
    }
    socioEconomic.push({ category, code: code ?? null, description: description ?? null });
  };

  const businessTypes = core?.entityTypes?.businessTypes ?? {};
  pushStringEntry("entityStructure", businessTypes.entityStructure);
  if (Array.isArray(businessTypes.entityType)) {
    businessTypes.entityType.forEach((value: any) => pushStringEntry("entityType", value));
  }
  if (Array.isArray(businessTypes.profitStructure)) {
    businessTypes.profitStructure.forEach((value: any) =>
      pushStringEntry("profitStructure", value)
    );
  }
  if (Array.isArray(businessTypes.organizationFactors)) {
    businessTypes.organizationFactors.forEach((value: any) =>
      pushStringEntry("organizationFactor", value)
    );
  }

  const socioTypes = core?.entityTypes?.socioEconomicTypes ?? {};
  if (Array.isArray(socioTypes.socioEconomicBusinessTypeList)) {
    socioTypes.socioEconomicBusinessTypeList.forEach((value: any) =>
      pushStringEntry("socioEconomicBusinessType", value)
    );
  }
  if (Array.isArray(socioTypes.sbaBusinessTypeList)) {
    socioTypes.sbaBusinessTypeList.forEach((entry: any) =>
      pushObjectEntry(
        "sbaBusinessType",
        entry,
        "sbaBusinessTypeCode",
        "sbaBusinessTypeDesc"
      )
    );
  }
  if (Array.isArray(socioTypes.governmentTypeList)) {
    socioTypes.governmentTypeList.forEach((value: any) =>
      pushStringEntry("governmentType", value)
    );
  }
  if (Array.isArray(socioTypes.otherGovEntities)) {
    socioTypes.otherGovEntities.forEach((value: any) =>
      pushStringEntry("otherGovernmentEntity", value)
    );
  }
  if (Array.isArray(socioTypes.fedRecNativeAmericanEntityList)) {
    socioTypes.fedRecNativeAmericanEntityList.forEach((value: any) =>
      pushStringEntry("nativeAmericanEntity", value)
    );
  }
  if (Array.isArray(socioTypes.otherEntityQualifiersList)) {
    socioTypes.otherEntityQualifiersList.forEach((value: any) =>
      pushStringEntry("otherEntityQualifier", value)
    );
  }

  return {
    contactEmail: email,
    contactPhone: phone,
    website,
    summary: detail?.summary ?? null,
    businessInformation: businessInfo ?? null,
    financialInformation: detail?.coreData?.financialInformation ?? null,
    pointsOfContact,
    socioEconomic,
  };
}

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

  const entityDetail = await fetchEntityCoreData(entity.uei, authToken);
  if (entityDetail) {
    const profile = extractEntityProfile(entityDetail);
    await SDRScoringRepository.saveEntityDetail(entity.id, profile);
  }

  const results = await fetchAwardsForEntity({
    uei: entity.uei,
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
