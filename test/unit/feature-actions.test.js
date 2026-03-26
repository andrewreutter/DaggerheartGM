import { describe, it, expect } from 'vitest';
import {
  parseSubFeatures,
  parsePassiveStats,
  buildCostBadges,
  deriveFeatureActionFromV2Row,
} from '../../src/client/lib/feature-actions.js';
import {
  enrichHoverActionMeta,
  extractEmbeddedResourceCostsFromText,
  extractAdvantageConditionFromText,
} from '../../src/features-v2/engine/hover-action-enrich.js';

// ── deriveFeatureActionFromV2Row + enrichHoverActionMeta ─────────────────────

describe('deriveFeatureActionFromV2Row', () => {
  it('returns isActive:false for empty / missing row', () => {
    expect(deriveFeatureActionFromV2Row(null).isActive).toBe(false);
    expect(deriveFeatureActionFromV2Row(undefined).isActive).toBe(false);
    expect(deriveFeatureActionFromV2Row({}).isActive).toBe(false);
  });

  it('aggregates costs only from card-placement chips', () => {
    const a = deriveFeatureActionFromV2Row({
      name: 'Test',
      description: '',
      chips: [
        { placements: ['card'], hopeCost: 3, stressCost: 1 },
        { placements: ['reviewAction'], hopeCost: 99 },
      ],
    });
    expect(a.hopeCost).toBe(3);
    expect(a.stressCost).toBe(1);
    expect(a.isActive).toBe(true);
  });

  it('reviewAction-only costs do not activate legacy strip (e.g. Wordsmith-style)', () => {
    const a = deriveFeatureActionFromV2Row({
      name: 'Heart of a Poet',
      description:
        'After you make an action roll to impress, persuade, or offend someone, you can spend a Hope to add a d4 to the roll.',
      chips: [{ placements: ['reviewAction'], hopeCost: 1 }],
    });
    expect(a.hopeCost).toBe(0);
    expect(a.isActive).toBe(false);
  });

  it('merges spellcast metadata from enrichHoverActionMeta on description', () => {
    const row = enrichHoverActionMeta({
      name: 'Banish',
      description:
        'Make a **Spellcast Roll** against a target within Close range. On a success, roll a number of **d20s** equal to your Spellcast trait.',
    });
    const a = deriveFeatureActionFromV2Row(row);
    expect(a.spellcastDC).toBe(null);
    expect(a.spellcastVsRoll).toBe(true);
    expect(a.isActive).toBe(true);
  });

  it('extracts Spellcast DC from description via enrich', () => {
    const row = enrichHoverActionMeta({
      name: 'Minor Illusion',
      description: 'Make a Spellcast Roll (10) to conjure a convincing illusion.',
    });
    const a = deriveFeatureActionFromV2Row(row);
    expect(a.spellcastDC).toBe(10);
    expect(a.isActive).toBe(true);
  });

  it('uses row.frequency and top-level hope costs', () => {
    const a = deriveFeatureActionFromV2Row({
      name: 'Rally',
      description: 'Inspire companions.',
      frequency: 'session',
      hopeCost: 0,
    });
    expect(a.frequency).toBe('session');
    expect(a.isActive).toBe(true);
  });

  it('uses advantageTriggers for advantageCondition', () => {
    const a = deriveFeatureActionFromV2Row({
      name: 'Dread Visage',
      description: '—',
      advantageTriggers: ['You have advantage on rolls to intimidate hostile creatures.'],
    });
    expect(a.advantageCondition).toBe('You have advantage on rolls to intimidate hostile creatures');
  });

  it('detects target types via enrichHoverActionMeta', () => {
    const row = enrichHoverActionMeta({
      description: 'Choose a target adversary to affect.',
    });
    const a = deriveFeatureActionFromV2Row(row);
    expect(a.targetType).toBe('adversary');
  });

  it('uses registry hopeCost on beastform Agile (no card chips)', () => {
    const a = deriveFeatureActionFromV2Row(
      enrichHoverActionMeta({
        name: 'Agile',
        type: 'beastform',
        description:
          'Your movement is silent, and you can **spend a Hope** to move up to Far range without rolling.',
        hopeCost: 1,
        chips: [],
      })
    );
    expect(a.hopeCost).toBe(1);
    expect(a.isActive).toBe(true);
  });
});

// ── extractEmbeddedResourceCostsFromText (embedded sub-options) ─────────────

describe('extractEmbeddedResourceCostsFromText', () => {
  it('extracts Hope, Stress, Armor, frequency from prose', () => {
    expect(extractEmbeddedResourceCostsFromText('Spend 3 Hope to use this ability.').hopeCost).toBe(3);
    expect(extractEmbeddedResourceCostsFromText('3 Hope').hopeCost).toBe(3);
    expect(extractEmbeddedResourceCostsFromText('costs 2 Hope').hopeCost).toBe(2);
    expect(extractEmbeddedResourceCostsFromText('spend a Hope').hopeCost).toBe(1);
    expect(extractEmbeddedResourceCostsFromText('you can **spend a Hope** to add a d4 to the roll.').hopeCost).toBe(1);
    expect(extractEmbeddedResourceCostsFromText('Mark a Stress to activate.').stressCost).toBe(1);
    expect(extractEmbeddedResourceCostsFromText('clear 2 Armor Slots.').armorClear).toBe(2);
    expect(extractEmbeddedResourceCostsFromText('You may use this once per session.').frequency).toBe('session');
  });
});

// ── extractAdvantageConditionFromText ───────────────────────────────────────

describe('extractAdvantageConditionFromText', () => {
  it('extracts full advantage sentence', () => {
    const dreadVisage = 'You have advantage on rolls to intimidate hostile creatures.';
    expect(extractAdvantageConditionFromText(dreadVisage)).toBe(
      'You have advantage on rolls to intimidate hostile creatures',
    );
    const dueling =
      'When there are no other creatures within Close range of the target, gain advantage on your attack roll against them.';
    expect(extractAdvantageConditionFromText(dueling)).toBe(
      'When there are no other creatures within Close range of the target, gain advantage on your attack roll against them',
    );
  });

  it('returns null when no advantage phrase', () => {
    expect(extractAdvantageConditionFromText('Spend 3 Hope to clear 2 Armor Slots.')).toBe(null);
  });
});

// ── parseSubFeatures ────────────────────────────────────────────────────────

describe('parseSubFeatures', () => {
  it('returns [] for empty/null', () => {
    expect(parseSubFeatures('')).toEqual([]);
    expect(parseSubFeatures(null)).toEqual([]);
  });

  it('returns [] when fewer than 2 options found', () => {
    expect(parseSubFeatures('**Just one bold:** description here.').length).toBeLessThan(2);
  });

  it('extracts bold sub-sections (**Name:**)', () => {
    const desc = `Choose one option:\n**Swift:** Move quickly to gain +2 Evasion.\n**Strong:** Gain +1 to Strength.`;
    const subs = parseSubFeatures(desc);
    expect(subs.length).toBeGreaterThanOrEqual(2);
    expect(subs[0].name).toBe('Swift');
    expect(subs[1].name).toBe('Strong');
  });

  it('extracts bullet list after "choose one"', () => {
    const desc = `You may choose one of the following options:\n- Heal: Clear 1 HP from an ally.\n- Strengthen: Add +1 to an ally\u2019s next roll.`;
    const subs = parseSubFeatures(desc);
    expect(subs.length).toBeGreaterThanOrEqual(2);
    expect(subs[0].description).toContain('Clear');
  });
});

// ── parsePassiveStats ───────────────────────────────────────────────────────

describe('parsePassiveStats', () => {
  it('returns [] for empty', () => {
    expect(parsePassiveStats('')).toEqual([]);
  });

  it('extracts Evasion bonus', () => {
    const s = parsePassiveStats('+1 Evasion from training.');
    expect(s[0]).toMatchObject({ stat: 'evasion', value: 1 });
  });

  it('extracts Evasion from +N bonus to your Evasion (Rogue\'s Dodge wording)', () => {
    const s = parsePassiveStats(
      'Spend 3 Hope to gain a +2 bonus to your Evasion until the next time an attack succeeds against you.'
    );
    expect(s.some((x) => x.stat === 'evasion' && x.value === 2)).toBe(true);
  });

  it('extracts damage threshold', () => {
    const s = parsePassiveStats('Gain +2 to your damage thresholds.');
    expect(s[0]).toMatchObject({ stat: 'threshold', value: 2 });
  });

  it('detects +level to damage', () => {
    const s = parsePassiveStats('Add your level to damage rolls.');
    expect(s[0]).toMatchObject({ stat: 'damage', value: null });
  });
});

// ── buildCostBadges ─────────────────────────────────────────────────────────

describe('buildCostBadges', () => {
  it('returns empty array for no-cost action', () => {
    const a = { hopeCost: 0, stressCost: 0, armorMark: 0, armorClear: 0, frequency: null };
    expect(buildCostBadges(a)).toEqual([]);
  });

  it('includes Hope and Stress badges', () => {
    const a = { hopeCost: 3, stressCost: 1, armorMark: 0, armorClear: 0, frequency: null };
    const badges = buildCostBadges(a);
    expect(badges.some((b) => b.style === 'hope')).toBe(true);
    expect(badges.some((b) => b.style === 'stress')).toBe(true);
  });

  it('includes frequency badge', () => {
    const a = { hopeCost: 0, stressCost: 0, armorMark: 0, armorClear: 0, frequency: 'session' };
    const badges = buildCostBadges(a);
    expect(badges.some((b) => b.style === 'frequency')).toBe(true);
    expect(badges.find((b) => b.style === 'frequency')?.label).toBe('session');
  });
});
