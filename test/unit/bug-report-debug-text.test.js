import { describe, it, expect } from 'vitest';
import { buildBugReportDebugText } from '../../src/client/lib/bug-report-debug-text.js';

const BASE_ROW = {
  id: 42,
  gmUid: 'gm-uid-123',
  tableId: 'table-abc',
  createdAt: '2026-08-03T22:00:00.000Z',
  payload: {
    notes: 'Something went wrong',
    route: 'https://example.com/table/table-abc',
    capturedAt: '2026-08-03T22:00:01.000Z',
    _reportedByEmail: 'gm@example.com',
    _reportedByRole: 'gm',
    _serverTimestamp: '2026-08-03T22:00:02.000Z',
    _userAgent: 'Mozilla/5.0 Test',
    activeElementsSummary: [
      { instanceId: 'inst-1', elementType: 'character', name: 'Aria', currentHp: 3 },
    ],
    recentActionLog: [
      { timestamp: 1000, displayName: 'Aria', rollText: '1d20', total: 14 },
    ],
    recentConsoleErrors: [
      { ts: 1000, msg: 'Uncaught TypeError: foo is not a function' },
    ],
  },
};

describe('buildBugReportDebugText', () => {
  it('includes the report id in the heading', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('# Bug Report #42');
  });

  it('includes reporter email and role', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('gm@example.com');
    expect(text).toContain('gm');
  });

  it('includes table id and GM uid', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('table-abc');
    expect(text).toContain('gm-uid-123');
  });

  it('includes the notes', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('Something went wrong');
  });

  it('includes active elements as JSON', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('inst-1');
    expect(text).toContain('"elementType": "character"');
  });

  it('includes action log as JSON', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('rollText');
    expect(text).toContain('1d20');
  });

  it('includes console errors as JSON', () => {
    const text = buildBugReportDebugText(BASE_ROW);
    expect(text).toContain('foo is not a function');
  });

  it('uses createdAt as fallback when _serverTimestamp is absent', () => {
    const row = {
      ...BASE_ROW,
      payload: { ...BASE_ROW.payload, _serverTimestamp: undefined },
    };
    const text = buildBugReportDebugText(row);
    expect(text).toContain('2026-08-03T22:00:00.000Z');
  });

  it('omits empty sections gracefully', () => {
    const row = {
      ...BASE_ROW,
      payload: {
        _reportedByEmail: 'a@b.com',
        _reportedByRole: 'player',
      },
    };
    const text = buildBugReportDebugText(row);
    expect(text).not.toContain('## Notes');
    expect(text).not.toContain('## Recent Action Log');
    expect(text).not.toContain('## Active Elements Summary');
    expect(text).not.toContain('## Recent Console Errors');
  });
});
