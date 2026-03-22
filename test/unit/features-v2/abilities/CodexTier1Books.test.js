import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { BookOfAva } from '../../../../src/features-v2/abilities/Codex/BookOfAva.js';
import { BookOfIlliat } from '../../../../src/features-v2/abilities/Codex/BookOfIlliat.js';
import { BookOfTyfar } from '../../../../src/features-v2/abilities/Codex/BookOfTyfar.js';
import { BookOfSitil } from '../../../../src/features-v2/abilities/Codex/BookOfSitil.js';
import { BookOfVagras } from '../../../../src/features-v2/abilities/Codex/BookOfVagras.js';
import { BookOfKorvax } from '../../../../src/features-v2/abilities/Codex/BookOfKorvax.js';
import { BookOfNorai } from '../../../../src/features-v2/abilities/Codex/BookOfNorai.js';
import { mockCharacter, mockGameState } from '../helpers.js';

function freeActionTable(charId, featureKey) {
  return buildTableSnapshot(
    mockGameState({
      activeElements: [mockCharacter({ instanceId: charId, spellcastTrait: 'knowledge' })],
      _ownerInstanceId: charId,
      _featureKey: featureKey,
      action: {
        type: 'free',
        actorInstanceId: charId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    })
  );
}

describe('Codex Tier 1 — Book of Ava', () => {
  it('exposes three card chips; Power Push queues Spellcast actionLoop', () => {
    const tbl = freeActionTable('a1', 'Book of Ava');
    const chips = collectChips([{ ...BookOfAva, _ownerInstanceId: 'a1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Power Push', "Tava's Armor", 'Ice Spike']);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Ava — Power Push',
          trait: 'Knowledge',
        }),
      })
    );
  });

  it("Tava's Armor chip spends 1 Hope and queues actionLoop", () => {
    const tbl = freeActionTable('a2', 'Book of Ava');
    const chips = collectChips([{ ...BookOfAva, _ownerInstanceId: 'a2' }], 'card', tbl);
    const chip = chips.find((c) => c.name === "Tava's Armor");
    expect(chip?.hopeCost).toBe(1);
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'a2', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: "Book of Ava — Tava's Armor" }),
      })
    );
  });
});

describe('Codex Tier 1 — Book of Illiat', () => {
  it('Arcane Barrage card has frequency rest', () => {
    const tbl = freeActionTable('i1', 'Book of Illiat');
    const chips = collectChips([{ ...BookOfIlliat, _ownerInstanceId: 'i1' }], 'card', tbl);
    const barrage = chips.find((c) => c.name === 'Arcane Barrage');
    expect(barrage?.frequency).toBe('rest');
  });
});

describe('Codex Tier 1 — Book of Tyfar', () => {
  it('Wild Flame chip queues actionLoop with trait', () => {
    const tbl = freeActionTable('t1', 'Book of Tyfar');
    const chips = collectChips([{ ...BookOfTyfar, _ownerInstanceId: 't1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Tyfar — Wild Flame', trait: 'Knowledge' }),
      })
    );
  });
});

describe('Codex Tier 1 — Book of Sitil', () => {
  it('Parallela spends 2 Hope when activated', () => {
    const tbl = freeActionTable('s1', 'Book of Sitil');
    const chips = collectChips([{ ...BookOfSitil, _ownerInstanceId: 's1' }], 'card', tbl);
    const chip = chips.find((c) => c.name === 'Parallela');
    expect(chip?.hopeCost).toBe(2);
    const fromUse = activateChip(chip, tbl, makeChipState());
    deductChipCosts(chip, tbl);
    const fromCost = applyMutations(tbl);
    expect([...fromUse, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 's1', amount: 2 }),
      })
    );
  });
});

describe('Codex Tier 1 — Book of Korvax', () => {
  it('Levitation queues Spellcast actionLoop without spending Hope', () => {
    const tbl = freeActionTable('k1', 'Book of Korvax');
    const chips = collectChips([{ ...BookOfKorvax, _ownerInstanceId: 'k1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Levitation', 'Recant', 'Rune Circle']);
    const lev = chips.find((c) => c.name === 'Levitation');
    expect(lev?.hopeCost).toBeUndefined();
    const fromUse = activateChip(lev, tbl, makeChipState());
    expect(fromUse.some((x) => x.type === 'spendHope')).toBe(false);
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Korvax — Levitation', trait: 'Knowledge' }),
      })
    );
  });

  it('Recant spends 1 Hope; Rune Circle marks 1 Stress and queues actionLoop', () => {
    const tbl = freeActionTable('k2', 'Book of Korvax');
    const chips = collectChips([{ ...BookOfKorvax, _ownerInstanceId: 'k2' }], 'card', tbl);
    const recant = chips.find((c) => c.name === 'Recant');
    expect(recant?.hopeCost).toBe(1);
    const fromRecantUse = activateChip(recant, tbl, makeChipState());
    deductChipCosts(recant, tbl);
    const fromRecantCost = applyMutations(tbl);
    expect([...fromRecantUse, ...fromRecantCost]).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'k2', amount: 1 }),
      })
    );

    const tbl2 = freeActionTable('k3', 'Book of Korvax');
    const chips2 = collectChips([{ ...BookOfKorvax, _ownerInstanceId: 'k3' }], 'card', tbl2);
    const circle = chips2.find((c) => c.name === 'Rune Circle');
    expect(circle?.stressCost).toBe(1);
    const fromCircleUse = activateChip(circle, tbl2, makeChipState());
    deductChipCosts(circle, tbl2);
    const fromCircleCost = applyMutations(tbl2);
    const circleMut = [...fromCircleUse, ...fromCircleCost];
    expect(circleMut).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'k3', amount: 1 }),
      })
    );
    expect(circleMut.some((x) => x.type === 'actionLoop' && x.payload?.title === 'Book of Korvax — Rune Circle')).toBe(
      true
    );
  });
});

describe('Codex Tier 1 — Book of Norai', () => {
  it('Mystic Tether and Fireball queue Spellcast actionLoops; Fireball has no chip Hope cost', () => {
    const tbl = freeActionTable('n1', 'Book of Norai');
    const chips = collectChips([{ ...BookOfNorai, _ownerInstanceId: 'n1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Mystic Tether', 'Fireball']);
    const m0 = activateChip(chips[0], tbl, makeChipState());
    expect(m0).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Norai — Mystic Tether', trait: 'Knowledge' }),
      })
    );
    expect(chips[1]?.hopeCost).toBeUndefined();
    const tbl2 = freeActionTable('n2', 'Book of Norai');
    const chips2 = collectChips([{ ...BookOfNorai, _ownerInstanceId: 'n2' }], 'card', tbl2);
    const m1 = activateChip(chips2[1], tbl2, makeChipState());
    expect(m1).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Norai — Fireball', trait: 'Knowledge' }),
      })
    );
  });
});

describe('Codex Tier 1 — Book of Vagras', () => {
  it('Runic Lock chip declares once per rest', () => {
    const tbl = freeActionTable('v1', 'Book of Vagras');
    const chips = collectChips([{ ...BookOfVagras, _ownerInstanceId: 'v1' }], 'card', tbl);
    const lock = chips.find((c) => c.name === 'Runic Lock');
    expect(lock?.frequency).toBe('rest');
  });

  it('Arcane Door chip does not auto-spend Hope (cost is after success per SRD)', () => {
    const tbl = freeActionTable('v2', 'Book of Vagras');
    const chips = collectChips([{ ...BookOfVagras, _ownerInstanceId: 'v2' }], 'card', tbl);
    const door = chips.find((c) => c.name === 'Arcane Door');
    expect(door?.hopeCost).toBeUndefined();
  });
});
