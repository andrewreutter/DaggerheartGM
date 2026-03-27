import { describe, expect, it } from 'vitest';
import { encounterImportSliceSubtitle } from '../../src/client/lib/encounter-import-slice-ui.js';

describe('encounterImportSliceSubtitle', () => {
  it('matches map / adversary / environment / note copy for text, ignore, and no-text cases', () => {
    expect(encounterImportSliceSubtitle('map', false, false)).toBe('Use image');
    expect(encounterImportSliceSubtitle('map', true, false)).toBe('Ignore text');
    expect(encounterImportSliceSubtitle('map', true, true)).toBe('Ignore text');

    expect(encounterImportSliceSubtitle('adversary', false, false)).toBe('Attach to new adversary');
    expect(encounterImportSliceSubtitle('adversary', true, true)).toBe('Attach to new adversary');
    expect(encounterImportSliceSubtitle('adversary', true, false)).toBe('Parse text');

    expect(encounterImportSliceSubtitle('environment', false, false)).toBe('Attach to new environment');
    expect(encounterImportSliceSubtitle('environment', true, true)).toBe('Attach to new environment');
    expect(encounterImportSliceSubtitle('environment', true, false)).toBe('Parse text');

    expect(encounterImportSliceSubtitle('note', false, false)).toBe('Attach to new note');
    expect(encounterImportSliceSubtitle('note', true, true)).toBe('Attach to new note');
    expect(encounterImportSliceSubtitle('note', true, false)).toBe('Use text');
  });
});
