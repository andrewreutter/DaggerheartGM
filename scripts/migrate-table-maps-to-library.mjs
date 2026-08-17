/**
 * Dry-run / apply: import table_state.maps[] into the owner's library.
 * Dedupe by mapImageUrl; blanks each get their own row. Stamps libraryMapId.
 *
 *   node --env-file=.env scripts/migrate-table-maps-to-library.mjs
 *   node --env-file=.env scripts/migrate-table-maps-to-library.mjs --apply
 *   node --env-file=.env scripts/migrate-table-maps-to-library.mjs --apply --table-id=...
 */
import { getPool, upsertItem, getUnifiedItems } from '../src/db.js';
import { planTableMapLibraryImport } from '../src/client/lib/map-library-import.js';
import { applyTableOp } from '../src/client/lib/table-ops.js';

const APPLY = process.argv.includes('--apply');
const tableIdArg = process.argv.find((a) => a.startsWith('--table-id='))?.slice('--table-id='.length);
const APP_ID = process.env.APP_ID || 'daggerheart-gm';

async function loadOwnerMaps(userId) {
  const { items } = await getUnifiedItems(APP_ID, userId, 'maps', {
    includeMine: true,
    includePublic: false,
    includeSrd: false,
    limit: 500,
    offset: 0,
    sort: 'name',
  });
  const byUrl = new Map();
  for (const it of items || []) {
    const u = it.mapImageUrl || it.imageUrl;
    if (u && !byUrl.has(u)) byUrl.set(u, it);
  }
  return byUrl;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const pool = getPool();
  const { rows } = tableIdArg
    ? await pool.query(
      `SELECT user_id, id, data FROM items WHERE app_id = $1 AND collection = 'table_state' AND id = $2`,
      [APP_ID, tableIdArg],
    )
    : await pool.query(
      `SELECT user_id, id, data FROM items WHERE app_id = $1 AND collection = 'table_state'`,
      [APP_ID],
    );

  let created = 0;
  let linked = 0;
  for (const row of rows) {
    const maps = row.data?.maps || [];
    if (!maps.some((m) => m && !m.libraryMapId)) continue;
    const existing = await loadOwnerMaps(row.user_id);
    const plan = planTableMapLibraryImport(maps, {
      existingLibraryByUrl: existing,
      mapViews: row.data?.mapViews,
      elements: row.data?.elements,
    });
    console.log(`${row.id} owner=${row.user_id} create=${plan.create.length} link=${plan.link.length}`);
    if (!APPLY) continue;
    for (const item of plan.create) {
      await upsertItem(APP_ID, row.user_id, 'maps', item.id, item, false);
      created += 1;
    }
    if (plan.link.length) {
      const stateForOp = { ...row.data, activeElements: row.data.elements || [] };
      const changes = applyTableOp({ op: 'link-maps-library', links: plan.link }, stateForOp);
      const next = { ...row.data, ...changes };
      if (changes.activeElements) {
        next.elements = changes.activeElements;
        delete next.activeElements;
      }
      await upsertItem(APP_ID, row.user_id, 'table_state', row.id, next, false);
      linked += plan.link.length;
    }
  }
  console.log(APPLY ? `Applied. created=${created} linked=${linked}` : 'Dry run only (pass --apply to write).');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
