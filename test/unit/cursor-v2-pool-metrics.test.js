import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  loadMetrics,
  saveMetrics,
  metricsPath,
  recordCompletedRun,
} from '../../scripts/lib/cursor-v2-pool-metrics.mjs';

describe('cursor-v2-pool-metrics', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dh-pool-metrics-'));
  });
  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true });
  });

  it('EMA updates and persists', () => {
    expect(existsSync(metricsPath(dir))).toBe(false);
    recordCompletedRun({ durationMs: 100_000, remain: 10, workers: 2, repoRoot: dir });
    let m = loadMetrics(dir);
    expect(m.completedRuns).toBe(1);
    expect(m.emaDurationMs).toBe(100_000);
    recordCompletedRun({ durationMs: 200_000, remain: 9, workers: 2, repoRoot: dir });
    m = loadMetrics(dir);
    expect(m.completedRuns).toBe(2);
    expect(m.emaDurationMs).toBeGreaterThan(100_000);
    expect(m.emaDurationMs).toBeLessThan(200_000);
  });
});
