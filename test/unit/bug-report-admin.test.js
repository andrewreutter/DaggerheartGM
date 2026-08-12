import { describe, it, expect } from 'vitest';
import { BUG_REPORT_STATUSES } from '../../src/db.js';
import {
  BUG_REPORT_STATUS_ORDER,
  bugReportSelectionState,
  otherBugReportStatuses,
  setBugReportVisibleSelection,
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
