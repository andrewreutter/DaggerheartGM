import { describe, expect, it } from 'vitest';
import { CHECKBOX_TRACK_PRESETS, getCheckboxTrackPreset } from '../../src/client/components/CheckboxTrack.jsx';

describe('getCheckboxTrackPreset', () => {
  it('returns a preset for each known kind', () => {
    const kinds = Object.keys(CHECKBOX_TRACK_PRESETS);
    expect(kinds.sort()).toEqual(
      ['hope', 'fear', 'hp', 'armor', 'stress', 'stressPurple'].sort(),
    );
    for (const k of kinds) {
      const p = getCheckboxTrackPreset(k);
      expect(p.Icon).toBeTruthy();
      expect(typeof p.icon).toBe('string');
    }
    const hope = getCheckboxTrackPreset('hope');
    expect(typeof hope.borderFilled).toBe('string');
    expect(typeof hope.borderEmpty).toBe('string');
  });

  it('falls back to hp for unknown kind', () => {
    expect(getCheckboxTrackPreset('unknown')).toBe(CHECKBOX_TRACK_PRESETS.hp);
  });
});
