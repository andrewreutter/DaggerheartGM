/**
 * OCR-based image parsing for Daggerheart stat block images.
 *
 * Uses Tesseract.js (WASM, no system binaries) to extract text from images,
 * then classifies each image as a stat block or artwork based on keyword density.
 *
 * Language data (~15MB) is downloaded on first use and cached locally.
 */

import { createWorker } from 'tesseract.js';

// Keywords that indicate an image contains a stat block rather than artwork
const STAT_KEYWORDS = /\b(HP|Hit Points?|Stress|Difficulty|Tier|Attack|ATK|Features?|Experiences?|Thresholds?|Melee|Close|Far|Passive|Action|Reaction|Damage|d\d+)\b/i;
const MIN_KEYWORD_HITS = 3;

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
 * Run OCR on a set of image URLs.
 *
 * Classifies each image as a stat block (text extracted) or artwork (URL preserved).
 * Processes up to maxImages images sequentially (Tesseract.js WASM is single-threaded).
 * Only non-stat-block image URLs are eligible for `artworkUrl` (primary banner/thumbnail).
 * Stat block images are collected separately and appended to `additionalImages`.
 * `hasStatBlockImages` is true when at least one image was classified as a stat block,
 * allowing callers to avoid falling back to stub imageUrl values.
 *
 * @param {string[]} imageUrls - Array of image URLs
 * @param {number}   [maxImages=4] - Max images to OCR (all URLs are still preserved)
 * @returns {{ texts: string[], artworkUrl: string|null, additionalImages: string[], hasStatBlockImages: boolean }}
 */
export async function ocrImages(imageUrls, maxImages = 4) {
  const texts = [];
  const artworkUrls = [];
  const statBlockUrls = [];

  const worker = await getWorker();

  for (const url of imageUrls.slice(0, maxImages)) {
    const buf = await fetchImage(url);
    if (!buf) {
      artworkUrls.push(url);
      continue;
    }

    let ocrText = '';
    try {
      const { data } = await worker.recognize(buf);
      ocrText = (data.text || '').trim();
    } catch {
      artworkUrls.push(url);
      continue;
    }

    if (isStatBlock(ocrText)) {
      texts.push(ocrText);
      statBlockUrls.push(url);
    } else {
      artworkUrls.push(url);
    }
  }

  // Images beyond maxImages weren't OCR'd — treat as artwork
  for (const url of imageUrls.slice(maxImages)) {
    artworkUrls.push(url);
  }

  const artworkUrl = artworkUrls[0] || null;
  // Additional images: remaining artwork first, then stat block images
  const additionalImages = [...artworkUrls.slice(1), ...statBlockUrls];

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
