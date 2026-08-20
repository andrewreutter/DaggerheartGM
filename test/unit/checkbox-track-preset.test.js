import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHECKBOX_TRACK_PRESETS,
  checkboxTrackMarkedSlotClasses,
  getCheckboxTrackPreset,
} from '../../src/client/components/CheckboxTrack.jsx';

const dir = dirname(fileURLToPath(import.meta.url));

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

  it('marked slot classes match a filled card pip', () => {
    expect(checkboxTrackMarkedSlotClasses(CHECKBOX_TRACK_PRESETS.hp)).toEqual({
      borderClass: 'border-0 border-transparent bg-transparent',
      iconClass: 'text-red-500 stroke-red-600',
    });
    expect(checkboxTrackMarkedSlotClasses(CHECKBOX_TRACK_PRESETS.stress)).toEqual({
      borderClass: 'border-0 border-transparent bg-transparent',
      iconClass: 'text-orange-500 stroke-orange-600',
    });
    expect(checkboxTrackMarkedSlotClasses(CHECKBOX_TRACK_PRESETS.armor)).toEqual({
      borderClass: 'border-0 border-transparent bg-transparent',
      iconClass: 'text-cyan-500 stroke-cyan-600',
    });
    expect(checkboxTrackMarkedSlotClasses(CHECKBOX_TRACK_PRESETS.hope)).toEqual({
      borderClass: 'border-2 border-yellow-400 border-solid bg-transparent',
      iconClass: 'text-yellow-400',
    });
    const src = readFileSync(join(dir, '../../src/client/components/CheckboxTrack.jsx'), 'utf8');
    expect(src).toContain('checkboxTrackMarkedSlotClasses(preset)');
    expect(src).toContain('w-4 h-4 rounded-sm flex-shrink-0');
    expect(src).toContain('w-3 h-3 shrink-0 pointer-events-none');
    expect(src).toContain('strokeWidth={2.25}');
    expect(src).toContain("from './Tooltip.jsx'");
    expect(src).toContain('<Tooltip');
    expect(src).not.toContain('title={');
  });
});
