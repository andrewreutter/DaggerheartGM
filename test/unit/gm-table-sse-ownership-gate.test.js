import { describe, it, expect } from 'vitest';
import { shouldStartGmTableRoomEffects } from '../../src/client/lib/gm-table-sse-ownership-gate.js';

describe('shouldStartGmTableRoomEffects', () => {
  it('allows GM after ownerUid hydrates for a secondary table', () => {
    expect(
      shouldStartGmTableRoomEffects({
        routeTableId: 'tbl-uuid',
        userUid: 'user-1',
        tableOwnerUid: 'user-1',
      }),
    ).toBe(true);
  });

  it('allows legacy primary URL before ownerUid hydrates', () => {
    expect(
      shouldStartGmTableRoomEffects({
        routeTableId: 'user-1',
        userUid: 'user-1',
        tableOwnerUid: undefined,
      }),
    ).toBe(true);
  });

  it('blocks another user table while ownerUid is still loading', () => {
    expect(
      shouldStartGmTableRoomEffects({
        routeTableId: 'gm-primary-as-table-id',
        userUid: 'invited-player',
        tableOwnerUid: undefined,
      }),
    ).toBe(false);
  });

  it('blocks when resolved owner is someone else', () => {
    expect(
      shouldStartGmTableRoomEffects({
        routeTableId: 'gm-primary-as-table-id',
        userUid: 'invited-player',
        tableOwnerUid: 'gm-primary-as-table-id',
      }),
    ).toBe(false);
  });
});
