import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";

const DB_PATH = path.join(__dirname, "../../sdr-intake.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_awards (
      id TEXT PRIMARY KEY,
      solicitation_number TEXT,
      title TEXT,
      agency TEXT,
      naics TEXT,
      modified_date TEXT,
      award_date TEXT,
      publish_date TEXT,
      contract_type TEXT,
      awardee_name TEXT,
      awardee_uei TEXT,
      awarding_office TEXT,
      value TEXT,
      award_amount TEXT,
      set_aside TEXT,
      place_city TEXT,
      place_state TEXT,
      place_country TEXT,
      contact_name TEXT,
      contact_email TEXT,
      entity_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_entities (
      id TEXT PRIMARY KEY,
      entity_name TEXT NOT NULL,
      uei TEXT,
      primary_naics TEXT,
      latest_modified_date TEXT,
      awards_last_year INTEGER DEFAULT 0,
      stale INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      contact_email TEXT,
      contact_phone TEXT,
      website TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_entity_awards (
      entity_id TEXT NOT NULL,
      award_id TEXT NOT NULL,
      PRIMARY KEY (entity_id, award_id),
      FOREIGN KEY (entity_id) REFERENCES sdr_entities(id) ON DELETE CASCADE,
      FOREIGN KEY (award_id) REFERENCES sdr_awards(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_scoring_jobs (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      status TEXT NOT NULL,
      auth_token TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY(entity_id) REFERENCES sdr_entities(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_entity_profiles (
      entity_id TEXT PRIMARY KEY,
      summary_json TEXT,
      business_info_json TEXT,
      financial_info_json TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(entity_id) REFERENCES sdr_entities(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_entity_pocs (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      poc_type TEXT,
      name TEXT,
      title TEXT,
      email TEXT,
      phone TEXT,
      address_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(entity_id) REFERENCES sdr_entities(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sdr_entity_socio_economic (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      category TEXT,
      code TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(entity_id) REFERENCES sdr_entities(id) ON DELETE CASCADE
    )
  `);

  db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_entities_uei ON sdr_entities(uei) WHERE uei IS NOT NULL AND uei <> ''"
  );
  db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_entities_name ON sdr_entities(entity_name)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_sdr_awards_modified_date ON sdr_awards(modified_date DESC)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_sdr_scoring_jobs_status ON sdr_scoring_jobs(status, created_at)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_sdr_entity_pocs_entity_id ON sdr_entity_pocs(entity_id)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_sdr_entity_socio_entity_id ON sdr_entity_socio_economic(entity_id)"
  );
});

function run(sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T | undefined);
      }
    });
  });
}

function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

export const sdrDb = {
  run,
  get,
  all,
};
