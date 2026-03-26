import { describe, it, expect, vi } from 'vitest';

import {
  replaceV2StatusLabel,
  getV2StatusFromLabels,
  parseMigrationIssueBodyParts,
  buildMigrationIssueBody,
  findNextWorkItemFromGitHub,
  statusToV2Label,
  V2_KIND_FEATURE,
  V2_KIND_BLOCKED,
  V2_MIGRATION_LABEL_OWNER,
  listAllV2MigrationIssues,
} from '../../scripts/lib/github-v2-tracker.mjs';

describe('github-v2-tracker labels', () => {
  it('maps status to label and reads it back', () => {
    expect(statusToV2Label('Needs Fix')).toBe('v2-status:Needs Fix');
    expect(getV2StatusFromLabels(['v2-migration', 'v2-status:Done'])).toBe('Done');
  });

  it('replaceV2StatusLabel swaps single workflow label', () => {
    const next = replaceV2StatusLabel(
      ['v2-migration', 'v2-kind:feature', 'v2-status:Unclaimed'],
      'In Progress',
    );
    expect(next).toContain('v2-status:In Progress');
    expect(next).not.toContain('v2-status:Unclaimed');
    expect(next).toContain('v2-kind:feature');
  });

  it('rejects invalid status', () => {
    expect(() => replaceV2StatusLabel([], 'NotARealStatus')).toThrow();
  });
});

describe('github-v2-tracker JSON body', () => {
  it('round-trips metadata and trailing markdown', () => {
    const meta = {
      v: 3,
      schema: 'v2-migration',
      kind: 'feature',
      name: 'Foo',
      sourceFile: 'abilities/Arcana/Foo.js',
      section: 'abilities',
      domain: 'Arcana',
      tier: 1,
      agent: 'impl-x1',
    };
    const body = buildMigrationIssueBody(meta, 'Hello **notes**');
    const parts = parseMigrationIssueBodyParts(body);
    expect(parts?.meta.name).toBe('Foo');
    expect(parts?.trailingMarkdown).toContain('Hello');
  });
});

function mockIssue(partial) {
  return {
    number: 1,
    title: 'Test',
    body: '',
    labels: [],
    ...partial,
  };
}

describe('findNextWorkItemFromGitHub', () => {
  it('prefers Needs Fix before Done', () => {
    const issues = [
      mockIssue({
        number: 10,
        labels: [{ name: V2_MIGRATION_LABEL_OWNER }, { name: V2_KIND_FEATURE }, { name: 'v2-status:Done' }],
        body: buildMigrationIssueBody({
          v: 3,
          schema: 'v2-migration',
          kind: 'feature',
          name: 'A',
          sourceFile: 'abilities/Arcana/A.js',
          section: 'abilities',
          domain: 'Arcana',
          tier: 1,
        }),
      }),
      mockIssue({
        number: 11,
        labels: [{ name: V2_MIGRATION_LABEL_OWNER }, { name: V2_KIND_FEATURE }, { name: 'v2-status:Needs Fix' }],
        body: buildMigrationIssueBody({
          v: 3,
          schema: 'v2-migration',
          kind: 'feature',
          name: 'B',
          sourceFile: 'abilities/Arcana/B.js',
          section: 'abilities',
          domain: 'Arcana',
          tier: 1,
        }),
      }),
    ];
    const w = findNextWorkItemFromGitHub(issues);
    expect(w?.kind).toBe('feature');
    expect(w?.row.githubIssueNumber).toBe(11);
  });

  it('returns blocked Open when no feature work', () => {
    const issues = [
      mockIssue({
        number: 20,
        labels: [{ name: V2_MIGRATION_LABEL_OWNER }, { name: V2_KIND_BLOCKED }, { name: 'v2-status:Open' }],
        body: buildMigrationIssueBody({
          v: 3,
          schema: 'v2-migration',
          kind: 'blocked',
          resolution: 'test-resolution',
          features: 'Foo',
        }),
        title: 'test-resolution',
      }),
    ];
    const w = findNextWorkItemFromGitHub(issues);
    expect(w?.kind).toBe('blocked');
    expect(w?.row.resolution).toBe('test-resolution');
  });
});

describe('listAllV2MigrationIssues (mock fetch)', () => {
  it('stops after a short page (<100 issues)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            number: 1,
            title: 'a',
            labels: [],
            body: '',
          },
        ]),
    });

    const out = await listAllV2MigrationIssues('o', 'r', 'tok', fetchFn);
    expect(out.length).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetches the next page when a full page is returned', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      title: `t${i}`,
      labels: [],
      body: '',
    }));
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify(fullPage) })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify([]) });

    const out = await listAllV2MigrationIssues('o', 'r', 'tok', fetchFn);
    expect(out.length).toBe(100);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
