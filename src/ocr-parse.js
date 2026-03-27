/**
 * OCR-based image parsing for Daggerheart stat block images.
 *
 * Uses Tesseract.js (WASM) for OCR. The engine provides the text and bounding
 * boxes used for artwork extraction.
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
 * Accuracy logging: win counts are persisted to data/ocr-engine-stats.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseStatBlock, detectCollection, mergeResults } from './text-parse.js';
import {
  clusterLinesToTextBlocks,
  getArtworkMarginRects,
  addNormalizedRect,
  LAYOUT_LINE_CONFIDENCE_ARTWORK,
  ocrDetectionsIndicateText,
} from './page-layout-ocr.js';

/** @typedef {'adversary' | 'environment' | 'note'} EncounterDropKind */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const STATS_PATH = join(__dirname, '../data/ocr-engine-stats.json');

// ---------------------------------------------------------------------------
// Artwork extraction constants
// ---------------------------------------------------------------------------

// Keywords that indicate an image contains a stat block rather than artwork
const STAT_KEYWORDS = /\b(HP|Hit Points?|Stress|Difficulty|Tier|Attack|ATK|Features?|Experiences?|Thresholds?|Melee|Close|Far|Passive|Action|Reaction|Damage|d\d+)\b/i;
const MIN_KEYWORD_HITS = 3;

// Minimum confidence for a detection line to be included in the text bounding box.
// 85 excludes OCR noise from artwork regions (54-74) while keeping stat block text (95+).
const MIN_LINE_CONFIDENCE = LAYOUT_LINE_CONFIDENCE_ARTWORK;

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

    const lines = detections.filter(
      d => d.confidence > MIN_LINE_CONFIDENCE && d.text.trim().length > 2
    );
    if (lines.length === 0) return [];

    const rects = getArtworkMarginRects(W, H, lines);
    const dataUrls = [];

    for (const r of rects) {
      const cropLeft = r.x0;
      const cropTop = r.y0;
      const cropWidth = r.x1 - r.x0;
      const cropHeight = r.y1 - r.y0;
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
    console.warn('[ocr] extractArtworkRegions error:', err.message);
    return [];
  }
}

/**
 * Full-page layout for GM preview: paragraph text blocks + margin image blocks.
 * Image regions use the same margin heuristic as stat-block artwork extraction;
 * inline art inside the text column is not segmented in v1.
 *
 * @param {Buffer} buf
 * @returns {Promise<{
 *   width: number,
 *   height: number,
 *   mime: string,
 *   dataUrl: string,
 *   text: string,
 *   textBlocks: Array<{ x0, y0, x1, y1, text, nx0?, ny0?, nx1?, ny1? }>,
 *   imageBlocks: Array<{ x0, y0, x1, y1, nx0?, ny0?, nx1?, ny1? }>
 * }>}
 */
export async function analyzePageLayout(buf) {
  const engines = await loadEngines();
  const engine = engines[0];
  let result;
  try {
    result = await engine.recognize(buf);
  } catch (err) {
    console.warn(`[ocr] analyzePageLayout recognize failed:`, err.message);
    throw err;
  }

  const meta = await sharp(buf).metadata();
  const W = meta.width || 0;
  const H = meta.height || 0;
  if (!W || !H) {
    throw new Error('Could not read image dimensions');
  }

  const fmt = meta.format || 'jpeg';
  const mime = fmt === 'png' ? 'image/png'
    : fmt === 'webp' ? 'image/webp'
      : fmt === 'gif' ? 'image/gif'
        : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const textBlocksRaw = clusterLinesToTextBlocks(result.detections);
  const textBlocks = textBlocksRaw.map((b) => addNormalizedRect(
    { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, text: b.text },
    W,
    H
  ));

  const lines = result.detections.filter(
    d => d.confidence > MIN_LINE_CONFIDENCE && d.text.trim().length > 2
  );
  const imageBlocks = getArtworkMarginRects(W, H, lines).map((r) => addNormalizedRect(r, W, H));

  return {
    width: W,
    height: H,
    mime,
    dataUrl,
    text: result.text || '',
    textBlocks,
    imageBlocks,
  };
}

// ---------------------------------------------------------------------------
// Dual-engine orchestration
// ---------------------------------------------------------------------------

/**
 * Run OCR on a single image buffer using all available engines.
 *
 * Runs Tesseract.js on the buffer. The engine's bounding boxes are used for
 * artwork region extraction. The parse result is returned as parsedResult
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
/**
 * Run OCR on a small image buffer (e.g. a user-drawn region) and return whether it contains readable text.
 * Uses the same line clustering thresholds as page layout text blocks.
 *
 * @param {Buffer} buf
 * @returns {Promise<boolean>}
 */
export async function ocrCropHasText(buf) {
  const engines = await loadEngines();
  const engine = engines[0];
  let result;
  try {
    result = await engine.recognize(buf);
  } catch (err) {
    console.warn('[ocr] ocrCropHasText recognize failed:', err?.message || err);
    return false;
  }
  return ocrDetectionsIndicateText(result.detections || []);
}

/**
 * OCR a cropped region; returns raw text plus whether detections indicate readable text.
 *
 * @param {Buffer} buf
 * @returns {Promise<{ text: string, hasText: boolean }>}
 */
export async function ocrCropRegionText(buf) {
  const engines = await loadEngines();
  const engine = engines[0];
  let result;
  try {
    result = await engine.recognize(buf);
  } catch (err) {
    console.warn('[ocr] ocrCropRegionText recognize failed:', err?.message || err);
    return { text: '', hasText: false };
  }
  const text = result.text || '';
  const hasText = ocrDetectionsIndicateText(result.detections || []);
  return { text, hasText };
}

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
 * Parse OCR text for Game Table encounter import (no stat-block keyword gate;
 * adversary/environment always run regex parser for the chosen kind).
 *
 * @param {string} text
 * @param {EncounterDropKind} kind
 * @returns {{ kind: EncounterDropKind, text: string, item: object, confidence?: number, missing?: string[] }}
 */
export function parseEncounterDropText(text, kind) {
  const raw = (text || '').trim();
  if (kind === 'note') {
    const firstLine = raw.split(/\n/).find(l => l.trim()) || 'Note';
    return {
      kind: 'note',
      text: raw,
      item: { body: raw, name: firstLine.trim().slice(0, 120) },
    };
  }
  const collection = kind === 'adversary' ? 'adversaries' : 'environments';
  const { item, confidence, missing } = parseStatBlock(raw, collection);
  return {
    kind,
    text: raw,
    item,
    confidence,
    missing,
  };
}

/**
 * OCR an image for encounter-panel drop targets (adversary / environment / note).
 *
 * @param {Buffer} buf
 * @param {EncounterDropKind} kind
 * @returns {Promise<{ kind: EncounterDropKind, text: string, item: object, confidence?: number, missing?: string[] }>}
 */
export async function parseEncounterDropBuffer(buf, kind) {
  if (!buf || !Buffer.isBuffer(buf)) {
    throw new Error('Image buffer is required');
  }
  if (!['adversary', 'environment', 'note'].includes(kind)) {
    throw new Error('kind must be adversary, environment, or note');
  }
  const engines = await loadEngines();
  const engine = engines[0];
  let result;
  try {
    result = await engine.recognize(buf);
  } catch (err) {
    console.warn(`[ocr] parseEncounterDropBuffer recognize failed:`, err?.message || err);
    return parseEncounterDropText('', kind);
  }
  const text = result.text || '';
  return parseEncounterDropText(text, kind);
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
