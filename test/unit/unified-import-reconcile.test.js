import { describe, it, expect } from 'vitest';
import {
  buildSliceDescriptors,
  reconcileSliceRows,
  defaultFullRect,
} from '../../src/client/lib/unified-import-reconcile.js';

describe('unified-import-reconcile', () => {
  it('buildSliceDescriptors creates stable text keys across body edits', () => {
    const d1 = buildSliceDescriptors([], [{ id: 't1', body: 'a' }]);
    const d2 = buildSliceDescriptors([], [{ id: 't1', body: 'ab' }]);
    expect(d1[0].structuralKey).toBe(d2[0].structuralKey);
    expect(d1[0].textBody).not.toBe(d2[0].textBody);
  });

  it('reconcileSliceRows merges text body without resetting when structuralKey matches', () => {
    const desc = buildSliceDescriptors([], [{ id: 't1', body: 'hello' }]);
    const defaults = (d) => ({ foo: 1, structuralKey: d.structuralKey });
    const first = reconcileSliceRows([], desc, defaults);
    expect(first[0].foo).toBe(1);
    const desc2 = buildSliceDescriptors([], [{ id: 't1', body: 'hello world' }]);
    const second = reconcileSliceRows(first, desc2, defaults);
    expect(second[0].foo).toBe(1);
    expect(second[0].textBody).toBe('hello world');
  });

  it('defaultFullRect covers image', () => {
    expect(defaultFullRect(100, 50)).toEqual({ x0: 0, y0: 0, x1: 100, y1: 50 });
  });

  it('buildSliceDescriptors passes editor OCR into slice descriptor for pipeline reuse', () => {
    const img = {
      id: 'asset-1',
      file: new File([], 'x.png'),
      layout: { width: 100, height: 100, dataUrl: 'data:image/png,abc', mime: 'image/png' },
      regions: [
        {
          id: 'reg-1',
          rect: { x0: 0, y0: 0, x1: 20, y1: 20 },
          ocrText: 'Goblin',
          ocrHasText: true,
          ocrComplete: true,
        },
      ],
    };
    const d = buildSliceDescriptors([img], []);
    expect(d[0].ocrPending).toBe(false);
    expect(d[0].ocrText).toBe('Goblin');
    expect(d[0].ocrHasText).toBe(true);
  });
});
