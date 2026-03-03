/**
 * OCR-based image parsing for Daggerheart stat block images.
 *
 * Supports multiple OCR engines simultaneously (Tesseract.js + EasyOCR).
 * Each image is processed by all available engines in parallel; the engine
 * producing the highest-confidence stat block parse wins and provides the
 * text and bounding boxes used for artwork extraction.
 *
 * Engine contract: each engine in src/ocr-engines/ exports:
 *   name:          string
 *   isAvailable(): boolean
 *   recognize(buf): Promise<{ text, detections: [{bbox:{x0,y0,x1,y1}, text, confidence}] }>
 *   terminate():   Promise<void>
 *
 * For composite images containing both artwork and a stat block, artwork
 * regions are automatically cropped using the winning engine's bounding boxes
 * and sharp. All four margins around the text are evaluated; any qualifying
 * region becomes a standalone artwork crop.
 *
 * Accuracy logging: on every invocation (when 2+ engines are active) a JSON
 * line is written to stdout and win counts are persisted to
 * data/ocr-engine-stats.json. Engines with 0 wins after 50+ total runs are
 * automatically disabled and a warning is printed on every OCR call.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseStatBlock, detectCollection, mergeResults } from './text-parse.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATS_PATH = join(__dirname, '../data/ocr-engine-stats.json');

// ---------------------------------------------------------------------------
// Artwork extraction constants
// ---------------------------------------------------------------------------

// Keywords that indicate an image contains a stat block rather than artwork
const STAT_KEYWORDS = /\b(HP|Hit Points?|Stress|Difficulty|Tier|Attack|ATK|Features?|Experiences?|Thresholds?|Melee|Close|Far|Passive|Action|Reaction|Damage|d\d+)\b/i;
const MIN_KEYWORD_HITS = 3;

// Minimum fraction of total image area a margin must occupy to qualify as artwork.
// 0.10 (10%) rejects thin decorative borders (typically 3-6%) while admitting
// genuine artwork banners (e.g. Sporenado top banner is ~33%).
const MIN_AREA_FRACTION = 0.10;
// Minimum size (in pixels) of the shorter dimension of a cropped region.
// 100px rejects narrow padding/borders (30-80px) while admitting real banners (~400px+).
const MIN_SHORT_SIDE_PX = 100;
// Maximum aspect ratio (longer / shorter side) for a region to qualify.
// 5:1 rejects tall/thin side margins that are likely decorative borders.
const MAX_ASPECT_RATIO = 5;
// Inward margin applied to each crop to avoid clipping partial glyphs (fraction).
const CROP_INSET_FRACTION = 0.02;
// Minimum confidence for a detection line to be included in the text bounding box.
// 85 excludes OCR noise from artwork regions (54-74) while keeping stat block text (95+).
const MIN_LINE_CONFIDENCE = 85;

// ---------------------------------------------------------------------------
// Retirement thresholds
// ---------------------------------------------------------------------------
const RETIREMENT_MIN_RUNS = 50; // minimum total runs before retirement can trigger

// ---------------------------------------------------------------------------
// Engine registry
// ---------------------------------------------------------------------------

/** @type {Array<{ name: string, isAvailable: ()=>boolean, recognize: (buf:Buffer)=>Promise<any>, terminate: ()=>Promise<void> }>} */
let _activeEngines = null; // null = not yet initialized

async function loadEngines() {
  if (_activeEngines !== null) return _activeEngines;

  const allEngines = await Promise.all([
    import('./ocr-engines/tesseract.js'),
    import('./ocr-engines/easyocr.js'),
  ]);

  const stats = loadStats();
  const totalRuns = Object.values(stats).reduce((sum, s) => sum + s.runs, 0);

  _activeEngines = [];
  for (const engine of allEngines) {
    if (!engine.isAvailable()) {
      console.log(`[ocr] Engine "${engine.name}" not available (missing dependency) — skipping.`);
      continue;
    }
    // Retirement check
    const engineStats = stats[engine.name];
    if (
      engineStats &&
      totalRuns >= RETIREMENT_MIN_RUNS &&
      engineStats.wins === 0
    ) {
      console.warn(
        `[ocr] WARNING: Engine "${engine.name}" has 0 wins in ${totalRuns} runs and is disabled. ` +
        `Remove it from src/ocr-engines/ to reclaim resources.`
      );
      continue;
    }
    _activeEngines.push(engine);
  }

  if (_activeEngines.length === 0) {
    throw new Error('[ocr] No OCR engines available. This should never happen (tesseract.js is always available).');
  }

  console.log(`[ocr] Active engines: ${_activeEngines.map(e => e.name).join(', ')}`);
  return _activeEngines;
}

// ---------------------------------------------------------------------------
// Accuracy stats persistence
// ---------------------------------------------------------------------------

function loadStats() {
  try {
    if (existsSync(STATS_PATH)) {
      return JSON.parse(readFileSync(STATS_PATH, 'utf8'));
    }
  } catch { /* ignore parse errors */ }
  return {};
}

function saveStats(stats) {
  try {
    writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.warn('[ocr] Could not save engine stats:', err.message);
  }
}

function recordWin(winnerName, engineNames) {
  const stats = loadStats();
  const totalRuns = Object.values(stats).reduce((sum, s) => sum + s.runs, 0) + 1;

  for (const name of engineNames) {
    if (!stats[name]) stats[name] = { wins: 0, runs: 0 };
    stats[name].runs += 1;
  }
  if (winnerName && stats[winnerName]) {
    stats[winnerName].wins += 1;
  }
  saveStats(stats);

  // Nag about any retired-but-still-installed engines on every call
  for (const [name, s] of Object.entries(stats)) {
    if (totalRuns >= RETIREMENT_MIN_RUNS && s.wins === 0 && engineNames.includes(name)) {
      console.warn(
        `[ocr] WARNING: Engine "${name}" has 0 wins in ${totalRuns} runs and is disabled. ` +
        `Remove it from src/ocr-engines/ to reclaim resources.`
      );
    }
  }

  return totalRuns;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Artwork region extraction (engine-agnostic)
// ---------------------------------------------------------------------------

/**
 * Given a stat-block image buffer and a normalized detections array, find all
 * margins (top, left, bottom, right) around the text bounding box that are
 * large enough to plausibly contain artwork, crop each one, and return an
 * array of base64 data URLs in priority order (top, left, bottom, right).
 *
 * @param {Buffer} buf
 * @param {Array<{ bbox: { x0, y0, x1, y1 }, text: string, confidence: number }>} detections
 * @returns {Promise<string[]>} Array of data:image/jpeg;base64,... URLs
 */
async function extractArtworkRegions(buf, detections) {
  try {
    const { width: W, height: H } = await sharp(buf).metadata();
    if (!W || !H) return [];

    // Filter to high-confidence lines with meaningful text
    const lines = detections.filter(
      d => d.confidence > MIN_LINE_CONFIDENCE && d.text.trim().length > 2
    );
    if (lines.length === 0) return [];

    // Compute tight bounding box around all qualifying text
    let textMinX = Infinity, textMinY = Infinity, textMaxX = -Infinity, textMaxY = -Infinity;
    for (const { bbox: { x0, y0, x1, y1 } } of lines) {
      if (x0 < textMinX) textMinX = x0;
      if (y0 < textMinY) textMinY = y0;
      if (x1 > textMaxX) textMaxX = x1;
      if (y1 > textMaxY) textMaxY = y1;
    }

    const totalArea = W * H;

    // Four candidate margins in priority order
    const candidates = [
      { name: 'top',    region: { left: 0,        top: 0,        width: W,             height: textMinY      } },
      { name: 'left',   region: { left: 0,        top: 0,        width: textMinX,       height: H             } },
      { name: 'bottom', region: { left: 0,        top: textMaxY, width: W,             height: H - textMaxY  } },
      { name: 'right',  region: { left: textMaxX, top: 0,        width: W - textMaxX,  height: H             } },
    ];

    const dataUrls = [];

    for (const { name, region } of candidates) {
      const { left, top, width, height } = region;

      if (width <= 0 || height <= 0) continue;

      const area = width * height;
      const shortSide = Math.min(width, height);
      const longSide = Math.max(width, height);

      if (area / totalArea < MIN_AREA_FRACTION) continue;
      if (shortSide < MIN_SHORT_SIDE_PX) continue;
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

// ---------------------------------------------------------------------------
// Dual-engine orchestration
// ---------------------------------------------------------------------------

/**
 * Run OCR on a single image buffer using all available engines.
 *
 * When multiple engines are available, all run in parallel. Each engine's
 * text is independently parsed, then all parse results are merged with
 * mergeResults so the best fields from each engine are combined — e.g.
 * EasyOCR may read a display-font title that Tesseract misses, while
 * Tesseract may extract features that EasyOCR's text ordering confuses.
 *
 * The highest-confidence engine's bounding boxes are used for artwork
 * region extraction. The merged parse result is returned as parsedResult
 * for callers that want to skip re-parsing the raw text.
 *
 * @param {Buffer} buf
 * @param {object} [opts]
 * @param {string|null} [opts.collection] - 'adversaries'|'environments'|null (auto-detect)
 * @returns {Promise<{
 *   text: string,
 *   isStatBlock: boolean,
 *   artworkRegions: string[],
 *   parsedResult: object|null
 * }>}
 */
export async function ocrBuffer(buf, { collection = null } = {}) {
  const engines = await loadEngines();

  // Helper: parse with known collection or auto-detect
  const parse = (text) => collection
    ? parseStatBlock(text, collection)
    : detectCollection(text);

  // With a single engine, skip all comparison overhead
  if (engines.length === 1) {
    const engine = engines[0];
    let result;
    try {
      result = await engine.recognize(buf);
    } catch (err) {
      console.warn(`[ocr] Engine "${engine.name}" failed:`, err.message);
      return { text: '', isStatBlock: false, artworkRegions: [], parsedResult: null };
    }
    const statBlock = isStatBlock(result.text);
    const parsedResult = statBlock && result.text ? parse(result.text) : null;
    const artworkRegions = statBlock && result.detections.length > 0
      ? await extractArtworkRegions(buf, result.detections)
      : [];
    return { text: result.text, isStatBlock: statBlock, artworkRegions, parsedResult };
  }

  // Run all engines in parallel
  const engineResults = await Promise.all(
    engines.map(async (engine) => {
      try {
        const result = await engine.recognize(buf);
        return { name: engine.name, result };
      } catch (err) {
        console.warn(`[ocr] Engine "${engine.name}" failed:`, err.message);
        return { name: engine.name, result: { text: '', detections: [] } };
      }
    })
  );

  // Parse each engine's output independently
  const parsedEngines = engineResults.map(({ name, result }) => {
    const statBlock = isStatBlock(result.text);
    const parseResult = statBlock && result.text ? parse(result.text) : null;
    return {
      name,
      result,
      statBlock,
      parseResult,
      confidence: parseResult?.confidence ?? 0,
      missing: parseResult?.missing ?? [],
    };
  });

  // Bbox winner: highest-confidence stat-block engine (for artwork extraction)
  const statBlockEngines = parsedEngines.filter(s => s.statBlock && s.parseResult);
  const bboxWinner = (statBlockEngines.length > 0 ? statBlockEngines : parsedEngines)
    .sort((a, b) => b.confidence - a.confidence)[0];

  // Merge all parse results — best fields from each engine combined
  const validParsed = parsedEngines.filter(s => s.parseResult);
  const mergedParseResult = validParsed.length > 0
    ? validParsed.reduce((acc, s, i) => i === 0 ? s.parseResult : mergeResults(acc, s.parseResult), null)
    : null;
  // mergeResults strips the `collection` field — re-attach it from the first parse result
  // (detectCollection populates it; parseStatBlock doesn't, so this is a no-op when collection is known)
  if (mergedParseResult && !mergedParseResult.collection) {
    const firstCollection = validParsed.find(s => s.parseResult?.collection)?.parseResult?.collection;
    if (firstCollection) mergedParseResult.collection = firstCollection;
  }

  // Accuracy logging (bbox winner credited with the win)
  const engineNames = parsedEngines.map(s => s.name);
  const totalRuns = recordWin(bboxWinner.statBlock ? bboxWinner.name : null, engineNames);

  const engineLog = {};
  for (const s of parsedEngines) {
    engineLog[s.name] = { confidence: s.confidence, missing: s.missing };
  }
  console.log(JSON.stringify({
    event: 'ocr_engine_result',
    engines: engineLog,
    winner: bboxWinner.statBlock ? bboxWinner.name : null,
    mergedConfidence: mergedParseResult?.confidence ?? null,
    totalRuns,
    ts: new Date().toISOString(),
  }));

  const artworkRegions = bboxWinner.statBlock && bboxWinner.result.detections.length > 0
    ? await extractArtworkRegions(buf, bboxWinner.result.detections)
    : [];

  return {
    text: bboxWinner.result.text,
    isStatBlock: bboxWinner.statBlock,
    artworkRegions,
    parsedResult: mergedParseResult,
  };
}

/**
 * Run OCR on a set of image URLs.
 *
 * Classifies each image as a stat block (text extracted) or artwork (URL preserved).
 * For stat block images, attempts to extract artwork from any large non-text margins.
 *
 * Processes up to maxImages images; remaining URLs are treated as artwork.
 * Returns parsedResults (cross-engine merged) alongside raw texts.
 *
 * @param {string[]} imageUrls
 * @param {object}   [opts]
 * @param {number}   [opts.maxImages=4]
 * @param {string|null} [opts.collection] - passed through to ocrBuffer
 * @returns {Promise<{
 *   texts: string[],
 *   parsedResults: object[],
 *   artworkUrl: string|null,
 *   additionalImages: string[],
 *   hasStatBlockImages: boolean
 * }>}
 */
export async function ocrImages(imageUrls, { maxImages = 4, collection = null } = {}) {
  const texts = [];
  const parsedResults = [];
  const artworkUrls = [];
  const croppedArtworkUrls = [];
  const statBlockUrls = [];

  for (const url of imageUrls.slice(0, maxImages)) {
    const buf = await fetchImage(url);
    if (!buf) {
      artworkUrls.push(url);
      continue;
    }

    const result = await ocrBuffer(buf, { collection });
    if (!result.text) {
      artworkUrls.push(url);
      continue;
    }

    if (result.isStatBlock) {
      texts.push(result.text);
      if (result.parsedResult) parsedResults.push(result.parsedResult);
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
  const additionalImages = [...allArtwork.slice(1), ...statBlockUrls];

  return { texts, parsedResults, artworkUrl, additionalImages, hasStatBlockImages: statBlockUrls.length > 0 };
}

/**
 * Gracefully shut down all OCR engine workers.
 * Called on server shutdown to clean up resources.
 */
export async function terminateOcr() {
  if (_activeEngines) {
    await Promise.all(_activeEngines.map(e => e.terminate().catch(() => {})));
    _activeEngines = null;
  }
}
