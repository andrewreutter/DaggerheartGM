import { describe, it, expect } from 'vitest';
import {
  altitudeControlExpandLeftPx,
  ALTITUDE_CONTROL_OVERLAP_PX,
  ALTITUDE_CONTROL_WIDTH_PX,
  ALTITUDE_STEP_FT,
  altitudeDragPxPerStep,
  altitudeStemOffsetPx,
  computeAltitudeStepsFromDragDeltaPx,
  formatAltitudeFt,
  isPointInExpandedHoverZone,
  bullseyeCenterWithAltitudePreview,
} from '../../src/client/lib/token-altitude.js';

describe('formatAltitudeFt', () => {
  it('formats positive, negative, and zero altitudes', () => {
    expect(formatAltitudeFt(50)).toBe("50'");
    expect(formatAltitudeFt(-20)).toBe("-20'");
    expect(formatAltitudeFt(0)).toBe("0'");
  });

  it('treats non-numeric input as 0', () => {
    expect(formatAltitudeFt(undefined)).toBe("0'");
    expect(formatAltitudeFt(null)).toBe("0'");
    expect(formatAltitudeFt(NaN)).toBe("0'");
  });
});

describe('computeAltitudeStepsFromDragDeltaPx', () => {
  it('returns 0 for no movement', () => {
    expect(computeAltitudeStepsFromDragDeltaPx(0, 10)).toBe(0);
  });

  it('positive delta (pointer moved up) yields positive steps', () => {
    expect(computeAltitudeStepsFromDragDeltaPx(10, 10)).toBe(1);
    expect(computeAltitudeStepsFromDragDeltaPx(25, 10)).toBe(3);
  });

  it('negative delta (pointer moved down) yields negative steps', () => {
    expect(computeAltitudeStepsFromDragDeltaPx(-10, 10)).toBe(-1);
  });

  it('returns 0 for invalid pxPerStep', () => {
    expect(computeAltitudeStepsFromDragDeltaPx(20, 0)).toBe(0);
    expect(computeAltitudeStepsFromDragDeltaPx(20, -5)).toBe(0);
    expect(computeAltitudeStepsFromDragDeltaPx(20, NaN)).toBe(0);
  });

  it('ALTITUDE_STEP_FT is 5', () => {
    expect(ALTITUDE_STEP_FT).toBe(5);
  });

  it('altitude control overlaps the token and extends less than its full width to the left', () => {
    expect(ALTITUDE_CONTROL_OVERLAP_PX).toBeGreaterThan(0);
    expect(altitudeControlExpandLeftPx()).toBe(
      ALTITUDE_CONTROL_WIDTH_PX - ALTITUDE_CONTROL_OVERLAP_PX,
    );
    expect(altitudeControlExpandLeftPx()).toBeLessThan(ALTITUDE_CONTROL_WIDTH_PX);
  });
});

describe('altitudeStemOffsetPx', () => {
  it('is altitude feet times map scale (1 ft of height = 1 ft on the map)', () => {
    expect(altitudeStemOffsetPx(50, 6.6)).toBeCloseTo(330);
    expect(altitudeStemOffsetPx(-20, 6.6)).toBeCloseTo(-132);
    expect(altitudeStemOffsetPx(0, 6.6)).toBe(0);
  });

  it('returns 0 for invalid scale or altitude', () => {
    expect(altitudeStemOffsetPx(50, 0)).toBe(0);
    expect(altitudeStemOffsetPx(50, -1)).toBe(0);
    expect(altitudeStemOffsetPx(NaN, 6.6)).toBe(0);
  });
});

describe('altitudeDragPxPerStep', () => {
  it('one 5′ step of pointer travel equals one 5′ of stem in screen pixels', () => {
    const pxPerFt = 6.6;
    const viewZoom = 1.5;
    expect(altitudeDragPxPerStep(pxPerFt, viewZoom)).toBeCloseTo(
      altitudeStemOffsetPx(ALTITUDE_STEP_FT, pxPerFt) * viewZoom,
    );
  });

  it('returns 0 for invalid scale', () => {
    expect(altitudeDragPxPerStep(0, 1)).toBe(0);
    expect(altitudeDragPxPerStep(6.6, 0)).toBe(0);
  });
});

describe('isPointInExpandedHoverZone', () => {
  const token = {
    tokenLeftPx: 100,
    tokenTopPx: 50,
    tokenWidthPx: 33,
    tokenHeightPx: 33,
    expandLeftPx: altitudeControlExpandLeftPx(),
  };

  it('is true for a point inside the token footprint', () => {
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: 60, ...token })).toBe(true);
  });

  it('is true for a point in the expanded left control zone', () => {
    const leftEdge = token.tokenLeftPx - token.expandLeftPx + 1;
    expect(isPointInExpandedHoverZone({ pointX: leftEdge, pointY: 60, ...token })).toBe(true);
  });

  it('is false for a point left of the expanded zone', () => {
    const tooFarLeft = token.tokenLeftPx - token.expandLeftPx - 1;
    expect(isPointInExpandedHoverZone({ pointX: tooFarLeft, pointY: 60, ...token })).toBe(false);
  });

  it('is false for a point above or below the token', () => {
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: 40, ...token })).toBe(false);
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: 90, ...token })).toBe(false);
  });

  it('extends upward to a positive stem tip', () => {
    const withStem = { ...token, stemOffsetPx: 80 };
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: 10, ...withStem })).toBe(true);
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: -20, ...withStem })).toBe(false);
  });

  it('extends downward to a negative stem tip', () => {
    const withStem = { ...token, stemOffsetPx: -80 };
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: 140, ...withStem })).toBe(true);
    expect(isPointInExpandedHoverZone({ pointX: 110, pointY: 180, ...withStem })).toBe(false);
  });
});

describe('bullseyeCenterWithAltitudePreview', () => {
  const center = { x: 10, y: 20, altitude: 0, excludeInstanceId: 'tok-a' };

  it('returns the center unchanged when there is no preview', () => {
    expect(bullseyeCenterWithAltitudePreview(center, null)).toBe(center);
    expect(bullseyeCenterWithAltitudePreview(null, { instanceId: 'tok-a', altitude: 40 })).toBeNull();
  });

  it('ignores a preview for a different token', () => {
    expect(bullseyeCenterWithAltitudePreview(center, { instanceId: 'tok-b', altitude: 40 })).toBe(center);
  });

  it('overlays the preview altitude onto the snapped bullseye token', () => {
    expect(bullseyeCenterWithAltitudePreview(center, { instanceId: 'tok-a', altitude: 40 })).toEqual({
      x: 10,
      y: 20,
      altitude: 40,
      excludeInstanceId: 'tok-a',
    });
  });

  it('returns the same object when the preview altitude already matches', () => {
    const atForty = { ...center, altitude: 40 };
    expect(bullseyeCenterWithAltitudePreview(atForty, { instanceId: 'tok-a', altitude: 40 })).toBe(atForty);
  });
});
