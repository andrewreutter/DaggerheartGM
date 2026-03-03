/**
 * OCR-based image parsing for Daggerheart stat block images.
 *
 * Uses Tesseract.js (WASM, no system binaries) to extract text from images,
 * then classifies each image as a stat block or artwork based on keyword density.
 *
 * For composite images that contain both artwork and a stat block (e.g. artwork
 * banner above the stat block), the artwork region(s) are automatically cropped
 * using Tesseract bounding boxes and sharp. All four margins around the text are
 * evaluated; any qualifying region becomes a standalone artwork crop. Results are
 * returned in priority order: top, left, bottom, right.
 *
 * Language data (~15MB) downloaded on first use and cached.
 */

import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

// Keywords that indicate an image contains a stat block rather than artwork
const STAT_KEYWORDS = /\b(HP|Hit Points?|Stress|Difficulty|Tier|Attack|ATK|Features?|Experiences?|Thresholds?|Melee|Close|Far|Passive|Action|Reaction|Damage|d\d+)\b/i;
const MIN_KEYWORD_HITS = 3;

// Minimum fraction of total image area a margin must occupy to qualify as artwork.
// 0.10 (10%) is chosen to reject thin decorative borders (typically 3-6% of area)
// while admitting genuine artwork banners (e.g. the Sporenado top banner is ~33%).
const MIN_AREA_FRACTION = 0.10;
// Minimum size (in pixels) of the shorter dimension of a cropped region.
// 100px rejects narrow padding/borders (30-80px) while admitting real banners (~400px+).
const MIN_SHORT_SIDE_PX = 100;
// Maximum aspect ratio (longer side / shorter side) for a region to qualify as artwork.
// 5:1 rejects tall/thin side margins (e.g. a 150x900px right margin = 6:1) that are
// likely decorative borders, while admitting wide panoramic banners (≤4:1 typical).
const MAX_ASPECT_RATIO = 5;
// Inward margin applied to each crop to avoid clipping partial text at the boundary (fraction)
const CROP_INSET_FRACTION = 0.02;
// Minimum confidence for a Tesseract line to be included in the text bounding box.
// Raised to 85 to exclude OCR noise from artwork regions (which scores 54-74) while
// keeping real printed stat block text (which scores 95+).
const MIN_LINE_CONFIDENCE = 85;

let _worker = null;

async function getWorker() {
  if (!_worker) {
    _worker = await createWorker('eng');
  }
  return _worker;
}

/**
 * Classify OCR text: does it look like a stat block?
 * Returns true if enough game-mechanic keywords are present.
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
 * Given a stat-block image buffer and the Tesseract blocks output, find all
 * margins (top, left, bottom, right) around the text bounding box that are
 * large enough to plausibly contain artwork, crop each one, and return an
 * array of base64 data URLs in priority order (top, left, bottom, right).
 *
 * Returns an empty array if no qualifying margin is found.
 *
 * @param {Buffer} buf - Raw image buffer
 * @param {import('tesseract.js').Block[]} blocks - Tesseract block data
 * @returns {Promise<string[]>} Array of data:image/jpeg;base64,... URLs
 */
async function extractArtworkRegions(buf, blocks) {
  try {
    const { width: W, height: H } = await sharp(buf).metadata();
    if (!W || !H) return [];

    // Collect all high-confidence lines with meaningful text
    const lines = blocks.flatMap(b =>
      b.paragraphs.flatMap(p =>
        p.lines.filter(l => l.confidence > MIN_LINE_CONFIDENCE && l.text.trim().length > 2)
      )
    );

    if (lines.length === 0) return [];

    // Compute tight bounding box around all qualifying text
    let textMinX = Infinity, textMinY = Infinity, textMaxX = -Infinity, textMaxY = -Infinity;
    for (const line of lines) {
      const { x0, y0, x1, y1 } = line.bbox;
      if (x0 < textMinX) textMinX = x0;
      if (y0 < textMinY) textMinY = y0;
      if (x1 > textMaxX) textMaxX = x1;
      if (y1 > textMaxY) textMaxY = y1;
    }

    const totalArea = W * H;

    // Define the four candidate margins in priority order (top, left, bottom, right)
    const candidates = [
      { name: 'top',    region: { left: 0,        top: 0,        width: W,             height: textMinY      } },
      { name: 'left',   region: { left: 0,        top: 0,        width: textMinX,       height: H             } },
      { name: 'bottom', region: { left: 0,        top: textMaxY, width: W,             height: H - textMaxY  } },
      { name: 'right',  region: { left: textMaxX, top: 0,        width: W - textMaxX,  height: H             } },
    ];

    const dataUrls = [];

    for (const { name, region } of candidates) {
      const { left, top, width, height } = region;

      // Must be a positive region
      if (width <= 0 || height <= 0) continue;

      const area = width * height;
      const shortSide = Math.min(width, height);

      if (area / totalArea < MIN_AREA_FRACTION) continue;
      if (shortSide < MIN_SHORT_SIDE_PX) continue;
      const longSide = Math.max(width, height);
      if (longSide / shortSide > MAX_ASPECT_RATIO) continue;

      // Apply inward inset to avoid clipping partial glyphs at the boundary
      let cropLeft = left, cropTop = top, cropWidth = width, cropHeight = height;
      const insetX = Math.floor(width * CROP_INSET_FRACTION);
      const insetY = Math.floor(height * CROP_INSET_FRACTION);

      if (name === 'top') {
        cropHeight = Math.max(1, height - insetY);
      } else if (name === 'bottom') {
        cropTop = top + insetY;
        cropHeight = Math.max(1, height - insetY);
      } else if (name === 'left') {
        cropWidth = Math.max(1, width - insetX);
      } else if (name === 'right') {
        cropLeft = left + insetX;
        cropWidth = Math.max(1, width - insetX);
      }

      // Clamp to image bounds
      cropLeft = Math.max(0, Math.min(cropLeft, W - 1));
      cropTop = Math.max(0, Math.min(cropTop, H - 1));
      cropWidth = Math.max(1, Math.min(cropWidth, W - cropLeft));
      cropHeight = Math.max(1, Math.min(cropHeight, H - cropTop));

      try {
        const cropped = await sharp(buf)
          .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
          .jpeg({ quality: 80 })
          .toBuffer();
        dataUrls.push(`data:image/jpeg;base64,${cropped.toString('base64')}`);
      } catch (cropErr) {
        console.warn(`[ocr] Failed to crop ${name} region:`, cropErr.message);
      }
    }

    return dataUrls;
  } catch (err) {
    console.warn('[ocr] extractArtworkRegions error:', err.message);
    return [];
  }
}

/**
 * Run OCR on a single image buffer.
 *
 * Returns the extracted text and whether the image looks like a stat block.
 * For stat block images, also returns any artwork regions cropped from non-text margins.
 *
 * @param {Buffer} buf - Raw image buffer
 * @returns {Promise<{ text: string, isStatBlock: boolean, artworkRegions: string[] }>}
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
    return { text: '', isStatBlock: false, artworkRegions: [] };
  }

  if (!isStatBlock(ocrText)) {
    return { text: ocrText, isStatBlock: false, artworkRegions: [] };
  }

  const artworkRegions = blocks.length > 0 ? await extractArtworkRegions(buf, blocks) : [];
  return { text: ocrText, isStatBlock: true, artworkRegions };
}

/**
 * Run OCR on a set of image URLs.
 *
 * Classifies each image as a stat block (text extracted) or artwork (URL preserved).
 * For stat block images, attempts to extract artwork from any large non-text margins
 * (top, left, bottom, right) using Tesseract bounding boxes and sharp.
 *
 * Processes up to maxImages images sequentially (Tesseract.js WASM is single-threaded).
 * Only non-stat-block image URLs are eligible for `artworkUrl` (primary banner/thumbnail).
 * `hasStatBlockImages` is true when at least one image was classified as a stat block.
 *
 * @param {string[]} imageUrls - Array of image URLs
 * @param {number}   [maxImages=4] - Max images to OCR (all URLs are still preserved)
 * @returns {{ texts: string[], artworkUrl: string|null, additionalImages: string[], hasStatBlockImages: boolean }}
 */
export async function ocrImages(imageUrls, maxImages = 4) {
  const texts = [];
  const artworkUrls = [];      // pure artwork images (not stat blocks)
  const croppedArtworkUrls = []; // artwork regions cropped from composite stat block images
  const statBlockUrls = [];    // original URLs of stat block images (kept as additional)

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

  return { texts, artworkUrl, additionalImages, hasStatBlockImages: statBlockUrls.length > 0 };
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
