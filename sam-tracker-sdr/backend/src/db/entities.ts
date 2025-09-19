import { v4 as uuidv4 } from "uuid";
import {
  SDRIntakeOpportunity,
  SDRIntakeNote,
  SDRScoreMetricDefinition,
  SDRScorecard,
  SDRScoringEntity,
  SDRScoringJob,
  SDRScoringJobStatus,
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

  async getEntityById(id: string): Promise<SDRScoringEntity | undefined> {
    const row = await fetchEntityRowById(id);
    return row ? mapEntityRow(row) : undefined;
  },

  async getEntityDetail(id: string): Promise<
    | { entity: SDRScoringEntity; awards: SDRIntakeOpportunity[] }
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
    return { entity, awards };
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
};
