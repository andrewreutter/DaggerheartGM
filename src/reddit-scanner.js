/**
 * Reddit background scanner.
 *
 * Periodically discovers new Reddit posts from r/daggerbrew and r/daggerheart,
 * auto-parses each one via the full text→OCR→LLM cascade, and stores the results
 * as mirror items with _redditStatus: 'needs_review' or 'failed'.
 *
 * The scanner is the SOLE entry point for new Reddit content — users never see
 * unreviewed posts. Only admin-approved items (_redditStatus: 'parsed') appear
 * in the Library.
 */

import { fetchPage, normalizePost, SUBREDDIT_CONFIG } from './reddit-search.js';
import { runParseCascade } from './reddit-parse-cascade.js';
import { upsertMirror, getExistingRedditMirrorIds, getBlockedRedditPostIds } from './db.js';

// Scan every 15 minutes
const SCAN_INTERVAL_MS = 15 * 60 * 1000;
// Delay between individual post parses (respects image fetch rate limits)
const BETWEEN_POST_DELAY_MS = 5000;
// Delay between listing fetches within a cycle
const BETWEEN_FETCH_DELAY_MS = 10000;

let scanTimer = null;
let scanning = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run one full scan cycle: discover → dedup → parse → store.
 */
async function runScanCycle(appId) {
  if (scanning) {
    console.log('[reddit-scanner] Previous cycle still running, skipping');
    return;
  }
  scanning = true;
  console.log('[reddit-scanner] Starting scan cycle');

  try {
    // Step 1: Fetch one page of recent posts from each subreddit/flair combo.
    const listingFetches = [
      { subreddit: 'daggerbrew', flair: 'Adversaries', collection: 'adversaries' },
      { subreddit: 'daggerbrew', flair: 'Environments', collection: 'environments' },
      // r/daggerheart uses a single Homebrew flair — collection determined by content
      { subreddit: 'daggerheart', flair: 'Homebrew', collection: null },
    ];

    const allPosts = [];
    for (const { subreddit, flair, collection } of listingFetches) {
      try {
        const { posts } = await fetchPage(subreddit, flair, '', null);
        for (const post of posts) {
          allPosts.push({ post, hintCollection: collection });
        }
        console.log(`[reddit-scanner] Fetched ${posts.length} posts from r/${subreddit} (${flair})`);
      } catch (err) {
        console.warn(`[reddit-scanner] Failed to fetch r/${subreddit} ${flair}:`, err.message);
      }
      await sleep(BETWEEN_FETCH_DELAY_MS);
    }

    if (allPosts.length === 0) {
      console.log('[reddit-scanner] No posts fetched');
      return;
    }

    // Step 2: Dedup — find which posts we haven't stored yet and aren't tagged/blocked.
    const allIds = allPosts.map(({ post }) => post.id);
    const itemIds = allIds.map(id => `reddit-${id}`);
    const [existingIds, blockedPostIds] = await Promise.all([
      getExistingRedditMirrorIds(appId, itemIds),
      getBlockedRedditPostIds(appId),
    ]);

    const newPosts = allPosts.filter(({ post }) =>
      !existingIds.has(`reddit-${post.id}`) && !blockedPostIds.has(post.id)
    );
    console.log(`[reddit-scanner] ${newPosts.length} new posts to parse (${allPosts.length - newPosts.length} already known)`);

    // Step 3: Parse each new post and store the result(s).
    // runParseCascade returns an array — posts with multiple stat blocks produce
    // multiple items (each with a suffixed ID like reddit-{postId}-0, -1, etc.).
    for (const { post, hintCollection } of newPosts) {
      try {
        // hintCollection is set for r/daggerbrew (reliable flair).
        // For r/daggerheart "Homebrew" posts (hintCollection = null), let the cascade
        // auto-detect from post text + OCR so image-only stat blocks are classified correctly.
        console.log(`[reddit-scanner] Parsing post ${post.id} "${post.name}"${hintCollection ? ` → ${hintCollection}` : ' (auto-detect)'}`);

        const results = await runParseCascade({
          collection: hintCollection,
          redditPostId: post._redditPostId,
          selftext: post._redditSelftext,
          images: post._redditImages,
          name: post.name,
        });

        for (const result of results) {
          const { item, collection: resolvedCollection } = result;
          // Strip runtime fields before storing
          const { id: _id, _source: _s, clone_count: _cc, play_count: _pc, popularity: _pop, ...mirrorData } = item;
          await upsertMirror(appId, resolvedCollection, item.id, { ...mirrorData, _source: 'reddit' });
          console.log(`[reddit-scanner] Stored ${item.id} collection=${resolvedCollection} status=${item._redditStatus} method=${item._parseMethod}`);
        }
      } catch (err) {
        console.warn(`[reddit-scanner] Failed to parse post ${post.id}:`, err.message);
      }

      await sleep(BETWEEN_POST_DELAY_MS);
    }

    console.log('[reddit-scanner] Cycle complete');
  } catch (err) {
    console.error('[reddit-scanner] Cycle error:', err);
  } finally {
    scanning = false;
  }
}

/**
 * Start the background scanner. Runs an initial cycle immediately, then every
 * SCAN_INTERVAL_MS milliseconds.
 *
 * @param {string} appId - The APP_ID env var value for mirror row namespacing.
 */
/**
 * Trigger an immediate scan cycle. Safe to call while a cycle is already running
 * (the guard inside runScanCycle will no-op in that case).
 */
export function triggerScanNow(appId) {
  runScanCycle(appId);
}

export function startRedditScanner(appId) {
  if (!appId) {
    console.warn('[reddit-scanner] No APP_ID set — scanner disabled');
    return;
  }

  console.log(`[reddit-scanner] Starting (interval=${SCAN_INTERVAL_MS / 60000}min)`);

  // Run immediately on startup (slight delay so DB migrations complete first)
  setTimeout(() => runScanCycle(appId), 5000);

  // Then repeat on schedule
  scanTimer = setInterval(() => runScanCycle(appId), SCAN_INTERVAL_MS);
}

/**
 * Stop the background scanner gracefully.
 */
export function stopRedditScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
    console.log('[reddit-scanner] Stopped');
  }
}
