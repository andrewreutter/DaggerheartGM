import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  formatDtScenesCacheStamp,
  hashAuthoredDtScenes,
  planDtScenesCacheSync,
  readAuthoredDtSceneFiles,
  DT_SCENES_CACHE_REVISION,
} from '../../src/dt-scenes-loader.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('planDtScenesCacheSync', () => {
  const incoming = [
    { id: 'srd-scene-crossroads-ambush', name: 'Crossroads Ambush' },
    { id: 'srd-scene-cross-the-raging-river', name: 'Cross the Raging River' },
  ];

  it('upserts every incoming scene when the cache is empty', () => {
    const { upserts } = planDtScenesCacheSync([], incoming);
    expect(upserts.map((s) => s.id)).toEqual([
      'srd-scene-crossroads-ambush',
      'srd-scene-cross-the-raging-river',
    ]);
  });

  it('skips admin-edited rows unless force is set', () => {
    const existing = [
      { id: 'srd-scene-crossroads-ambush', name: 'Edited', _adminEditedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'srd-scene-cross-the-raging-river', name: 'River' },
    ];
    const skipped = planDtScenesCacheSync(existing, incoming);
    expect(skipped.upserts.map((s) => s.id)).toEqual(['srd-scene-cross-the-raging-river']);

    const forced = planDtScenesCacheSync(existing, incoming, { force: true });
    expect(forced.upserts.map((s) => s.id)).toEqual([
      'srd-scene-crossroads-ambush',
      'srd-scene-cross-the-raging-river',
    ]);
  });

  it('reads _adminEditedAt from a nested data bag', () => {
    const existing = [
      { external_id: 'srd-scene-crossroads-ambush', data: { _adminEditedAt: '2026-08-01T00:00:00.000Z' } },
    ];
    const { upserts } = planDtScenesCacheSync(existing, incoming);
    expect(upserts.map((s) => s.id)).toEqual(['srd-scene-cross-the-raging-river']);
  });
});

describe('authored DT scene files', () => {
  it('reads both catalog scenes from data/dt-scenes/', async () => {
    const files = await readAuthoredDtSceneFiles();
    expect(files.map((f) => f.id).sort()).toEqual([
      'srd-scene-cross-the-raging-river',
      'srd-scene-crossroads-ambush',
    ]);
    expect(files.every((f) => f.scene._source === 'dt')).toBe(true);
  });
});

describe('hashAuthoredDtScenes / formatDtScenesCacheStamp', () => {
  it('is stable for the same files and changes when content changes', () => {
    const a = hashAuthoredDtScenes([
      { filename: 'a.json', raw: '{"id":"a"}' },
      { filename: 'b.json', raw: '{"id":"b"}' },
    ]);
    const b = hashAuthoredDtScenes([
      { filename: 'b.json', raw: '{"id":"b"}' },
      { filename: 'a.json', raw: '{"id":"a"}' },
    ]);
    const c = hashAuthoredDtScenes([
      { filename: 'a.json', raw: '{"id":"a","x":1}' },
      { filename: 'b.json', raw: '{"id":"b"}' },
    ]);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(formatDtScenesCacheStamp(a)).toBe(`${DT_SCENES_CACHE_REVISION}:${a}`);
  });
});

describe('server startup wires DT scene load', () => {
  it('calls loadDtScenesIntoDb after loadSrdIntoDb when DATABASE_URL is set', () => {
    const source = readFileSync(join(REPO_ROOT, 'server.js'), 'utf8');
    expect(source).toMatch(/import \{ loadDtScenesIntoDb \} from '\.\/src\/dt-scenes-loader\.js'/);
    const srdAt = source.indexOf('await loadSrdIntoDb(APP_ID)');
    const dtAt = source.indexOf('await loadDtScenesIntoDb(APP_ID)');
    expect(srdAt).toBeGreaterThan(-1);
    expect(dtAt).toBeGreaterThan(srdAt);
  });
});
