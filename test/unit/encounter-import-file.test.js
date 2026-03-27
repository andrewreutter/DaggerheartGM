import { describe, it, expect } from 'vitest';
import {
  isEncounterImportImageFile,
  firstImageFileFromDataTransfer,
} from '../../src/client/lib/encounter-import-file.js';

describe('encounter-import-file', () => {
  it('isEncounterImportImageFile accepts standard MIME', () => {
    const f = new File(['x'], 'a.png', { type: 'image/png' });
    expect(isEncounterImportImageFile(f)).toBe(true);
  });

  it('isEncounterImportImageFile accepts empty MIME when extension looks like an image', () => {
    const f = new File(['x'], 'Screen Shot 2024-01-01.png', { type: '' });
    expect(isEncounterImportImageFile(f)).toBe(true);
  });

  it('isEncounterImportImageFile rejects empty MIME without image extension', () => {
    const f = new File(['x'], 'readme', { type: '' });
    expect(isEncounterImportImageFile(f)).toBe(false);
  });

  it('firstImageFileFromDataTransfer reads files list', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const dt = { files: [file], items: [] };
    expect(firstImageFileFromDataTransfer(dt)).toBe(file);
  });

  it('firstImageFileFromDataTransfer falls back to items', () => {
    const file = new File(['x'], 'b.jpg', { type: 'image/jpeg' });
    const item = {
      kind: 'file',
      getAsFile: () => file,
    };
    const dt = { files: [], items: [item] };
    expect(firstImageFileFromDataTransfer(dt)).toBe(file);
  });
});
