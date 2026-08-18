import { describe, it, expect } from 'vitest';
import {
  pixelCropFromVisibleNorm,
  computeTablePreviewVisualHash,
  layoutPreviewTokens,
  TABLE_PREVIEW_WIDTH,
  TABLE_PREVIEW_HEIGHT,
} from '../../src/client/lib/table-preview-frame.js';
import { previewTokensSvgBuffer, compositeTablePreviewPng } from '../../src/server/table-preview.js';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('pixelCropFromVisibleNorm', () => {
  it('returns full image when norm is missing', () => {
    expect(pixelCropFromVisibleNorm(null, 100, 50)).toEqual({ left: 0, top: 0, width: 100, height: 50 });
  });

  it('crops to the camera rect', () => {
    expect(pixelCropFromVisibleNorm({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 200, 100)).toEqual({
      left: 50,
      top: 25,
      width: 100,
      height: 50,
    });
  });
});

describe('computeTablePreviewVisualHash', () => {
  const base = {
    activeMapId: 'm1',
    maps: [{ id: 'm1', mapImageUrl: 'https://cdn/map.png' }],
    gmActiveViewId: 'v1',
    mapViews: [{ id: 'v1', mapId: 'm1', mapViewVisibleNorm: { x: 0, y: 0, w: 1, h: 1 } }],
    elements: [
      { instanceId: 'c1', elementType: 'character', name: 'Briar', tokenX: 10.4, tokenY: 20.4, mapId: 'm1', imageUrl: 'https://cdn/p.png' },
    ],
  };

  it('is stable when token feet round to the same 1′', () => {
    const a = computeTablePreviewVisualHash(base);
    const b = computeTablePreviewVisualHash({
      ...base,
      elements: [{ ...base.elements[0], tokenX: 10.1, tokenY: 20.4 }],
    });
    expect(a).toBe(b);
  });

  it('changes when the portrait URL or camera changes', () => {
    const a = computeTablePreviewVisualHash(base);
    const portrait = computeTablePreviewVisualHash({
      ...base,
      elements: [{ ...base.elements[0], imageUrl: 'https://cdn/other.png' }],
    });
    const camera = computeTablePreviewVisualHash({
      ...base,
      mapViews: [{ id: 'v1', mapId: 'm1', mapViewVisibleNorm: { x: 0.1, y: 0, w: 0.5, h: 0.5 } }],
    });
    expect(portrait).not.toBe(a);
    expect(camera).not.toBe(a);
  });
});

describe('layoutPreviewTokens', () => {
  it('places a default 5×5 token at map origin in the top-left of the preview', () => {
    const tokens = layoutPreviewTokens({
      maps: [{ id: 'm1', mapSizeFt: 100, mapDimension: 'width' }],
      activeMapId: 'm1',
      elements: [
        { instanceId: 'c1', elementType: 'character', tokenX: 0, tokenY: 0, mapId: 'm1' },
      ],
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].cx).toBeCloseTo((2.5 / 100) * TABLE_PREVIEW_WIDTH, 5);
    expect(tokens[0].cy).toBeCloseTo((2.5 / 100) * TABLE_PREVIEW_HEIGHT, 5);
    expect(tokens[0].fill).toMatch(/^#/);
  });
});

describe('compositeTablePreviewPng', () => {
  it('composites a tiny map fixture into a 16:9 PNG', async () => {
    const png = await compositeTablePreviewPng(
      {
        maps: [{ id: 'm1', mapImageUrl: 'https://example.test/map.png', mapSizeFt: 50 }],
        activeMapId: 'm1',
        elements: [
          { instanceId: 'c1', elementType: 'character', tokenX: 10, tokenY: 10, mapId: 'm1' },
        ],
      },
      { fetchFn: async () => ({ ok: true, arrayBuffer: async () => ONE_PX_PNG }) },
    );
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(previewTokensSvgBuffer([{ cx: 10, cy: 10, rx: 3, ry: 3, fill: '#0284c7' }]).toString()).toContain('ellipse');
  });

  it('renders a dark placeholder when there is no map art', async () => {
    const png = await compositeTablePreviewPng({ maps: [], elements: [] });
    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
