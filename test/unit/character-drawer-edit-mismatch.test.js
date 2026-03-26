import { describe, it, expect } from 'vitest';
import {
  characterDrawerEditMismatch,
  shouldSuppressCharacterOverlayOutsideDismiss,
} from '../../src/client/lib/character-drawer-edit-mismatch.js';

describe('characterDrawerEditMismatch', () => {
  const baseEdit = {
    step: 'form',
    presentation: 'rightDrawer',
    collection: 'characters',
    baseElement: { instanceId: 'a' },
    instances: [{ instanceId: 'a' }],
  };

  it('is false when not right-drawer character form', () => {
    expect(
      characterDrawerEditMismatch(
        { ...baseEdit, presentation: 'center' },
        { isOpen: true, data: { element: { instanceId: 'b' } } },
      ),
    ).toBe(false);
  });

  it('is false when pinned instance matches edit session', () => {
    expect(
      characterDrawerEditMismatch(baseEdit, { isOpen: true, data: { element: { instanceId: 'a' } } }),
    ).toBe(false);
  });

  it('is true when pinned instance differs from edit session', () => {
    expect(
      characterDrawerEditMismatch(baseEdit, { isOpen: true, data: { element: { instanceId: 'b' } } }),
    ).toBe(true);
  });

  it('is false when overlay is closed', () => {
    expect(characterDrawerEditMismatch(baseEdit, { isOpen: false, data: { element: { instanceId: 'b' } } })).toBe(false);
  });
});

describe('shouldSuppressCharacterOverlayOutsideDismiss', () => {
  const baseEdit = {
    step: 'form',
    presentation: 'rightDrawer',
    collection: 'characters',
    baseElement: { instanceId: 'a' },
  };

  it('is true when character drawer is open without mismatch', () => {
    expect(
      shouldSuppressCharacterOverlayOutsideDismiss(baseEdit, { isOpen: true, data: { element: { instanceId: 'a' } } }, false),
    ).toBe(true);
  });

  it('is false when overlay is closed', () => {
    expect(shouldSuppressCharacterOverlayOutsideDismiss(baseEdit, { isOpen: false }, false)).toBe(false);
  });

  it('is false when drawer session mismatches pinned sheet', () => {
    expect(
      shouldSuppressCharacterOverlayOutsideDismiss(baseEdit, { isOpen: true, data: { element: { instanceId: 'a' } } }, true),
    ).toBe(false);
  });
});
