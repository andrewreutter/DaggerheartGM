import { describe, it, expect, vi } from 'vitest';
import { ensureEditorListIds } from '../../src/client/lib/ensure-editor-list-ids.js';

vi.mock('../../src/client/lib/helpers.js', () => ({
  generateId: vi.fn(() => 'test-id'),
}));

describe('ensureEditorListIds', () => {
  it('returns empty array for undefined (new adversary editor initial shape)', () => {
    expect(ensureEditorListIds(undefined)).toEqual([]);
  });

  it('assigns id to entries missing it', () => {
    expect(ensureEditorListIds([{ name: 'x', modifier: 1 }])).toEqual([
      { name: 'x', modifier: 1, id: 'test-id' },
    ]);
  });

  it('preserves existing ids', () => {
    expect(ensureEditorListIds([{ id: 'keep', name: 'x', modifier: 1 }])).toEqual([
      { id: 'keep', name: 'x', modifier: 1 },
    ]);
  });
});
