#!/usr/bin/env node
/**
 * One-time migration: move inline `data:` item image URLs out of library rows
 * (`characters`, `adversaries`, `environments`, `scenes`, `adventures`) and into
 * Supabase Storage, replacing them with the resulting public URL.
 *
 * Background: several client paths (AI image generation, paste/drop into ItemDetailModal,
 * Unified Import) historically stored base64 data URLs directly in `imageUrl` /
 * `_additionalImages` on library items. These blobs inflate DB row sizes and slow reads.
 * The `POST /api/images/upload` path added alongside this script prevents new occurrences;
 * this script cleans up already-persisted ones.
 *
 * Coverage:
 *  - Top-level `imageUrl` and `_additionalImages` on any row.
 *  - Nested scene shapes: `adversaries[].data.imageUrl`, `environments[].data.imageUrl`.
 *  - All entries in `_additionalImages` arrays at any depth.
 *
 * Images land under `item-images/{ownerUid}/{uuid}.{ext}` in the same
 * `whiteboard-assets` Supabase bucket used by map images.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-item-images-to-storage.mjs                             # dry run
 *   node --env-file=.env scripts/migrate-item-images-to-storage.mjs --apply                     # upload + rewrite
 *   node --env-file=.env scripts/migrate-item-images-to-storage.mjs --apply --collection=adversaries  # single collection
 *
 * Requires DATABASE_URL always; requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for --apply.
 * Idempotent / resumable — rows without inline data URLs are skipped on re-run.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getPool } from '../src/db.js';

const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';
const BUCKET = 'whiteboard-assets';
const ITEM_COLLECTIONS = ['characters', 'adversaries', 'environments', 'scenes', 'adventures'];

const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif',
  'image/apng': 'apng',
};

const BASE64_DATA_URL_RE = /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,([\s\S]*)$/;

function parseBase64DataUrl(url) {
  if (typeof url !== 'string') return null;
  const m = BASE64_DATA_URL_RE.exec(url);
  if (!m) return null;
  const [, mime, payload] = m;
  return { mime, buffer: Buffer.from(payload, 'base64') };
}

async function uploadItemImage(supabase, ownerUid, mime, buffer) {
  const ext = MIME_TO_EXT[mime] || 'bin';
  const storagePath = `item-images/${ownerUid}/${randomUUID()}.${ext}`;
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

/**
 * Collect every { label, get, set } slot pointing at an imageUrl or _additionalImages entry
 * that might be a data URL, recursively walking plain-object trees.
 *
 * Mutates `slots` in place.
 */
function collectImageSlots(node, path, slots) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item, idx) => collectImageSlots(item, `${path}[${idx}]`, slots));
    return;
  }
  if ('imageUrl' in node && typeof node.imageUrl === 'string' && node.imageUrl.startsWith('data:')) {
    const captured = { node, key: 'imageUrl' };
    slots.push({
      label: `${path}.imageUrl`,
      get: () => captured.node[captured.key],
      set: (url) => { captured.node[captured.key] = url; },
    });
  }
  if ('_additionalImages' in node && Array.isArray(node._additionalImages)) {
    node._additionalImages.forEach((url, idx) => {
      if (typeof url === 'string' && url.startsWith('data:')) {
        const capturedNode = node;
        const capturedIdx = idx;
        slots.push({
          label: `${path}._additionalImages[${capturedIdx}]`,
          get: () => capturedNode._additionalImages[capturedIdx],
          set: (u) => { capturedNode._additionalImages[capturedIdx] = u; },
        });
      }
    });
  }
  // Recurse into known nested shapes that might carry their own imageUrl.
  for (const key of ['adversaries', 'environments', 'scenes']) {
    if (Array.isArray(node[key])) {
      node[key].forEach((entry, idx) => {
        if (entry && typeof entry === 'object' && entry.data && typeof entry.data === 'object') {
          collectImageSlots(entry.data, `${path}.${key}[${idx}].data`, slots);
        }
      });
    }
  }
}

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const colArg = argv.find((a) => a.startsWith('--collection='));
  const collection = colArg ? colArg.slice('--collection='.length) : null;
  if (collection && !ITEM_COLLECTIONS.includes(collection)) {
    console.error(`Unknown collection "${collection}". Valid: ${ITEM_COLLECTIONS.join(', ')}`);
    process.exit(1);
  }
  return { apply, collection };
}

async function main() {
  const { apply, collection } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (apply && !supabaseConfigured) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to --apply.');
    console.error('Run without --apply for a dry-run report.');
    process.exit(1);
  }
  const supabase = supabaseConfigured
    ? createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

  const db = getPool();
  const collections = collection ? [collection] : ITEM_COLLECTIONS;

  let totalRowsScanned = 0;
  let rowsWithInlineImages = 0;
  let rowsMigrated = 0;
  let imagesFound = 0;
  let imagesMigrated = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;
  const failures = [];

  for (const col of collections) {
    const { rows } = await db.query(
      `SELECT app_id, user_id, id, data FROM items WHERE app_id = $1 AND collection = $2 ORDER BY id ASC`,
      [APP_ID, col],
    );
    console.log(`\n[${col}] ${rows.length} row(s)`);
    totalRowsScanned += rows.length;

    for (const row of rows) {
      const ownerUid = row.user_id;
      const itemId = row.id;
      const data = row.data;
      if (!data || typeof data !== 'object') continue;

      const slots = [];
      collectImageSlots(data, 'data', slots);
      if (!slots.length) continue;

      rowsWithInlineImages++;
      const beforeSize = Buffer.byteLength(JSON.stringify(data));
      const name = data.name || itemId;
      console.log(`  ${col}/${itemId} "${name}": ${fmtBytes(beforeSize)}, ${slots.length} inline image(s):`);

      let rowChanged = false;
      for (const slot of slots) {
        const parsed = parseBase64DataUrl(slot.get());
        if (!parsed) continue;
        imagesFound++;
        console.log(`    - ${slot.label}: ${parsed.mime}, ${fmtBytes(parsed.buffer.length)}`);
        if (!apply) continue;
        try {
          const publicUrl = await uploadItemImage(supabase, ownerUid, parsed.mime, parsed.buffer);
          slot.set(publicUrl);
          rowChanged = true;
          imagesMigrated++;
          console.log(`      -> ${publicUrl}`);
        } catch (err) {
          failures.push({ col, itemId, slot: slot.label, error: err.message || String(err) });
          console.error(`      ! upload failed: ${err.message || err}`);
        }
      }

      if (apply && rowChanged) {
        const afterSize = Buffer.byteLength(JSON.stringify(data));
        try {
          await db.query(
            `UPDATE items SET data = $1 WHERE app_id = $2 AND user_id = $3 AND collection = $4 AND id = $5`,
            [data, APP_ID, ownerUid, col, itemId],
          );
          rowsMigrated++;
          totalBytesBefore += beforeSize;
          totalBytesAfter += afterSize;
          console.log(`    -> wrote: ${fmtBytes(beforeSize)} -> ${fmtBytes(afterSize)}`);
        } catch (err) {
          failures.push({ col, itemId, slot: '(row write)', error: err.message || String(err) });
          console.error(`    ! failed to write ${col}/${itemId}: ${err.message || err}`);
        }
      }
    }
  }

  console.log('\n---');
  if (!apply) {
    console.log(
      rowsWithInlineImages
        ? `Dry run complete. ${rowsWithInlineImages} row(s) / ${imagesFound} image(s) across ${totalRowsScanned} scanned would be migrated. Re-run with --apply to upload and rewrite.`
        : `Dry run complete. No inline item images found across ${totalRowsScanned} row(s) — nothing to migrate.`,
    );
  } else {
    console.log(
      `Done. Migrated ${imagesMigrated}/${imagesFound} image(s) in ${rowsMigrated}/${rowsWithInlineImages} row(s). ` +
      (totalBytesBefore ? `Total row size change: ${fmtBytes(totalBytesBefore)} -> ${fmtBytes(totalBytesAfter)}.` : ''),
    );
    if (failures.length) {
      console.log(`\n${failures.length} failure(s) — re-run to retry only unmigrated items:`);
      for (const f of failures) console.log(`  - ${f.col}/${f.itemId} [${f.slot}]: ${f.error}`);
    }
  }

  await db.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
