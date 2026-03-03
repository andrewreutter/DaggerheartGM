/**
 * OCR-based image parsing for Daggerheart stat block images.
 *
 * Uses Tesseract.js (WASM, no system binaries) to extract text from images,
 * then classifies each image as a stat block or artwork based on keyword density.
 *
 * For images containing multiple stat blocks (e.g., a book page with three
 * adversaries and shared artwork), the pipeline:
 *   1. Clusters Tesseract blocks into discrete text regions by spatial proximity.
 *   2. Identifies large non-text areas between/around clusters as artwork candidates.
 *   3. Returns one text region per detected stat block, plus artwork crops.
 *
 * For single-stat-block images the behavior is identical to before: one text
 * region, artwork cropped from any large margin areas.
 *
 * Language data (~15MB) downloaded on first use and cached.
 */

import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

// Keywords that indicate a text region contains a stat block rather than artwork
const STAT_KEYWORDS = /\b(HP|Hit Points?|Stress|Difficulty|Tier|Attack|ATK|Features?|Experiences?|Thresholds?|Melee|Close|Far|Passive|Action|Reaction|Damage|d\d+)\b/i;
const MIN_KEYWORD_HITS = 3;

// Minimum confidence for a Tesseract line to be included in clustering.
// Raised to 85 to exclude OCR noise from artwork regions (which scores 54-74)
// while keeping real printed stat block text (which scores 95+).
const MIN_LINE_CONFIDENCE = 85;

// Clustering: maximum vertical gap between consecutive lines (as fraction of
// image height) for two lines to be considered part of the same text cluster.
// 0.20 is deliberately generous — we rely on horizontal non-overlap to separate
// side-by-side columns, and on splitStatBlocks() to split stacked stat blocks.
const CLUSTER_VERT_GAP_FRAC = 0.20;

// Clustering: minimum fraction of the narrower block's width that must overlap
// horizontally for two blocks to be in the same cluster (same column).
const CLUSTER_HORIZ_OVERLAP_FRAC = 0.30;

// Artwork extraction: minimum fraction of total image area a region must
// occupy to qualify as artwork (rejects thin decorative borders).
const MIN_AREA_FRACTION = 0.08;

// Artwork extraction: minimum size (pixels) of the shorter dimension.
const MIN_SHORT_SIDE_PX = 80;

// Artwork extraction: maximum aspect ratio (long side / short side).
const MAX_ASPECT_RATIO = 5;

// Inward inset applied to each artwork crop to avoid clipping partial text.
const CROP_INSET_FRACTION = 0.02;

// Artwork coverage threshold: if another cluster covers >30% of a candidate
// artwork area, that area is considered "covered" and skipped.
const COVERAGE_THRESHOLD = 0.30;

let _worker = null;

async function getWorker() {
  if (!_worker) {
    _worker = await createWorker('eng');
  }
  return _worker;
}

/**
 * Classify a text string: does it look like a stat block?
 */
function isStatBlock(text) {
  const matches = text.match(new RegExp(STAT_KEYWORDS.source, 'gi'));
  return (matches || []).length >= MIN_KEYWORD_HITS;
}

/**
 * Fetch an image URL and return its Buffer.
 * Returns null if the fetch fails or returns non-image content.
 */
async function fetchImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DaggerheartGM/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

/**
 * Compute the fraction of the narrower block's width that two bboxes overlap horizontally.
 */
function horizOverlapFrac(ba, bb) {
  const ol = Math.max(ba.x0, bb.x0);
  const or_ = Math.min(ba.x1, bb.x1);
  if (or_ <= ol) return 0;
  const narrower = Math.min(ba.x1 - ba.x0, bb.x1 - bb.x0);
  return narrower > 0 ? (or_ - ol) / narrower : 0;
}

/**
 * Expand a bbox to also contain another bbox.
 */
function expandBbox(a, b) {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/**
 * Cluster Tesseract blocks into spatially coherent text regions.
 *
 * Two lines are placed in the same cluster when they have sufficient
 * horizontal overlap (same column) and the vertical gap is below the
 * threshold.  This naturally separates side-by-side columns while keeping
 * all content within a single stat block together.
 *
 * @param {import('tesseract.js').Block[]} blocks - Tesseract block data
 * @param {number} W - Image width in pixels
 * @param {number} H - Image height in pixels
 * @returns {{ bbox: {x0,y0,x1,y1}, text: string }[]}
 */
function clusterBlocks(blocks, W, H) {
  // Flatten all high-confidence lines
  const lines = [];
  for (const block of blocks) {
    for (const para of (block.paragraphs || [])) {
      for (const line of (para.lines || [])) {
        if (line.confidence > MIN_LINE_CONFIDENCE && (line.text || '').trim().length > 2) {
          lines.push({ bbox: { ...line.bbox }, text: line.text });
        }
      }
    }
  }

  if (lines.length === 0) return [];

  // Sort top-to-bottom, left-to-right so greedy merge is order-consistent
  lines.sort((a, b) => a.bbox.y0 !== b.bbox.y0 ? a.bbox.y0 - b.bbox.y0 : a.bbox.x0 - b.bbox.x0);

  const vertGapMax = H * CLUSTER_VERT_GAP_FRAC;

  // Greedy clustering: assign each line to the best existing cluster or start a new one.
  //
  // Each cluster tracks TWO x-ranges:
  //   colX0/colX1  — stable "column" range used for horizontal overlap checks.
  //                  Only expanded when a line's width is reasonable (≤1.5× the
  //                  current column width). Wide outlier lines (headers/badges
  //                  spanning the full card) are absorbed into the cluster but
  //                  don't corrupt the column range.
  //   bbox         — full enclosing box of all lines (including outliers).
  //                  Used for artwork gap detection only.
  const clusters = []; // { bbox, colX0, colX1, lineTexts }

  for (const line of lines) {
    let bestCluster = null;
    let bestScore = -Infinity;

    for (const cluster of clusters) {
      const vertGap = line.bbox.y0 - cluster.bbox.y1;
      if (vertGap > vertGapMax) continue;

      // Use the stable column x-range for overlap checks, NOT the full bbox.
      // This prevents a single wide line from making the cluster "swallow"
      // lines from adjacent columns.
      const colBbox = { x0: cluster.colX0, y0: cluster.bbox.y0, x1: cluster.colX1, y1: cluster.bbox.y1 };
      const horiz = horizOverlapFrac(colBbox, line.bbox);
      if (horiz < CLUSTER_HORIZ_OVERLAP_FRAC) continue;

      const score = horiz - (Math.max(0, vertGap) / (H || 1));
      if (score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.lineTexts.push(line.text);
      bestCluster.bbox = expandBbox(bestCluster.bbox, line.bbox);

      // Only expand the stable column range if this line isn't an outlier.
      // An outlier is a line significantly wider than the current column
      // (e.g., a "STANDARD" badge spanning the full card header).
      const lineW = line.bbox.x1 - line.bbox.x0;
      const colW = bestCluster.colX1 - bestCluster.colX0;
      if (lineW <= colW * 1.5) {
        bestCluster.colX0 = Math.min(bestCluster.colX0, line.bbox.x0);
        bestCluster.colX1 = Math.max(bestCluster.colX1, line.bbox.x1);
      }
    } else {
      clusters.push({
        bbox: { ...line.bbox },
        colX0: line.bbox.x0,
        colX1: line.bbox.x1,
        lineTexts: [line.text],
      });
    }
  }

  return clusters
    .filter(c => c.lineTexts.length > 0)
    .map(c => ({
      bbox: c.bbox,
      text: c.lineTexts.join('\n').trim(),
    }));
}

/**
 * Check whether a candidate artwork rectangle is substantially covered by
 * text clusters (other than the self cluster, if any).
 *
 * @param {{ left, top, width, height }} rect - Candidate artwork area
 * @param {{ bbox }|null} selfCluster - Cluster that "owns" this gap (excluded)
 * @param {{ bbox }[]} allClusters
 * @returns {boolean}
 */
function isCoveredByCluster(rect, selfCluster, allClusters) {
  const { left, top, width, height } = rect;
  const rectRight = left + width;
  const rectBottom = top + height;
  const rectArea = width * height;
  if (rectArea <= 0) return false;

  for (const c of allClusters) {
    if (c === selfCluster) continue;
    const ol = Math.max(c.bbox.x0, left);
    const ot = Math.max(c.bbox.y0, top);
    const or_ = Math.min(c.bbox.x1, rectRight);
    const ob = Math.min(c.bbox.y1, rectBottom);
    if (or_ <= ol || ob <= ot) continue;
    const overlapArea = (or_ - ol) * (ob - ot);
    if (overlapArea / rectArea > COVERAGE_THRESHOLD) return true;
  }
  return false;
}

/**
 * Crop artwork from image areas not covered by text clusters.
 *
 * For a single-cluster image: checks the four traditional margins (top, left,
 * bottom, right) around that cluster.
 *
 * For multi-cluster images: additionally checks the rectangular area ABOVE and
 * BELOW each cluster in its own horizontal band, excluding areas already covered
 * by another cluster.  This correctly detects artwork like a photo that occupies
 * the top-right quadrant while stat blocks fill the rest of the page.
 *
 * @param {Buffer} buf - Raw image buffer
 * @param {{ bbox }[]} clusters - Text clusters from clusterBlocks()
 * @param {number} W - Image width
 * @param {number} H - Image height
 * @returns {Promise<string[]>} Base64 data URLs of cropped artwork regions
 */
async function extractArtworkFromGaps(buf, clusters, W, H) {
  try {
    if (!W || !H || clusters.length === 0) return [];

    const candidates = []; // { left, top, width, height, selfCluster }

    // Global bounding box of all clusters
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (const c of clusters) {
      gx0 = Math.min(gx0, c.bbox.x0);
      gy0 = Math.min(gy0, c.bbox.y0);
      gx1 = Math.max(gx1, c.bbox.x1);
      gy1 = Math.max(gy1, c.bbox.y1);
    }

    // Four global margin regions (same as original approach)
    candidates.push(
      { left: 0, top: 0, width: W, height: gy0, selfCluster: null },
      { left: 0, top: 0, width: gx0, height: H, selfCluster: null },
      { left: 0, top: gy1, width: W, height: H - gy1, selfCluster: null },
      { left: gx1, top: 0, width: W - gx1, height: H, selfCluster: null },
    );

    // Per-cluster gap regions (only meaningful for multi-cluster images)
    if (clusters.length > 1) {
      for (const cluster of clusters) {
        const { x0, y0, x1, y1 } = cluster.bbox;

        // Area above this cluster (in its x column)
        if (y0 > 0) {
          candidates.push({ left: x0, top: 0, width: x1 - x0, height: y0, selfCluster: cluster });
        }

        // Area below this cluster (in its x column)
        if (y1 < H) {
          candidates.push({ left: x0, top: y1, width: x1 - x0, height: H - y1, selfCluster: cluster });
        }
      }
    }

    const dataUrls = [];
    const totalArea = W * H;
    const seen = new Set();

    for (const { left, top, width, height, selfCluster } of candidates) {
      if (width <= 0 || height <= 0) continue;

      // Deduplicate similar regions (round to nearest 10px)
      const key = `${Math.round(left / 10)},${Math.round(top / 10)},${Math.round(width / 10)},${Math.round(height / 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (isCoveredByCluster({ left, top, width, height }, selfCluster, clusters)) continue;

      const area = width * height;
      const shortSide = Math.min(width, height);
      const longSide = Math.max(width, height);

      if (area / totalArea < MIN_AREA_FRACTION) continue;
      if (shortSide < MIN_SHORT_SIDE_PX) continue;
      if (longSide / shortSide > MAX_ASPECT_RATIO) continue;

      // Uniform inward inset to avoid clipping partial glyphs at boundaries
      const insetX = Math.floor(width * CROP_INSET_FRACTION);
      const insetY = Math.floor(height * CROP_INSET_FRACTION);
      const cropLeft = Math.max(0, Math.min(left + insetX, W - 1));
      const cropTop = Math.max(0, Math.min(top + insetY, H - 1));
      const cropWidth = Math.max(1, Math.min(width - 2 * insetX, W - cropLeft));
      const cropHeight = Math.max(1, Math.min(height - 2 * insetY, H - cropTop));

      try {
        const cropped = await sharp(buf)
          .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
          .jpeg({ quality: 80 })
          .toBuffer();
        dataUrls.push(`data:image/jpeg;base64,${cropped.toString('base64')}`);
      } catch (cropErr) {
        console.warn('[ocr] Failed to crop artwork region:', cropErr.message);
      }
    }

    return dataUrls;
  } catch (err) {
    console.warn('[ocr] extractArtworkFromGaps error:', err.message);
    return [];
  }
}

/**
 * Run OCR on a single image buffer.
 *
 * Clusters Tesseract blocks into text regions, extracts artwork from the
 * leftover non-text areas, and returns one text region per detected stat block.
 *
 * Return shape:
 * ```
 * {
 *   text: string,              // full concatenated OCR text (backward compat)
 *   isStatBlock: boolean,      // true when any region looks like a stat block
 *   textRegions: [{ text: string, bbox: {x0,y0,x1,y1} }],  // one per detected stat block
 *   artworkRegions: string[],  // base64 data URLs cropped from non-text areas
 *   allClusters: [{ text: string, bbox: {x0,y0,x1,y1} }],  // ALL detected clusters (debug)
 *   imageWidth: number,        // source image width in pixels
 *   imageHeight: number,       // source image height in pixels
 * }
 * ```
 *
 * @param {Buffer} buf - Raw image buffer
 */
export async function ocrBuffer(buf) {
  const worker = await getWorker();

  let ocrText = '';
  let blocks = [];
  try {
    const { data } = await worker.recognize(buf, {}, { blocks: true });
    ocrText = (data.text || '').trim();
    blocks = data.blocks || [];
  } catch {
    return { text: '', isStatBlock: false, textRegions: [], artworkRegions: [], allClusters: [], imageWidth: 0, imageHeight: 0 };
  }

  if (!isStatBlock(ocrText)) {
    return { text: ocrText, isStatBlock: false, textRegions: [], artworkRegions: [], allClusters: [], imageWidth: 0, imageHeight: 0 };
  }

  let W = 0, H = 0;
  try {
    ({ width: W, height: H } = await sharp(buf).metadata());
  } catch {
    return { text: ocrText, isStatBlock: true, textRegions: [{ text: ocrText, bbox: null }], artworkRegions: [], allClusters: [], imageWidth: 0, imageHeight: 0 };
  }

  const allClusters = clusterBlocks(blocks, W, H);

  // Separate stat-block clusters from decorative/footer text clusters
  const statClusters = allClusters.filter(c => isStatBlock(c.text));

  // Use ALL clusters for artwork gap detection so we don't accidentally crop text regions
  const artworkRegions = allClusters.length > 0
    ? await extractArtworkFromGaps(buf, allClusters, W, H)
    : [];

  let textRegions = statClusters.map(c => ({ text: c.text, bbox: c.bbox }));

  // Fallback: if clustering produced no stat-block regions, treat whole image as one region
  if (textRegions.length === 0) {
    textRegions = [{ text: ocrText, bbox: { x0: 0, y0: 0, x1: W, y1: H } }];
  }

  return { text: ocrText, isStatBlock: true, textRegions, artworkRegions, allClusters, imageWidth: W, imageHeight: H };
}

/**
 * Run OCR on a set of image URLs.
 *
 * Classifies each image as a stat block (text extracted) or artwork (URL preserved).
 * For stat block images, returns one text region per detected stat block plus
 * any artwork crops from non-text areas.
 *
 * Processes up to maxImages images sequentially (Tesseract.js WASM is single-threaded).
 * Only non-stat-block image URLs are eligible for `artworkUrl`.
 *
 * @param {string[]} imageUrls - Array of image URLs
 * @param {number}   [maxImages=4] - Max images to OCR
 * @returns {{
 *   texts: string[],
 *   textRegions: { text: string, bbox: object|null }[],
 *   artworkUrl: string|null,
 *   additionalImages: string[],
 *   hasStatBlockImages: boolean
 * }}
 */
export async function ocrImages(imageUrls, maxImages = 4) {
  const texts = [];
  const textRegions = [];         // NEW: one entry per detected stat block region across all images
  const artworkUrls = [];         // pure artwork images (not stat blocks)
  const croppedArtworkUrls = [];  // artwork regions cropped from composite stat block images
  const statBlockUrls = [];       // original URLs of stat block images (kept as additional)

  for (const url of imageUrls.slice(0, maxImages)) {
    const buf = await fetchImage(url);
    if (!buf) {
      artworkUrls.push(url);
      continue;
    }

    const result = await ocrBuffer(buf);
    if (!result.text) {
      artworkUrls.push(url);
      continue;
    }

    if (result.isStatBlock) {
      texts.push(result.text);
      statBlockUrls.push(url);
      croppedArtworkUrls.push(...result.artworkRegions);
      textRegions.push(...result.textRegions);
    } else {
      artworkUrls.push(url);
    }
  }

  // Images beyond maxImages weren't OCR'd — treat as artwork
  for (const url of imageUrls.slice(maxImages)) {
    artworkUrls.push(url);
  }

  // Primary artwork: prefer pure artwork images, fall back to cropped regions
  const allArtwork = [...artworkUrls, ...croppedArtworkUrls];
  const artworkUrl = allArtwork[0] || null;

  // Additional images: remaining artwork (pure + cropped beyond the first) + original stat block URLs
  const additionalImages = [...allArtwork.slice(1), ...statBlockUrls];

  return { texts, textRegions, artworkUrl, additionalImages, hasStatBlockImages: statBlockUrls.length > 0 };
}

/**
 * Gracefully shut down the Tesseract worker.
 * Called on server shutdown to clean up resources.
 */
export async function terminateOcr() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}
