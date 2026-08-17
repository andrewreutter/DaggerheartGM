import { describe, it, expect } from 'vitest';
import {
  computeMapDrawCanvasSize,
  ftToDrawPixel,
  drawPixelToFt,
  scribbleCanvasLayoutKey,
  DEFAULT_MAP_DRAW_BRUSH_RADIUS_FT,
  hexToRgba,
  strokeDrawSegment,
  alphaFromRgbaString,
  ERASER_DESTINATION_OUT,
  eraseSourceRgba,
  rgbStringFromRgba,
  floodEraseConnectedComponent,
  multiplyRgbaAlpha,
  isNonDegenerateScribbleSegmentPx,
  shouldSkipDrawOverlayReload,
  loadDrawDataUrlOntoCanvas,
} from '../../src/client/lib/map-draw-layer.js';

describe('map-draw-layer', () => {
  it('computeMapDrawCanvasSize caps longest edge', () => {
    const { w, h } = computeMapDrawCanvasSize(500, 500);
    expect(Math.max(w, h)).toBeLessThanOrEqual(1024);
    expect(w).toBe(h);
  });

  it('ftToDrawPixel maps corners', () => {
    const sz = computeMapDrawCanvasSize(100, 50);
    expect(ftToDrawPixel(0, 0, 100, 50, sz)).toEqual({ x: 0, y: 0 });
    expect(ftToDrawPixel(100, 50, 100, 50, sz)).toEqual({ x: sz.w, y: sz.h });
  });

  it('drawPixelToFt round-trips with ftToDrawPixel for scribble broadcast coords', () => {
    const sz = computeMapDrawCanvasSize(80, 60);
    const px = { x: sz.w * 0.25, y: sz.h * 0.75 };
    const ft = drawPixelToFt(px.x, px.y, 80, 60, sz);
    const back = ftToDrawPixel(ft.x, ft.y, 80, 60, sz);
    expect(back.x).toBeCloseTo(px.x, 5);
    expect(back.y).toBeCloseTo(px.y, 5);
  });

  it('scribbleCanvasLayoutKey ignores unrelated mapConfig churn (stable for same map + image)', () => {
    expect(scribbleCanvasLayoutKey(100, 80, 'https://x/a.png')).toBe(scribbleCanvasLayoutKey(100, 80, 'https://x/a.png'));
  });

  it('DEFAULT_MAP_DRAW_BRUSH_RADIUS_FT matches prior default', () => {
    expect(DEFAULT_MAP_DRAW_BRUSH_RADIUS_FT).toBe(7.5);
  });

  it('hexToRgba converts hex and clamps alpha', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    expect(hexToRgba('#00ff00', 2)).toBe('rgba(0,255,0,1)');
  });

  it('alphaFromRgbaString reads opacity from rgba string', () => {
    expect(alphaFromRgbaString('rgba(1,2,3,0.35)')).toBeCloseTo(0.35);
    expect(alphaFromRgbaString('rgba(255, 0, 0, 1)')).toBe(1);
  });

  it('multiplyRgbaAlpha scales alpha and clamps', () => {
    expect(multiplyRgbaAlpha('rgba(100, 50, 25, 0.8)', 0.5)).toBe('rgba(100,50,25,0.4)');
    expect(multiplyRgbaAlpha('rgba(0, 0, 0, 1)', 0)).toBe('rgba(0,0,0,0)');
  });

  it('isNonDegenerateScribbleSegmentPx rejects missing or zero-length segments', () => {
    expect(isNonDegenerateScribbleSegmentPx(null, { x: 1, y: 1 })).toBe(false);
    expect(isNonDegenerateScribbleSegmentPx({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
    expect(isNonDegenerateScribbleSegmentPx({ x: 0, y: 0 }, { x: 0.6, y: 0 })).toBe(true);
  });

  it('rgbStringFromRgba strips alpha for globalAlpha pairing', () => {
    expect(rgbStringFromRgba('rgba(99,88,77,0.25)')).toBe('rgb(99,88,77)');
  });

  it('ERASER_DESTINATION_OUT is full-alpha destination-out source', () => {
    expect(ERASER_DESTINATION_OUT).toBe('rgba(0,0,0,1)');
  });

  it('eraseSourceRgba ignores brush opacity (same as ERASER_DESTINATION_OUT)', () => {
    expect(eraseSourceRgba('rgba(99,88,77,0.25)')).toBe(ERASER_DESTINATION_OUT);
  });

  it('strokeDrawSegment uses rgb + globalAlpha for brush so opacity applies without segment overlap artifacts', () => {
    const alphas = [];
    const styles = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      set globalAlpha(v) {
        alphas.push(v);
      },
      set strokeStyle(v) {
        styles.push(v);
      },
      set globalCompositeOperation(_) {},
      lineCap: '',
      lineJoin: '',
      lineWidth: 0,
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
    };
    strokeDrawSegment(ctx, 0, 0, 5, 5, 3, 'brush', 'rgba(10,20,30,0.9)');
    expect(styles).toContain('rgb(10,20,30)');
    expect(alphas).toContain(0.9);
  });

  it('strokeDrawSegment eraser ignores brush opacity (full destination-out)', () => {
    const styles = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      set strokeStyle(v) {
        styles.push(v);
      },
      set globalCompositeOperation(_) {},
      lineCap: '',
      lineJoin: '',
      lineWidth: 0,
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
    };
    strokeDrawSegment(ctx, 0, 0, 5, 5, 3, 'eraser', 'rgba(255,0,0,0.4)');
    expect(styles).toContain(ERASER_DESTINATION_OUT);
  });

  it('floodEraseConnectedComponent clears 4-connected opaque region', () => {
    const w = 8;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 2; x++) {
        const i = (y * w + x) * 4;
        data[i] = 200;
        data[i + 1] = 10;
        data[i + 2] = 10;
        data[i + 3] = 255;
      }
    }
    const ctx = {
      getImageData() {
        return { data, width: w, height: h };
      },
      putImageData(img) {
        data.set(img.data);
      },
    };
    const ok = floodEraseConnectedComponent(ctx, w, h, 1.2, 1.8);
    expect(ok).toBe(true);
    expect(data[(1 * w + 1) * 4 + 3]).toBe(0);
    expect(data[(2 * w + 2) * 4 + 3]).toBe(0);
  });

  it('shouldSkipDrawOverlayReload keeps live pixels after a local overlay commit URL swap', () => {
    expect(shouldSkipDrawOverlayReload({
      strokeActive: false,
      sizeChanged: false,
      canvasAuthoritative: true,
      sourceUrl: 'https://cdn/overlay.png',
      lastLoadedUrl: 'data:image/png;base64,aaa',
    })).toBe(true);
  });

  it('shouldSkipDrawOverlayReload reloads when the canvas size changes', () => {
    expect(shouldSkipDrawOverlayReload({
      strokeActive: false,
      sizeChanged: true,
      canvasAuthoritative: true,
      sourceUrl: 'https://cdn/overlay.png',
      lastLoadedUrl: 'data:image/png;base64,aaa',
    })).toBe(false);
  });

  it('loadDrawDataUrlOntoCanvas does not reset canvas.width when size already matches', async () => {
    let widthSets = 0;
    const canvas = {
      _w: 12,
      _h: 8,
      get width() { return this._w; },
      set width(v) { widthSets += 1; this._w = v; },
      get height() { return this._h; },
      set height(v) { this._h = v; },
      getContext: () => ({ clearRect() {}, drawImage() {} }),
    };
    await loadDrawDataUrlOntoCanvas(null, canvas, { w: 12, h: 8 });
    expect(widthSets).toBe(0);
  });
});
