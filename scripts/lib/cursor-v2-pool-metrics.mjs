/**
 * Persistent EMA + ETA for scripts/cursor-v2-pool.mjs (time per completed ticket).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const METRICS_FILENAME = '.cursor-v2-pool-metrics.json';
const ALPHA = 0.12;

export function metricsPath(repoRoot) {
  return join(repoRoot, METRICS_FILENAME);
}

/**
 * @returns {{
 *   version: number,
 *   completedRuns: number,
 *   sumDurationMs: number,
 *   emaDurationMs: number | null,
 *   lastRemain: number | null,
 *   lastUpdated: number | null,
 * }}
 */
export function loadMetrics(repoRoot) {
  const p = metricsPath(repoRoot);
  if (!existsSync(p)) {
    return {
      version: 1,
      completedRuns: 0,
      sumDurationMs: 0,
      emaDurationMs: null,
      lastRemain: null,
      lastUpdated: null,
    };
  }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    return {
      version: 1,
      completedRuns: Number(raw.completedRuns) || 0,
      sumDurationMs: Number(raw.sumDurationMs) || 0,
      emaDurationMs: raw.emaDurationMs == null ? null : Number(raw.emaDurationMs),
      lastRemain: raw.lastRemain == null ? null : Number(raw.lastRemain),
      lastUpdated: raw.lastUpdated == null ? null : Number(raw.lastUpdated),
    };
  } catch {
    return {
      version: 1,
      completedRuns: 0,
      sumDurationMs: 0,
      emaDurationMs: null,
      lastRemain: null,
      lastUpdated: null,
    };
  }
}

export function saveMetrics(repoRoot, data) {
  const p = metricsPath(repoRoot);
  writeFileSync(p, JSON.stringify({ ...data, version: 1 }, null, 2), 'utf8');
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/**
 * @param {object} o
 * @param {number} o.durationMs - last ticket wall time
 * @param {number} o.remain - gated features not Validated/Reviewed
 * @param {number} o.workers - parallel pool size
 * @param {import('fs').PathLike} o.repoRoot
 */
export function recordCompletedRun(o) {
  const { durationMs, remain, workers, repoRoot } = o;
  const m = loadMetrics(repoRoot);
  m.completedRuns += 1;
  m.sumDurationMs += durationMs;
  m.emaDurationMs =
    m.emaDurationMs == null ? durationMs : ALPHA * durationMs + (1 - ALPHA) * m.emaDurationMs;
  m.lastRemain = remain;
  m.lastUpdated = Date.now();
  saveMetrics(repoRoot, m);

  const meanMs = m.completedRuns > 0 ? m.sumDurationMs / m.completedRuns : m.emaDurationMs;
  const ema = m.emaDurationMs;
  const w = Math.max(1, workers);

  let etaTail;
  if (remain === 0) {
    etaTail = '| gated remain 0 (nothing left on this count)';
  } else if (ema != null && Number.isFinite(ema)) {
    const etaSeqMs = remain * ema;
    const etaParMs = (remain * ema) / w;
    etaTail = `| ETA ~${fmtDuration(etaSeqMs)} (1 worker) ~${fmtDuration(etaParMs)} (${w} workers, rough)`;
  } else {
    etaTail = '| ETA calibrating…';
  }

  const line = [
    `[pool-metrics] run #${m.completedRuns} finished in ${fmtDuration(durationMs)}`,
    `| EMA ${fmtDuration(ema)} mean ${fmtDuration(meanMs)}`,
    `| remain ${remain} gated features`,
    etaTail,
  ].join(' ');

  return { metrics: m, line };
}

export function formatPoolBanner({ repoRoot, remain, workers }) {
  const m = loadMetrics(repoRoot);
  const w = Math.max(1, workers);
  const ema = m.emaDurationMs;
  let tail = 'collecting samples on first completions…';
  if (remain === 0) {
    tail = 'gated remain already 0';
  } else if (ema != null && Number.isFinite(ema)) {
    const etaSeq = remain * ema;
    const etaPar = (remain * ema) / w;
    tail = `ETA ~${fmtDuration(etaSeq)} (1 worker) ~${fmtDuration(etaPar)} (${w} workers, rough)`;
  }
  return `[pool-metrics] start: ${remain} remain | ${m.completedRuns} completed runs recorded | ${tail}`;
}
