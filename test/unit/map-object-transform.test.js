import { describe, it, expect } from 'vitest';
import {
  canModifyMapObject,
  computeCornerAnchor,
  computeCornerResize,
  MAP_OBJECT_Z_INDEX,
  MAP_OBJECT_Z_INDEX_MAX,
  mapObjectAreaFt,
  mapObjectStackZIndex,
  mapObjectUsesStrokeHitTest,
  battleMapEscapeResult,
  scaleBrushStroke,
  sortMapObjectsForStack,
  TOKEN_LAYER_Z_INDEX_MIN,
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

describe('mapObjectAreaFt', () => {
  it('uses widthFt × heightFt', () => {
    expect(mapObjectAreaFt({ widthFt: 10, heightFt: 4 })).toBe(40);
  });

  it('falls back to the mapImage default size when dimensions are missing', () => {
    expect(mapObjectAreaFt({ elementType: 'mapImage' })).toBe(20 * 20);
  });

  it('falls back to the drawShape default size when dimensions are missing', () => {
    expect(mapObjectAreaFt({ elementType: 'drawShape' })).toBe(4 * 4);
  });
});

describe('sortMapObjectsForStack', () => {
  it('puts the smaller object after the larger one so it paints and receives clicks on top', () => {
    const large = { instanceId: 'big', widthFt: 40, heightFt: 40, elementType: 'mapImage' };
    const small = { instanceId: 'small', widthFt: 8, heightFt: 8, elementType: 'drawShape' };
    expect(sortMapObjectsForStack([small, large]).map((el) => el.instanceId)).toEqual(['big', 'small']);
  });

  it('lets a small image sit above a large shape that was added later', () => {
    const largeShape = { instanceId: 'shape', widthFt: 50, heightFt: 30, elementType: 'drawShape' };
    const smallImage = { instanceId: 'img', widthFt: 6, heightFt: 6, elementType: 'mapImage' };
    expect(sortMapObjectsForStack([largeShape, smallImage]).map((el) => el.instanceId)).toEqual(['shape', 'img']);
  });

  it('breaks area ties by instanceId so order is stable', () => {
    const a = { instanceId: 'b-id', widthFt: 10, heightFt: 10 };
    const b = { instanceId: 'a-id', widthFt: 10, heightFt: 10 };
    expect(sortMapObjectsForStack([a, b]).map((el) => el.instanceId)).toEqual(['a-id', 'b-id']);
  });

  it('keeps the selected object last so its grips stay on top while editing', () => {
    const large = { instanceId: 'big', widthFt: 40, heightFt: 40 };
    const small = { instanceId: 'small', widthFt: 8, heightFt: 8 };
    expect(sortMapObjectsForStack([small, large], { selectedId: 'big' }).map((el) => el.instanceId)).toEqual(['small', 'big']);
  });
});

describe('mapObjectStackZIndex', () => {
  it('keeps unselected objects in the 22–28 band and selected at 29', () => {
    expect(mapObjectStackZIndex(0)).toBe(MAP_OBJECT_Z_INDEX);
    expect(mapObjectStackZIndex(3)).toBe(MAP_OBJECT_Z_INDEX + 3);
    expect(mapObjectStackZIndex(0, { selected: true })).toBe(MAP_OBJECT_Z_INDEX_MAX);
  });

  it('never reaches the token layer, even with many stacked objects', () => {
    expect(mapObjectStackZIndex(100)).toBe(MAP_OBJECT_Z_INDEX_MAX - 1);
    expect(mapObjectStackZIndex(100, { selected: true })).toBeLessThan(TOKEN_LAYER_Z_INDEX_MIN);
    expect(mapObjectStackZIndex(0, { selected: true })).toBeLessThan(TOKEN_LAYER_Z_INDEX_MIN);
    expect(TOKEN_LAYER_Z_INDEX_MIN).toBe(30);
  });
});

describe('battleMapEscapeResult', () => {
  it('clears map-object selection and the token pin', () => {
    const next = battleMapEscapeResult({ isPlayer: false });
    expect(next.selectedMapObjectId).toBeNull();
    expect(next.pinnedToken).toBeNull();
  });

  it('resets the draw tool to hand for the GM, not for a player', () => {
    expect(battleMapEscapeResult({ isPlayer: false }).resetDrawToolToHand).toBe(true);
    expect(battleMapEscapeResult({ isPlayer: true }).resetDrawToolToHand).toBe(false);
  });
});

describe('mapObjectUsesStrokeHitTest', () => {
  it('is false for images and filled shapes (full box is the hit target)', () => {
    expect(mapObjectUsesStrokeHitTest({ elementType: 'mapImage' })).toBe(false);
    expect(mapObjectUsesStrokeHitTest({ elementType: 'drawShape', shapeTool: 'rect', filled: true })).toBe(false);
  });

  it('is true for unfilled rect/oval and brush so empty bbox space does not steal clicks', () => {
    expect(mapObjectUsesStrokeHitTest({ elementType: 'drawShape', shapeTool: 'rect', filled: false })).toBe(true);
    expect(mapObjectUsesStrokeHitTest({ elementType: 'drawShape', shapeTool: 'oval' })).toBe(true);
    expect(mapObjectUsesStrokeHitTest({ elementType: 'drawShape', shapeTool: 'brush' })).toBe(true);
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
