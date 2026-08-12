import { describe, it, expect } from 'vitest';
import {
  ACTION_LOG_DICE_BUILDER_MAX_HEIGHT,
  ACTION_LOG_LIST_MAX_HEIGHT,
  ACTION_LOG_PANEL_MAX_HEIGHT,
  DIE_CONTROL_COLUMN_MIN_WIDTH_CLASS,
  DIE_CONTROL_COLUMN_MIN_WIDTH_PX,
  DIE_TYPE_LABEL_HEIGHT_CLASS,
  dieControlsNeedWrap,
} from '../../src/client/lib/action-log-layout.js';
import { MANUAL_DICE_SIZES } from '../../src/client/lib/manual-dice-roll-text.js';

describe('action-log-layout', () => {
  it('caps the expanded log well below a near-full viewport so the dice builder stays visible', () => {
    // Former bug: maxHeight was min(680px, 85vh), which pushed the dice roller off-screen.
    expect(ACTION_LOG_LIST_MAX_HEIGHT).not.toMatch(/85vh|680px/);
    expect(ACTION_LOG_LIST_MAX_HEIGHT).toMatch(/360px/);
    expect(ACTION_LOG_LIST_MAX_HEIGHT).toMatch(/40dvh/);
    expect(ACTION_LOG_PANEL_MAX_HEIGHT).toMatch(/100dvh/);
    expect(ACTION_LOG_DICE_BUILDER_MAX_HEIGHT).toMatch(/rem/);
  });

  it('gives die-control columns a min width large enough for − / count / +', () => {
    expect(DIE_CONTROL_COLUMN_MIN_WIDTH_PX).toBeGreaterThanOrEqual(72);
    expect(DIE_CONTROL_COLUMN_MIN_WIDTH_CLASS).toBe(`min-w-[${DIE_CONTROL_COLUMN_MIN_WIDTH_PX / 16}rem]`);
  });

  it('uses a compact die-type label height (not the former h-9)', () => {
    expect(DIE_TYPE_LABEL_HEIGHT_CLASS).toBe('h-6');
    expect(DIE_TYPE_LABEL_HEIGHT_CLASS).not.toBe('h-9');
  });

  it('detects when Duality + die sizes + modifier must wrap on a narrow container', () => {
    const columnCount = 1 + MANUAL_DICE_SIZES.length + 1; // Duality, dice, modifier
    // Wide enough for one row
    expect(dieControlsNeedWrap(900, columnCount)).toBe(false);
    // Narrow center column (typical when sidebars eat the width) needs a second row
    expect(dieControlsNeedWrap(420, columnCount)).toBe(true);
  });
});
