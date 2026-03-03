#!/usr/bin/env node
/**
 * reddit-nuke.js — wipes all Reddit mirror rows and the blocked_reddit_posts
 * table so the scanner starts completely fresh.
 *
 * Usage:  npm run reddit:nuke
 *
 * Requires DATABASE_URL and APP_ID in the environment (loaded from .env by the
 * npm script via --env-file=.env).
 */

import pg from 'pg';

const { Pool } = pg;

const { DATABASE_URL, APP_ID } = process.env;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}
if (!APP_ID) {
  console.error('ERROR: APP_ID is not set.');
  process.exit(1);
}

const MIRROR_USER_ID = '__MIRROR__';

const pool = new Pool({ connectionString: DATABASE_URL });

async function nuke() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete all Reddit mirror rows for this app.
    const mirrorResult = await client.query(
      `DELETE FROM items
       WHERE app_id = $1
         AND user_id = $2
         AND data->>'_source' = 'reddit'`,
      [APP_ID, MIRROR_USER_ID]
    );

    // 2. Clear the blocked_reddit_posts table for this app.
    const blockResult = await client.query(
      `DELETE FROM blocked_reddit_posts WHERE app_id = $1`,
      [APP_ID]
    );

    await client.query('COMMIT');

    console.log(`[reddit:nuke] Deleted ${mirrorResult.rowCount} Reddit mirror row(s).`);
    console.log(`[reddit:nuke] Deleted ${blockResult.rowCount} blocked Reddit post row(s).`);
    console.log('[reddit:nuke] Done. The scanner will start fresh on next server boot.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[reddit:nuke] ERROR — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

nuke();
