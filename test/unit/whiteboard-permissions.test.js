/**
 * Unit tests for whiteboard shape ownership/permissions logic.
 *
 * The permission guards in Whiteboard.jsx use TLDraw side-effect handlers that are
 * plain functions with deterministic return values. This file tests those conditions
 * directly without requiring a real TLDraw editor or browser environment.
 *
 * Guard rules (player mode only):
 *   beforeChange: remote changes always pass; local changes blocked if owner ≠ uid or no owner.
 *   beforeDelete: remote changes always pass; local deletes blocked if owner ≠ uid or no owner.
 */
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers that mirror the guards defined in TldrawCanvas.handleMount
// ---------------------------------------------------------------------------

/**
 * Simulates the beforeChange handler used for player sessions.
 * Returns `prev` to block the change, `next` to allow it.
 */
function beforeChange(prev, next, source, userId) {
  if (source === 'remote') return next;
  const owner = next.meta?.createdBy;
  if (!owner || owner !== userId) return prev;
  return next;
}

/**
 * Simulates the beforeDelete handler used for player sessions.
 * Returns false to block the deletion, undefined to allow it.
 */
function beforeDelete(shape, source, userId) {
  if (source === 'remote') return undefined;
  const owner = shape.meta?.createdBy;
  if (!owner || owner !== userId) return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// beforeChange — player cannot modify shapes they don't own
// ---------------------------------------------------------------------------

describe('whiteboard beforeChange guard (player mode)', () => {
  const userId = 'player-uid';
  const prev = { id: 'shape1', x: 0, meta: { createdBy: 'gm-uid' } };

  it('allows remote changes regardless of ownership', () => {
    const next = { ...prev, x: 100 };
    expect(beforeChange(prev, next, 'remote', userId)).toBe(next);
  });

  it('blocks local changes to shapes owned by the GM', () => {
    const next = { ...prev, x: 100 };
    expect(beforeChange(prev, next, 'user', userId)).toBe(prev);
  });

  it('blocks local changes to shapes with no createdBy (legacy shapes)', () => {
    const noOwnerPrev = { id: 'shape2', x: 0, meta: {} };
    const noOwnerNext = { ...noOwnerPrev, x: 50 };
    expect(beforeChange(noOwnerPrev, noOwnerNext, 'user', userId)).toBe(noOwnerPrev);
  });

  it('blocks local changes to shapes where meta is absent', () => {
    const noMetaPrev = { id: 'shape3', x: 0 };
    const noMetaNext = { ...noMetaPrev, x: 50 };
    expect(beforeChange(noMetaPrev, noMetaNext, 'user', userId)).toBe(noMetaPrev);
  });

  it('allows local changes to shapes owned by the current player', () => {
    const ownPrev = { id: 'shape4', x: 0, meta: { createdBy: userId } };
    const ownNext = { ...ownPrev, x: 99 };
    expect(beforeChange(ownPrev, ownNext, 'user', userId)).toBe(ownNext);
  });
});

// ---------------------------------------------------------------------------
// beforeDelete — player cannot delete shapes they don't own
// ---------------------------------------------------------------------------

describe('whiteboard beforeDelete guard (player mode)', () => {
  const userId = 'player-uid';

  it('allows remote deletions regardless of ownership', () => {
    const shape = { id: 'shape1', meta: { createdBy: 'gm-uid' } };
    expect(beforeDelete(shape, 'remote', userId)).toBeUndefined();
  });

  it('blocks local deletion of shapes owned by the GM', () => {
    const shape = { id: 'shape1', meta: { createdBy: 'gm-uid' } };
    expect(beforeDelete(shape, 'user', userId)).toBe(false);
  });

  it('blocks local deletion of legacy shapes with no createdBy', () => {
    const shape = { id: 'shape2', meta: {} };
    expect(beforeDelete(shape, 'user', userId)).toBe(false);
  });

  it('blocks local deletion of shapes with no meta at all', () => {
    const shape = { id: 'shape3' };
    expect(beforeDelete(shape, 'user', userId)).toBe(false);
  });

  it('allows deletion of shapes owned by the current player', () => {
    const shape = { id: 'shape4', meta: { createdBy: userId } };
    expect(beforeDelete(shape, 'user', userId)).toBeUndefined();
  });
});
