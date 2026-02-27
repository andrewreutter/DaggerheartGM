import pg from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function runMigrations() {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await db.query('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`[db] Applied migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

// --- Query helpers ---

export async function getItems(appId, userId, collection) {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT id, data FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3
     ORDER BY created_at ASC`,
    [appId, userId, collection]
  );
  return rows.map(r => ({ id: r.id, ...r.data }));
}

export async function upsertItem(appId, userId, collection, id, data) {
  const db = getPool();
  const { rows } = await db.query(
    `INSERT INTO items (id, app_id, user_id, collection, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (app_id, collection, id)
     DO UPDATE SET data = $5, updated_at = now()
     RETURNING id`,
    [id, appId, userId, collection, data]
  );
  return rows[0].id;
}

export async function deleteItem(appId, userId, collection, id) {
  const db = getPool();
  await db.query(
    `DELETE FROM items
     WHERE app_id = $1 AND user_id = $2 AND collection = $3 AND id = $4`,
    [appId, userId, collection, id]
  );
}
