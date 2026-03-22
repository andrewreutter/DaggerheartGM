/**
 * Valor domain — Bare Bones (Tier 1)
 * SRD: Unarmored — Armor Score 3 + Strength; tiered base Major/Severe thresholds.
 */

const BARE_MAJOR = { 1: 9, 2: 11, 3: 13, 4: 15 };
const BARE_SEVERE = { 1: 19, 2: 24, 3: 31, 4: 38 };

export const BareBones = {
  name: 'Bare Bones',
  description:
    'When you choose not to equip armor, you have a base Armor Score of 3 + your Strength and use the following as your base damage thresholds:\n\n- _Tier 1_: 9/19\n- _Tier 2_: 11/24\n- _Tier 3_: 13/31\n- _Tier 4_: 15/38',
  passiveStatMods: {
    armorScore: (table) => {
      if (table.me?.armorId) return 0;
      const str = table.me?.traits?.strength ?? 0;
      const target = 3 + str;
      const current = table.me?.armorScore ?? 0;
      return target - current;
    },
    majorThreshold: (table) => {
      if (table.me?.armorId) return 0;
      const tier = Math.min(4, Math.max(1, table.me?.tier ?? 1));
      const tgt = BARE_MAJOR[tier] ?? 9;
      const cur = table.me?.armorThresholdMajor ?? 0;
      return tgt - cur;
    },
    severeThreshold: (table) => {
      if (table.me?.armorId) return 0;
      const tier = Math.min(4, Math.max(1, table.me?.tier ?? 1));
      const tgt = BARE_SEVERE[tier] ?? 19;
      const cur = table.me?.armorThresholdSevere ?? 0;
      return tgt - cur;
    },
  },
};
