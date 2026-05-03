import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { env } from "./env.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = resolve(currentDirectory, "../../data/stadium-flow.sqlite");

let databaseInstance;
let sqlModule;
let databasePath;
let rawDatabaseInstance;

function getDatabasePath() {
  return env.sqlitePath || defaultDatabasePath;
}

function normalizeRows(result) {
  if (!result[0]) {
    return [];
  }

  const [{ columns, values }] = result;
  return values.map((valueRow) =>
    Object.fromEntries(columns.map((column, index) => [column, valueRow[index]]))
  );
}

function persistDatabase() {
  if (!rawDatabaseInstance || !databasePath) {
    return;
  }

  const data = rawDatabaseInstance.export();
  writeFileSync(databasePath, Buffer.from(data));
}

function createAdapter(db) {
  return {
    exec(sql) {
      db.run(sql);
      persistDatabase();
    },
    all(sql, params = []) {
      return normalizeRows(db.exec(sql, params));
    },
    get(sql, params = []) {
      return this.all(sql, params)[0];
    },
    run(sql, params = []) {
      db.run(sql, params);
      const lastInsert = this.get("SELECT last_insert_rowid() AS id");
      const changes = this.get("SELECT changes() AS count");
      persistDatabase();
      return {
        lastInsertRowid: lastInsert?.id ?? 0,
        changes: changes?.count ?? 0
      };
    }
  };
}

function ensureColumn(adapter, tableName, columnName, definition) {
  const columns = adapter.all(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    adapter.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function createTables(adapter) {
  adapter.exec(`
    CREATE TABLE IF NOT EXISTS gates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gate_id TEXT NOT NULL UNIQUE,
      gate_name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 1,
      visible INTEGER NOT NULL DEFAULT 1,
      zone_label TEXT NOT NULL DEFAULT 'General',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      service_rate_per_minute INTEGER NOT NULL DEFAULT 12,
      queue_length INTEGER NOT NULL DEFAULT 0,
      live_crowd_score INTEGER NOT NULL DEFAULT 0,
      direction_hint TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_type TEXT NOT NULL,
      author_name TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      context TEXT NOT NULL DEFAULT 'operations',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reward_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fan_name TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      completed_detours INTEGER NOT NULL DEFAULT 0,
      report_reputation INTEGER NOT NULL DEFAULT 0,
      live_reports_submitted INTEGER NOT NULL DEFAULT 0,
      live_reports_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crowd_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gate_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      message TEXT NOT NULL,
      crowd_level TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      verification_count INTEGER NOT NULL DEFAULT 1,
      verified_at TEXT,
      reputation_awarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crowd_report_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      fan_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(report_id, fan_name)
    );
  `);

  ensureColumn(adapter, "reward_profiles", "report_reputation", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(adapter, "reward_profiles", "live_reports_submitted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(adapter, "reward_profiles", "live_reports_verified", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(adapter, "crowd_reports", "status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn(adapter, "crowd_reports", "verification_count", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(adapter, "crowd_reports", "verified_at", "TEXT");
  ensureColumn(adapter, "crowd_reports", "reputation_awarded", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(adapter, "crowd_reports", "created_at", "TEXT");
  ensureColumn(adapter, "crowd_reports", "updated_at", "TEXT");
  ensureColumn(adapter, "crowd_report_votes", "created_at", "TEXT");
}

export async function connectDatabase() {
  if (databaseInstance) {
    return databaseInstance;
  }

  databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  sqlModule = await initSqlJs();
  const fileBuffer = existsSync(databasePath) ? readFileSync(databasePath) : undefined;
  rawDatabaseInstance = fileBuffer ? new sqlModule.Database(fileBuffer) : new sqlModule.Database();

  databaseInstance = createAdapter(rawDatabaseInstance);
  createTables(databaseInstance);

  console.log(`SQLite connected at ${databasePath}`);
  return databaseInstance;
}

export function getDatabase() {
  if (!databaseInstance) {
    throw new Error("Database is not initialized.");
  }

  return databaseInstance;
}
