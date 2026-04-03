import { describe, it, expect } from 'vitest';
import { shouldAutoOpenCharacterEditorForIncompleteCharacter } from '../../src/client/lib/game-table-incomplete-character-auto-editor.js';

describe('shouldAutoOpenCharacterEditorForIncompleteCharacter', () => {
  const base = {
    viewerCanEditSheet: true,
    isCharacterComplete: false,
    editState: null,
    characterInstanceId: 'inst-1',
  };

  it('returns true when GM can edit, character incomplete, editor not open', () => {
    expect(shouldAutoOpenCharacterEditorForIncompleteCharacter(base)).toBe(true);
  });

  it('returns false when viewer cannot edit', () => {
    expect(
      shouldAutoOpenCharacterEditorForIncompleteCharacter({
        ...base,
        viewerCanEditSheet: false,
      }),
    ).toBe(false);
  });

  it('returns false when character is complete', () => {
    expect(
      shouldAutoOpenCharacterEditorForIncompleteCharacter({
        ...base,
        isCharacterComplete: true,
      }),
    ).toBe(false);
  });

  it('returns false when the character editor is already open for that instance', () => {
    expect(
      shouldAutoOpenCharacterEditorForIncompleteCharacter({
        ...base,
        editState: {
          step: 'form',
          presentation: 'rightDrawer',
          collection: 'characters',
          baseElement: { instanceId: 'inst-1' },
        },
      }),
    ).toBe(false);
  });

  it('returns true when editor is open for a different character', () => {
    expect(
      shouldAutoOpenCharacterEditorForIncompleteCharacter({
        ...base,
        editState: {
          step: 'form',
          presentation: 'rightDrawer',
          collection: 'characters',
          baseElement: { instanceId: 'other' },
        },
      }),
    ).toBe(true);
  });
});
