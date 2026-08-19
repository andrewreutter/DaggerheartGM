/**
 * Unit tests for dice-utils.js parsing and damage-rewriting utilities.
 */
import { describe, it, expect } from 'vitest';
import { parseLeadingDamageDice, stripDisadvantageFromRollText, insertDisadvantageD6 } from '../../src/client/lib/dice-utils.js';

describe('parseLeadingDamageDice', () => {
  it('parses simple dice expressions', () => {
    expect(parseLeadingDamageDice('d8')).toEqual({
      qty: '1',
      die: 'd8',
      modStr: '',
      rest: '',
    });
  });

  it('parses dice with quantity', () => {
    expect(parseLeadingDamageDice('2d6')).toEqual({
      qty: '2',
      die: 'd6',
      modStr: '',
      rest: '',
    });
  });

  it('parses dice with modifier', () => {
    expect(parseLeadingDamageDice('d8+2')).toEqual({
      qty: '1',
      die: 'd8',
      modStr: '+2',
      rest: '',
    });
  });

  it('parses dice with negative modifier', () => {
    expect(parseLeadingDamageDice('d10-1')).toEqual({
      qty: '1',
      die: 'd10',
      modStr: '-1',
      rest: '',
    });
  });

  it('parses dice with trailing text', () => {
    expect(parseLeadingDamageDice('d8+2 phy')).toEqual({
      qty: '1',
      die: 'd8',
      modStr: '+2',
      rest: ' phy',
    });
  });

  it('parses full expression with quantity, modifier, and suffix', () => {
    expect(parseLeadingDamageDice('3d6+4 mag')).toEqual({
      qty: '3',
      die: 'd6',
      modStr: '+4',
      rest: ' mag',
    });
  });

  it('handles whitespace trimming', () => {
    expect(parseLeadingDamageDice('  d8+2 phy  ')).toEqual({
      qty: '1',
      die: 'd8',
      modStr: '+2',
      rest: ' phy',
    });
  });

  it('returns null for invalid input', () => {
    expect(parseLeadingDamageDice('')).toBeNull();
    expect(parseLeadingDamageDice(null)).toBeNull();
    expect(parseLeadingDamageDice(undefined)).toBeNull();
    expect(parseLeadingDamageDice('not a dice expression')).toBeNull();
    expect(parseLeadingDamageDice('invalid')).toBeNull();
  });

  it('handles case-insensitive dice notation', () => {
    expect(parseLeadingDamageDice('D8+2')).toEqual({
      qty: '1',
      die: 'D8',
      modStr: '+2',
      rest: '',
    });
  });
});

describe('stripDisadvantageFromRollText', () => {
  it('strips a single [1d6] disadvantage block', () => {
    const { strippedText, removedLabels } = stripDisadvantageFromRollText(
      'Hero Agility [d12] [d12] disadvantage Retract [1d6]',
    );
    expect(strippedText).toBe('Hero Agility [d12] [d12]');
    expect(removedLabels).toEqual(['Retract']);
  });

  it('strips a keep-highest [Nd6kh] disadvantage block', () => {
    const { strippedText, removedLabels } = stripDisadvantageFromRollText(
      'Hero Agility [d12] [d12] disadvantage Retract and Cover [2d6kh]',
    );
    expect(strippedText).toBe('Hero Agility [d12] [d12]');
    expect(removedLabels).toEqual(['Retract and Cover']);
  });

  it('strips stacked insertDisadvantageD6 blocks', () => {
    const once = insertDisadvantageD6('Hero Agility [d12] [d12]', 'Retract');
    const twice = insertDisadvantageD6(once, 'Cover');
    const { strippedText, removedLabels } = stripDisadvantageFromRollText(twice);
    expect(strippedText).toBe('Hero Agility [d12] [d12]');
    expect(removedLabels).toEqual(['Retract', 'Cover']);
  });
});
