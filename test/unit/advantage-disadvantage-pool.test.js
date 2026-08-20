import { describe, it, expect } from 'vitest';
import {
  resolveOwnPool,
  formatOwnPoolRollSuffix,
  formatOwnPoolDieSuffix,
  formatOwnPoolCancelledNote,
  extractOwnPoolFromRollText,
  applyOwnPoolToRollText,
  appendOwnPoolAdvantageToRollText,
  appendOwnPoolDisadvantageToRollText,
  applyOwnPoolDieMutations,
} from '../../src/client/lib/advantage-disadvantage-pool.js';

describe('resolveOwnPool', () => {
  it('keeps two advantage names (FIFO leftover labels)', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim', 'Dueling'],
      disadvantageNames: [],
    });
    expect(resolved).toEqual({
      cancelled: [],
      remainingType: 'advantage',
      remainingNames: ['Aim', 'Dueling'],
    });
  });

  it('keeps two disadvantage names', () => {
    const resolved = resolveOwnPool({
      advantageNames: [],
      disadvantageNames: ['Retract', 'Cover'],
    });
    expect(resolved.remainingType).toBe('disadvantage');
    expect(resolved.remainingNames).toEqual(['Retract', 'Cover']);
  });

  it('cancels 1 + 1 to empty', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim'],
      disadvantageNames: ['Retract'],
    });
    expect(resolved.remainingType).toBeNull();
    expect(resolved.remainingNames).toEqual([]);
    expect(resolved.cancelled).toEqual([{ advantage: 'Aim', disadvantage: 'Retract' }]);
  });

  it('2 adv + 1 disadv leaves the second advantage (FIFO)', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim', 'Dueling'],
      disadvantageNames: ['Retract'],
    });
    expect(resolved.remainingType).toBe('advantage');
    expect(resolved.remainingNames).toEqual(['Dueling']);
    expect(resolved.cancelled).toEqual([{ advantage: 'Aim', disadvantage: 'Retract' }]);
  });

  it('1 adv + 2 disadv leaves the second disadvantage', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim'],
      disadvantageNames: ['Retract', 'Cover'],
    });
    expect(resolved.remainingType).toBe('disadvantage');
    expect(resolved.remainingNames).toEqual(['Cover']);
  });

  it('3 + 2 leaves one leftover of the longer type', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['A', 'B', 'C'],
      disadvantageNames: ['X', 'Y'],
    });
    expect(resolved.remainingType).toBe('advantage');
    expect(resolved.remainingNames).toEqual(['C']);
    expect(resolved.cancelled).toHaveLength(2);
  });

  it('empty lists stay empty', () => {
    expect(resolveOwnPool({})).toEqual({
      cancelled: [],
      remainingType: null,
      remainingNames: [],
    });
  });
});

describe('formatOwnPoolRollSuffix', () => {
  it('formats 2 advantage as keep-highest add', () => {
    const resolved = resolveOwnPool({ advantageNames: ['Aim', 'Dueling'] });
    expect(formatOwnPoolDieSuffix(resolved)).toBe(' Aim and Dueling [2d6kh]');
    expect(formatOwnPoolRollSuffix(resolved)).toBe(' Aim and Dueling [2d6kh]');
  });

  it('formats 2 disadvantage as keep-highest subtract', () => {
    const resolved = resolveOwnPool({ disadvantageNames: ['Retract', 'Cover'] });
    expect(formatOwnPoolDieSuffix(resolved)).toBe(' disadvantage Retract and Cover [2d6kh]');
  });

  it('formats 1 + 1 as empty die plus cancelled note', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim'],
      disadvantageNames: ['Retract'],
    });
    expect(formatOwnPoolDieSuffix(resolved)).toBe('');
    expect(formatOwnPoolCancelledNote(resolved)).toBe(' — cancelled: Aim vs Retract');
    expect(formatOwnPoolRollSuffix(resolved)).toBe(' — cancelled: Aim vs Retract');
  });

  it('formats 2 adv + 1 disadv as one leftover [d6]', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim', 'Dueling'],
      disadvantageNames: ['Retract'],
    });
    expect(formatOwnPoolDieSuffix(resolved)).toBe(' Dueling [d6]');
    expect(formatOwnPoolRollSuffix(resolved)).toBe(' Dueling [d6] — cancelled: Aim vs Retract');
  });

  it('formats 1 adv + 2 disadv as one disadvantage [1d6]', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim'],
      disadvantageNames: ['Retract', 'Cover'],
    });
    expect(formatOwnPoolDieSuffix(resolved)).toBe(' disadvantage Cover [1d6]');
  });

  it('formats 3 + 2 as one leftover', () => {
    const resolved = resolveOwnPool({
      advantageNames: ['Aim', 'Dueling', 'Charge'],
      disadvantageNames: ['Retract', 'Cover'],
    });
    expect(formatOwnPoolDieSuffix(resolved)).toBe(' Charge [d6]');
    expect(formatOwnPoolRollSuffix(resolved, { includeCancelled: false })).toBe(' Charge [d6]');
  });

  it('formats empty as empty', () => {
    expect(formatOwnPoolRollSuffix(resolveOwnPool({}))).toBe('');
  });
});

describe('extractOwnPoolFromRollText / applyOwnPoolToRollText', () => {
  const base = 'Hero Longsword Hope [d12] Fear [d12] Presence [2] damage [d8+2] phy Melee';

  it('extracts a trailing Vulnerable Target [d6] without eating range/trait', () => {
    const { strippedText, advantageNames } = extractOwnPoolFromRollText(`${base} Vulnerable Target [d6]`);
    expect(advantageNames).toEqual(['Vulnerable Target']);
    expect(strippedText).toBe(base);
  });

  it('extracts Aim and Dueling [2d6kh]', () => {
    const { strippedText, advantageNames } = extractOwnPoolFromRollText(`${base} Aim and Dueling [2d6kh]`);
    expect(advantageNames).toEqual(['Aim', 'Dueling']);
    expect(strippedText).toBe(base);
  });

  it('extracts stacked insertDisadvantageD6 blocks', () => {
    const { strippedText, disadvantageNames } = extractOwnPoolFromRollText(
      `${base} disadvantage Retract [1d6] disadvantage Cover [1d6]`,
    );
    expect(disadvantageNames).toEqual(['Retract', 'Cover']);
    expect(strippedText).toBe(base);
  });

  it('extracts a keep-highest disadvantage block', () => {
    const { disadvantageNames } = extractOwnPoolFromRollText(`${base} disadvantage Retract and Cover [2d6kh]`);
    expect(disadvantageNames).toEqual(['Retract', 'Cover']);
  });

  it('does not treat helper addDie dice as own-pool', () => {
    const withHelper = `${base} Wordsmith [d10]`;
    const { strippedText, advantageNames, disadvantageNames } = extractOwnPoolFromRollText(withHelper);
    expect(advantageNames).toEqual([]);
    expect(disadvantageNames).toEqual([]);
    expect(strippedText).toBe(withHelper);
  });

  it('ignores a trailing Help an Ally suffix when extracting own-pool', () => {
    const helps = [{ instanceId: 'beau', label: 'Beau helps' }];
    const withHelp = `${base} Aim [d6] Beau helps [d6]`;
    const extracted = extractOwnPoolFromRollText(withHelp, { helps });
    expect(extracted.advantageNames).toEqual(['Aim']);
    expect(extracted.strippedText).toBe(base);
    expect(extracted.helpSuffix).toBe(' Beau helps [d6]');
    expect(applyOwnPoolToRollText(withHelp, { disadvantageNames: ['Retract'], helps }))
      .toBe(`${base} — cancelled: Aim vs Retract Beau helps [d6]`);
  });

  it('appendOwnPoolAdvantageToRollText merges into one pool (no second block)', () => {
    const once = appendOwnPoolAdvantageToRollText(base, 'Aim');
    expect(once).toBe(`${base} Aim [d6]`);
    const twice = appendOwnPoolAdvantageToRollText(once, 'Vulnerable Target');
    expect(twice).toBe(`${base} Aim and Vulnerable Target [2d6kh]`);
    expect(twice.match(/\[(?:\d+d6kh|d6)\]/g)).toHaveLength(1);
  });

  it('appendOwnPoolDisadvantageToRollText cancels an existing advantage', () => {
    const withAdv = appendOwnPoolAdvantageToRollText(base, 'Aim');
    const mixed = appendOwnPoolDisadvantageToRollText(withAdv, 'Retract');
    expect(mixed).toBe(`${base} — cancelled: Aim vs Retract`);
  });

  it('applyOwnPoolToRollText leaves helper dice untouched', () => {
    const withHelper = `${base} Enchanted Aid [d8]`;
    const next = applyOwnPoolToRollText(withHelper, { advantageNames: ['Aim'] });
    expect(next).toBe(`${withHelper} Aim [d6]`);
  });
});

describe('applyOwnPoolDieMutations', () => {
  it('applies addAdvantageDie, addDisadvantageDie, and removeDisadvantageDie', () => {
    const advantageNames = [];
    const disadvantageNames = [];
    const wrapper = {
      addAdvantageDie: (n) => advantageNames.push(n),
      addDisadvantage: (n) => disadvantageNames.push(n),
      removeDisadvantage: () => { disadvantageNames.length = 0; },
    };
    applyOwnPoolDieMutations([
      { type: 'addAdvantageDie', payload: { name: 'Aim' } },
      { type: 'addDisadvantageDie', payload: { name: 'Retract' } },
      { type: 'addDie', payload: { name: 'Wordsmith', die: 'd10' } },
    ], wrapper);
    expect(advantageNames).toEqual(['Aim']);
    expect(disadvantageNames).toEqual(['Retract']);
    applyOwnPoolDieMutations([{ type: 'removeDisadvantageDie', payload: { name: 'Retract' } }], wrapper);
    expect(disadvantageNames).toEqual([]);
  });
});
