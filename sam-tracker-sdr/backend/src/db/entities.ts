import { v4 as uuidv4 } from "uuid";
import {
  SDRIntakeOpportunity,
  SDRIntakeNote,
  SDRScoreMetricDefinition,
  SDRScorecard,
  SDRScoringEntity,
  SDRScoringJob,
  SDRScoringJobStatus,
  SDREntityProfile,
  SDREntityPointOfContact,
  SDREntitySocioEconomic,
} from "./schema";
import { sdrDb } from "./sqlite";

const scoringMetrics: SDRScoreMetricDefinition[] = [
  {
    id: "tech-fit",
    label: "Technical Fit",
    description: "How well the opportunity aligns with our product capabilities.",
  },
  {
    id: "contract-viability",
    label: "Contract Viability",
    description: "Likelihood that we can compliantly pursue the opportunity.",
  },
  {
    id: "competitiveness",
    label: "Competitiveness",
    description: "How competitive we are compared to the incumbent landscape.",
  },
];

const intakeNotes: SDRIntakeNote[] = [];
const scorecards: SDRScorecard[] = [];

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface EntityDetailPayload {
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  summary?: Record<string, any> | null;
  businessInformation?: Record<string, any> | null;
  financialInformation?: Record<string, any> | null;
  pointsOfContact?: Array<{
    type?: string | null;
    name?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: Record<string, any> | null;
  }>;
  socioEconomic?: Array<{
    category: string;
    code?: string | null;
    description?: string | null;
  }>;
}

function mapJobRow(row: any): SDRScoringJob {
  return {
    id: row.id,
    entityId: row.entity_id,
    status: row.status as SDRScoringJobStatus,
    error: row.error ?? null,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    entityName: row.entity_name ?? undefined,
    entityUei: row.uei ?? undefined,
    authToken: row.auth_token ?? undefined,
  };
}

async function findOrCreateEntity(
  opportunity: SDRIntakeOpportunity
): Promise<string | undefined> {
  const rawName = opportunity.awardeeName?.trim();
  const rawUei = opportunity.awardeeUei?.trim();

  if (!rawName && !rawUei) {
    return undefined;
  }

  const entityName = rawName && rawName.length > 0 ? rawName : "Unknown";
  const uei = rawUei && rawUei.length > 0 ? rawUei : null;
  const primaryNaics = opportunity.naics || "Unknown";
  const latestModified = opportunity.modifiedDate ?? null;
  const now = new Date().toISOString();

  let existing: { id: string } | undefined;
  if (uei) {
    existing = await sdrDb.get<{ id: string }>(
      `SELECT id FROM sdr_entities WHERE uei = ? LIMIT 1`,
      [uei]
    );
  }
  if (!existing) {
    existing = await sdrDb.get<{ id: string }>(
      `SELECT id FROM sdr_entities WHERE LOWER(entity_name) = LOWER(?) LIMIT 1`,
      [entityName]
    );
  }

  if (existing?.id) {
    await sdrDb.run(
      `UPDATE sdr_entities
       SET primary_naics = COALESCE(?, primary_naics),
           latest_modified_date = COALESCE(?, latest_modified_date),
           uei = CASE WHEN (uei IS NULL OR uei = '') THEN COALESCE(?, uei) ELSE uei END,
           stale = 1,
           updated_at = ?
       WHERE id = ?`,
      [primaryNaics, latestModified, uei, now, existing.id]
    );
    return existing.id;
  }

  const id = uuidv4();
  await sdrDb.run(
    `INSERT INTO sdr_entities (
       id,
       entity_name,
       uei,
       primary_naics,
       latest_modified_date,
       awards_last_year,
       stale,
       status,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entityName,
      uei,
      primaryNaics,
      latestModified,
      0,
      1,
      "pending",
      now,
      now,
    ]
  );

  return id;
}

async function upsertAward(opportunity: SDRIntakeOpportunity, entityId?: string) {
  const now = new Date().toISOString();
  await sdrDb.run(
    `INSERT INTO sdr_awards (
       id,
       solicitation_number,
       title,
       agency,
       naics,
       modified_date,
       award_date,
       publish_date,
       contract_type,
       awardee_name,
       awardee_uei,
       awarding_office,
       value,
       award_amount,
        set_aside,
        place_city,
        place_state,
        place_country,
        contact_name,
        contact_email,
       entity_id,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       solicitation_number = excluded.solicitation_number,
       title = excluded.title,
       agency = excluded.agency,
       naics = excluded.naics,
       modified_date = excluded.modified_date,
       award_date = excluded.award_date,
       publish_date = excluded.publish_date,
       contract_type = excluded.contract_type,
       awardee_name = excluded.awardee_name,
       awardee_uei = excluded.awardee_uei,
       awarding_office = excluded.awarding_office,
       value = excluded.value,
       award_amount = excluded.award_amount,
        set_aside = excluded.set_aside,
        place_city = excluded.place_city,
        place_state = excluded.place_state,
        place_country = excluded.place_country,
        contact_name = excluded.contact_name,
        contact_email = excluded.contact_email,
       entity_id = excluded.entity_id,
       updated_at = excluded.updated_at
    `,
    [
      opportunity.id,
      opportunity.solicitationNumber,
      opportunity.title,
      opportunity.agency,
      opportunity.naics,
      opportunity.modifiedDate ?? null,
      opportunity.awardDate ?? null,
      opportunity.postedDate ?? null,
      opportunity.contractType ?? null,
      opportunity.awardeeName ?? null,
      opportunity.awardeeUei ?? null,
      opportunity.awardingOffice ?? null,
      opportunity.value ?? null,
      opportunity.awardAmount ?? null,
      opportunity.setAside ?? null,
      opportunity.placeCity ?? null,
      opportunity.placeState ?? null,
      opportunity.placeCountry ?? null,
      opportunity.contactName ?? null,
      opportunity.contactEmail ?? null,
      entityId ?? null,
      now,
      now,
    ]
  );

  if (entityId) {
    await sdrDb.run(
      `INSERT OR IGNORE INTO sdr_entity_awards (entity_id, award_id) VALUES (?, ?)`,
      [entityId, opportunity.id]
    );
  }
}

async function refreshEntityStats(entityId: string) {
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - ONE_YEAR_MS).toISOString();

  const aggregates = await sdrDb.get<{
    latestModified?: string;
    totalAwards?: number;
  }>(
    `SELECT
       MAX(modified_date) AS latestModified,
       COUNT(*) AS totalAwards
     FROM sdr_awards
     WHERE entity_id = ?`,
    [entityId]
  );

  const awardsLastYearRow = await sdrDb.get<{ count?: number }>(
    `SELECT COUNT(*) AS count
     FROM sdr_awards
     WHERE entity_id = ? AND modified_date >= ?`,
    [entityId, cutoffIso]
  );

  const awardsLastYear = awardsLastYearRow?.count ?? 0;

  await sdrDb.run(
    `UPDATE sdr_entities
     SET latest_modified_date = ?,
         awards_last_year = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      aggregates?.latestModified ?? null,
      awardsLastYear,
      nowIso,
      entityId,
    ]
  );
}

async function updateEntityProfileRow(
  entityId: string,
  profile: {
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
  }
) {
  const normalize = (value?: string) =>
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;

  const contactEmail = normalize(profile.contactEmail);
  const contactPhone = normalize(profile.contactPhone);
  const website = normalize(profile.website);
  if (
    contactEmail === undefined &&
    contactPhone === undefined &&
    website === undefined
  ) {
    return;
  }
  const now = new Date().toISOString();
  await sdrDb.run(
    `UPDATE sdr_entities
     SET contact_email = COALESCE(?, contact_email),
         contact_phone = COALESCE(?, contact_phone),
         website = COALESCE(?, website),
         updated_at = ?
     WHERE id = ?`,
    [
      contactEmail ?? null,
      contactPhone ?? null,
      website ?? null,
      now,
      entityId,
    ]
  );
}

async function upsertEntityProfileRow(
  entityId: string,
  profile: {
    summary?: Record<string, any> | null;
    businessInformation?: Record<string, any> | null;
    financialInformation?: Record<string, any> | null;
  }
) {
  const now = new Date().toISOString();
  const summaryJson = profile.summary ? JSON.stringify(profile.summary) : null;
  const bizJson = profile.businessInformation
    ? JSON.stringify(profile.businessInformation)
    : null;
  const financialJson = profile.financialInformation
    ? JSON.stringify(profile.financialInformation)
    : null;

  await sdrDb.run(
    `INSERT INTO sdr_entity_profiles (
       entity_id,
       summary_json,
       business_info_json,
       financial_info_json,
       updated_at
     ) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(entity_id) DO UPDATE SET
       summary_json = excluded.summary_json,
       business_info_json = excluded.business_info_json,
       financial_info_json = excluded.financial_info_json,
       updated_at = excluded.updated_at`,
    [entityId, summaryJson, bizJson, financialJson, now]
  );
}

async function replaceEntityPointsOfContact(
  entityId: string,
  points: NonNullable<EntityDetailPayload["pointsOfContact"]>
) {
  await sdrDb.run(`DELETE FROM sdr_entity_pocs WHERE entity_id = ?`, [entityId]);
  if (!points || points.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  for (const point of points) {
    const hasData =
      (point.type && point.type.trim().length > 0) ||
      (point.name && point.name.trim().length > 0) ||
      (point.title && point.title.trim().length > 0) ||
      (point.email && point.email.trim().length > 0) ||
      (point.phone && point.phone.trim().length > 0);
    if (!hasData) {
      continue;
    }
    const id = uuidv4();
    const addressJson = point.address ? JSON.stringify(point.address) : null;
    await sdrDb.run(
      `INSERT INTO sdr_entity_pocs (
         id,
         entity_id,
         poc_type,
         name,
         title,
         email,
         phone,
         address_json,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entityId,
        point.type ?? null,
        point.name ?? null,
        point.title ?? null,
        point.email ?? null,
        point.phone ?? null,
        addressJson,
        now,
        now,
      ]
    );
  }
}

async function replaceEntitySocioEconomic(
  entityId: string,
  entries: NonNullable<EntityDetailPayload["socioEconomic"]>
) {
  await sdrDb.run(
    `DELETE FROM sdr_entity_socio_economic WHERE entity_id = ?`,
    [entityId]
  );
  if (!entries || entries.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    const id = uuidv4();
    await sdrDb.run(
      `INSERT INTO sdr_entity_socio_economic (
         id,
         entity_id,
         category,
         code,
         description,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entityId,
        entry.category ?? null,
        entry.code ?? null,
        entry.description ?? null,
        now,
        now,
      ]
    );
  }
}

async function getEntityProfileRow(
  entityId: string
): Promise<SDREntityProfile | null> {
  const row = await sdrDb.get<any>(
    `SELECT * FROM sdr_entity_profiles WHERE entity_id = ?`,
    [entityId]
  );
  if (!row) {
    return null;
  }
  const parseJson = (value: any) => {
    if (typeof value !== "string" || value.length === 0) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  };
  return {
    entityId: row.entity_id,
    summary: parseJson(row.summary_json),
    businessInformation: parseJson(row.business_info_json),
    financialInformation: parseJson(row.financial_info_json),
    updatedAt: row.updated_at,
  };
}

async function listEntityPointsOfContact(
  entityId: string
): Promise<SDREntityPointOfContact[]> {
  const rows = await sdrDb.all<any>(
    `SELECT * FROM sdr_entity_pocs WHERE entity_id = ? ORDER BY datetime(updated_at) DESC`,
    [entityId]
  );
  const parseJson = (value: any) => {
    if (typeof value !== "string" || value.length === 0) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  };
  return rows.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    type: row.poc_type ?? null,
    name: row.name ?? null,
    title: row.title ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: parseJson(row.address_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function listEntitySocioEconomic(
  entityId: string
): Promise<SDREntitySocioEconomic[]> {
  const rows = await sdrDb.all<any>(
    `SELECT * FROM sdr_entity_socio_economic WHERE entity_id = ? ORDER BY datetime(updated_at) DESC`,
    [entityId]
  );
  return rows.map((row) => ({
    id: row.id,
    entityId: row.entity_id,
    category: row.category ?? null,
    code: row.code ?? null,
    description: row.description ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapAwardRow(row: any): SDRIntakeOpportunity {
  return {
    id: row.id,
    solicitationNumber: row.solicitation_number ?? "",
    title: row.title ?? "Untitled Award",
    agency: row.agency ?? "Unknown",
    naics: row.naics ?? "Unknown",
    postedDate: row.publish_date ?? undefined,
    awardDate: row.award_date ?? undefined,
    modifiedDate: row.modified_date ?? undefined,
    status: "new",
    contractType: row.contract_type ?? undefined,
    awardeeName: row.awardee_name ?? undefined,
    awardeeUei: row.awardee_uei ?? undefined,
    awardingOffice: row.awarding_office ?? undefined,
    value: row.value ?? undefined,
    awardAmount: row.award_amount ?? undefined,
    setAside: row.set_aside ?? undefined,
    placeCity: row.place_city ?? undefined,
    placeState: row.place_state ?? undefined,
    placeCountry: row.place_country ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
  };
}

async function fetchEntityRowById(id: string): Promise<any | undefined> {
  return sdrDb.get(`SELECT * FROM sdr_entities WHERE id = ?`, [id]);
}

function mapEntityRow(row: any): SDRScoringEntity {
  const statusValue = typeof row.status === "string" ? row.status : "pending";
  const allowedStatuses: SDRScoringEntity["status"][] = [
    "pending",
    "queued",
    "processing",
    "ready",
  ];
  const normalizedStatus = (allowedStatuses.includes(statusValue as any)
    ? (statusValue as SDRScoringEntity["status"])
    : "pending");

  return {
    id: row.id,
    entityName: row.entity_name,
    uei: row.uei ?? "",
    primaryNaics: row.primary_naics ?? "Unknown",
    recentAwardDate: row.latest_modified_date ?? "",
    awardsLastYear: Number(row.awards_last_year ?? 0),
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    website: row.website ?? undefined,
    status: normalizedStatus,
    stale: Boolean(row.stale),
  };
}

export const SDRIntakeRepository = {
  async list(): Promise<SDRIntakeOpportunity[]> {
    const rows = await sdrDb.all(`
      SELECT *
      FROM sdr_awards
      ORDER BY datetime(COALESCE(modified_date, created_at)) DESC
    `);
    return rows.map(mapAwardRow);
  },

  async getById(id: string): Promise<SDRIntakeOpportunity | undefined> {
    const row = await sdrDb.get(`SELECT * FROM sdr_awards WHERE id = ?`, [id]);
    return row ? mapAwardRow(row) : undefined;
  },

  async listByEntity(entityId: string): Promise<SDRIntakeOpportunity[]> {
    const rows = await sdrDb.all(
      `SELECT *
       FROM sdr_awards
       WHERE entity_id = ?
       ORDER BY datetime(COALESCE(modified_date, created_at)) DESC`,
      [entityId]
    );
    return rows.map(mapAwardRow);
  },

  async listNotes(opportunityId: string): Promise<SDRIntakeNote[]> {
    return intakeNotes.filter((note) => note.opportunityId === opportunityId);
  },

  async ingestOpportunity(opportunity: SDRIntakeOpportunity): Promise<void> {
    const entityId = await findOrCreateEntity(opportunity);
    await upsertAward(opportunity, entityId);
    if (entityId) {
      await refreshEntityStats(entityId);
    }
    if (entityId) {
      await sdrDb.run(
        `UPDATE sdr_entities SET stale = 1 WHERE id = ?`,
        [entityId]
      );
    }
  },

  async existingIds(): Promise<Set<string>> {
    const rows = await sdrDb.all<{ id: string }>(`SELECT id FROM sdr_awards`);
    return new Set(rows.map((row) => row.id));
  },

  async clearAllAwards(): Promise<void> {
    const now = new Date().toISOString();
    await sdrDb.run(`DELETE FROM sdr_entity_awards`);
    await sdrDb.run(`DELETE FROM sdr_awards`);
    await sdrDb.run(
      `UPDATE sdr_entities
       SET awards_last_year = 0,
           stale = 1,
           latest_modified_date = NULL,
           updated_at = ?`,
      [now]
    );
  },
};

export const SDRScoringRepository = {
  async listScorecards(): Promise<SDRScorecard[]> {
    return scorecards;
  },

  async listMetricDefinitions(): Promise<SDRScoreMetricDefinition[]> {
    return scoringMetrics;
  },

  async listEntities(): Promise<SDRScoringEntity[]> {
    const rows = await sdrDb.all(`
      SELECT *
      FROM sdr_entities
      ORDER BY
        CASE status
          WHEN 'processing' THEN 0
          WHEN 'queued' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        stale DESC,
        datetime(COALESCE(latest_modified_date, updated_at)) DESC
      LIMIT 500
    `);
    return rows.map(mapEntityRow);
  },

  async clearAllEntities(): Promise<void> {
    await sdrDb.run(`DELETE FROM sdr_entity_awards`);
    await sdrDb.run(`UPDATE sdr_awards SET entity_id = NULL`);
    await sdrDb.run(`DELETE FROM sdr_entities`);
    await sdrDb.run(`DELETE FROM sdr_scoring_jobs`);
  },

  async markAllEntitiesStale(): Promise<void> {
    const now = new Date().toISOString();
    await sdrDb.run(
      `UPDATE sdr_entities
       SET stale = 1,
           status = 'pending',
           updated_at = ?`,
      [now]
    );
  },

  async getEntityById(id: string): Promise<SDRScoringEntity | undefined> {
    const row = await fetchEntityRowById(id);
    return row ? mapEntityRow(row) : undefined;
  },

  async getEntityDetail(id: string): Promise<
    | {
        entity: SDRScoringEntity;
        awards: SDRIntakeOpportunity[];
        profile: SDREntityProfile | null;
        pointsOfContact: SDREntityPointOfContact[];
        socioEconomic: SDREntitySocioEconomic[];
      }
    | undefined
  > {
    const row = await fetchEntityRowById(id);
    if (!row) {
      return undefined;
    }
    const entity = mapEntityRow(row);
    if (!entity) {
      return undefined;
    }
    const awards = await SDRIntakeRepository.listByEntity(id);
    const profile = await getEntityProfileRow(id);
    const pointsOfContact = await listEntityPointsOfContact(id);
    const socioEconomic = await listEntitySocioEconomic(id);
    return { entity, awards, profile, pointsOfContact, socioEconomic };
  },

  async saveEntityDetail(
    entityId: string,
    detail: EntityDetailPayload
  ): Promise<void> {
    await updateEntityProfileRow(entityId, detail);
    await upsertEntityProfileRow(entityId, {
      summary: detail.summary ?? null,
      businessInformation: detail.businessInformation ?? null,
      financialInformation: detail.financialInformation ?? null,
    });
    await replaceEntityPointsOfContact(entityId, detail.pointsOfContact ?? []);
    await replaceEntitySocioEconomic(entityId, detail.socioEconomic ?? []);
  },
};

async function listStaleEntityIds(limit = 50): Promise<string[]> {
  const rows = await sdrDb.all<{ id: string }>(
    `SELECT id FROM sdr_entities WHERE stale = 1 ORDER BY datetime(COALESCE(latest_modified_date, updated_at)) DESC LIMIT ?`,
    [limit]
  );
  return rows.map((row) => row.id);
}

async function setEntityStatus(
  entityId: string,
  status: SDRScoringEntity["status"],
  stale?: boolean
) {
  const now = new Date().toISOString();
  const params: any[] = [status, now, entityId];
  let sql = `UPDATE sdr_entities SET status = ?, updated_at = ? WHERE id = ?`;
  if (typeof stale === "boolean") {
    sql = `UPDATE sdr_entities SET status = ?, stale = ?, updated_at = ? WHERE id = ?`;
    params.splice(1, 0, stale ? 1 : 0);
  }
  await sdrDb.run(sql, params);
}

async function enqueueScoringJobs(
  entityIds: string[],
  authToken: string
): Promise<SDRScoringJob[]> {
  if (entityIds.length === 0) {
    return [];
  }
  const now = new Date().toISOString();
  const jobs: SDRScoringJob[] = [];
  for (const entityId of entityIds) {
    const existing = await sdrDb.get<{ id: string }>(
      `SELECT id FROM sdr_scoring_jobs WHERE entity_id = ? AND status IN ('queued','processing') LIMIT 1`,
      [entityId]
    );
    if (existing) {
      continue;
    }
    const jobId = uuidv4();
    await sdrDb.run(
      `INSERT INTO sdr_scoring_jobs (id, entity_id, status, auth_token, created_at) VALUES (?, ?, 'queued', ?, ?)` ,
      [jobId, entityId, authToken, now]
    );
    await setEntityStatus(entityId, "queued");
    const row = await sdrDb.get(
      `SELECT j.*, e.entity_name, e.uei FROM sdr_scoring_jobs j LEFT JOIN sdr_entities e ON e.id = j.entity_id WHERE j.id = ?`,
      [jobId]
    );
    if (row) {
      jobs.push(mapJobRow(row));
    }
  }
  return jobs;
}

async function getNextQueuedJob(): Promise<SDRScoringJob | undefined> {
  const row = await sdrDb.get(
    `SELECT j.*, e.entity_name, e.uei FROM sdr_scoring_jobs j LEFT JOIN sdr_entities e ON e.id = j.entity_id WHERE j.status = 'queued' ORDER BY j.created_at ASC LIMIT 1`
  );
  return row ? mapJobRow(row) : undefined;
}

async function markJobProcessing(jobId: string): Promise<void> {
  const now = new Date().toISOString();
  await sdrDb.run(
    `UPDATE sdr_scoring_jobs SET status = 'processing', started_at = ?, error = NULL WHERE id = ?`,
    [now, jobId]
  );
}

async function markJobCompleted(jobId: string): Promise<void> {
  const now = new Date().toISOString();
  await sdrDb.run(
    `UPDATE sdr_scoring_jobs SET status = 'completed', completed_at = ?, error = NULL WHERE id = ?`,
    [now, jobId]
  );
}

async function markJobFailed(jobId: string, error: string): Promise<void> {
  const now = new Date().toISOString();
  await sdrDb.run(
    `UPDATE sdr_scoring_jobs SET status = 'failed', completed_at = ?, error = ? WHERE id = ?`,
    [now, error, jobId]
  );
}

async function listQueueJobs(limit = 50): Promise<SDRScoringJob[]> {
  const rows = await sdrDb.all(
    `SELECT j.*, e.entity_name, e.uei FROM sdr_scoring_jobs j LEFT JOIN sdr_entities e ON e.id = j.entity_id ORDER BY datetime(j.created_at) DESC LIMIT ?`,
    [limit]
  );
  return rows.map(mapJobRow);
}

async function getActiveJob(): Promise<SDRScoringJob | undefined> {
  const row = await sdrDb.get(
    `SELECT j.*, e.entity_name, e.uei FROM sdr_scoring_jobs j LEFT JOIN sdr_entities e ON e.id = j.entity_id WHERE j.status = 'processing' LIMIT 1`
  );
  return row ? mapJobRow(row) : undefined;
}

async function markEntityRescored(entityId: string) {
  await setEntityStatus(entityId, "ready", false);
}

async function getQueueSummary() {
  const jobs = await listQueueJobs(100);
  const activeJob = jobs.find((job) => job.status === "processing");
  const queuedJobs = jobs.filter((job) => job.status === "queued");
  const recentJobs = jobs
    .filter((job) => job.status === "completed")
    .slice(0, 10);
  const failedJobs = jobs.filter((job) => job.status === "failed").slice(0, 10);
  return {
    activeJob,
    queuedJobs,
    recentJobs,
    failedJobs,
  };
}

async function removeJob(jobId: string): Promise<void> {
  await sdrDb.run(`DELETE FROM sdr_scoring_jobs WHERE id = ?`, [jobId]);
}

async function resetQueuedJobs(): Promise<void> {
  const queued = await sdrDb.all<{ entity_id: string }>(
    `SELECT entity_id FROM sdr_scoring_jobs WHERE status IN ('queued','processing')`
  );
  if (queued.length > 0) {
    const now = new Date().toISOString();
    const ids = queued.map((row) => row.entity_id);
    const placeholders = ids.map(() => "?").join(",");
    await sdrDb.run(
      `UPDATE sdr_entities
       SET status = 'pending',
           stale = 1,
           updated_at = ?
       WHERE id IN (${placeholders})`,
      [now, ...ids]
    );
  }
  await sdrDb.run(`DELETE FROM sdr_scoring_jobs WHERE status IN ('queued','processing')`);
}

async function clearStaleRunningFlags(): Promise<void> {
  const now = new Date().toISOString();
  await sdrDb.run(
    `UPDATE sdr_entities
     SET status = 'pending',
         stale = 1,
         updated_at = ?
     WHERE status IN ('processing','queued')`,
    [now]
  );
}

async function markAllEntitiesStale(): Promise<void> {
  const now = new Date().toISOString();
  await sdrDb.run(
    `UPDATE sdr_entities
     SET status = 'pending',
         stale = 1,
         updated_at = ?`,
    [now]
  );
}

async function clearFailedJobs(): Promise<void> {
  const failed = await sdrDb.all<{ entity_id: string | null }>(
    `SELECT entity_id FROM sdr_scoring_jobs WHERE status = 'failed'`
  );
  const ids = failed
    .map((row) => row.entity_id)
    .filter((value): value is string => Boolean(value));
  if (ids.length > 0) {
    const now = new Date().toISOString();
    const placeholders = ids.map(() => "?").join(",");
    await sdrDb.run(
      `UPDATE sdr_entities
       SET status = 'pending',
           stale = 1,
           updated_at = ?
       WHERE id IN (${placeholders})`,
      [now, ...ids]
    );
  }
  await sdrDb.run(`DELETE FROM sdr_scoring_jobs WHERE status = 'failed'`);
}

export const SDRScoringQueueRepository = {
  listStaleEntityIds,
  enqueueScoringJobs,
  getNextQueuedJob,
  markJobProcessing,
  markJobCompleted,
  markJobFailed,
  listQueueJobs,
  getActiveJob,
  getQueueSummary,
  setEntityStatus,
  markEntityRescored,
  removeJob,
  resetQueuedJobs,
  clearStaleRunningFlags,
  markAllEntitiesStale,
  clearFailedJobs,
};
