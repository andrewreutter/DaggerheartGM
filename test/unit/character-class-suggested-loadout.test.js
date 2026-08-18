import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  highestTraitNames,
  pickRandom,
  pickSuggestedClassLoadout,
} from '../../src/client/lib/character-class-suggested-loadout.js';

function sequentialRng(values) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i += 1;
    return v;
  };
}

const weapons = [
  { id: 'w-mace', name: 'Mace', trait: 'Strength', primary_or_secondary: 'Primary', burden: 'One-Handed' },
  { id: 'w-rapier', name: 'Rapier', trait: 'Finesse', primary_or_secondary: 'Primary', burden: 'One-Handed' },
  { id: 'w-greataxe', name: 'Greataxe', trait: 'Strength', primary_or_secondary: 'Primary', burden: 'Two-Handed' },
  { id: 'w-shortbow', name: 'Shortbow', trait: 'Finesse', primary_or_secondary: 'Primary', burden: 'Two-Handed' },
  { id: 'w-shield', name: 'Round Shield', trait: 'Strength', primary_or_secondary: 'Secondary', burden: 'One-Handed' },
  { id: 'w-dagger', name: 'Dagger', trait: 'Finesse', primary_or_secondary: 'Secondary', burden: 'One-Handed' },
];

const armor = [
  { id: 'a-leather', name: 'Leather' },
  { id: 'a-chainmail', name: 'Chainmail' },
];

const abilities = [
  { id: 'abl-grace-1', name: 'Deft Deceiver', domain: 'Grace', level: 1 },
  { id: 'abl-grace-2', name: 'Inspirational Words', domain: 'Grace', level: 1 },
  { id: 'abl-codex-1', name: 'Book of Ava', domain: 'Codex', level: 1 },
  { id: 'abl-codex-high', name: 'Book of Korvax', domain: 'Codex', level: 2 },
  { id: 'abl-blade-1', name: 'Get Back Up', domain: 'Blade', level: 1 },
];

describe('highestTraitNames', () => {
  it('returns the trait(s) with the highest score', () => {
    expect(highestTraitNames({
      agility: 0, strength: 2, finesse: -1, instinct: 1, presence: 1, knowledge: 0,
    })).toEqual(['strength']);
  });

  it('returns every trait tied for highest', () => {
    expect(highestTraitNames({
      agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0,
    })).toEqual(['agility', 'strength']);
  });
});

describe('pickRandom', () => {
  it('returns undefined for an empty list', () => {
    expect(pickRandom([])).toBeUndefined();
    expect(pickRandom(null)).toBeUndefined();
  });

  it('uses randomFn to pick an index', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c');
  });
});

describe('pickSuggestedClassLoadout', () => {
  const strengthTraits = {
    agility: 0, strength: 2, finesse: -1, instinct: 0, presence: 1, knowledge: 1,
  };

  it('picks a trait-optimal one-handed primary and matching secondary, plus armor and one card per domain', () => {
    const loadout = pickSuggestedClassLoadout({
      traits: strengthTraits,
      weapons,
      armor,
      abilities,
      classDomains: ['Grace', 'Codex'],
      characterLevel: 1,
      randomFn: sequentialRng([0, 0, 0, 0, 0]),
    });
    expect(loadout.primaryWeaponId).toBe('w-mace');
    expect(loadout.secondaryWeaponId).toBe('w-shield');
    expect(loadout.armorId).toBe('a-leather');
    expect(loadout.abilityIds).toEqual(['abl-grace-1', 'abl-codex-1']);
  });

  it('clears secondary when the trait-optimal primary is two-handed', () => {
    const twoHandedOnly = weapons.filter((w) => w.id === 'w-greataxe' || w.id === 'w-shield');
    const loadout = pickSuggestedClassLoadout({
      traits: strengthTraits,
      weapons: twoHandedOnly,
      armor,
      abilities,
      classDomains: ['Grace', 'Codex'],
      characterLevel: 1,
      randomFn: () => 0,
    });
    expect(loadout.primaryWeaponId).toBe('w-greataxe');
    expect(loadout.secondaryWeaponId).toBeNull();
  });

  it('does not pick domain cards outside the class domains or above the starting-slot level cap', () => {
    const loadout = pickSuggestedClassLoadout({
      traits: strengthTraits,
      weapons,
      armor,
      abilities,
      classDomains: ['Grace', 'Codex'],
      characterLevel: 1,
      randomFn: () => 0,
    });
    expect(loadout.abilityIds).not.toContain('abl-blade-1');
    expect(loadout.abilityIds).not.toContain('abl-codex-high');
  });

  it('falls back to any weapon when none match the highest trait', () => {
    const knowledgeTraits = {
      agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 2,
    };
    const loadout = pickSuggestedClassLoadout({
      traits: knowledgeTraits,
      weapons: [weapons[1], weapons[5]],
      armor,
      abilities,
      classDomains: ['Grace', 'Codex'],
      characterLevel: 1,
      randomFn: () => 0,
    });
    expect(loadout.primaryWeaponId).toBe('w-rapier');
    expect(loadout.secondaryWeaponId).toBe('w-dagger');
  });
});

describe('CharacterForm class-select loadout wiring', () => {
  it('applies suggested loadout on class change and no longer has Randomize remaining selections', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, '../../src/client/components/forms/CharacterForm.jsx'), 'utf8');
    expect(src).toMatch(/pickSuggestedClassLoadout/);
    expect(src).toMatch(/Suggested traits, weapons, and armor applied\. Random domain cards applied\. Adjust below if desired\./);
    expect(src).not.toMatch(/Randomize remaining selections/);
    expect(src).not.toMatch(/handleFillOutAutomatically/);
  });
});
