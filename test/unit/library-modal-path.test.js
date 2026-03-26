import { describe, it, expect } from 'vitest';
import { buildLibraryModalPath } from '../../src/client/lib/library-modal-path.js';

describe('buildLibraryModalPath', () => {
  it('uses /library/all/:id when browsing the All tab so the sidebar stays on All', () => {
    expect(buildLibraryModalPath('all', 'adversaries', 'srd-adv-bear')).toBe('/library/all/srd-adv-bear');
    expect(buildLibraryModalPath('all', 'features', 'v2feat-x')).toBe('/library/all/v2feat-x');
  });

  it('uses the collection segment when browsing a single collection tab', () => {
    expect(buildLibraryModalPath('adversaries', 'adversaries', 'srd-adv-bear')).toBe(
      '/library/adversaries/srd-adv-bear'
    );
  });

  it('defaults item id to new', () => {
    expect(buildLibraryModalPath('classes', 'classes')).toBe('/library/classes/new');
  });
});
