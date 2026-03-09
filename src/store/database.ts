import Database from "better-sqlite3";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { runMigrations } from "./migrations.js";

const HELIOS_DIR = join(homedir(), ".helios");
const DB_PATH = join(HELIOS_DIR, "helios.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(HELIOS_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    runMigrations(_db);
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function getHeliosDir(): string {
  mkdirSync(HELIOS_DIR, { recursive: true });
  return HELIOS_DIR;
}
