/**
 * Seed SRD data into the database using user_id = '__SRD__'.
 *
 * Requires DATABASE_URL and APP_ID in environment (loaded from .env by npm run seed:srd).
 *
 * Usage: npm run seed:srd
 *   (or: node --env-file=.env scripts/seed-srd.js)
 *
 * Run `npm run fetch:srd` first if data/srd-adversaries.json doesn't exist.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import { runMigrations, upsertItem, getPool, SRD_USER_ID } from '../src/db.js';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const APP_ID = process.env.APP_ID || 'default';

// Maps legacy SRD role names to current role names.
const ROLE_MAP = {
  artillery: 'ranged',
  skirmisher: 'skulk',
  solo: 'standard',
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Create a .env file or set it in your environment.');
    process.exit(1);
  }

  console.log(`Connecting to database (APP_ID="${APP_ID}")...`);
  await runMigrations();

  // Purge all existing SRD items so re-seeding is always idempotent regardless of ID changes.
  const db = getPool();
  const { rowCount } = await db.query(
    `DELETE FROM items WHERE app_id = $1 AND user_id = $2`,
    [APP_ID, SRD_USER_ID]
  );
  console.log(`Purged ${rowCount} existing SRD items.`);

  const [adversaries, environments] = await Promise.all([
    readFile(join(DATA_DIR, 'srd-adversaries.json'), 'utf8').then(JSON.parse),
    readFile(join(DATA_DIR, 'srd-environments.json'), 'utf8').then(JSON.parse),
  ]);

  console.log(`Seeding ${adversaries.length} adversaries (with role normalization)...`);
  for (const adv of adversaries) {
    const { id, ...data } = adv;
    const normalizedData = { ...data, role: ROLE_MAP[data.role] || data.role };
    await upsertItem(APP_ID, SRD_USER_ID, 'adversaries', id, normalizedData, true);
  }

  console.log(`Seeding ${environments.length} environments...`);
  for (const env of environments) {
    const { id, ...data } = env;
    await upsertItem(APP_ID, SRD_USER_ID, 'environments', id, data, true);
  }

  console.log(`Done. Seeded ${adversaries.length} adversaries and ${environments.length} environments as SRD content.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
