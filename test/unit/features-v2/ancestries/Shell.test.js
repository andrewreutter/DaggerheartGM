import { describe, it, expect } from 'vitest';
import { Shell } from '../../../../src/features-v2/ancestries/Galapa.js';

describe('Shell', () => {
  it('exports name and SRD description', () => {
    expect(Shell.name).toBe('Shell');
    expect(Shell.description).toBe(
      'Gain a bonus to your damage thresholds equal to your Proficiency.'
    );
  });

  it('does not declare passiveStatMods until V2 exposes proficiency for threshold bonuses (blocked)', () => {
    expect(Shell.passiveStatMods).toBeUndefined();
  });
});
