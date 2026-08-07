import { describe, expect, it } from 'vitest';
import {
  buildStitchFilterComplex,
  buildStitchSegments,
  normalizeCuts,
  roleToCamera,
  stitchOrderedSegmentFiles,
} from '../helpers/subclass-video-stitch.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('roleToCamera', () => {
  it('maps actor roles case-insensitively', () => {
    expect(roleToCamera('GM')).toBe('gm');
    expect(roleToCamera(' gm ')).toBe('gm');
    expect(roleToCamera('PLAYER A')).toBe('playerA');
    expect(roleToCamera('Player A')).toBe('playerA');
    expect(roleToCamera('PLAYERA')).toBe('playerA');
    expect(roleToCamera('PLAYER B')).toBe('playerB');
    expect(roleToCamera('playerb')).toBe('playerB');
  });

  it('returns null for non-actor / wrap-up roles', () => {
    expect(roleToCamera('Bard / Troubadour')).toBeNull();
    expect(roleToCamera('Walkthrough complete')).toBeNull();
    expect(roleToCamera('Druid / Warden of the Elements')).toBeNull();
    expect(roleToCamera('')).toBeNull();
  });
});

describe('normalizeCuts', () => {
  it('inserts default camera at t=0 when cuts are empty', () => {
    expect(normalizeCuts([])).toEqual([{ tMs: 0, camera: 'playerA' }]);
  });

  it('replaces default opening camera when first cut is at t≈0', () => {
    expect(normalizeCuts([{ tMs: 0, camera: 'gm' }])).toEqual([{ tMs: 0, camera: 'gm' }]);
    expect(normalizeCuts([{ tMs: 5, camera: 'gm' }])).toEqual([{ tMs: 0, camera: 'gm' }]);
  });

  it('drops consecutive duplicate cameras', () => {
    expect(
      normalizeCuts([
        { tMs: 0, camera: 'gm' },
        { tMs: 1000, camera: 'gm' },
        { tMs: 2000, camera: 'playerA' },
        { tMs: 3000, camera: 'playerA' },
      ])
    ).toEqual([
      { tMs: 0, camera: 'gm' },
      { tMs: 2000, camera: 'playerA' },
    ]);
  });
});

describe('buildStitchSegments', () => {
  it('builds half-open segments and extends the last to durationSec', () => {
    const segs = buildStitchSegments(
      [
        { tMs: 0, camera: 'gm' },
        { tMs: 2500, camera: 'playerA' },
        { tMs: 10000, camera: 'playerB' },
      ],
      20
    );
    expect(segs).toEqual([
      { camera: 'gm', startSec: 0, endSec: 2.5 },
      { camera: 'playerA', startSec: 2.5, endSec: 10 },
      { camera: 'playerB', startSec: 10, endSec: 20 },
    ]);
  });

  it('clamps segments that overrun durationSec', () => {
    const segs = buildStitchSegments(
      [
        { tMs: 0, camera: 'playerA' },
        { tMs: 5000, camera: 'gm' },
      ],
      3
    );
    expect(segs).toEqual([{ camera: 'playerA', startSec: 0, endSec: 3 }]);
  });

  it('returns empty when duration is zero', () => {
    expect(buildStitchSegments([{ tMs: 0, camera: 'gm' }], 0)).toEqual([]);
  });
});

describe('buildStitchFilterComplex', () => {
  it('emits trim/setpts/scale/concat labeled outputs for each segment', () => {
    const segments = [
      { camera: 'gm', startSec: 0, endSec: 2 },
      { camera: 'playerA', startSec: 2, endSec: 5 },
    ];
    const { filterComplex, videoLabel } = buildStitchFilterComplex(segments, ['gm', 'playerA']);
    expect(videoLabel).toBe('vout');
    expect(filterComplex).toContain('[0:v]trim=start=0:end=2,setpts=PTS-STARTPTS');
    expect(filterComplex).toContain('[1:v]trim=start=2:end=5,setpts=PTS-STARTPTS');
    expect(filterComplex).toContain('scale=1280:720');
    expect(filterComplex).toContain('[v0][v1]concat=n=2:v=1:a=0[vout]');
  });

  it('maps cameras to their input index (not segment order)', () => {
    const segments = [
      { camera: 'playerA', startSec: 0, endSec: 1 },
      { camera: 'gm', startSec: 1, endSec: 2 },
    ];
    // Inputs ordered gm, playerA → playerA is index 1, gm is index 0
    const { filterComplex } = buildStitchFilterComplex(segments, ['gm', 'playerA']);
    expect(filterComplex).toContain('[1:v]trim=start=0:end=1');
    expect(filterComplex).toContain('[0:v]trim=start=1:end=2');
  });

  it('throws when a segment camera is missing from inputs', () => {
    expect(() =>
      buildStitchFilterComplex([{ camera: 'playerB', startSec: 0, endSec: 1 }], ['gm', 'playerA'])
    ).toThrow(/playerB/);
  });
});

describe('stitchOrderedSegmentFiles', () => {
  it('copies a single non-empty segment to the output path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-stitch-'));
    const src = path.join(dir, 'only.webm');
    const dest = path.join(dir, 'out.webm');
    const payload = Buffer.alloc(64, 1);
    fs.writeFileSync(src, payload);
    const result = stitchOrderedSegmentFiles({ segmentPaths: [src], outputPath: dest });
    expect(result.segmentCount).toBe(1);
    expect(result.outputPath).toBe(dest);
    expect(fs.readFileSync(dest).equals(payload)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('throws when no segment files exist on disk', () => {
    expect(() =>
      stitchOrderedSegmentFiles({
        segmentPaths: ['/tmp/dh-definitely-missing-segment.webm'],
        outputPath: path.join(os.tmpdir(), 'dh-stitch-out.webm'),
      })
    ).toThrow(/no segment/);
  });
});
