#!/usr/bin/env node
/**
 * Manual run of FCG + HoD sync.
 * Usage:
 *   npm run crawl          — sync both FCG and HoD
 *   npm run crawl:fcg     — sync FCG only
 *   npm run crawl:hod     — sync HoD only
 */

import { runMigrations } from '../src/db.js';
import { runFullSync, runSyncSource } from '../src/external-sync.js';

const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';

function formatProgress(data) {
  if (data.phase === 'start') {
    return data.source ? `[${data.source.toUpperCase()}] Starting...` : '[Sync] Starting...';
  }
  if (data.phase === 'fcg_done') {
    const r = data;
    if (r.advCount != null && r.envCount != null) {
      return `[FCG] Done: ${r.count} items (${r.advCount} adversaries, ${r.envCount} environments)`;
    }
    return `[FCG] Done: ${r.count} items`;
  }
  if (data.phase === 'hod_done') {
    const r = data;
    if (r.result?.total != null && r.result?.successCount != null) {
      const dedupNote = r.result.preDedupCount != null && r.result.postDedupCount != null && r.result.preDedupCount !== r.result.postDedupCount
        ? ` (list had ${r.result.preDedupCount}, deduped to ${r.result.postDedupCount})`
        : '';
      return `[HoD] Done: ${r.result.successCount}/${r.result.total} items synced${dedupNote}`;
    }
    return `[HoD] Done: ${r.count} items`;
  }
  if (data.phase === 'done') {
    if (data.source) {
      return `[${data.source.toUpperCase()}] Complete.`;
    }
    return `[Sync] Complete. FCG: ${data.fcgCount}, HoD: ${data.hodCount}`;
  }
  if (data.source === 'fcg') {
    const pct = data.total > 0 ? ((data.processed / data.total) * 100).toFixed(1) : '?';
    const breakdown = data.advCount != null && data.envCount != null
      ? ` (${data.advCount} adv, ${data.envCount} env)`
      : '';
    return `[FCG] Page ${data.page}: ${data.processed}/${data.total} items (${pct}%)${breakdown}`;
  }
  if (data.source === 'hod' && data.phase === 'list') {
    const target = data.targetTotal != null ? ` (target: ${data.targetTotal})` : '';
    return `[HoD] List ${data.collection} page ${data.page}: ${data.collectionCollected}/${data.targetTotal} collected${target}`;
  }
  if (data.source === 'hod' && data.phase === 'list_done') {
    const t = data.targets || {};
    const adv = t.adversaries ?? '?';
    const env = t.environments ?? '?';
    const pre = data.preDedupCount ?? data.total;
    const post = data.postDedupCount ?? data.total;
    let dedupLine = '';
    if (pre !== post) {
      const dupCount = pre - post;
      dedupLine = ` Dedup: ${pre} → ${post} (${dupCount} duplicates removed).`;
    }
    const skipLine = data.skipped != null && data.skipped > 0
      ? ` ${data.skipped} cached (skip), ${data.toFetch} to fetch.`
      : '';
    if (data.runDir) {
      const paths = [data.predupPath, data.dedupPath, data.dupsPath].filter(Boolean).join(' ');
      dedupLine += (dedupLine ? ' ' : '.') + ` run: ${data.runDir} pre deduped dupes: ${paths}`;
    }
    return `[HoD] List complete: ${data.total} unique IDs (adversaries: ${adv}, environments: ${env}).${skipLine}${dedupLine} Starting detail fetch...`;
  }
  if (data.source === 'hod' && data.phase === 'detail') {
    const pct = data.total > 0 ? ((data.current / data.total) * 100).toFixed(1) : '?';
    const name = data.name ? ` — ${data.name}` : '';
    const ok = data.successCount != null ? ` (${data.successCount} ok)` : '';
    return `[HoD] Detail ${data.current}/${data.total} (${pct}%)${ok}${name}`;
  }
  return '';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const sourceArg = args.find(a => ['fcg', 'hod'].includes(a?.toLowerCase()))?.toLowerCase();
  const hodFull = args.includes('--full');
  const runSourceOnly = sourceArg === 'fcg' || sourceArg === 'hod';

  try {
    await runMigrations();
    const onProgress = (data) => {
      const msg = formatProgress(data);
      if (msg) console.log(msg);
    };

    if (runSourceOnly) {
      const opts = sourceArg === 'hod' && hodFull ? { fullRefresh: true } : {};
      await runSyncSource(APP_ID, sourceArg, onProgress, opts);
    } else {
      await runFullSync(APP_ID, onProgress);
    }
    process.exit(0);
  } catch (err) {
    console.error('Crawl failed:', err.message);
    process.exit(1);
  }
}

main();
