import { describe, it, expect } from 'vitest';
import { parseFeatureAction, parseSubFeatures, parsePassiveStats, buildCostBadges } from '../../src/client/lib/feature-actions.js';

// ── parseFeatureAction ──────────────────────────────────────────────────────

describe('parseFeatureAction', () => {
  it('returns isActive:false for empty description', () => {
    expect(parseFeatureAction('').isActive).toBe(false);
    expect(parseFeatureAction(null).isActive).toBe(false);
    expect(parseFeatureAction(undefined).isActive).toBe(false);
  });

  it('extracts Hope cost', () => {
    expect(parseFeatureAction('Spend 3 Hope to use this ability.').hopeCost).toBe(3);
    expect(parseFeatureAction('3 Hope').hopeCost).toBe(3);
    expect(parseFeatureAction('costs 2 Hope').hopeCost).toBe(2);
    expect(parseFeatureAction('spend a Hope').hopeCost).toBe(1);
    expect(parseFeatureAction('you can **spend a Hope** to add a d4 to the roll.').hopeCost).toBe(1);
  });

  it('parses Heart of a Poet (Bard Wordsmith subclass)', () => {
    const desc = 'After you make an action roll to impress, persuade, or offend someone, you can **spend a Hope** to add a **d4** to the roll.';
    const a = parseFeatureAction(desc);
    expect(a.hopeCost).toBe(1);
    expect(a.dice).toContain('d4');
    expect(a.isActive).toBe(true);
  });

  it('extracts Stress cost', () => {
    expect(parseFeatureAction('Mark a Stress to activate.').stressCost).toBe(1);
    expect(parseFeatureAction('mark 1 Stress').stressCost).toBe(1);
    expect(parseFeatureAction('mark 2 Stress to push').stressCost).toBe(2);
  });

  it('extracts Armor slot operations', () => {
    expect(parseFeatureAction('clear 2 Armor Slots.').armorClear).toBe(2);
    expect(parseFeatureAction('mark an Armor Slot.').armorMark).toBe(1);
    expect(parseFeatureAction('mark 2 armor slots').armorMark).toBe(2);
  });

  it('extracts dice expressions', () => {
    const a = parseFeatureAction('Roll 2d4 and apply the result.');
    expect(a.dice).toContain('2d4');
    const b = parseFeatureAction('Gain d6 rally dice; Hope [d12] Fear [d12]');
    expect(b.dice).toContain('d6');
    expect(b.dice).toContain('d12');
  });

  it('extracts Spellcast DC', () => {
    expect(parseFeatureAction('Make a Spellcast Roll (10).').spellcastDC).toBe(10);
    expect(parseFeatureAction('Spellcast Roll (14)').spellcastDC).toBe(14);
  });

  it('extracts frequency', () => {
    expect(parseFeatureAction('You may use this once per session.').frequency).toBe('session');
    expect(parseFeatureAction('Beginning of each session, roll 3d4.').frequency).toBe('session');
    expect(parseFeatureAction('Once per rest, mark a Stress.').frequency).toBe('rest');
    expect(parseFeatureAction('Once per long rest.').frequency).toBe('longRest');
    expect(parseFeatureAction('Mark a Stress.').frequency).toBe(null);
  });

  it('detects target types', () => {
    expect(parseFeatureAction('Choose a target adversary to affect.').targetType).toBe('adversary');
    expect(parseFeatureAction('Choose an ally to heal.').targetType).toBe('character');
    expect(parseFeatureAction('Target a creature.').targetType).toBe('adversary');
    expect(parseFeatureAction('Describe your performance.').impliesTarget).toBe(false);
  });

  it('sets isActive correctly', () => {
    expect(parseFeatureAction('Spend 3 Hope').isActive).toBe(true);
    expect(parseFeatureAction('Roll d6').isActive).toBe(true);
    expect(parseFeatureAction('Once per session').isActive).toBe(true);
    expect(parseFeatureAction('A narrative description.').isActive).toBe(false);
  });

  // Real SRD feature text samples
  it('parses Rally (Bard L1)', () => {
    const desc = 'Once per session, you can take a few moments to inspire your companions. Roll a Hope die, and add the result to each of your allies\u2019 next roll.';
    const a = parseFeatureAction(desc);
    expect(a.frequency).toBe('session');
    expect(a.isActive).toBe(true);
  });

  it('parses Make a Scene (Bard Hope)', () => {
    const desc = 'Spend 3 Hope. Choose an adversary within Far range. Until the end of their next turn, all rolls against them gain +2.';
    const a = parseFeatureAction(desc);
    expect(a.hopeCost).toBe(3);
    expect(a.targetType).toBe('adversary');
  });

  it('parses Frontline Tank (Guardian Hope)', () => {
    const desc = 'Spend 3 Hope to clear 2 Armor Slots.';
    const a = parseFeatureAction(desc);
    expect(a.hopeCost).toBe(3);
    expect(a.armorClear).toBe(2);
  });

  it('parses Minor Illusion (Sorcerer)', () => {
    const desc = 'Make a Spellcast Roll (10) to conjure a convincing illusion.';
    const a = parseFeatureAction(desc);
    expect(a.spellcastDC).toBe(10);
    expect(a.isActive).toBe(true);
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
    const a = parseFeatureAction('A narrative description.');
    expect(buildCostBadges(a)).toEqual([]);
  });

  it('includes Hope and Stress badges', () => {
    const a = parseFeatureAction('Spend 3 Hope and mark 1 Stress.');
    const badges = buildCostBadges(a);
    expect(badges.some(b => b.style === 'hope')).toBe(true);
    expect(badges.some(b => b.style === 'stress')).toBe(true);
  });

  it('includes frequency badge', () => {
    const a = parseFeatureAction('Once per session, roll 2d4.');
    const badges = buildCostBadges(a);
    expect(badges.some(b => b.style === 'frequency')).toBe(true);
    expect(badges.find(b => b.style === 'frequency')?.label).toBe('Once/session');
  });
});
