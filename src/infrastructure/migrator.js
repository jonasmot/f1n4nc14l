import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function listMigrations(directory = MIGRATIONS_DIR) {
  return readdirSync(directory)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => {
      const version = Number(file.split('_')[0]);
      const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
      return {
        version,
        name,
        file,
        sql: readFileSync(join(directory, file), 'utf8'),
      };
    });
}

export function migrate(db, { migrations = listMigrations() } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version),
  );
  const appliedNow = [];

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      );
      db.exec('COMMIT');
      appliedNow.push(migration.version);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return appliedNow;
}

export function currentVersion(db) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()) {
    return 0;
  }
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
  return row?.version ?? 0;
}
