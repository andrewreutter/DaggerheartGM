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
import { BookOfRonin } from '../../../../src/features-v2/abilities/Codex/BookOfRonin.js';
import { BookOfExota } from '../../../../src/features-v2/abilities/Codex/BookOfExota.js';
import { BookOfHomet } from '../../../../src/features-v2/abilities/Codex/BookOfHomet.js';
import { BookOfGrynn } from '../../../../src/features-v2/abilities/Codex/BookOfGrynn.js';
import { mockCharacter, mockGameState, mockAdversary, mockRoll, runReviewAction } from '../helpers.js';

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

  it('Arcane Barrage requires selecting an adversary within Close; activation queues actionLoop naming the target', () => {
    const pc = mockCharacter({
      instanceId: 'i1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'knowledge',
    });
    const adv = mockAdversary({ instanceId: 'adv-1', name: 'Goblin', tokenX: 5, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [pc, adv],
        _ownerInstanceId: 'i1',
        _featureKey: 'Book of Illiat',
        action: {
          type: 'free',
          actorInstanceId: 'i1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...BookOfIlliat, _ownerInstanceId: 'i1' }], 'card', tbl);
    const barrage = chips.find((c) => c.name === 'Arcane Barrage');
    expect(barrage?.multiSelect).toBe(false);
    expect(typeof barrage?.selectTargets).toBe('function');
    expect(barrage?.selectTargets?.(tbl)).toHaveLength(1);
    expect(barrage?.disabled).toBe(false);

    const m = activateChip(barrage, tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Illiat — Arcane Barrage',
          trait: 'Knowledge',
        }),
      })
    );
    const loop = m.find((x) => x.type === 'actionLoop');
    expect(String(loop?.payload?.description ?? '')).toContain('Goblin');
  });

  it('Arcane Barrage is disabled when no adversary is within Close', () => {
    const pc = mockCharacter({ instanceId: 'i1', tokenX: 0, tokenY: 0, spellcastTrait: 'knowledge' });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 200, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [pc, adv],
        _ownerInstanceId: 'i1',
        _featureKey: 'Book of Illiat',
        action: {
          type: 'free',
          actorInstanceId: 'i1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...BookOfIlliat, _ownerInstanceId: 'i1' }], 'card', tbl);
    const barrage = chips.find((c) => c.name === 'Arcane Barrage');
    expect(barrage?.disabled).toBe(true);
    expect(barrage?.selectTargets?.(tbl)).toHaveLength(0);
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

describe('Codex Tier 1 — Book of Homet', () => {
  it('Pass Through is once per rest; Plane Gate is once per long rest; both queue Spellcast actionLoops', () => {
    const tbl = freeActionTable('h1', 'Book of Homet');
    const chips = collectChips([{ ...BookOfHomet, _ownerInstanceId: 'h1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Pass Through', 'Plane Gate']);
    expect(chips[0]?.frequency).toBe('rest');
    expect(chips[1]?.frequency).toBe('longRest');
    const m0 = activateChip(chips[0], tbl, makeChipState());
    expect(m0).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Homet — Pass Through', trait: 'Knowledge' }),
      })
    );
    const tbl2 = freeActionTable('h2', 'Book of Homet');
    const chips2 = collectChips([{ ...BookOfHomet, _ownerInstanceId: 'h2' }], 'card', tbl2);
    const m1 = activateChip(chips2[1], tbl2, makeChipState());
    expect(m1).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Homet — Plane Gate', trait: 'Knowledge' }),
      })
    );
  });
});

describe('Codex Tier 1 — Book of Exota', () => {
  it('Repudiate is once per rest and queues a reaction-roll actionLoop', () => {
    const tbl = freeActionTable('e1', 'Book of Exota');
    const chips = collectChips([{ ...BookOfExota, _ownerInstanceId: 'e1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Repudiate', 'Create Construct']);
    const rep = chips.find((c) => c.name === 'Repudiate');
    expect(rep?.frequency).toBe('rest');
    const m = activateChip(rep, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Exota — Repudiate', trait: 'Knowledge' }),
      })
    );
  });

  it('Create Construct spends 1 Hope and queues Spellcast actionLoop', () => {
    const tbl = freeActionTable('e2', 'Book of Exota');
    const chips = collectChips([{ ...BookOfExota, _ownerInstanceId: 'e2' }], 'card', tbl);
    const construct = chips.find((c) => c.name === 'Create Construct');
    expect(construct?.hopeCost).toBe(1);
    const fromUse = activateChip(construct, tbl, makeChipState());
    deductChipCosts(construct, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'e2', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Exota — Create Construct', trait: 'Knowledge' }),
      })
    );
  });
});

describe('Codex Tier 1 — Book of Grynn', () => {
  it('Time Lock and Wall of Flame queue Spellcast actionLoops', () => {
    const tbl = freeActionTable('g1', 'Book of Grynn');
    const chips = collectChips([{ ...BookOfGrynn, _ownerInstanceId: 'g1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Time Lock', 'Wall of Flame']);
    const m0 = activateChip(chips[0], tbl, makeChipState());
    expect(m0).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Grynn — Time Lock', trait: 'Knowledge' }),
      })
    );
    const tbl2 = freeActionTable('g2', 'Book of Grynn');
    const chips2 = collectChips([{ ...BookOfGrynn, _ownerInstanceId: 'g2' }], 'card', tbl2);
    const m1 = activateChip(chips2[1], tbl2, makeChipState());
    expect(m1).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Book of Grynn — Wall of Flame', trait: 'Knowledge' }),
      })
    );
  });

  it('Arcane Deflection reviewAction chip when you take damage (Very Close context)', () => {
    const self = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const { chips } = runReviewAction(
      { ...BookOfGrynn, _ownerInstanceId: 'g1' },
      {
        activeElements: [self, adv],
        _ownerInstanceId: 'g1',
        _featureKey: 'Book of Grynn',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['g1'],
          effects: [
            { type: 'damage', target: { instanceId: 'g1' }, amount: 4, damageType: 'physical' },
          ],
        },
      }
    );
    const def = chips.find((c) => c.name === 'Arcane Deflection');
    expect(def?.hopeCost).toBe(1);
    expect(def?.frequency).toBe('longRest');
    expect(def).toBeDefined();
  });

  it('Arcane Deflection reviewAction chip when an ally within Very Close is damaged', () => {
    const owner = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'g2', name: 'Ally', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 12, tokenY: 0 });
    const { chips } = runReviewAction(
      { ...BookOfGrynn, _ownerInstanceId: 'g1' },
      {
        activeElements: [owner, ally, adv],
        _ownerInstanceId: 'g1',
        _featureKey: 'Book of Grynn',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['g2'],
          effects: [
            { type: 'damage', target: { instanceId: 'g2' }, amount: 3, damageType: 'physical' },
          ],
        },
      }
    );
    expect(chips.some((c) => c.name === 'Arcane Deflection')).toBe(true);
  });

  it('Arcane Deflection onUse clears pending damage and queues narration', () => {
    const char = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const effects = [
      { type: 'damage', target: { instanceId: 'g1' }, amount: 4, damageType: 'physical' },
    ];
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Book of Grynn',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['g1'],
        effects,
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BookOfGrynn, _ownerInstanceId: 'g1' }], 'reviewAction', tbl);
    const def = chips.find((c) => c.name === 'Arcane Deflection');
    expect(def).toBeDefined();
    const m = [...activateChip(def, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(effects[0].amount).toBe(0);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addNarration',
        payload: expect.objectContaining({ text: expect.stringContaining('Arcane Deflection') }),
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

describe('Codex — Book of Ronin (Level 9 grimoire)', () => {
  it('Transform queues Spellcast (15); Eternal Enervation is once per long rest', () => {
    const tbl = freeActionTable('r1', 'Book of Ronin');
    const chips = collectChips([{ ...BookOfRonin, _ownerInstanceId: 'r1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Transform', 'Eternal Enervation']);
    expect(chips[0]?.frequency).toBeUndefined();
    expect(chips[1]?.frequency).toBe('longRest');
    const m0 = activateChip(chips[0], tbl, makeChipState());
    expect(m0).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Ronin — Transform',
          trait: 'Knowledge',
          difficulty: 15,
        }),
      })
    );
    const tbl2 = freeActionTable('r2', 'Book of Ronin');
    const chips2 = collectChips([{ ...BookOfRonin, _ownerInstanceId: 'r2' }], 'card', tbl2);
    const m1 = activateChip(chips2[1], tbl2, makeChipState());
    expect(m1).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Ronin — Eternal Enervation',
          trait: 'Knowledge',
        }),
      })
    );
  });
});
