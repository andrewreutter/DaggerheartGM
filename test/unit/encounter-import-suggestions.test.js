import { describe, expect, it } from 'vitest';
import { inferEncounterImportSuggestions } from '../../src/client/lib/encounter-import-slice-ui.js';

describe('inferEncounterImportSuggestions', () => {
  it('with no legible OCR, suggests Map only', () => {
    expect(inferEncounterImportSuggestions(false, '')).toEqual({
      map: true,
      adversary: false,
      environment: false,
      note: false,
    });
  });

  it('matches adversary keywords (word boundaries, case-insensitive)', () => {
    expect(inferEncounterImportSuggestions(true, 'Motives: eat heroes')).toEqual({
      map: false,
      adversary: true,
      environment: false,
      note: false,
    });
    expect(inferEncounterImportSuggestions(true, 'Tactics\nflank')).toEqual({
      map: false,
      adversary: true,
      environment: false,
      note: false,
    });
    expect(inferEncounterImportSuggestions(true, 'Attack +5')).toEqual({
      map: false,
      adversary: true,
      environment: false,
      note: false,
    });
  });

  it('matches environment keywords', () => {
    expect(inferEncounterImportSuggestions(true, 'Impulses: gloom')).toEqual({
      map: false,
      adversary: false,
      environment: true,
      note: false,
    });
    expect(inferEncounterImportSuggestions(true, 'Potential Adversaries here')).toEqual({
      map: false,
      adversary: false,
      environment: true,
      note: false,
    });
  });

  it('suggests Note when legible but no keyword hit', () => {
    expect(inferEncounterImportSuggestions(true, 'Some random scribble')).toEqual({
      map: false,
      adversary: false,
      environment: false,
      note: true,
    });
  });

  it('highlights both adversary and environment when both keyword sets match', () => {
    expect(
      inferEncounterImportSuggestions(true, 'Motives x\nImpulses y'),
    ).toEqual({
      map: false,
      adversary: true,
      environment: true,
      note: false,
    });
  });

  it('does not match substrings without word boundaries', () => {
    expect(inferEncounterImportSuggestions(true, 'Motive without s')).toEqual({
      map: false,
      adversary: false,
      environment: false,
      note: true,
    });
  });
});
