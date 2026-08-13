import { describe, it, expect } from 'vitest';
import {
  ALTITUDE_CONTROL_GAP_PX,
  ALTITUDE_CONTROL_WIDTH_PX,
  ALTITUDE_STEP_FT,
  computeAltitudeStepsFromDragDeltaPx,
  formatAltitudeFt,
  isPointInExpandedHoverZone,
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
});

describe('isPointInExpandedHoverZone', () => {
  const token = {
    tokenLeftPx: 100,
    tokenTopPx: 50,
    tokenWidthPx: 33,
    tokenHeightPx: 33,
    expandLeftPx: ALTITUDE_CONTROL_WIDTH_PX + ALTITUDE_CONTROL_GAP_PX,
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
});
