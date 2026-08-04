#!/usr/bin/env node
/**
 * One-time migration (latency diagnosis plan, Fix 0): move inline `data:` map image URLs
 * out of `table_state` rows and into Supabase Storage, replacing them with the resulting
 * public URL.
 *
 * Background: the unified import / paste-map flow historically wrote the cropped map image
 * as a base64 data URL directly into `mapImageUrl` instead of uploading it via
 * `POST /api/room/my/map-image` (Fix 1 addresses the flow itself so this can't recur). Any
 * table with a pasted map image ends up with a multi-MB `table_state` row, which is read and
 * written several times per table op and pushed in full to every connected client over SSE.
 *
 * This scans EVERY `table_state` row (all tables, all GMs) — not just one table — for inline
 * map images in both the current shape (`data.maps[].mapImageUrl`) and the legacy
 * pre-multi-map shape (`data.mapConfig.mapImageUrl`), uploads each one to the same
 * `whiteboard-assets` bucket / `map-images/{gmUid}/{uuid}.{ext}` path the live upload endpoint
 * uses, and rewrites just the `data` column with the public URL in place. Overlay PNGs
 * (`overlayPng`) are not handled here — they were confirmed to be zero bytes in production and
 * are hardened going forward by Fix 1 at the write path instead.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-map-images-to-storage.mjs                  # dry run — report only
 *   node --env-file=.env scripts/migrate-map-images-to-storage.mjs --apply          # upload + rewrite rows
 *   node --env-file=.env scripts/migrate-map-images-to-storage.mjs --apply --table-id=<id>  # single table
 *
 * Requires DATABASE_URL always; requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to --apply
 * (dry run works without Supabase configured, so it's safe to point at prod first without
 * risking an upload).
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getPool } from '../src/db.js';

const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const BUCKET = 'whiteboard-assets';

// Mirrors MIME_TO_EXT in server.js (POST /api/room/my/map-image) — kept local so this script
// has no dependency on importing server.js (which has side effects like cron jobs on import).
const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  'image/apng': 'apng',
};

const BASE64_DATA_URL_RE = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([\s\S]*)$/;

/** Parses a base64 `data:` URL into `{ mime, buffer }`, or null if not a base64 data URL. */
function parseBase64DataUrl(url) {
  if (typeof url !== 'string') return null;
  const m = BASE64_DATA_URL_RE.exec(url);
  if (!m) return null;
  const [, mime, payload] = m;
  return { mime, buffer: Buffer.from(payload, 'base64') };
}

/**
 * Collects every inline map-image "slot" in a table_state row's `data`, covering the current
 * multi-map shape and the legacy single-map shape. Each slot exposes `get`/`set` so the same
 * upload-and-replace logic works uniformly regardless of where the field lives.
 */
function collectMapImageSlots(data) {
  const slots = [];
  const maps = Array.isArray(data?.maps) ? data.maps : [];
  maps.forEach((map, i) => {
    slots.push({
      label: `maps[${i}]${map?.name ? ` "${map.name}"` : ''}`,
      get: () => map?.mapImageUrl,
      set: (url) => { map.mapImageUrl = url; },
    });
  });
  if (data?.mapConfig && typeof data.mapConfig === 'object') {
    slots.push({
      label: 'mapConfig (legacy)',
      get: () => data.mapConfig.mapImageUrl,
      set: (url) => { data.mapConfig.mapImageUrl = url; },
    });
  }
  return slots;
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const tableIdArg = argv.find((a) => a.startsWith('--table-id='));
  const tableId = tableIdArg ? tableIdArg.slice('--table-id='.length) : null;
  return { apply, tableId };
}

async function uploadMapImage(supabase, gmUid, mime, buffer) {
  const ext = MIME_TO_EXT[mime] || 'bin';
  const storagePath = `map-images/${gmUid}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function fmtBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

async function main() {
  const { apply, tableId } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (apply && !supabaseConfigured) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to --apply (uploads need Storage).');
    console.error('Run without --apply for a dry-run report (no Supabase needed).');
    process.exit(1);
  }
  const supabase = supabaseConfigured
    ? createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

  const db = getPool();
  const { rows } = await db.query(
    tableId
      ? `SELECT app_id, user_id, id, data FROM items
         WHERE app_id = $1 AND collection = 'table_state' AND id = $2
         ORDER BY id ASC`
      : `SELECT app_id, user_id, id, data FROM items
         WHERE app_id = $1 AND collection = 'table_state'
         ORDER BY id ASC`,
    tableId ? [APP_ID, tableId] : [APP_ID]
  );

  console.log(`${apply ? 'Migrating' : 'Scanning (dry run — no uploads, no writes)'} ${rows.length} table_state row(s)...\n`);

  let tablesWithInlineImages = 0;
  let tablesMigrated = 0;
  let imagesFound = 0;
  let imagesMigrated = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  const failures = [];

  for (const row of rows) {
    const gmUid = row.user_id;
    const rowTableId = row.id;
    const data = row.data;
    const slots = collectMapImageSlots(data).filter((slot) => parseBase64DataUrl(slot.get()));
    if (!slots.length) continue;

    tablesWithInlineImages++;
    const beforeSize = Buffer.byteLength(JSON.stringify(data));
    console.log(`Table ${rowTableId} (gm ${gmUid}): row is ${fmtBytes(beforeSize)}, ${slots.length} inline image(s):`);

    let rowChanged = false;
    for (const slot of slots) {
      const parsed = parseBase64DataUrl(slot.get());
      imagesFound++;
      console.log(`  - ${slot.label}: inline ${parsed.mime}, ${fmtBytes(parsed.buffer.length)}`);
      if (!apply) continue;
      try {
        const publicUrl = await uploadMapImage(supabase, gmUid, parsed.mime, parsed.buffer);
        slot.set(publicUrl);
        rowChanged = true;
        imagesMigrated++;
        console.log(`    -> uploaded to ${publicUrl}`);
      } catch (err) {
        failures.push({ tableId: rowTableId, slot: slot.label, error: err.message || String(err) });
        console.error(`    ! upload failed: ${err.message || err}`);
      }
    }

    if (apply && rowChanged) {
      const afterSize = Buffer.byteLength(JSON.stringify(data));
      try {
        await db.query(
          `UPDATE items SET data = $1, updated_at = now()
           WHERE app_id = $2 AND user_id = $3 AND collection = 'table_state' AND id = $4`,
          [data, APP_ID, gmUid, rowTableId]
        );
        tablesMigrated++;
        totalBytesBefore += beforeSize;
        totalBytesAfter += afterSize;
        console.log(`  -> wrote table ${rowTableId}: ${fmtBytes(beforeSize)} -> ${fmtBytes(afterSize)}`);
      } catch (err) {
        failures.push({ tableId: rowTableId, slot: '(row write)', error: err.message || String(err) });
        console.error(`  ! failed to write table ${rowTableId}: ${err.message || err}`);
      }
    }
    console.log('');
  }

  console.log('---');
  if (!apply) {
    console.log(
      tablesWithInlineImages
        ? `Dry run complete. ${tablesWithInlineImages} table(s) / ${imagesFound} image(s) would be migrated. Re-run with --apply to upload them to Supabase Storage and rewrite the rows.`
        : 'Dry run complete. No inline map images found — nothing to migrate.'
    );
  } else {
    console.log(
      `Done. Migrated ${imagesMigrated}/${imagesFound} image(s) across ${tablesMigrated}/${tablesWithInlineImages} table(s). ` +
      `Total migrated row size: ${fmtBytes(totalBytesBefore)} -> ${fmtBytes(totalBytesAfter)}.`
    );
    if (failures.length) {
      console.log(`\n${failures.length} failure(s) — safe to re-run the script, it will retry only what's still unmigrated:`);
      for (const f of failures) console.log(`  - table ${f.tableId} [${f.slot}]: ${f.error}`);
    }
  }

  await db.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
