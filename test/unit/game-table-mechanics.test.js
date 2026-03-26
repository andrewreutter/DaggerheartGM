import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  resolveParryWeaponFeature,
  resolveWeaponOnBannerAckDescriptor,
  resolveOriginFeatureDescriptor,
  resolveClassFeatureDescriptor,
  resolveVirtualWeaponBehavior,
  resolveWeaponTagDescriptor,
  getWeaponTagAutomatedForBanner,
  buildWeaponTagBannerNarrationParts,
  buildRollBaseBannerNarrationParts,
  wrapEntity,
} from '../../src/client/lib/game-table-mechanics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('game-table-mechanics (V2-only facade)', () => {
  it('resolveParryWeaponFeature returns activeFeatures Parry row', () => {
    const parryRow = { name: 'Parry', onBeforeDamageApplied: async () => 3 };
    const charEl = {
      activeFeatures: [parryRow],
      weapons: [{ feature: { name: 'Parry' } }],
    };
    expect(resolveParryWeaponFeature(charEl)).toBe(parryRow);
  });

  it('resolveWeaponOnBannerAckDescriptor returns null without a matching row', () => {
    expect(resolveWeaponOnBannerAckDescriptor({ activeFeatures: [] }, 'TotallyFakeTag')).toBe(null);
  });

  it('wrapEntity mutates stress via updateActiveElement', () => {
    const updates = [];
    const el = { instanceId: 'a', maxStress: 6, currentStress: 0 };
    const w = wrapEntity(el, (id, u) => updates.push([id, u]));
    w.markStress(2);
    expect(updates).toEqual([['a', { currentStress: 2 }]]);
  });

  it('resolveOriginFeatureDescriptor returns ancestry row from activeFeatures', () => {
    const row = { name: 'Luckbringer', type: 'ancestry', onSessionStart: () => {} };
    expect(
      resolveOriginFeatureDescriptor({ activeFeatures: [row] }, 'Luckbringer')
    ).toBe(row);
  });

  it('resolveClassFeatureDescriptor returns class row from activeFeatures', () => {
    const row = { name: 'Beastform', type: 'class', class: 'Druid', onFeatureActivated: () => {} };
    expect(resolveClassFeatureDescriptor({ activeFeatures: [row] }, 'Beastform')).toBe(row);
  });

  it('resolveWeaponTagDescriptor returns weapon row from activeFeatures', () => {
    const row = { name: 'Reliable', type: 'weapon', showTag: true, automated: true };
    expect(
      resolveWeaponTagDescriptor('Reliable', { activeFeatures: [row] })
    ).toBe(row);
  });

  it('getWeaponTagAutomatedForBanner reads automated from activeFeatures', () => {
    const attackerEl = {
      activeFeatures: [{ name: 'Reliable', type: 'weapon', automated: true }],
    };
    expect(getWeaponTagAutomatedForBanner('Reliable', attackerEl)).toBe(true);
  });

  it('getWeaponTagAutomatedForBanner is false without attacker context', () => {
    expect(getWeaponTagAutomatedForBanner('Reliable', null)).toBe(false);
  });

  it('buildWeaponTagBannerNarrationParts adds automated description lines for matching weapon tags', () => {
    const attackerEl = {
      activeFeatures: [
        { name: 'Reliable', type: 'weapon', automated: true, description: '+1 to attack rolls with this weapon.' },
      ],
    };
    expect(buildWeaponTagBannerNarrationParts(['Reliable'], attackerEl)).toEqual([
      { text: '+1 to attack rolls with this weapon.', style: 'automated' },
    ]);
  });

  it('buildWeaponTagBannerNarrationParts skips non-automated or missing description', () => {
    const attackerEl = {
      activeFeatures: [
        { name: 'Showy', type: 'weapon', automated: false, description: 'x' },
        { name: 'Quiet', type: 'weapon', automated: true },
      ],
    };
    expect(buildWeaponTagBannerNarrationParts(['Showy', 'Quiet'], attackerEl)).toEqual([]);
  });

  it('buildRollBaseBannerNarrationParts merges roll._narration with automated weapon tag lines', () => {
    const attackerEl = {
      activeFeatures: [
        { name: 'Reliable', type: 'weapon', automated: true, description: '+1 to attack rolls with this weapon.' },
      ],
    };
    const roll = {
      _narration: 'Aim carefully.',
      tags: [{ name: 'Reliable' }],
    };
    expect(buildRollBaseBannerNarrationParts(roll, attackerEl)).toEqual([
      { text: 'Aim carefully.' },
      { text: '+1 to attack rolls with this weapon.', style: 'automated' },
    ]);
  });

  it('resolveVirtualWeaponBehavior reads virtualWeapon from activeFeatures', () => {
    const onAcknowledge = () => {};
    const attackerEl = {
      activeFeatures: [
        {
          name: 'Retracting Claws',
          type: 'ancestry',
          virtualWeapon: { onAcknowledge, stressCost: 1 },
        },
      ],
    };
    const b = resolveVirtualWeaponBehavior('Retracting Claws', attackerEl);
    expect(b.onAcknowledge).toBe(onAcknowledge);
    expect(b.stressCost).toBe(1);
  });

  it('game-table-mechanics.js does not import legacy Phase 1 registry paths', () => {
    const path = join(__dirname, '../../src/client/lib/game-table-mechanics.js');
    const src = readFileSync(path, 'utf8');
    expect(src).not.toContain('../../features/');
    expect(src).not.toContain('phase1-game-table-registry');
  });
});
