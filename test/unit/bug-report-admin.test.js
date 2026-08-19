import { describe, it, expect } from 'vitest';
import { BUG_REPORT_STATUSES } from '../../src/db.js';
import {
  BUG_REPORT_STATUS_ORDER,
  DEFAULT_BUG_REPORT_COLUMNS,
  addBugReportColumn,
  bugReportSelectionState,
  isValidBugReportStatus,
  normalizeBugReportColumns,
  otherBugReportStatuses,
  reorderBugReportColumns,
  setBugReportVisibleSelection,
  normalizeManualBugReportCreate,
  resolveBugReportTab,
  slugifyBugReportColumnId,
  toggleBugReportSelection,
} from '../../src/client/lib/bug-report-admin.js';

describe('bug-report-admin statuses', () => {
  it('includes shipped after completed and cancelled at the end', () => {
    expect(BUG_REPORT_STATUS_ORDER).toEqual([
      'triage',
      'bug',
      'feature',
      'completed',
      'shipped',
      'cancelled',
    ]);
    expect(BUG_REPORT_STATUSES).toEqual([...BUG_REPORT_STATUS_ORDER]);
    expect(DEFAULT_BUG_REPORT_COLUMNS.map(c => c.id)).toEqual([...BUG_REPORT_STATUS_ORDER]);
  });

  it('otherBugReportStatuses omits the current tab', () => {
    expect(otherBugReportStatuses('completed')).toEqual([
      'triage',
      'bug',
      'feature',
      'shipped',
      'cancelled',
    ]);
    expect(otherBugReportStatuses('shipped')).not.toContain('shipped');
    expect(otherBugReportStatuses('cancelled')).toContain('shipped');
  });

  it('otherBugReportStatuses uses a custom column list', () => {
    const columns = [
      { id: 'triage', label: 'Triage' },
      { id: 'blocked', label: 'Blocked' },
    ];
    expect(otherBugReportStatuses('triage', columns)).toEqual(['blocked']);
    expect(otherBugReportStatuses('blocked', columns)).toEqual(['triage']);
  });
});

describe('bug-report-admin columns', () => {
  it('accepts built-in and custom status slugs', () => {
    expect(isValidBugReportStatus('triage')).toBe(true);
    expect(isValidBugReportStatus('in-progress')).toBe(true);
    expect(isValidBugReportStatus('Blocked')).toBe(false);
    expect(isValidBugReportStatus('1blocked')).toBe(false);
    expect(isValidBugReportStatus('')).toBe(false);
  });

  it('slugifies column names', () => {
    expect(slugifyBugReportColumnId('In Progress')).toBe('in-progress');
    expect(slugifyBugReportColumnId('  Needs Review  ')).toBe('needs-review');
    expect(slugifyBugReportColumnId('2nd pass')).toBe('col-2nd-pass');
    expect(slugifyBugReportColumnId('!!!')).toBe(null);
  });

  it('normalizes missing or empty input to the default columns', () => {
    expect(normalizeBugReportColumns(null)).toEqual(
      DEFAULT_BUG_REPORT_COLUMNS.map(c => ({ id: c.id, label: c.label }))
    );
    expect(normalizeBugReportColumns([])).toEqual(
      DEFAULT_BUG_REPORT_COLUMNS.map(c => ({ id: c.id, label: c.label }))
    );
  });

  it('drops invalid or duplicate column rows', () => {
    expect(normalizeBugReportColumns([
      { id: 'blocked', label: 'Blocked' },
      { id: 'Blocked', label: 'Nope' },
      { id: 'blocked', label: 'Again' },
      { label: 'Needs Review' },
      null,
    ])).toEqual([
      { id: 'blocked', label: 'Blocked' },
      { id: 'needs-review', label: 'Needs Review' },
    ]);
  });

  it('adds a column with a unique slug', () => {
    const added = addBugReportColumn(DEFAULT_BUG_REPORT_COLUMNS, 'In Progress');
    expect(added.ok).toBe(true);
    expect(added.column).toEqual({ id: 'in-progress', label: 'In Progress' });
    expect(added.columns.at(-1)).toEqual(added.column);
  });

  it('suffixes colliding slugs instead of rejecting the add', () => {
    const added = addBugReportColumn(DEFAULT_BUG_REPORT_COLUMNS, 'Bug');
    expect(added.ok).toBe(true);
    expect(added.column).toEqual({ id: 'bug-2', label: 'Bug' });
  });

  it('rejects a blank column name', () => {
    const added = addBugReportColumn(DEFAULT_BUG_REPORT_COLUMNS, '   ');
    expect(added.ok).toBe(false);
    expect(added.error).toBe('Name is required');
  });

  it('reorders columns by index', () => {
    const columns = [
      { id: 'triage', label: 'Triage' },
      { id: 'bug', label: 'Bug' },
      { id: 'feature', label: 'Feature' },
    ];
    expect(reorderBugReportColumns(columns, 0, 2).map(c => c.id)).toEqual([
      'bug',
      'feature',
      'triage',
    ]);
    expect(reorderBugReportColumns(columns, 2, 0).map(c => c.id)).toEqual([
      'feature',
      'triage',
      'bug',
    ]);
    expect(reorderBugReportColumns(columns, 1, 1).map(c => c.id)).toEqual([
      'triage',
      'bug',
      'feature',
    ]);
  });
});

describe('bug-report-admin selection', () => {
  it('toggles a single id', () => {
    const once = toggleBugReportSelection([], 1);
    expect([...once]).toEqual([1]);
    const twice = toggleBugReportSelection(once, 1);
    expect([...twice]).toEqual([]);
  });

  it('reports all / some / none selected for visible rows', () => {
    expect(bugReportSelectionState(new Set([1, 2]), [1, 2])).toEqual({
      selectedCount: 2,
      allSelected: true,
      someSelected: false,
    });
    expect(bugReportSelectionState(new Set([1]), [1, 2])).toEqual({
      selectedCount: 1,
      allSelected: false,
      someSelected: true,
    });
    expect(bugReportSelectionState(new Set([9]), [1, 2])).toEqual({
      selectedCount: 0,
      allSelected: false,
      someSelected: false,
    });
  });

  it('select-all adds only visible ids; clear removes only visible ids', () => {
    const selected = setBugReportVisibleSelection(new Set([9]), [1, 2], true);
    expect(selected.has(1)).toBe(true);
    expect(selected.has(2)).toBe(true);
    expect(selected.has(9)).toBe(true);

    const cleared = setBugReportVisibleSelection(selected, [1, 2], false);
    expect(cleared.has(1)).toBe(false);
    expect(cleared.has(2)).toBe(false);
    expect(cleared.has(9)).toBe(true);
  });
});

describe('resolveBugReportTab', () => {
  it('keeps a stored slug that still exists in the column list', () => {
    expect(resolveBugReportTab('bug')).toBe('bug');
    expect(resolveBugReportTab('shipped')).toBe('shipped');
    expect(resolveBugReportTab('blocked', [
      { id: 'triage', label: 'Triage' },
      { id: 'blocked', label: 'Blocked' },
    ])).toBe('blocked');
  });

  it('falls back to the first column when the stored tab is missing or unknown', () => {
    expect(resolveBugReportTab(null)).toBe('triage');
    expect(resolveBugReportTab('')).toBe('triage');
    expect(resolveBugReportTab('no-such-column')).toBe('triage');
    expect(resolveBugReportTab('bug', [
      { id: 'feature', label: 'Feature' },
      { id: 'triage', label: 'Triage' },
    ])).toBe('feature');
  });
});

describe('normalizeManualBugReportCreate', () => {
  it('requires trimmed notes and a valid status slug', () => {
    expect(normalizeManualBugReportCreate({ notes: '  Ship portrait  ', status: 'triage' })).toEqual({
      ok: true,
      notes: 'Ship portrait',
      status: 'triage',
    });
    expect(normalizeManualBugReportCreate({ notes: '  ', status: 'bug' }).ok).toBe(false);
    expect(normalizeManualBugReportCreate({ notes: 'Need review', status: 'Blocked' }).ok).toBe(false);
    expect(normalizeManualBugReportCreate({ notes: 'Need review', status: 'in-progress' })).toEqual({
      ok: true,
      notes: 'Need review',
      status: 'in-progress',
    });
  });
});
