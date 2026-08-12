#!/usr/bin/env node
/**
 * Character ownership reconciliation script.
 *
 * The items table has `(app_id, user_id, collection, id)` as its primary key, which allowed
 * the same character `id` to exist under multiple users (GM row + player shadow row). This
 * script audits every character id across all table_state rows and all `characters` items
 * rows, classifies each situation, and (with --apply + --decisions <file>) merges duplicates
 * into a single canonical row and stamps `table_id` on it.
 *
 * Usage:
 *   node --env-file=.env scripts/reconcile-character-ownership.mjs               # dry run — report only
 *   node --env-file=.env scripts/reconcile-character-ownership.mjs --decisions decisions.json  # see what --apply would do
 *   node --env-file=.env scripts/reconcile-character-ownership.mjs --apply --decisions decisions.json  # write changes
 *   node --env-file=.env scripts/reconcile-character-ownership.mjs --table-id=<id>  # scope to one table
 *   node --env-file=.env scripts/reconcile-character-ownership.mjs --check       # verify all clean after run
 *
 * Dry run requires only DATABASE_URL. --apply reads from --decisions file which you fill in
 * after reviewing the dry-run report.
 *
 * The report is saved to character-reconciliation-report.json (dry run + apply both write this).
 * The decisions template (for duplicate rows) is saved to character-reconciliation-decisions.template.json.
 * Fill in `keepUserId` for each "duplicate" entry, then pass it with --decisions.
 */

import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const { Pool } = pg;
const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { apply: false, check: false, tableId: null, decisionsFile: null };
  for (const arg of args) {
    if (arg === '--apply') opts.apply = true;
    else if (arg === '--check') opts.check = true;
    else if (arg.startsWith('--table-id=')) opts.tableId = arg.split('=')[1];
    else if (arg.startsWith('--decisions=')) opts.decisionsFile = arg.split('=')[1];
    else if (arg === '--decisions' && args[args.indexOf(arg) + 1]) {
      opts.decisionsFile = args[args.indexOf(arg) + 1];
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (opts.check) {
      await runCheck(pool);
    } else if (opts.apply) {
      if (!opts.decisionsFile) {
        console.error('--apply requires --decisions <file>');
        process.exit(1);
      }
      await runApply(pool, opts);
    } else {
      await runDryRun(pool, opts);
    }
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/** Load every table_state row (optionally scoped to one tableId). */
async function loadTableStates(pool, tableId) {
  let q, params;
  if (tableId) {
    q = `SELECT id, user_id, data FROM items WHERE app_id = $1 AND collection = 'table_state' AND id = $2`;
    params = [APP_ID, tableId];
  } else {
    q = `SELECT id, user_id, data FROM items WHERE app_id = $1 AND collection = 'table_state'`;
    params = [APP_ID];
  }
  const { rows } = await pool.query(q, params);
  return rows;
}

/** Load every character library row. */
async function loadCharacterRows(pool) {
  const { rows } = await pool.query(
    `SELECT id, user_id, table_id, data, is_public, updated_at
     FROM items WHERE app_id = $1 AND collection = 'characters'
     ORDER BY id, updated_at DESC NULLS LAST`,
    [APP_ID],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Build a map of characterId -> [{ tableId, tableName, gmUid, assignedPlayerEmail }]
 * by scanning all table_state elements.
 */
function buildCharacterTableRefMap(tableStateRows) {
  const map = new Map(); // charId -> Set of tableId refs

  for (const row of tableStateRows) {
    const tableId = row.id;
    const gmUid = row.user_id;
    const tableName = row.data?.tableName || row.data?.top?.tableName || tableId;
    const elements = row.data?.elements || [];

    for (const el of elements) {
      if (el.elementType !== 'character' || !el.id) continue;
      if (!map.has(el.id)) map.set(el.id, []);
      map.get(el.id).push({
        tableId,
        tableName,
        gmUid,
        assignedPlayerEmail: el.assignedPlayerEmail || null,
        instanceId: el.instanceId,
      });
    }
  }
  return map;
}

/**
 * Group character rows by id.
 * Returns Map<charId, row[]> where each entry has all rows for that id.
 */
function groupCharacterRowsById(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, []);
    map.get(row.id).push(row);
  }
  return map;
}

/** Lightweight diff — return array of field names that differ between two data objects. */
function diffFields(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const diffs = [];
  for (const k of keys) {
    if (k === 'updated_at') continue;
    const av = (a || {})[k];
    const bv = (b || {})[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) diffs.push(k);
  }
  return diffs;
}

/**
 * Classify each character id into one of:
 *   clean     — 1 table ref, 1 library row, just needs table_id backfill
 *   duplicate — 1+ table refs, 2+ library rows (the divergence bug)
 *   multi_table — 2+ different tables reference the same char id (legacy "browse existing")
 *   orphan_row — library row(s) but no table reference
 *   orphan_ref — table reference(s) but no library row
 *
 * Returns an array of classified entries.
 */
function classify(tableRefMap, rowsByCharId) {
  const allIds = new Set([...tableRefMap.keys(), ...rowsByCharId.keys()]);
  const entries = [];

  for (const charId of allIds) {
    const tableRefs = tableRefMap.get(charId) || [];
    const rows = rowsByCharId.get(charId) || [];

    const uniqueTableIds = [...new Set(tableRefs.map(r => r.tableId))];
    const tableCount = uniqueTableIds.length;
    const rowCount = rows.length;

    if (tableCount === 0 && rowCount > 0) {
      entries.push({ kind: 'orphan_row', charId, tableRefs, rows });
    } else if (tableCount > 0 && rowCount === 0) {
      entries.push({ kind: 'orphan_ref', charId, tableRefs, rows });
    } else if (tableCount > 1) {
      entries.push({ kind: 'multi_table', charId, tableRefs, rows, uniqueTableIds });
    } else if (rowCount > 1) {
      // Exactly 1 table, 2+ rows — the divergence bug
      const sorted = rows.slice().sort((a, b) => {
        const ta = new Date(a.updated_at ?? 0).getTime();
        const tb = new Date(b.updated_at ?? 0).getTime();
        return tb - ta; // newest first
      });
      const newestRow = sorted[0];
      const otherRows = sorted.slice(1);
      const diffedFields = diffFields(newestRow.data, otherRows[0]?.data);
      entries.push({
        kind: 'duplicate',
        charId,
        tableRefs,
        rows,
        newestRow,
        otherRows,
        diffedFields,
        // Default: keep the newest row's user. Fill in keepUserId to override.
        recommendedKeepUserId: newestRow.user_id,
      });
    } else {
      // Clean: exactly 1 table, 1 row
      const row = rows[0];
      entries.push({
        kind: 'clean',
        charId,
        tableRefs,
        rows,
        tableId: uniqueTableIds[0],
        rowUserId: row.user_id,
        currentTableId: row.table_id,
        needsTableIdBackfill: row.table_id !== uniqueTableIds[0],
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

async function runDryRun(pool, opts) {
  console.log('=== Character Ownership Reconciliation — DRY RUN ===\n');

  const tableStateRows = await loadTableStates(pool, opts.tableId);
  const characterRows = await loadCharacterRows(pool);

  console.log(`Table state rows scanned: ${tableStateRows.length}`);
  console.log(`Character library rows found: ${characterRows.length}\n`);

  const tableRefMap = buildCharacterTableRefMap(tableStateRows);
  const rowsByCharId = groupCharacterRowsById(characterRows);
  const entries = classify(tableRefMap, rowsByCharId);

  const byKind = { clean: [], duplicate: [], multi_table: [], orphan_row: [], orphan_ref: [] };
  for (const e of entries) byKind[e.kind].push(e);

  console.log('=== Summary ===');
  console.log(`  Clean (1 table, 1 row):             ${byKind.clean.length}`);
  console.log(`  Duplicate rows (1 table, 2+ rows):  ${byKind.duplicate.length}`);
  console.log(`  Multi-table references:             ${byKind.multi_table.length}`);
  console.log(`  Orphan library rows (no table ref): ${byKind.orphan_row.length}`);
  console.log(`  Orphan table refs (no library row): ${byKind.orphan_ref.length}`);

  const needsBackfill = byKind.clean.filter(e => e.needsTableIdBackfill);
  console.log(`  Clean rows needing table_id backfill: ${needsBackfill.length}\n`);

  if (byKind.duplicate.length > 0) {
    console.log('=== DUPLICATES (require your decision) ===');
    for (const e of byKind.duplicate) {
      console.log(`\n  Character: ${e.charId}`);
      console.log(`  Table: ${e.tableRefs[0]?.tableId} (${e.tableRefs[0]?.tableName})`);
      console.log(`  Rows (${e.rows.length}):`);
      for (const r of e.rows) {
        const age = r.updated_at ? new Date(r.updated_at).toISOString() : 'no timestamp';
        console.log(`    user_id=${r.user_id}  level=${r.data?.level ?? '?'}  name=${r.data?.name ?? '?'}  updated=${age}`);
      }
      console.log(`  Diverging fields: ${e.diffedFields.join(', ') || '(none)'}`);
      console.log(`  Recommended keep: user_id=${e.recommendedKeepUserId} (newest)`);
    }
  }

  if (byKind.multi_table.length > 0) {
    console.log('\n=== MULTI-TABLE REFS ===');
    for (const e of byKind.multi_table) {
      console.log(`\n  Character: ${e.charId}  name=${e.rows[0]?.data?.name ?? '?'}`);
      console.log(`  Referenced by tables: ${e.uniqueTableIds.join(', ')}`);
    }
  }

  if (byKind.orphan_ref.length > 0) {
    console.log('\n=== ORPHAN REFS (table references without library rows) ===');
    for (const e of byKind.orphan_ref) {
      console.log(`  ${e.charId} referenced by: ${e.tableRefs.map(r => r.tableId).join(', ')}`);
    }
  }

  if (byKind.orphan_row.length > 0) {
    console.log('\n=== ORPHAN ROWS (library rows without table references) ===');
    for (const e of byKind.orphan_row) {
      const r = e.rows[0];
      console.log(`  ${e.charId}  name=${r?.data?.name ?? '?'}  user=${r?.user_id}  updated=${r?.updated_at ?? 'none'}`);
    }
  }

  // Write full report
  const report = { generatedAt: new Date().toISOString(), opts, summary: {}, entries };
  report.summary = {
    clean: byKind.clean.length,
    cleanNeedingBackfill: needsBackfill.length,
    duplicate: byKind.duplicate.length,
    multi_table: byKind.multi_table.length,
    orphan_row: byKind.orphan_row.length,
    orphan_ref: byKind.orphan_ref.length,
  };
  writeFileSync('character-reconciliation-report.json', JSON.stringify(report, null, 2));
  console.log('\nFull report saved to: character-reconciliation-report.json');

  // Write decisions template for duplicates
  if (byKind.duplicate.length > 0) {
    const template = byKind.duplicate.map(e => ({
      charId: e.charId,
      tableId: e.tableRefs[0]?.tableId,
      characterName: e.rows[0]?.data?.name ?? 'Unknown',
      rows: e.rows.map(r => ({
        userId: r.user_id,
        level: r.data?.level ?? null,
        updatedAt: r.updated_at ?? null,
        divergingFields: e.diffedFields,
      })),
      recommendedKeepUserId: e.recommendedKeepUserId,
      // FILL THIS IN: set to the user_id of the row you want to keep as canonical
      keepUserId: e.recommendedKeepUserId,
      // Optional: override specific fields (e.g. take level from one row, name from another)
      // fieldOverrides: { level: 5, name: "Vodalus" }
      fieldOverrides: {},
    }));
    writeFileSync('character-reconciliation-decisions.template.json', JSON.stringify(template, null, 2));
    console.log('Decisions template saved to: character-reconciliation-decisions.template.json');
    console.log('\nFill in `keepUserId` (and optional `fieldOverrides`) in the template,');
    console.log('rename it to e.g. decisions.json, then re-run with --apply --decisions decisions.json');
  }

  const totalIssues = byKind.duplicate.length + byKind.multi_table.length;
  if (totalIssues === 0) {
    console.log('\n✓ No duplicates or multi-table refs found — ready to proceed with migration 038.');
  } else {
    console.log(`\n${totalIssues} issue(s) require resolution before applying migration 038.`);
  }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

async function runApply(pool, opts) {
  console.log('=== Character Ownership Reconciliation — APPLY ===\n');

  const decisions = JSON.parse(readFileSync(opts.decisionsFile, 'utf8'));
  const decisionsByCharId = Object.fromEntries(decisions.map(d => [d.charId, d]));

  const tableStateRows = await loadTableStates(pool, opts.tableId);
  const characterRows = await loadCharacterRows(pool);

  const tableRefMap = buildCharacterTableRefMap(tableStateRows);
  const rowsByCharId = groupCharacterRowsById(characterRows);
  const entries = classify(tableRefMap, rowsByCharId);

  const client = await pool.connect();
  let fixedClean = 0, fixedDuplicate = 0, skipped = 0, errors = 0;

  try {
    await client.query('BEGIN');

    for (const e of entries) {
      if (e.kind === 'clean' && e.needsTableIdBackfill) {
        // Backfill table_id on the single row
        try {
          await client.query(
            `UPDATE items SET table_id = $1
             WHERE app_id = $2 AND collection = 'characters' AND id = $3
               AND (table_id IS NULL OR table_id = $1)`,
            [e.tableId, APP_ID, e.charId],
          );
          console.log(`  ✓ Backfilled table_id=${e.tableId} on ${e.charId} (${e.rows[0]?.data?.name ?? '?'})`);
          fixedClean++;
        } catch (err) {
          console.error(`  ✗ Failed to backfill ${e.charId}: ${err.message}`);
          errors++;
        }
      } else if (e.kind === 'duplicate') {
        const decision = decisionsByCharId[e.charId];
        if (!decision) {
          console.warn(`  ⚠ No decision for duplicate ${e.charId} — skipping`);
          skipped++;
          continue;
        }
        const keepUserId = decision.keepUserId;
        const keepRow = e.rows.find(r => r.user_id === keepUserId);
        if (!keepRow) {
          console.error(`  ✗ keepUserId ${keepUserId} not found among rows for ${e.charId} — skipping`);
          errors++;
          continue;
        }
        const tableId = e.tableRefs[0]?.tableId;
        if (!tableId) {
          console.error(`  ✗ No tableId found for ${e.charId} — skipping`);
          errors++;
          continue;
        }

        // Merge field overrides into the keep row's data
        let finalData = { ...keepRow.data };
        if (decision.fieldOverrides && Object.keys(decision.fieldOverrides).length > 0) {
          finalData = { ...finalData, ...decision.fieldOverrides };
          console.log(`  Applying field overrides for ${e.charId}: ${Object.keys(decision.fieldOverrides).join(', ')}`);
        }

        // Update the keep row with merged data + table_id
        try {
          await client.query(
            `UPDATE items SET data = $1, table_id = $2, updated_at = now()
             WHERE app_id = $3 AND collection = 'characters' AND id = $4 AND user_id = $5`,
            [finalData, tableId, APP_ID, e.charId, keepUserId],
          );
        } catch (err) {
          console.error(`  ✗ Failed to update keep row for ${e.charId}: ${err.message}`);
          errors++;
          continue;
        }

        // Archive losing rows (rename id to _archivedDuplicateOf + charId + uuid)
        const losingRows = e.rows.filter(r => r.user_id !== keepUserId);
        let archiveErrors = 0;
        for (const loser of losingRows) {
          const archiveId = `_archivedDuplicateOf_${e.charId}_${randomUUID()}`;
          const archivedData = {
            ...loser.data,
            _archivedDuplicateOf: e.charId,
            _archivedAt: new Date().toISOString(),
            _archivedOriginalUserId: loser.user_id,
          };
          try {
            await client.query(
              `UPDATE items SET id = $1, data = $2
               WHERE app_id = $3 AND collection = 'characters' AND id = $4 AND user_id = $5`,
              [archiveId, archivedData, APP_ID, e.charId, loser.user_id],
            );
            console.log(`  ↳ Archived row user_id=${loser.user_id} as ${archiveId}`);
          } catch (err) {
            console.error(`  ✗ Failed to archive losing row user_id=${loser.user_id}: ${err.message}`);
            archiveErrors++;
          }
        }

        if (archiveErrors === 0) {
          console.log(`  ✓ Merged duplicate ${e.charId} (${keepRow.data?.name ?? '?'}) → keepUserId=${keepUserId} tableId=${tableId}`);
          fixedDuplicate++;
        } else {
          errors += archiveErrors;
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err.message);
    errors++;
  } finally {
    client.release();
  }

  console.log('\n=== Apply Summary ===');
  console.log(`  table_id backfills:   ${fixedClean}`);
  console.log(`  Duplicates merged:    ${fixedDuplicate}`);
  console.log(`  Skipped (no decision): ${skipped}`);
  console.log(`  Errors:               ${errors}`);

  // Write updated report
  const report = { generatedAt: new Date().toISOString(), mode: 'apply', opts, fixedClean, fixedDuplicate, skipped, errors };
  writeFileSync('character-reconciliation-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to: character-reconciliation-report.json');

  if (errors > 0) {
    console.log('\n⚠ Some errors occurred — re-run the dry run to see remaining issues.');
    process.exit(1);
  } else {
    console.log('\n✓ Apply complete. Run with --check to verify no duplicates remain.');
  }
}

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

async function runCheck(pool) {
  console.log('=== Character Ownership Check ===\n');

  const tableStateRows = await loadTableStates(pool, null);
  const characterRows = await loadCharacterRows(pool);

  const tableRefMap = buildCharacterTableRefMap(tableStateRows);
  const rowsByCharId = groupCharacterRowsById(characterRows);
  const entries = classify(tableRefMap, rowsByCharId);

  const duplicates = entries.filter(e => e.kind === 'duplicate');
  const multiTable = entries.filter(e => e.kind === 'multi_table');

  if (duplicates.length === 0 && multiTable.length === 0) {
    console.log('✓ All clear — no duplicate rows or multi-table refs found.');
    console.log('  Safe to apply migration 038 (unique index).');
  } else {
    console.log(`✗ Issues remain:`);
    if (duplicates.length) console.log(`  ${duplicates.length} duplicate row situation(s)`);
    if (multiTable.length) console.log(`  ${multiTable.length} multi-table reference(s)`);
    console.log('\nRun the dry run again to see details.');
    process.exit(1);
  }

  const missingTableId = characterRows.filter(r => !r.table_id);
  console.log(`\n  Character rows without table_id: ${missingTableId.length}`);
  if (missingTableId.length > 0) {
    console.log('  (These will be backfilled on next save or via --apply with a decisions file)');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
