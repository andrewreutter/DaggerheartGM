import { describe, it, expect } from 'vitest';
import {
  tokenizeTokenName,
  tokenAbbrev,
  stripSharedNamePrefix,
  collectDistinctAdversaryNames,
  adversaryTokenAbbrev,
  tokenAbbrevForElement,
} from '../../src/client/lib/token-abbrev.js';

describe('tokenAbbrev', () => {
  it('returns ? for a missing or blank name', () => {
    expect(tokenAbbrev(null)).toBe('?');
    expect(tokenAbbrev('')).toBe('?');
    expect(tokenAbbrev('   ')).toBe('?');
  });

  it('uses the first two letters of a single word', () => {
    expect(tokenAbbrev('Bear')).toBe('BE');
    expect(tokenAbbrev('Kat')).toBe('KA');
  });

  it('uses initials of the first two words', () => {
    expect(tokenAbbrev('Dire Wolf')).toBe('DW');
    expect(tokenAbbrev('Jagged Knife Lieutenant')).toBe('JK');
    expect(tokenAbbrev('Archer Guard')).toBe('AG');
  });
});

describe('tokenizeTokenName', () => {
  it('splits on spaces and colons', () => {
    expect(tokenizeTokenName('Fallen Warlord: Realm-Breaker')).toEqual([
      'Fallen',
      'Warlord',
      'Realm-Breaker',
    ]);
  });
});

describe('stripSharedNamePrefix', () => {
  const jagged = [
    'Jagged Knife Hexer',
    'Jagged Knife Lackey',
    'Jagged Knife Lieutenant',
  ];

  it('leaves a lone family member unchanged so the current encoder still yields JK', () => {
    expect(stripSharedNamePrefix('Jagged Knife Lieutenant', ['Jagged Knife Lieutenant']))
      .toBe('Jagged Knife Lieutenant');
  });

  it('strips the longest shared word prefix among distinct names', () => {
    expect(stripSharedNamePrefix('Jagged Knife Hexer', jagged)).toBe('Hexer');
    expect(stripSharedNamePrefix('Jagged Knife Lackey', jagged)).toBe('Lackey');
    expect(stripSharedNamePrefix('Jagged Knife Lieutenant', jagged)).toBe('Lieutenant');
  });

  it('does not treat duplicate instances of the same name as a prefix to strip', () => {
    expect(stripSharedNamePrefix('Jagged Knife Lackey', ['Jagged Knife Lackey'])).toBe('Jagged Knife Lackey');
  });

  it('keeps the last word when the shared prefix is the entire shorter name', () => {
    const names = ['Tangle Bramble', 'Tangle Bramble Swarm'];
    expect(stripSharedNamePrefix('Tangle Bramble', names)).toBe('Bramble');
    expect(stripSharedNamePrefix('Tangle Bramble Swarm', names)).toBe('Swarm');
  });

  it('strips through a colon so Fallen Warlord variants disambiguate', () => {
    const names = ['Fallen Warlord: Realm-Breaker', 'Fallen Warlord: Undefeated Champion'];
    expect(stripSharedNamePrefix('Fallen Warlord: Realm-Breaker', names)).toBe('Realm-Breaker');
    expect(stripSharedNamePrefix('Fallen Warlord: Undefeated Champion', names)).toBe('Undefeated Champion');
  });

  it('strips only the first word when that is all the family shares', () => {
    const names = ['Giant Rat', 'Giant Scorpion'];
    expect(stripSharedNamePrefix('Giant Rat', names)).toBe('Rat');
    expect(stripSharedNamePrefix('Giant Scorpion', names)).toBe('Scorpion');
  });

  it('leaves unrelated names that do not share a word prefix alone', () => {
    expect(stripSharedNamePrefix('Construct', ['Construct', 'Courtier', 'Cave Ogre'])).toBe('Construct');
  });
});

describe('adversaryTokenAbbrev', () => {
  it('encodes Jagged Knife types as their role word once they share a table', () => {
    const names = [
      'Jagged Knife Hexer',
      'Jagged Knife Lackey',
      'Jagged Knife Lieutenant',
    ];
    expect(adversaryTokenAbbrev('Jagged Knife Hexer', names)).toBe('HE');
    expect(adversaryTokenAbbrev('Jagged Knife Lackey', names)).toBe('LA');
    expect(adversaryTokenAbbrev('Jagged Knife Lieutenant', names)).toBe('LI');
  });

  it('keeps JK when only one Jagged Knife type is present', () => {
    expect(adversaryTokenAbbrev('Jagged Knife Lieutenant', ['Jagged Knife Lieutenant'])).toBe('JK');
  });

  it('encodes Demon of X by the last word after stripping Demon of', () => {
    const names = ['Demon of Avarice', 'Demon of Despair', 'Demon of Wrath'];
    expect(adversaryTokenAbbrev('Demon of Avarice', names)).toBe('AV');
    expect(adversaryTokenAbbrev('Demon of Despair', names)).toBe('DE');
    expect(adversaryTokenAbbrev('Demon of Wrath', names)).toBe('WR');
  });
});

describe('collectDistinctAdversaryNames', () => {
  it('returns unique adversary names and ignores other element types and copies', () => {
    expect(collectDistinctAdversaryNames([
      { elementType: 'character', name: 'Ada Bard' },
      { elementType: 'adversary', name: 'Jagged Knife Lackey' },
      { elementType: 'adversary', name: 'Jagged Knife Lackey' },
      { elementType: 'adversary', name: 'Jagged Knife Hexer' },
      { elementType: 'boardToken', name: 'Companion' },
      { elementType: 'adversary', name: '  ' },
    ])).toEqual(['Jagged Knife Lackey', 'Jagged Knife Hexer']);
  });
});

describe('tokenAbbrevForElement', () => {
  const jagged = ['Jagged Knife Hexer', 'Jagged Knife Lieutenant'];

  it('never strips prefixes on characters', () => {
    expect(tokenAbbrevForElement({ elementType: 'character', name: 'Jagged Knife Hexer' }, jagged))
      .toBe('JK');
  });

  it('uses board-token label (else name) without prefix stripping', () => {
    expect(tokenAbbrevForElement({ elementType: 'boardToken', label: 'Wolf Friend', name: 'Companion' }, jagged))
      .toBe('WF');
    expect(tokenAbbrevForElement({ elementType: 'boardToken', name: 'Companion' }, jagged)).toBe('CO');
  });

  it('strips shared prefixes only for adversaries', () => {
    expect(tokenAbbrevForElement({ elementType: 'adversary', name: 'Jagged Knife Hexer' }, jagged))
      .toBe('HE');
  });
});
