/**
 * Reddit integration for r/daggerbrew and r/daggerheart.
 *
 * Searches for adversary/environment homebrew posts using flair filtering:
 *   r/daggerbrew  — flair "Adversaries" or "Environments" depending on collection
 *   r/daggerheart — flair "Homebrew" (always; further scoping happens via LLM parse)
 *
 * Uses the public .json endpoints (no OAuth required). Rate limit: ~10 req/min
 * unauthenticated — adequate for a single-user GM tool with the result cache.
 * OAuth can be layered on later if rate limits become an issue.
 *
 * Returns stub items in the native app schema for display in the Library grid.
 * Full structured data is fetched/parsed on demand via getRedditPost() + LLM.
 */

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'DaggerheartGM/1.0';

// Per subreddit: flair mapping and sort priority (lower = higher priority).
// daggerbrew first — its flairs classify adversaries vs environments directly.
export const SUBREDDIT_CONFIG = {
  daggerbrew:  { flairs: { adversaries: 'Adversaries', environments: 'Environments' }, priority: 0 },
  daggerheart: { flairs: { adversaries: 'Homebrew',    environments: 'Homebrew' },     priority: 1 },
};

const SUBREDDITS = Object.keys(SUBREDDIT_CONFIG);

// ---------------------------------------------------------------------------
// Per-query result cache — avoids re-fetching Reddit on each offset increment.
// Key: `${collection}:${normalizedSearch}`
// ---------------------------------------------------------------------------

const queryCache = new Map();
const QUERY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCacheKey(collection, search) {
  return `${collection}:${(search || '').trim().toLowerCase()}`;
}

function getCache(key) {
  const now = Date.now();
  const entry = queryCache.get(key);
  if (entry && now - entry.fetchedAt < QUERY_CACHE_TTL) return entry;
  const fresh = {
    posts: [],
    bySubreddit: Object.fromEntries(
      SUBREDDITS.map(sub => [sub, { after: null, done: false }])
    ),
    fetchedAt: now,
  };
  queryCache.set(key, fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Fetch one page from a subreddit with flair filtering
// ---------------------------------------------------------------------------

export async function fetchPage(subreddit, flair, search, after) {
  const flairFilter = `flair_name:"${flair}"`;
  const q = search ? `${search} ${flairFilter}` : flairFilter;

  const url = new URL(`${REDDIT_BASE}/r/${subreddit}/search.json`);
  url.searchParams.set('q', q);
  url.searchParams.set('restrict_sr', 'on');
  url.searchParams.set('sort', 'new');
  url.searchParams.set('limit', '25');
  url.searchParams.set('type', 'link');
  url.searchParams.set('raw_json', '1');
  if (after) url.searchParams.set('after', after);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Reddit search ${subreddit}: HTTP ${res.status}`);

  const json = await res.json();
  const listing = json?.data;
  if (!listing) throw new Error(`Reddit search ${subreddit}: unexpected response shape`);

  const posts = (listing.children || []).map(c => normalizePost(c.data, subreddit));
  return { posts, after: listing.after || null };
}

// ---------------------------------------------------------------------------
// Normalize a Reddit API post object into a native app stub item
// ---------------------------------------------------------------------------

function extractImages(post) {
  const images = [];

  // Gallery posts
  if (post.is_gallery && post.media_metadata) {
    for (const item of Object.values(post.media_metadata)) {
      if (item.status === 'valid' && item.e === 'Image') {
        const src = item.s?.u || item.s?.gif;
        if (src) images.push(src.replace(/&amp;/g, '&'));
      }
    }
  }

  // Preview images (single image post or link preview)
  if (post.preview?.images?.length) {
    for (const img of post.preview.images) {
      const url = img.source?.url?.replace(/&amp;/g, '&');
      if (url && !images.includes(url)) images.push(url);
    }
  }

  // Direct image URL
  if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
    if (!images.includes(post.url)) images.push(post.url);
  }

  // Deduplicate by base filename — preview.redd.it and i.redd.it often point to the
  // same image with different URLs. Keep the last occurrence (direct URL preferred).
  const seen = new Map();
  for (const url of images) {
    const basename = url.split('/').pop().split('?')[0];
    seen.set(basename, url);
  }
  return [...seen.values()];
}

export function normalizePost(post, subreddit) {
  const images = extractImages(post);
  const thumbnail =
    post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : images[0] || null;

  return {
    id: `reddit-${post.id}`,
    name: post.title || '',
    // Game data fields — unknown until LLM parse; kept as empty/null so ItemCard renders gracefully
    tier: null,
    role: '',
    type: '',
    description: post.selftext ? post.selftext.slice(0, 300) : '',
    motive: '',
    difficulty: 10,
    hp_max: 0,
    stress_max: 0,
    hp_thresholds: { major: null, severe: null },
    attack: { name: '', range: '', modifier: 0, trait: 'Phy', damage: '' },
    features: [],
    experiences: [],
    imageUrl: thumbnail || '',
    // Reddit-specific metadata carried through for LLM parse + display
    _source: 'reddit',
    _redditPostId: post.id,
    _redditPermalink: post.permalink,
    _redditFlair: post.link_flair_text || null,
    _redditSubreddit: subreddit,
    _redditImages: images,
    _redditSelftext: post.selftext || '',
    _redditScore: post.score || 0,
    _redditAuthor: post.author || '',
    _redditCreatedUtc: post.created_utc || 0,
  };
}

// ---------------------------------------------------------------------------
// Public: search across both subreddits with per-subreddit flair filtering
// ---------------------------------------------------------------------------

/**
 * Search r/daggerbrew and r/daggerheart for homebrew adversaries or environments.
 *
 * Uses a per-query cache so incremental offset calls don't re-fetch Reddit pages.
 * totalCount is estimated (Reddit doesn't expose totals); the value is conservative
 * so the infinite-scroll "has more" logic works correctly.
 *
 * @param {object} opts
 * @param {string} opts.collection - 'adversaries' | 'environments'
 * @param {string} [opts.search]   - Free-text search string
 * @param {number} [opts.limit]    - Max items to return (default 20)
 * @param {number} [opts.offset]   - Zero-based offset within this source's result space
 * @returns {{ items: object[], totalCount: number }}
 */
export async function searchReddit({ collection, search, limit = 20, offset = 0 } = {}) {
  const cacheKey = getCacheKey(collection, search);
  const cache = getCache(cacheKey);

  // Fetch pages from both subreddits until we have enough to satisfy offset + limit,
  // or until all sources are exhausted.
  while (cache.posts.length < offset + limit) {
    const pendingSubs = SUBREDDITS.filter(sub => !cache.bySubreddit[sub].done);
    if (pendingSubs.length === 0) break;

    const results = await Promise.allSettled(
      pendingSubs.map(async sub => {
        const flair = SUBREDDIT_CONFIG[sub].flairs[collection] || 'Homebrew';
        const subState = cache.bySubreddit[sub];
        const { posts, after } = await fetchPage(sub, flair, search, subState.after);
        subState.after = after;
        subState.done = !after;
        return posts;
      })
    );

    let anyNew = false;
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        cache.posts.push(...result.value);
        anyNew = true;
      }
    }
    if (!anyNew) break;
  }

  // Sort: daggerbrew before daggerheart (better flair classification), then by score.
  cache.posts.sort((a, b) => {
    const pa = SUBREDDIT_CONFIG[a._redditSubreddit]?.priority ?? 9;
    const pb = SUBREDDIT_CONFIG[b._redditSubreddit]?.priority ?? 9;
    if (pa !== pb) return pa - pb;
    return (b._redditScore || 0) - (a._redditScore || 0);
  });

  const items = cache.posts.slice(offset, offset + limit);
  const allDone = SUBREDDITS.every(sub => cache.bySubreddit[sub].done);
  const totalCount = allDone
    ? cache.posts.length
    : Math.max(cache.posts.length + limit, offset + items.length + limit);

  return { items, totalCount };
}

// ---------------------------------------------------------------------------
// Public: fetch full post detail for LLM parse
// ---------------------------------------------------------------------------

/**
 * Fetch the full post body and images for a Reddit post by its base36 ID.
 * Returns enough data for parseRedditPost() in llm-parse.js.
 *
 * @param {string} postId - Reddit base36 post ID (without the 'reddit-' prefix)
 * @returns {object} Full post metadata including selftext and image URLs
 */
export async function getRedditPost(postId) {
  const res = await fetch(`${REDDIT_BASE}/comments/${postId}.json?raw_json=1`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Reddit post fetch failed: HTTP ${res.status}`);

  const json = await res.json();
  // Response is [postListing, commentsListing]; we only need the first
  const postData = json?.[0]?.data?.children?.[0]?.data;
  if (!postData) throw new Error(`Reddit post not found: ${postId}`);

  const subreddit = (postData.subreddit || '').toLowerCase();
  const images = extractImages(postData);

  return {
    id: `reddit-${postData.id}`,
    _redditPostId: postData.id,
    _redditTitle: postData.title || '',
    _redditSelftext: postData.selftext || '',
    _redditImages: images,
    _redditFlair: postData.link_flair_text || null,
    _redditSubreddit: subreddit,
    _redditPermalink: postData.permalink,
    _redditAuthor: postData.author || '',
    _redditScore: postData.score || 0,
    _redditCreatedUtc: postData.created_utc || 0,
  };
}
