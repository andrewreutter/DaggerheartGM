import { describe, it, expect } from 'vitest';
import { computePlayerV2ReviewChipApply } from '../../src/server/v2-player-review-chip.js';
import {
  collectV2ReviewActionChips,
  enrichV2RollIsSuccessFromTarget,
  v2BannerChipActivationKey,
} from '../../src/client/lib/v2-action-loop-bridge.js';

describe('computePlayerV2ReviewChipApply', () => {
  it('returns 400 when activationKey is missing', () => {
    const r = computePlayerV2ReviewChipApply({
      activeElements: [],
      tableState: {},
      viewerInstanceId: 'pc-1',
      roll: { _attackerInstanceId: 'pc-1' },
      activationKey: '',
      srdData: { weaponsById: {}, armorById: {} },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('returns ok with table updates for Rune Ward when viewer matches cross-sheet holder', async () => {
    const { mockCharacter, mockAdversary } = await import('./features-v2/helpers.js');
    const wizard = mockCharacter({
      instanceId: 'wiz-1',
      abilityIds: ['srd-abl-rune-ward'],
      featureState: { 'Rune Ward': { runeWardHolderInstanceId: 'ally-1' } },
    });
    const ally = mockCharacter({ instanceId: 'ally-1', hope: 6, maxHope: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const roll = {
      _attackerInstanceId: 'adv-1',
      _selectedTargetInstanceId: 'ally-1',
      _traitKey: 'agility',
      subItems: [{ pre: 'damage ', input: 'd8', result: '3', post: ' phy' }],
      total: 10,
      dominant: 'hope',
    };
    enrichV2RollIsSuccessFromTarget(roll, [wizard, ally, adv]);

    const srdData = {
      weaponsById: {},
      armorById: {},
      ancestriesById: {},
      communitiesById: {},
      classesById: {},
    };

    const chips = collectV2ReviewActionChips({
      roll,
      activeElements: [wizard, ally, adv],
      srdData,
      fearCount: 0,
      mapConfig: null,
      dedupeFeatureNames: new Set(),
      viewer: { role: 'player', viewerCharacterInstanceId: 'ally-1' },
    });
    const rw = chips.find((c) => c._featureName === 'Rune Ward' && c.name === 'Rune Ward');
    expect(rw).toBeDefined();

    const r = computePlayerV2ReviewChipApply({
      activeElements: [wizard, ally, adv],
      tableState: {},
      viewerInstanceId: 'ally-1',
      roll,
      activationKey: v2BannerChipActivationKey(rw),
      srdData,
    });
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.updates)).toBe(true);
    expect(r.updates.length).toBeGreaterThan(0);
  });
});
