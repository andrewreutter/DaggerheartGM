/**
 * OCR-based image parsing for Daggerheart stat block images.
 *
 * Uses Tesseract.js (WASM, no system binaries) to extract text from images,
 * then classifies each image as a stat block or artwork based on keyword density.
 *
 * Language data (~15MB) is downloaded on first use and cached locally.
 */

import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

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
 * Extract a title from inverted-image OCR output.
 * In the inverted image, only the originally-dark-background regions are readable.
 * The title is typically the first few non-empty lines before the text degrades.
 * Returns the cleaned title string or null.
 */
function extractTitleFromInverted(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Take lines from the top that look like title text (short, mostly alphabetic)
  // Stop at the first line that looks like body content (Tier, Difficulty, etc.)
  const titleLines = [];
  for (const line of lines) {
    if (/^(Tier|Difficulty|Impulse|Potential|Features?|HP|Stress|Attack)\b/i.test(line)) break;
    if (line.length > 60) break;
    // Skip lines that are mostly garbage characters from the inverted body
    const alphaRatio = (line.match(/[a-zA-Z\s]/g) || []).length / line.length;
    if (alphaRatio < 0.6) break;
    titleLines.push(line);
    if (titleLines.length >= 3) break;
  }
  const title = titleLines.join(' ').trim();
  return title.length >= 3 ? title : null;
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
      // Stat card titles are often white-on-dark and invisible to normal OCR.
      // If the text starts with "Tier" (no name before it), invert the image
      // and run a second pass to recover the title.
      if (/^\s*Tier\s/i.test(ocrText)) {
        try {
          const meta = await sharp(buf).metadata();
          const cropHeight = Math.round(meta.height * 0.2);
          const croppedInvBuf = await sharp(buf)
            .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
            .negate({ alpha: false })
            .toBuffer();
          const { data: invData } = await worker.recognize(croppedInvBuf);
          const invText = (invData.text || '').trim();
          const titleLine = extractTitleFromInverted(invText);
          if (titleLine) {
            ocrText = titleLine + '\n' + ocrText;
          }
        } catch { /* crop/inversion failed — proceed with original text */ }
      }
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
