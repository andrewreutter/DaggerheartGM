#!/usr/bin/env node
/**
 * Preview / apply the FCG + HoD catalog cleanup and leftover public-adversary delete.
 *
 * Same work as startup migrations:
 *   041_remove_fcg_hod_catalogs.sql
 *   042_delete_public_adversaries.sql
 *
 * Deploying the app also applies those files automatically via `runMigrations()`.
 * Use this script to inspect production first (dry run) or apply early.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-scraped-catalogs.mjs           # dry run
 *   node --env-file=.env scripts/migrate-scraped-catalogs.mjs --apply   # run unapplied 041/042
 *
 * Requires DATABASE_URL. Idempotent — already-applied migrations are skipped.
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../src/db.js';
import {
  PUBLIC_ADVERSARY_LIST_SQL,
  SCRAPED_CATALOG_CLEANUP_MIGRATIONS,
  SCRAPED_CATALOG_CLEANUP_REPORT_QUERIES,
} from '../src/scraped-catalog-cleanup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const apply = process.argv.includes('--apply');

async function report(db) {
  const counts = {};
  for (const q of SCRAPED_CATALOG_CLEANUP_REPORT_QUERIES) {
    const { rows } = await db.query(q.sql);
    counts[q.key] = rows[0].n;
    console.log(`${q.label}: ${rows[0].n}`);
  }
  if (counts.publicAdversaries > 0) {
    const { rows } = await db.query(PUBLIC_ADVERSARY_LIST_SQL);
    console.log('Public adversaries:');
    for (const r of rows) {
      console.log(`  ${r.id}  ${r.user_id}  ${JSON.stringify(r.name)}`);
    }
  }
  return counts;
}

async function appliedSet(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await db.query('SELECT name FROM _migrations');
  return new Set(rows.map((r) => r.name));
}

async function applyPending(db) {
  const done = await appliedSet(db);
  let applied = 0;
  for (const file of SCRAPED_CATALOG_CLEANUP_MIGRATIONS) {
    if (done.has(file)) {
      console.log(`Already applied: ${file}`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied: ${file}`);
      applied += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const db = getPool();
  console.log(apply ? 'Apply mode' : 'Dry run (pass --apply to run 041/042)');
  console.log('');
  await report(db);
  console.log('');
  const done = await appliedSet(db);
  for (const file of SCRAPED_CATALOG_CLEANUP_MIGRATIONS) {
    console.log(`${file}: ${done.has(file) ? 'applied' : 'pending'}`);
  }
  if (apply) {
    console.log('');
    await applyPending(db);
    console.log('');
    console.log('After apply:');
    await report(db);
  }
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
