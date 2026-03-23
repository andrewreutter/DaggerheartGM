import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { MasterOfTheCraft } from '../../../../src/features-v2/abilities/Grace/MasterOfTheCraft.js';
import { mockCharacter, mockGameState } from '../helpers.js';

const EXPS = [
  { id: 'exp-a', name: 'Cooking' },
  { id: 'exp-b', name: 'Sailing' },
];

function tableForCreate(overrides = {}) {
  const { featureState, character: charOverrides, ...rest } = overrides;
  const char = mockCharacter({
    instanceId: 'c1',
    experiences: EXPS,
    ...charOverrides,
  });
  return buildTableSnapshot(
    mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Master of the Craft',
      featureState: featureState ?? { 'Master of the Craft': {} },
      action: {
        type: 'free',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
      ...rest,
    })
  );
}

describe('Grace — Master of the Craft', () => {
  it('create flow: mode chip stores motcMode', () => {
    const tbl = tableForCreate();
    const chips = collectChips([{ ...MasterOfTheCraft, _ownerInstanceId: 'c1' }], 'create', tbl);
    const layout = chips.find((c) => c.name === 'Master of the Craft — layout');
    expect(layout).toBeDefined();
    const m = activateChip(layout, tbl, makeChipState(), { selectedId: 'twoPlusTwo' });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Master of the Craft',
          key: 'motcMode',
          value: 'twoPlusTwo',
        }),
      })
    );
  });

  it('two +2 path queues addExperienceBonus for two distinct ids', () => {
    const tbl = tableForCreate({
      featureState: {
        'Master of the Craft': { motcMode: 'twoPlusTwo' },
      },
    });
    const chips = collectChips([{ ...MasterOfTheCraft, _ownerInstanceId: 'c1' }], 'create', tbl);
    const pick = chips.find((c) => c.name === 'Master of the Craft — two Experiences');
    expect(pick).toBeDefined();
    const m = activateChip(pick, tbl, makeChipState(), { selectedIds: ['exp-a', 'exp-b'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addExperienceBonus',
        payload: { instanceId: 'c1', experienceId: 'exp-a', amount: 2 },
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addExperienceBonus',
        payload: { instanceId: 'c1', experienceId: 'exp-b', amount: 2 },
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'motcDone',
          value: true,
        }),
      })
    );
  });

  it('two +2 path does nothing when the same Experience is picked twice', () => {
    const tbl = tableForCreate({
      featureState: {
        'Master of the Craft': { motcMode: 'twoPlusTwo' },
      },
    });
    const chips = collectChips([{ ...MasterOfTheCraft, _ownerInstanceId: 'c1' }], 'create', tbl);
    const pick = chips.find((c) => c.name === 'Master of the Craft — two Experiences');
    const m = activateChip(pick, tbl, makeChipState(), { selectedIds: ['exp-a', 'exp-a'] });
    expect(m.filter((x) => x.type === 'addExperienceBonus')).toHaveLength(0);
  });

  it('+3 path queues one addExperienceBonus with amount 3', () => {
    const tbl = tableForCreate({
      featureState: {
        'Master of the Craft': { motcMode: 'onePlusThree' },
      },
    });
    const chips = collectChips([{ ...MasterOfTheCraft, _ownerInstanceId: 'c1' }], 'create', tbl);
    const pick = chips.find((c) => c.name === 'Master of the Craft — one Experience');
    expect(pick).toBeDefined();
    const m = activateChip(pick, tbl, makeChipState(), { selectedId: 'exp-b' });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addExperienceBonus',
        payload: { instanceId: 'c1', experienceId: 'exp-b', amount: 3 },
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'motcDone',
          value: true,
        }),
      })
    );
  });

  it('hides create chips after motcDone', () => {
    const tbl = tableForCreate({
      featureState: {
        'Master of the Craft': { motcMode: 'onePlusThree', motcDone: true },
      },
    });
    const chips = collectChips([{ ...MasterOfTheCraft, _ownerInstanceId: 'c1' }], 'create', tbl);
    expect(chips).toHaveLength(0);
  });
});
