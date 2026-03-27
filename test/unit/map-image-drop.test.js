import { describe, it, expect } from 'vitest';
import {
  dataTransferHasFileDrag,
  pickFirstImageFileFromDataTransfer,
} from '../../src/client/lib/map-image-drop.js';

describe('map-image-drop', () => {
  it('dataTransferHasFileDrag is true when Files is in types', () => {
    expect(dataTransferHasFileDrag({ types: ['text/plain', 'Files'] })).toBe(true);
    expect(dataTransferHasFileDrag({ types: ['Files'] })).toBe(true);
  });

  it('dataTransferHasFileDrag is false when missing', () => {
    expect(dataTransferHasFileDrag(null)).toBe(false);
    expect(dataTransferHasFileDrag({ types: ['text/plain'] })).toBe(false);
  });

  it('pickFirstImageFileFromDataTransfer prefers image from files', () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const dt = { files: [png], items: [] };
    expect(pickFirstImageFileFromDataTransfer(dt)).toBe(png);
  });

  it('pickFirstImageFileFromDataTransfer skips non-images in files', () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const dt = { files: [txt, png], items: [] };
    expect(pickFirstImageFileFromDataTransfer(dt)).toBe(png);
  });

  it('pickFirstImageFileFromDataTransfer uses DataTransferItemList when files empty', () => {
    const png = new File(['x'], 'b.png', { type: 'image/png' });
    const item = {
      kind: 'file',
      type: 'image/png',
      getAsFile: () => png,
    };
    const dt = { files: [], items: [item] };
    expect(pickFirstImageFileFromDataTransfer(dt)).toBe(png);
  });
});
