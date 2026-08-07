/**
 * Pure helpers + thin ffmpeg invoke for multi-camera subclass video stitching.
 *
 * Cut list entries: `{ tMs: number, camera: 'gm'|'playerA'|'playerB' }` (sorted by tMs).
 * Each segment `[tStart, tEnd)` pulls from the matching camera's screencast file.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const STITCH_CAMERAS = ['gm', 'playerA', 'playerB'];

/**
 * Map caption role strings → camera ids. Non-actor roles return null (no cut).
 * @param {string} role
 * @returns {'gm'|'playerA'|'playerB'|null}
 */
export function roleToCamera(role) {
  const key = String(role ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (key === 'GM') return 'gm';
  if (key === 'PLAYER A' || key === 'PLAYERA') return 'playerA';
  if (key === 'PLAYER B' || key === 'PLAYERB') return 'playerB';
  return null;
}

/**
 * Normalize + sort cut entries; drop no-ops (same camera as previous).
 * @param {Array<{ tMs: number, camera: string }>} cuts
 * @param {string} [defaultCamera='playerA']
 * @returns {Array<{ tMs: number, camera: string }>}
 */
/** Opening-cut grace window: first cut within this many ms replaces a synthetic t=0 default. */
const OPENING_CUT_GRACE_MS = 250;

export function normalizeCuts(cuts, defaultCamera = 'playerA') {
  const list = Array.isArray(cuts) ? [...cuts] : [];
  list.sort((a, b) => a.tMs - b.tMs || 0);
  const out = [];
  const needsDefault = list.length === 0 || list[0].tMs > OPENING_CUT_GRACE_MS;
  if (needsDefault) {
    out.push({ tMs: 0, camera: defaultCamera });
  }
  for (const c of list) {
    if (!c || !STITCH_CAMERAS.includes(c.camera)) continue;
    const tMs = Math.max(0, Number(c.tMs) || 0);
    const prev = out[out.length - 1];
    if (prev && prev.camera === c.camera) continue;
    // First cut in the opening grace window replaces a synthetic default at t=0.
    if (
      prev &&
      prev.tMs === 0 &&
      out.length === 1 &&
      tMs <= OPENING_CUT_GRACE_MS &&
      prev.camera === defaultCamera &&
      c.camera !== defaultCamera
    ) {
      out[0] = { tMs: 0, camera: c.camera };
      continue;
    }
    if (!needsDefault && out.length === 0) {
      out.push({ tMs: 0, camera: c.camera });
      continue;
    }
    if (prev && tMs < prev.tMs) continue;
    if (prev && tMs === prev.tMs && out.length === 1) {
      out[0] = { tMs: 0, camera: c.camera };
      continue;
    }
    out.push({ tMs, camera: c.camera });
  }
  if (out.length === 0) out.push({ tMs: 0, camera: defaultCamera });
  return out;
}

/**
 * Build timed segments from a cut list and total duration (seconds).
 * Last segment extends to `durationSec` (clamped to longest input).
 *
 * @param {Array<{ tMs: number, camera: string }>} cuts
 * @param {number} durationSec
 * @param {string} [defaultCamera='playerA']
 * @returns {Array<{ camera: string, startSec: number, endSec: number }>}
 */
export function buildStitchSegments(cuts, durationSec, defaultCamera = 'playerA') {
  const normalized = normalizeCuts(cuts, defaultCamera);
  const total = Math.max(0, Number(durationSec) || 0);
  if (total <= 0) return [];

  const segments = [];
  for (let i = 0; i < normalized.length; i++) {
    const startSec = normalized[i].tMs / 1000;
    const endSec = i + 1 < normalized.length ? normalized[i + 1].tMs / 1000 : total;
    if (endSec <= startSec) continue;
    if (startSec >= total) break;
    segments.push({
      camera: normalized[i].camera,
      startSec,
      endSec: Math.min(endSec, total),
    });
  }
  return segments;
}

/**
 * Build an ffmpeg filter_complex that trims/concats camera inputs to one stream.
 *
 * Input index map: cameras present in `inputCameras` order become `-i` slots 0..n-1.
 *
 * @param {Array<{ camera: string, startSec: number, endSec: number }>} segments
 * @param {string[]} inputCameras - cameras that have `-i` files, in order
 * @param {{ width?: number, height?: number }} [opts]
 * @returns {{ filterComplex: string, videoLabel: string }}
 */
export function buildStitchFilterComplex(segments, inputCameras, opts = {}) {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 720;
  const camIndex = Object.fromEntries(inputCameras.map((c, i) => [c, i]));

  if (!segments.length) {
    throw new Error('buildStitchFilterComplex: no segments');
  }

  const parts = [];
  const concatInputs = [];
  segments.forEach((seg, i) => {
    const idx = camIndex[seg.camera];
    if (idx == null) {
      throw new Error(`buildStitchFilterComplex: camera "${seg.camera}" not in inputs`);
    }
    const dur = seg.endSec - seg.startSec;
    const label = `v${i}`;
    // trim → reset pts → scale/pad to common size → format
    parts.push(
      `[${idx}:v]trim=start=${seg.startSec}:end=${seg.endSec},setpts=PTS-STARTPTS,` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[${label}]`
    );
    concatInputs.push(`[${label}]`);
    void dur;
  });

  const n = segments.length;
  parts.push(`${concatInputs.join('')}concat=n=${n}:v=1:a=0[vout]`);
  return { filterComplex: parts.join(';'), videoLabel: 'vout' };
}

/**
 * @param {string} bin
 * @returns {string|null} resolved path or null
 */
export function resolveBinary(bin) {
  const which = spawnSync('which', [bin], { encoding: 'utf8' });
  if (which.status === 0) {
    const p = which.stdout.trim();
    if (p) return p;
  }
  return null;
}

/**
 * Probe media duration in seconds via ffprobe.
 * @param {string} filePath
 * @param {string} [ffprobePath]
 * @returns {number}
 */
export function probeDurationSec(filePath, ffprobePath) {
  const bin = ffprobePath || resolveBinary('ffprobe');
  if (!bin) {
    throw new Error(
      'ffprobe not found on PATH. Install ffmpeg (includes ffprobe) — required for subclass video stitching.'
    );
  }
  const r = spawnSync(
    bin,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { encoding: 'utf8', timeout: 30000 }
  );
  if (r.status !== 0) {
    throw new Error(`ffprobe failed for ${filePath}: ${r.stderr || r.stdout}`);
  }
  const d = parseFloat(String(r.stdout).trim());
  if (!Number.isFinite(d) || d < 0) {
    throw new Error(`ffprobe returned invalid duration for ${filePath}: ${r.stdout}`);
  }
  return d;
}

/**
 * Stitch multi-camera screencasts using a cut list.
 *
 * @param {{
 *   cuts: Array<{ tMs: number, camera: string }>,
 *   cameraFiles: Partial<Record<'gm'|'playerA'|'playerB', string>>,
 *   outputPath: string,
 *   defaultCamera?: string,
 *   width?: number,
 *   height?: number,
 * }} opts
 * @returns {{ outputPath: string, durationSec: number, segments: ReturnType<typeof buildStitchSegments> }}
 */
export function stitchSubclassVideos(opts) {
  const ffmpeg = resolveBinary('ffmpeg');
  const ffprobe = resolveBinary('ffprobe');
  if (!ffmpeg || !ffprobe) {
    throw new Error(
      'ffmpeg/ffprobe not found on PATH. Install system ffmpeg (e.g. brew install ffmpeg) — required for multi-camera subclass videos. finish() cannot stitch without them.'
    );
  }

  const cameraFiles = opts.cameraFiles || {};
  const available = STITCH_CAMERAS.filter((c) => cameraFiles[c] && fs.existsSync(cameraFiles[c]));
  if (!available.length) {
    throw new Error('stitchSubclassVideos: no camera input files found');
  }

  const durations = Object.fromEntries(
    available.map((c) => [c, probeDurationSec(cameraFiles[c], ffprobe)])
  );
  const longest = Math.max(...Object.values(durations));
  const defaultCamera = available.includes(opts.defaultCamera)
    ? opts.defaultCamera
    : available.includes('playerA')
      ? 'playerA'
      : available[0];

  // Only keep cuts whose cameras exist; fall back to default for missing cameras.
  const cuts = (opts.cuts || []).map((c) => ({
    tMs: c.tMs,
    camera: available.includes(c.camera) ? c.camera : defaultCamera,
  }));

  const segments = buildStitchSegments(cuts, longest, defaultCamera);
  if (!segments.length) {
    throw new Error('stitchSubclassVideos: empty segment list');
  }

  // Ensure every segment camera is in the input list (already filtered).
  const inputCameras = [];
  for (const seg of segments) {
    if (!inputCameras.includes(seg.camera)) inputCameras.push(seg.camera);
  }
  // Prefer stable order gm, playerA, playerB for debugging.
  inputCameras.sort((a, b) => STITCH_CAMERAS.indexOf(a) - STITCH_CAMERAS.indexOf(b));

  const { filterComplex, videoLabel } = buildStitchFilterComplex(segments, inputCameras, {
    width: opts.width,
    height: opts.height,
  });

  fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true });

  const args = ['-y'];
  for (const c of inputCameras) {
    args.push('-i', cameraFiles[c]);
  }
  args.push(
    '-filter_complex',
    filterComplex,
    '-map',
    `[${videoLabel}]`,
    '-c:v',
    'libvpx',
    '-b:v',
    '2M',
    '-deadline',
    'good',
    '-cpu-used',
    '2',
    '-an',
    opts.outputPath
  );

  const r = spawnSync(ffmpeg, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: opts.timeoutMs ?? 120000,
  });
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    throw new Error(`ffmpeg stitch timed out for ${opts.outputPath}`);
  }
  if (r.status !== 0) {
    throw new Error(`ffmpeg stitch failed (exit ${r.status}): ${r.stderr || r.stdout}`);
  }
  if (!fs.existsSync(opts.outputPath)) {
    throw new Error(`ffmpeg stitch completed but output missing: ${opts.outputPath}`);
  }

  return { outputPath: opts.outputPath, durationSec: longest, segments };
}

/**
 * Concat ordered active-camera segment files (each file is already a hard-cut slice).
 * Used by the harness when only one CDP screencast runs at a time.
 *
 * @param {{
 *   segmentPaths: string[],
 *   outputPath: string,
 *   width?: number,
 *   height?: number,
 *   timeoutMs?: number,
 * }} opts
 * @returns {{ outputPath: string, durationSec: number, segmentCount: number }}
 */
export function stitchOrderedSegmentFiles(opts) {
  const ffmpeg = resolveBinary('ffmpeg');
  const ffprobe = resolveBinary('ffprobe');
  if (!ffmpeg || !ffprobe) {
    throw new Error(
      'ffmpeg/ffprobe not found on PATH. Install system ffmpeg (e.g. brew install ffmpeg) — required for multi-camera subclass videos. finish() cannot stitch without them.'
    );
  }

  const segmentPaths = (opts.segmentPaths || []).filter((p) => {
    try {
      return p && fs.existsSync(p) && fs.statSync(p).size > 0;
    } catch {
      return false;
    }
  });
  if (!segmentPaths.length) {
    throw new Error('stitchOrderedSegmentFiles: no segment files found');
  }

  fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true });

  if (segmentPaths.length === 1) {
    fs.copyFileSync(segmentPaths[0], opts.outputPath);
    let durationSec = 0;
    try {
      durationSec = probeDurationSec(segmentPaths[0], ffprobe);
    } catch {
      /* fake/partial webm during interrupt cleanup */
    }
    return {
      outputPath: opts.outputPath,
      durationSec,
      segmentCount: 1,
    };
  }

  // Prefer the concat demuxer: N-input filter_complex scale/pad graphs are extremely
  // slow when a walkthrough has dozens of camera cuts (each cut = one segment file).
  const listPath = `${opts.outputPath}.concat.txt`;
  const escapeConcatPath = (p) => p.replace(/'/g, `'\\''`);
  fs.writeFileSync(listPath, segmentPaths.map((p) => `file '${escapeConcatPath(path.resolve(p))}'`).join('\n'));

  const tryArgs = (args, timeoutMs) =>
    spawnSync(ffmpeg, args, {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: timeoutMs,
    });

  try {
    // 1) Stream-copy concat when Playwright segment codecs align (fast path).
    let r = tryArgs(
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-an', opts.outputPath],
      Math.min(30000, opts.timeoutMs ?? 120000)
    );
    if (r.status !== 0 || !fs.existsSync(opts.outputPath) || fs.statSync(opts.outputPath).size === 0) {
      // 2) Re-encode with realtime VP8 — much faster than filter_complex N-way concat.
      try {
        fs.rmSync(opts.outputPath, { force: true });
      } catch {
        /* ignore */
      }
      r = tryArgs(
        [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listPath,
          '-c:v',
          'libvpx',
          '-b:v',
          '1M',
          '-deadline',
          'realtime',
          '-cpu-used',
          '8',
          '-an',
          opts.outputPath,
        ],
        opts.timeoutMs ?? 120000
      );
    }
    if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
      throw new Error(`ffmpeg segment concat timed out for ${opts.outputPath}`);
    }
    if (r.status !== 0) {
      throw new Error(`ffmpeg segment concat failed (exit ${r.status}): ${r.stderr || r.stdout}`);
    }
    if (!fs.existsSync(opts.outputPath)) {
      throw new Error(`ffmpeg segment concat completed but output missing: ${opts.outputPath}`);
    }
  } finally {
    try {
      fs.rmSync(listPath, { force: true });
    } catch {
      /* ignore */
    }
  }

  let durationSec = 0;
  for (const p of segmentPaths) {
    try {
      durationSec += probeDurationSec(p, ffprobe);
    } catch {
      /* best-effort total */
    }
  }
  return { outputPath: opts.outputPath, durationSec, segmentCount: segmentPaths.length };
}
