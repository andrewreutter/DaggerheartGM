import { describe, it, expect } from 'vitest';
import {
  canModifyMapObject,
  computeCornerAnchor,
  computeCornerResize,
  scaleBrushStroke,
} from '../../src/client/lib/map-object-transform.js';

describe('canModifyMapObject', () => {
  it('GM can modify any object', () => {
    expect(canModifyMapObject({ createdByUid: 'other' }, { isPlayer: false, userUid: 'me' })).toBe(true);
    expect(canModifyMapObject({}, { isPlayer: false, userUid: 'me' })).toBe(true);
  });

  it('player can modify legacy objects with no createdByUid', () => {
    expect(canModifyMapObject({}, { isPlayer: true, userUid: 'me' })).toBe(true);
    expect(canModifyMapObject({ createdByUid: null }, { isPlayer: true, userUid: 'me' })).toBe(true);
  });

  it('player can modify only objects they created', () => {
    expect(canModifyMapObject({ createdByUid: 'me' }, { isPlayer: true, userUid: 'me' })).toBe(true);
    expect(canModifyMapObject({ createdByUid: 'other' }, { isPlayer: true, userUid: 'me' })).toBe(false);
  });
});

describe('computeCornerAnchor', () => {
  it('anchors the opposite corner for each dragged corner', () => {
    const args = { cx: 10, cy: 10, widthFt: 4, heightFt: 6 };
    expect(computeCornerAnchor({ corner: 'NW', ...args })).toEqual({ anchorX: 12, anchorY: 13 });
    expect(computeCornerAnchor({ corner: 'NE', ...args })).toEqual({ anchorX: 8, anchorY: 13 });
    expect(computeCornerAnchor({ corner: 'SW', ...args })).toEqual({ anchorX: 12, anchorY: 7 });
    expect(computeCornerAnchor({ corner: 'SE', ...args })).toEqual({ anchorX: 8, anchorY: 7 });
  });
});

describe('computeCornerResize', () => {
  it('free mode resizes width/height independently', () => {
    const res = computeCornerResize({
      mode: 'free',
      corner: 'SE',
      dxFt: 2,
      dyFt: 3,
      anchorX: 0,
      anchorY: 0,
      startWidthFt: 4,
      startHeightFt: 6,
    });
    expect(res.widthFt).toBe(6);
    expect(res.heightFt).toBe(9);
    expect(res.xFt).toBe(3);
    expect(res.yFt).toBe(4.5);
  });

  it('NW corner grows on negative drag (left/up)', () => {
    const res = computeCornerResize({
      mode: 'free',
      corner: 'NW',
      dxFt: -2,
      dyFt: -3,
      anchorX: 10,
      anchorY: 10,
      startWidthFt: 4,
      startHeightFt: 6,
    });
    expect(res.widthFt).toBe(6);
    expect(res.heightFt).toBe(9);
    expect(res.xFt).toBe(7);
    expect(res.yFt).toBe(5.5);
  });

  it('aspectLocked mode derives height from width via ratio, ignoring dyFt', () => {
    const res = computeCornerResize({
      mode: 'aspectLocked',
      corner: 'SE',
      dxFt: 4,
      dyFt: 999, // ignored in this mode
      anchorX: 0,
      anchorY: 0,
      startWidthFt: 10,
      startHeightFt: 5,
      ratio: 0.5,
    });
    expect(res.widthFt).toBe(14);
    expect(res.heightFt).toBe(7);
  });

  it('uniform mode behaves identically to aspectLocked', () => {
    const shared = {
      corner: 'NE',
      dxFt: -3,
      dyFt: 0,
      anchorX: 5,
      anchorY: 5,
      startWidthFt: 8,
      startHeightFt: 4,
      ratio: 0.5,
    };
    expect(computeCornerResize({ mode: 'uniform', ...shared })).toEqual(
      computeCornerResize({ mode: 'aspectLocked', ...shared }),
    );
  });

  it('clamps to minSizeFt', () => {
    const res = computeCornerResize({
      mode: 'free',
      corner: 'SE',
      dxFt: -100,
      dyFt: -100,
      anchorX: 0,
      anchorY: 0,
      startWidthFt: 4,
      startHeightFt: 4,
      minSizeFt: 1,
    });
    expect(res.widthFt).toBe(1);
    expect(res.heightFt).toBe(1);
  });
});

describe('scaleBrushStroke', () => {
  it('scales points and radius uniformly', () => {
    const result = scaleBrushStroke([{ x: 1, y: -2 }, { x: 3, y: 4 }], 0.5, 2);
    expect(result.pointsFt).toEqual([{ x: 2, y: -4 }, { x: 6, y: 8 }]);
    expect(result.radiusFt).toBe(1);
  });

  it('handles an empty/undefined points array', () => {
    expect(scaleBrushStroke(undefined, 0.5, 2).pointsFt).toEqual([]);
    expect(scaleBrushStroke([], 0.5, 2).pointsFt).toEqual([]);
  });
});
