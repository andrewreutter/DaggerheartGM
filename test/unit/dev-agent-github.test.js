import { describe, it, expect } from 'vitest';
import {
  parseDevAgentMetadataFromIssueBody,
  buildDevAgentIssueBody,
  replaceDevAgentStateLabel,
  getDevAgentStateLabel,
  filterIssuesByDevAgentPath,
  normalizeDevAgentRelPath,
  extractDevAgentPathFromIssueTitle,
  buildOpenIssuesSearchQuery,
  mergeIssuesByNumber,
  extractPullNumberFromText,
  isGithubIssueWriteForbidden,
  DEV_AGENT_STATE_LABELS,
  DEV_AGENT_LABEL_OWNER,
} from '../../src/dev-agent-github.js';

describe('dev-agent-github', () => {
  it('parseDevAgentMetadataFromIssueBody reads fenced json', () => {
    const body = '```json\n{"v":1,"path":"classes/Bard.js","kind":"feature","submittedAt":"2025-01-01"}\n```\n\nHello';
    const m = parseDevAgentMetadataFromIssueBody(body);
    expect(m.path).toBe('classes/Bard.js');
    expect(m.kind).toBe('feature');
  });

  it('buildDevAgentIssueBody round-trips path', () => {
    const b = buildDevAgentIssueBody({
      path: 'abilities/Bone/Foo.js',
      kind: 'bug',
      message: 'Fix thing',
      submittedAt: '2025-01-02T00:00:00.000Z',
    });
    const m = parseDevAgentMetadataFromIssueBody(b);
    expect(m.path).toBe('abilities/Bone/Foo.js');
    expect(m.kind).toBe('bug');
  });

  it('replaceDevAgentStateLabel swaps one state label', () => {
    const next = replaceDevAgentStateLabel(
      [DEV_AGENT_LABEL_OWNER, DEV_AGENT_STATE_LABELS.queued],
      DEV_AGENT_STATE_LABELS.running,
    );
    expect(next).toContain(DEV_AGENT_LABEL_OWNER);
    expect(next).toContain(DEV_AGENT_STATE_LABELS.running);
    expect(next).not.toContain(DEV_AGENT_STATE_LABELS.queued);
  });

  it('getDevAgentStateLabel finds state', () => {
    expect(getDevAgentStateLabel(['foo', DEV_AGENT_STATE_LABELS.awaitingHuman])).toBe(
      DEV_AGENT_STATE_LABELS.awaitingHuman,
    );
  });

  it('filterIssuesByDevAgentPath', () => {
    const issues = [
      { body: buildDevAgentIssueBody({ path: 'a.js', kind: 'feature', message: 'x' }) },
      { body: buildDevAgentIssueBody({ path: 'b.js', kind: 'feature', message: 'y' }) },
    ];
    const f = filterIssuesByDevAgentPath(issues, 'a.js');
    expect(f).toHaveLength(1);
  });

  it('filterIssuesByDevAgentPath matches case-insensitively and trims', () => {
    const issues = [
      { body: buildDevAgentIssueBody({ path: 'classes/Bard.js', kind: 'feature', message: 'x' }) },
    ];
    expect(filterIssuesByDevAgentPath(issues, '  classes/bard.js  ')).toHaveLength(1);
  });

  it('normalizeDevAgentRelPath', () => {
    expect(normalizeDevAgentRelPath('./classes/Foo.js')).toBe('classes/Foo.js');
    expect(normalizeDevAgentRelPath('a\\b.js')).toBe('a/b.js');
  });

  it('extractDevAgentPathFromIssueTitle', () => {
    expect(extractDevAgentPathFromIssueTitle('[dh-dev-agent] bug: classes/Bard.js')).toBe('classes/Bard.js');
    expect(extractDevAgentPathFromIssueTitle('other')).toBe(null);
  });

  it('buildOpenIssuesSearchQuery', () => {
    const q = buildOpenIssuesSearchQuery('o', 'r', ['dh-dev-agent']);
    expect(q).toContain('repo:o/r');
    expect(q).toContain('label:dh-dev-agent');
  });

  it('mergeIssuesByNumber dedupes', () => {
    const a = [{ number: 1, created_at: '2020-01-01', title: 'x' }];
    const b = [{ number: 1, created_at: '2020-01-01', title: 'y' }];
    expect(mergeIssuesByNumber(a, b)).toHaveLength(1);
  });

  it('filterIssuesByDevAgentPath falls back to title when body missing', () => {
    const issues = [{ title: '[dh-dev-agent] feature: classes/Z.js', body: 'no json here' }];
    expect(filterIssuesByDevAgentPath(issues, 'classes/Z.js')).toHaveLength(1);
  });

  it('isGithubIssueWriteForbidden', () => {
    expect(
      isGithubIssueWriteForbidden(new Error('GitHub PATCH /repos/o/r/issues/1 → 403: Resource not accessible')),
    ).toBe(true);
    expect(isGithubIssueWriteForbidden(new Error('GitHub GET → 404: Not Found'))).toBe(false);
  });

  it('extractPullNumberFromText', () => {
    expect(extractPullNumberFromText('see https://github.com/o/r/pull/42 ok')).toBe(42);
    expect(extractPullNumberFromText('Dev agent opened PR: pull/7')).toBe(7);
    expect(extractPullNumberFromText('no pr')).toBe(null);
  });
});
