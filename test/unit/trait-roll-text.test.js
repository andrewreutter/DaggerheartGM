import { describe, it, expect } from 'vitest';
import { buildTraitRollText, buildPreRollPanelTitle, buildSpotlightRequestActionLabel } from '../../src/client/lib/trait-roll-text.js';

describe('buildTraitRollText', () => {
  it('builds a Duality Hope/Fear pair with a positive trait modifier', () => {
    expect(buildTraitRollText('Ada', 'agility', 2)).toBe(
      'Ada Agility Hope [d12] Fear [d12] Agility [2]',
    );
  });

  it('omits a zero trait modifier', () => {
    expect(buildTraitRollText('Bea', 'presence', 0)).toBe(
      'Bea Presence Hope [d12] Fear [d12]',
    );
  });

  it('includes a negative trait modifier', () => {
    expect(buildTraitRollText('Cal', 'strength', -1)).toBe(
      'Cal Strength Hope [d12] Fear [d12] Strength [-1]',
    );
  });

  it('appends an experience bonus when named', () => {
    expect(buildTraitRollText('Dee', 'knowledge', 1, 'Scholar', 3)).toBe(
      'Dee Knowledge Hope [d12] Fear [d12] Knowledge [1] Scholar [3]',
    );
  });
});

describe('buildPreRollPanelTitle', () => {
  it('uses actor and trait when no action or weapon is given', () => {
    expect(buildPreRollPanelTitle({ actorName: 'Ada', traitKey: 'agility' })).toBe('Ada — Agility');
  });

  it('prefers a weapon name over the trait', () => {
    expect(buildPreRollPanelTitle({
      actorName: 'Ada',
      traitKey: 'agility',
      weaponName: 'Shortbow',
    })).toBe('Ada — Shortbow');
  });

  it('prefers an action name over weapon and trait', () => {
    expect(buildPreRollPanelTitle({
      actorName: 'Ada',
      traitKey: 'presence',
      weaponName: 'Rapier',
      actionName: 'Rally',
    })).toBe('Ada — Rally');
  });

  it('labels a spellcast roll when no named action is given', () => {
    expect(buildPreRollPanelTitle({
      actorName: 'Ada',
      traitKey: 'presence',
      isSpellcast: true,
    })).toBe('Ada — Spellcast');
  });

  it('labels a reaction roll with the trait', () => {
    expect(buildPreRollPanelTitle({
      actorName: 'Ada',
      traitKey: 'agility',
      isReaction: true,
    })).toBe('Ada — Reaction (Agility)');
  });

  it('uses companion attack as the action when provided', () => {
    expect(buildPreRollPanelTitle({
      actorName: 'Wolf',
      traitKey: 'instinct',
      companionAttackName: 'Snap',
    })).toBe('Wolf — Snap');
  });

  it('strips the actor prefix from displayName when that is the only action hint', () => {
    expect(buildPreRollPanelTitle({
      actorName: 'Ada',
      traitKey: 'finesse',
      displayName: 'Ada Dualstaff',
    })).toBe('Ada — Dualstaff');
  });

  it('falls back to Before you roll when nothing is known', () => {
    expect(buildPreRollPanelTitle({})).toBe('Before you roll');
  });
});

describe('buildSpotlightRequestActionLabel', () => {
  it('strips the actor prefix from displayName', () => {
    expect(buildSpotlightRequestActionLabel({
      actorName: 'Ada',
      displayName: 'Ada Longsword',
      rollMeta: { _attackerInstanceId: 'pc-1' },
    })).toBe('Longsword');
  });

  it('prefers a feature name, then Spellcast, then the trait', () => {
    expect(buildSpotlightRequestActionLabel({
      actorName: 'Ada',
      displayName: 'Ada Rally',
      rollMeta: { _featureName: 'Rally' },
    })).toBe('Rally');
    expect(buildSpotlightRequestActionLabel({
      actorName: 'Ada',
      displayName: 'Ada Spellcast',
      rollMeta: { _isSpellcastRoll: true, _traitKey: 'presence' },
    })).toBe('Spellcast');
    expect(buildSpotlightRequestActionLabel({
      actorName: 'Ada',
      rollMeta: { _traitKey: 'agility' },
    })).toBe('Agility');
  });
});
