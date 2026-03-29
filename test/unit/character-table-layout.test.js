import { describe, it, expect } from 'vitest';
import {
  CHARACTER_TABLE_CARD_AVAILABLE,
  CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR,
  CHARACTER_TABLE_SHEET_COLUMN_WIDTH,
  CHARACTER_TABLE_SHEET_COLUMN_WIDTH_WITH_EDITOR,
  characterTableUnifiedCardWidth,
} from '../../src/client/lib/character-table-layout.js';

describe('characterTableUnifiedCardWidth', () => {
  it('matches sheet column width when editor is closed', () => {
    expect(characterTableUnifiedCardWidth(false)).toBe(CHARACTER_TABLE_SHEET_COLUMN_WIDTH);
  });

  it('caps combined shell at min(86rem, available) when editor is open', () => {
    const w = characterTableUnifiedCardWidth(true);
    expect(w).toBe('min(86rem, calc(100vw - 14rem - 8px))');
  });
});

describe('dual-column widths', () => {
  it('exports shared available width for Game Table overlay alignment', () => {
    expect(CHARACTER_TABLE_CARD_AVAILABLE).toBe('calc(100vw - 14rem - 8px)');
  });

  it('uses proportional 44/86 and 42/86 factors when both columns are visible', () => {
    expect(CHARACTER_TABLE_SHEET_COLUMN_WIDTH_WITH_EDITOR).toContain('44 / 86');
    expect(CHARACTER_TABLE_EDITOR_DRAWER_WIDTH_WITH_EDITOR).toContain('42 / 86');
  });
});
