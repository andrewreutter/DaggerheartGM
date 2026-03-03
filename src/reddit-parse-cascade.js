/**
 * Shared Reddit parse cascade: text regex → OCR → LLM fallback.
 *
 * Used by:
 *   - POST /api/reddit/parse  (manual re-parse from admin queue or detail modal)
 *   - reddit-scanner.js       (background auto-parse on discovery)
 *
 * Returns an ARRAY of result objects — one per detected stat block.  Posts
 * containing a single stat block return a single-element array with the
 * unsuffixed ID `reddit-{postId}` for backward compatibility.  Posts with
 * multiple stat blocks return elements with IDs `reddit-{postId}-0`,
 * `reddit-{postId}-1`, etc.
 *
 * Each result: { collection, item, artworkUrl, parseMethod, additionalImages,
 *               hasStatBlockImages, redditMeta }
 */

import { getRedditPost } from './reddit-search.js';
import { parseStatBlock, mergeResults, detectCollection, detectCollections } from './text-parse.js';
import { ocrImages } from './ocr-parse.js';
import { parseRedditPost as llmParseRedditPost } from './llm-parse.js';

/**
 * Run the full parse cascade for a Reddit post.
 *
 * @param {object} opts
 * @param {string|null} opts.collection  - 'adversaries' | 'environments' | null (auto-detect)
 * @param {string} opts.redditPostId     - Reddit base36 post ID (without 'reddit-' prefix)
 * @param {string} [opts.selftext]       - Fallback selftext if post fetch fails
 * @param {string[]} [opts.images]       - Fallback image URLs if post fetch fails
 * @param {string} [opts.name]           - Fallback post title
 * @param {boolean} [opts.forceLlm]      - Skip text/OCR stages and go directly to LLM
 *
 * @returns {Promise<Array<{
 *   collection: string,
 *   item: object,
 *   artworkUrl: string|null,
 *   parseMethod: string,
 *   additionalImages: string[],
 *   hasStatBlockImages: boolean,
 *   redditMeta: object,
 * }>>}
 */
export async function runParseCascade({
  collection = null,
  redditPostId,
  selftext = '',
  images = [],
  name = '',
  forceLlm = false,
}) {
  let postText = selftext || '';
  let postImages = Array.isArray(images) ? images : [];
  let postTitle = name || '';
  let redditMeta = {};

  // Fetch fresh post data from Reddit when available.
  try {
    const postDetail = await getRedditPost(redditPostId);
    postText = postDetail._redditSelftext || postText;
    postImages = postDetail._redditImages?.length ? postDetail._redditImages : postImages;
    postTitle = postDetail._redditTitle || postTitle;
    const { _redditPermalink, _redditAuthor, _redditSubreddit, _redditFlair, _redditScore, _redditCreatedUtc } = postDetail;
    redditMeta = { _redditPermalink, _redditAuthor, _redditSubreddit, _redditFlair, _redditScore, _redditCreatedUtc };
  } catch (fetchErr) {
    console.warn(`[reddit-cascade] Could not fetch post ${redditPostId}:`, fetchErr.message);
  }

  // Cache any OCR we run for collection detection so Stage 2 can reuse it.
  let cachedOcr = null;

  // Auto-detect collection when not specified.
  if (!collection) {
    const textDetect = detectCollection(postText, postTitle);
    if (textDetect.confidence >= 0.4) {
      collection = textDetect.collection;
      console.log(`[reddit-cascade] ${redditPostId} collection text-detected → ${collection} (conf=${textDetect.confidence.toFixed(2)})`);
    } else if (postImages.length > 0 && !forceLlm) {
      try {
        cachedOcr = await ocrImages(postImages);
        const combined = [postText, ...cachedOcr.texts].join('\n\n');
        const ocrDetect = detectCollection(combined, postTitle);
        collection = ocrDetect.collection || 'adversaries';
        console.log(`[reddit-cascade] ${redditPostId} collection OCR-detected → ${collection} (conf=${ocrDetect.confidence.toFixed(2)})`);
      } catch (ocrErr) {
        console.warn(`[reddit-cascade] OCR collection detection failed for ${redditPostId}:`, ocrErr.message);
        collection = textDetect.collection || 'adversaries';
      }
    } else {
      collection = textDetect.collection || 'adversaries';
      console.log(`[reddit-cascade] ${redditPostId} collection fallback → ${collection}`);
    }
  }

  /**
   * Build a single result object for one parsed item.
   * `suffix` is '' for single-item posts, '-0', '-1', etc. for multi-item posts.
   */
  function buildResult(item, artworkUrl, parseMethod, additionalImages = [], hasStatBlockImages = false, suffix = '') {
    const id = suffix ? `reddit-${redditPostId}${suffix}` : `reddit-${redditPostId}`;
    return {
      collection,
      item: {
        ...item,
        ...redditMeta,
        id,
        imageUrl: artworkUrl || (hasStatBlockImages ? '' : item.imageUrl) || '',
        _source: 'reddit',
        _redditPostId: redditPostId,
        _redditSelftext: postText,
        _redditImages: postImages,
        _redditStatus: isSuccessfulParse(parseMethod) ? 'needs_review' : 'failed',
        _parseMethod: parseMethod,
        ...(additionalImages.length > 0 ? { _additionalImages: additionalImages } : {}),
      },
      artworkUrl: artworkUrl || null,
      parseMethod,
      additionalImages,
      hasStatBlockImages,
      redditMeta,
    };
  }

  /**
   * Wrap an array of parse results into the full result shape.
   * When multiple items come from multi-stat-block detection, they each get
   * a numeric suffix on the ID; a single item keeps the plain ID.
   */
  function buildResults(segments, artworkUrl, parseMethod, additionalImages = [], hasStatBlockImages = false) {
    if (segments.length === 1) {
      return [buildResult(segments[0].item, artworkUrl, parseMethod, additionalImages, hasStatBlockImages)];
    }
    return segments.map((seg, i) =>
      buildResult(seg.item, artworkUrl, parseMethod, additionalImages, hasStatBlockImages, `-${i}`)
    );
  }

  // --- Stage 1: Regex parse selftext ---
  if (!forceLlm) {
    // Use detectCollections to handle posts that contain multiple stat blocks in text
    const textSegments = detectCollections(postText, postTitle);
    const primaryText = textSegments[0]; // use first segment to check confidence threshold
    console.log(`[reddit-cascade] ${redditPostId} text parse confidence=${primaryText.confidence.toFixed(2)} segments=${textSegments.length}`);

    if (textSegments.length > 1 || primaryText.confidence >= 0.7) {
      // Multi-segment or high-confidence single result → accept text parse
      return buildResults(textSegments, null, 'text');
    }

    // --- Stage 2: OCR images + merge (reuse cached OCR if already run for detection) ---
    if (postImages.length > 0) {
      try {
        const { textRegions, artworkUrl, additionalImages, hasStatBlockImages } =
          cachedOcr || await ocrImages(postImages);

        // textRegions is now the primary source — one per detected stat block in images
        if (textRegions && textRegions.length > 0) {
          // Each text region is independently parsed and optionally further split
          const ocrSegments = textRegions.flatMap(region => detectCollections(region.text));

          if (ocrSegments.length > 1) {
            // Multiple stat blocks detected in images → return them directly
            console.log(`[reddit-cascade] ${redditPostId} OCR found ${ocrSegments.length} stat blocks`);
            return buildResults(ocrSegments, artworkUrl, 'ocr', additionalImages, hasStatBlockImages);
          }

          // Single OCR result: already parsed via detectCollections — use directly
          const ocrResult = ocrSegments[0];
          console.log(`[reddit-cascade] ${redditPostId} OCR parse confidence=${ocrResult.confidence.toFixed(2)}`);

          const merged = mergeResults(primaryText, ocrResult);
          if (merged.confidence >= 0.5) {
            return buildResults([merged], artworkUrl, 'ocr', additionalImages, hasStatBlockImages);
          }
        } else if (cachedOcr?.texts?.length > 0) {
          // Fallback: use legacy combined texts (older ocrImages path)
          const ocrResult = parseStatBlock(cachedOcr.texts.join('\n\n'), collection, postTitle);
          console.log(`[reddit-cascade] ${redditPostId} OCR (legacy) parse confidence=${ocrResult.confidence.toFixed(2)}`);
          const merged = mergeResults(primaryText, ocrResult);
          if (merged.confidence >= 0.5) {
            return buildResults([merged], artworkUrl, 'ocr', additionalImages, hasStatBlockImages);
          }
        }

        if (primaryText.confidence >= 0.5) {
          return buildResults([primaryText], null, 'text');
        }
      } catch (ocrErr) {
        console.warn(`[reddit-cascade] OCR failed for ${redditPostId}:`, ocrErr.message);
      }
    }

    // Accept a lower-confidence text parse if it at least got features.
    if (primaryText.item.features?.length > 0) {
      return buildResults([primaryText], null, 'partial');
    }
  }

  // --- Stage 3: LLM fallback ---
  // LLM produces a single item (GPT-4o handles multi-block images internally)
  if (!process.env.OPENAI_API_KEY) {
    const fallback = parseStatBlock(postText, collection, postTitle);
    return buildResults([{ item: fallback.item, confidence: fallback.confidence }], null, 'partial');
  }

  try {
    const { item: parsed, artworkUrl } = await llmParseRedditPost({
      title: postTitle,
      text: postText,
      imageUrls: postImages,
      collection,
    });
    const llmAdditional = postImages.filter(u => u !== artworkUrl);
    return buildResults([{ item: parsed }], artworkUrl, 'llm', llmAdditional);
  } catch (llmErr) {
    console.warn(`[reddit-cascade] LLM failed for ${redditPostId}:`, llmErr.message);
    const fallback = parseStatBlock(postText, collection, postTitle);
    return buildResults([{ item: fallback.item }], null, 'partial');
  }
}

/** True when parseMethod indicates a successful parse (not partial). */
export function isSuccessfulParse(parseMethod) {
  return parseMethod === 'text' || parseMethod === 'ocr' || parseMethod === 'llm';
}
