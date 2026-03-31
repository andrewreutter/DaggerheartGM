import { describe, it, expect } from 'vitest';
import {
  BEASTBOUND_COMPANION_VIRTUAL_TOKEN_ID,
  collectMissingCompanionBoardTokenElements,
  hasCompanionBoardToken,
} from '../../src/client/lib/board-token-utils.js';

describe('board-token-utils', () => {
  it('collectMissingCompanionBoardTokenElements returns a boardToken row when Beastbound has companion and no token', () => {
    const parentId = 'char-instance-1';
    const activeElements = [
      {
        elementType: 'character',
        instanceId: parentId,
        subclassId: 'srd-sub-beastbound',
        companion: { name: 'Rex' },
      },
    ];
    const rows = collectMissingCompanionBoardTokenElements(activeElements);
    expect(rows).toHaveLength(1);
    expect(rows[0].elementType).toBe('boardToken');
    expect(rows[0].parentInstanceId).toBe(parentId);
    expect(rows[0].virtualTokenId).toBe(BEASTBOUND_COMPANION_VIRTUAL_TOKEN_ID);
    expect(rows[0].label).toBe('Rex');
  });

  it('collectMissingCompanionBoardTokenElements is empty when companion token already exists', () => {
    const parentId = 'char-instance-2';
    const tokenId = 'board-token-uuid';
    const activeElements = [
      {
        elementType: 'character',
        instanceId: parentId,
        subclassId: 'srd-sub-beastbound',
        companion: { name: 'Rex' },
      },
      {
        elementType: 'boardToken',
        instanceId: tokenId,
        parentInstanceId: parentId,
        virtualTokenId: BEASTBOUND_COMPANION_VIRTUAL_TOKEN_ID,
        tokenKind: 'companion',
        label: 'Rex',
      },
    ];
    expect(hasCompanionBoardToken(activeElements, parentId)).toBe(true);
    expect(collectMissingCompanionBoardTokenElements(activeElements)).toHaveLength(0);
  });

  it('collectMissingCompanionBoardTokenElements ignores non-Beastbound or missing companion', () => {
    expect(
      collectMissingCompanionBoardTokenElements([
        { elementType: 'character', instanceId: 'a', subclassId: 'srd-sub-hunter', companion: {} },
      ]),
    ).toHaveLength(0);
    expect(
      collectMissingCompanionBoardTokenElements([
        { elementType: 'character', instanceId: 'b', subclassId: 'srd-sub-beastbound' },
      ]),
    ).toHaveLength(0);
  });
});
