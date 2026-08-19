import { describe, expect, it } from 'vitest';
import {
  TOKEN_NAME_CHIP_HEIGHT_PX,
  collectTokenNameChipObstacles,
  estimateTokenNameChipSize,
  placeTokenNameChip,
  scoreTokenNameChipCandidate,
  segmentHitsRect,
} from '../../src/client/lib/token-name-chip-place.js';

const tokenRect = { x: 100, y: 100, w: 40, h: 40 };

describe('estimateTokenNameChipSize', () => {
  it('sizes the chip at about two-thirds of the original 16px chrome', () => {
    expect(TOKEN_NAME_CHIP_HEIGHT_PX).toBe(11);
    expect(estimateTokenNameChipSize('Vivius').height).toBe(11);
  });
});

describe('placeTokenNameChip', () => {
  it('defaults to the right of a lone token', () => {
    const placed = placeTokenNameChip({ tokenRect, name: 'Vivius' });
    expect(placed.side).toBe('right');
    expect(placed.x).toBeGreaterThan(tokenRect.x + tokenRect.w);
  });

  it('moves off the right when another token sits there', () => {
    const placed = placeTokenNameChip({
      tokenRect,
      name: 'Vivius',
      obstacles: [{ x: 146, y: 100, w: 40, h: 40 }],
    });
    expect(placed.side).toBe('top');
  });

  it('treats left as last resort so it stays off the altitude control', () => {
    const blockers = [
      { x: 146, y: 90, w: 80, h: 60 },
      { x: 80, y: 50, w: 80, h: 40 },
      { x: 80, y: 150, w: 80, h: 40 },
      { x: 146, y: 50, w: 40, h: 40 },
      { x: 146, y: 150, w: 40, h: 40 },
      { x: 50, y: 50, w: 40, h: 40 },
      { x: 50, y: 150, w: 40, h: 40 },
    ];
    const placed = placeTokenNameChip({ tokenRect, name: 'Vivius', obstacles: blockers });
    expect(placed.side).toBe('left');
  });
});

describe('segmentHitsRect', () => {
  it('detects a distance line through a candidate chip', () => {
    expect(segmentHitsRect(120, 120, 200, 120, { x: 146, y: 110, w: 40, h: 16 })).toBe(true);
    expect(segmentHitsRect(120, 120, 200, 200, { x: 100, y: 70, w: 40, h: 16 })).toBe(false);
  });
});

describe('scoreTokenNameChipCandidate', () => {
  it('penalizes a chip that a connector line crosses', () => {
    const chip = { x: 146, y: 112, w: 40, h: 16 };
    const clear = scoreTokenNameChipCandidate(chip, [], null, []);
    const hit = scoreTokenNameChipCandidate(chip, [], null, [{ x1: 120, y1: 120, x2: 200, y2: 120 }]);
    expect(hit).toBeGreaterThan(clear);
  });
});

describe('collectTokenNameChipObstacles', () => {
  it('includes other tokens, the hovered altitude control, and distance labels', () => {
    const hovered = { instanceId: 'a', tokenX: 10, tokenY: 10, altitude: 0 };
    const other = { instanceId: 'b', tokenX: 30, tokenY: 10, altitude: 20 };
    const { obstacles, segments } = collectTokenNameChipObstacles({
      hoveredInstanceId: 'a',
      pxPerFt: 10,
      tokens: [
        { element: hovered, widthPx: 40, heightPx: 40 },
        { element: other, widthPx: 40, heightPx: 40 },
      ],
      connectors: [{
        instanceId: 'b',
        x1: 12, y1: 12, x2: 32, y2: 12,
        targetHalfWidthFt: 2.5,
        targetHalfLengthFt: 2.5,
        distanceFt: 20,
      }],
    });
    expect(obstacles.some((o) => o.kind === 'token')).toBe(true);
    const control = obstacles.find((o) => o.kind === 'altitude-control');
    expect(control).toBeTruthy();
    // Control overlaps the hovered token (right edge past token left).
    expect(control.x + control.w).toBeGreaterThan(hovered.tokenX * 10);
    expect(obstacles.some((o) => o.kind === 'stem')).toBe(true);
    expect(obstacles.some((o) => o.kind === 'distance-label')).toBe(true);
    expect(segments).toHaveLength(1);
  });
});
