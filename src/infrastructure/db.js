import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function resolveDatabasePath(options = {}) {
  const candidate =
    options.path ?? process.env.FIN_DB_PATH ?? resolve(PROJECT_ROOT, 'data', 'financas.db');

  if (candidate === ':memory:') return candidate;
  return isAbsolute(candidate) ? candidate : resolve(PROJECT_ROOT, candidate);
}

export function openDatabase(options = {}) {
  const path = resolveDatabasePath(options);

  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = DELETE;');
  }

  return db;
}

export function isInitialized(db) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  return Boolean(row);
}
