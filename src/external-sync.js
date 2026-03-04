/**
 * Background sync of FCG and HoD into external_item_cache.
 * Runs full-dataset loops: paginate all FCG pages, list all HoD IDs, fetch all HoD details.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { searchFCG } from './fcg-search.js';
import { searchHoD, fetchHoDFoundryDetail } from './hod-search.js';
import { upsertExternalCache, getCachedExternalIds, getSyncState, setSyncState } from './db.js';
import { createHash } from 'crypto';

const FCG_PAGE_SIZE = 100;
const HOD_LIST_PAGE_SIZE = 100;
const HOD_DETAIL_THROTTLE_MS = 1000;
const FCG_PARALLEL_PAGES = 3;
const HOD_PARALLEL_DETAIL = 3;

function hashContent(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

/**
 * Sync all FCG adversaries and environments into external_item_cache.
 * Paginates the full catalog (no category filter); fetches 3 pages in parallel.
 */
async function syncFCG(appId, onProgress) {
  let offset = 0;
  let hasMore = true;
  let pageNum = 0;
  let totalProcessed = 0;
  let fcgTotal = 0;
  let advCount = 0;
  let envCount = 0;

  while (hasMore) {
    const offsets = Array.from({ length: FCG_PARALLEL_PAGES }, (_, i) => offset + i * FCG_PAGE_SIZE);
    const results = await Promise.all(
      offsets.map(o => searchFCG({ search: '', limit: FCG_PAGE_SIZE, offset: o }))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const advItems = result.adversaries || [];
      const envItems = result.environments || [];
      fcgTotal = result.fcgTotal || 0;

      for (const item of advItems) {
        const rawHash = hashContent(item);
        const { id, _source, ...data } = item;
        await upsertExternalCache(appId, 'fcg', 'adversaries', id, { ...data, _source: 'fcg' }, rawHash);
        totalProcessed++;
        advCount++;
      }
      for (const item of envItems) {
        const rawHash = hashContent(item);
        const { id, _source, ...data } = item;
        await upsertExternalCache(appId, 'fcg', 'environments', id, { ...data, _source: 'fcg' }, rawHash);
        totalProcessed++;
        envCount++;
      }

      pageNum++;
      onProgress?.({
        source: 'fcg',
        page: pageNum,
        offset: offsets[i],
        total: fcgTotal,
        processed: totalProcessed,
        advCount,
        envCount,
      });

      const totalInPage = advItems.length + envItems.length;
      if (totalInPage === 0) {
        hasMore = false;
        break;
      }
    }

    if (hasMore) {
      offset += FCG_PARALLEL_PAGES * FCG_PAGE_SIZE;
      if (offset >= fcgTotal) hasMore = false;
    }
  }

  return { totalProcessed, advCount, envCount };
}

/**
 * Sync all HoD adversaries and environments into external_item_cache.
 * List phase: paginate through all list pages to collect post IDs.
 * Detail phase: fetch Foundry JSON for each ID (3 parallel, 1s throttle per chunk).
 * When opts.fullRefresh is false (default), skips items already in cache.
 */
async function syncHoD(appId, onProgress, opts = {}) {
  const fullRefresh = opts.fullRefresh === true;
  const timestamp = Date.now();
  const runDir = join(process.cwd(), 'data', 'hod-crawl', String(timestamp));
  mkdirSync(runDir, { recursive: true });

  const collections = ['adversaries', 'environments'];
  const allIds = []; // { postId, collection, link }
  const targets = {}; // { adversaries: N, environments: N }

  for (const collection of collections) {
    let offset = 0;
    let hasMore = true;
    let pageNum = 0;

    while (hasMore) {
      const result = await searchHoD({
        search: '',
        collection,
        limit: HOD_LIST_PAGE_SIZE,
        offset,
      });

      const items = result.items || [];
      const totalCount = result.totalCount || 0;
      targets[collection] = totalCount;

      const pageItems = [];
      for (const item of items) {
        const postId = item._hodPostId || item.id?.replace(/^hod-/, '');
        const link = item._hodLink || `https://heartofdaggers.com/?p=${postId}`;
        if (postId) {
          const entry = { postId, collection, link, name: item.name || '' };
          allIds.push(entry);
          pageItems.push(entry);
        }
      }

      pageNum++;
      const pagePath = join(runDir, `${collection}-page-${pageNum}.json`);
      writeFileSync(pagePath, JSON.stringify({ collection, page: pageNum, offset, totalCount, count: pageItems.length, items: pageItems }, null, 2), 'utf8');

      const collectionCollected = allIds.filter(({ collection: c }) => c === collection).length;
      onProgress?.({
        source: 'hod',
        phase: 'list',
        collection,
        page: pageNum,
        idsCollected: allIds.length,
        collectionCollected,
        targetTotal: totalCount,
      });

      if (items.length === 0) {
        hasMore = false;
      } else {
        // Advance by requested page size, not items.length. If we advance by items.length
        // and the API returns fewer items than requested, we'd re-request the same page
        // and get duplicates (e.g. page 2 returns 80 items → offset 180 → page 2 again).
        offset += HOD_LIST_PAGE_SIZE;
        if (offset >= totalCount) hasMore = false;
      }
    }
  }

  const preDedupCount = allIds.length;
  const seen = new Set();
  const duplicates = [];
  const uniqueIds = allIds.filter((item) => {
    const { postId, collection } = item;
    const key = `${collection}:${postId}`;
    if (seen.has(key)) {
      duplicates.push(item);
      return false;
    }
    seen.add(key);
    return true;
  });
  const postDedupCount = uniqueIds.length;

  const predupPath = join(runDir, 'predup.json');
  const dedupPath = join(runDir, 'dedup.json');
  const dupsPath = join(runDir, 'dups.json');
  writeFileSync(predupPath, JSON.stringify({ phase: 'pre-dedup', description: 'Raw list from API (may contain duplicates)', count: preDedupCount, items: allIds }, null, 2), 'utf8');
  writeFileSync(dedupPath, JSON.stringify({ phase: 'post-dedup', description: 'Unique items only (duplicates removed)', count: postDedupCount, items: uniqueIds }, null, 2), 'utf8');
  writeFileSync(dupsPath, JSON.stringify({ phase: 'dupes', description: 'Duplicate records that were removed', count: duplicates.length, items: duplicates }, null, 2), 'utf8');

  let toFetch = uniqueIds;
  let skipped = 0;
  if (!fullRefresh) {
    const cachedIds = await getCachedExternalIds(appId, 'hod');
    toFetch = uniqueIds.filter(({ postId, collection }) => {
      const externalId = `hod-${postId}`;
      return !cachedIds.has(externalId);
    });
    skipped = uniqueIds.length - toFetch.length;
  }
  onProgress?.({ source: 'hod', phase: 'list_done', total: postDedupCount, skipped, toFetch: toFetch.length, preDedupCount, postDedupCount, targets, runDir, predupPath, dedupPath, dupsPath });

  let detailNum = 0;
  let successCount = 0;
  for (let i = 0; i < toFetch.length; i += HOD_PARALLEL_DETAIL) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, HOD_DETAIL_THROTTLE_MS));
    }
    const chunk = toFetch.slice(i, i + HOD_PARALLEL_DETAIL);
    const results = await Promise.all(
      chunk.map(async ({ postId, collection, link }) => {
        let fetchedName = null;
        try {
          const full = await fetchHoDFoundryDetail(postId, link, collection);
          fetchedName = full?.name;
          const rawHash = hashContent(full);
          const { id, _source, _hodPostId, _hodLink, ...data } = full;
          const externalId = id;
          await upsertExternalCache(appId, 'hod', collection, externalId, {
            ...data,
            _source: 'hod',
            _hodPostId: postId,
            _hodLink: link,
          }, rawHash);
          return { success: true, name: fetchedName, postId };
        } catch (err) {
          console.warn(`[sync] HoD detail fetch failed for ${postId}:`, err.message);
          return { success: false, name: null, postId };
        }
      })
    );

    for (const r of results) {
      if (r.success) successCount++;
      detailNum++;
    }
    if (detailNum % 10 === 0 || detailNum === toFetch.length) {
      const last = results[results.length - 1];
      onProgress?.({
        source: 'hod',
        phase: 'detail',
        current: detailNum,
        total: toFetch.length,
        successCount,
        name: last?.name,
        postId: last?.postId,
      });
    }
  }

  return { total: postDedupCount, successCount, skipped, toFetch: toFetch.length, preDedupCount, postDedupCount };
}

/**
 * Run full sync: FCG + HoD in parallel.
 * Uses a mutex so only one sync runs at a time.
 * @param {object} opts - Optional. hodFullRefresh: true for HoD full refresh (default false = incremental).
 */
let syncInProgress = false;

export async function runFullSync(appId, onProgress, opts = {}) {
  if (syncInProgress) {
    throw new Error('Sync already in progress');
  }
  syncInProgress = true;
  try {
    onProgress?.({ phase: 'start' });
    const [fcgResult, hodResult] = await Promise.all([
      syncFCG(appId, (d) => onProgress?.({ ...d, source: 'fcg' })),
      syncHoD(appId, (d) => onProgress?.({ ...d, source: 'hod' }), { fullRefresh: opts.hodFullRefresh === true }),
    ]);
    const fcgCount = typeof fcgResult === 'object' ? fcgResult.totalProcessed : fcgResult;
    const hodCount = typeof hodResult === 'object' ? hodResult.successCount : hodResult;
    onProgress?.({ phase: 'fcg_done', count: fcgCount, ...(typeof fcgResult === 'object' ? fcgResult : {}) });
    onProgress?.({ phase: 'hod_done', count: hodCount, ...(typeof hodResult === 'object' ? hodResult : {}) });
    onProgress?.({ phase: 'done', fcgCount, hodCount, fcgResult, hodResult });
    return { fcgCount, hodCount, fcgResult, hodResult };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Run sync for a single source: 'fcg' or 'hod'.
 * @param {object} opts - Optional. fullRefresh: true for HoD full refresh (default false = incremental).
 */
export async function runSyncSource(appId, source, onProgress, opts = {}) {
  if (syncInProgress) {
    throw new Error('Sync already in progress');
  }
  const src = source?.toLowerCase();
  if (src !== 'fcg' && src !== 'hod') {
    throw new Error(`Unknown source: ${source}. Use 'fcg' or 'hod'.`);
  }
  syncInProgress = true;
  try {
    onProgress?.({ phase: 'start', source: src });
    if (src === 'fcg') {
      const result = await syncFCG(appId, onProgress);
      const count = typeof result === 'object' ? result.totalProcessed : result;
      onProgress?.({ phase: 'done', source: 'fcg', count, result });
      return result;
    }
    const result = await syncHoD(appId, onProgress, { fullRefresh: opts.fullRefresh === true });
    const count = typeof result === 'object' ? result.successCount : result;
    onProgress?.({ phase: 'done', source: 'hod', count, result });
    return result;
  } finally {
    syncInProgress = false;
  }
}

export function isSyncInProgress() {
  return syncInProgress;
}
