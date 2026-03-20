/**
 * Giant ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Giants are towering humanoids with broad shoulders, long arms, and one to three eyes. Adult giants
 * range from 6 ½ to 8 ½ feet tall and are naturally muscular. The average giant lifespan is about 75 years.
 *
 * SRD (Endurance): Gain an additional Hit Point slot at character creation.
 *
 * SRD (Reach): Treat any weapon, ability, spell, or other feature that has a Melee range as though it has a Very Close
 * range instead.
 */
export default {
  Endurance: {
    passiveStatMods: { maxHp: 1 },
  },
  Reach: {
    weaponsFilter: (weapons) => weapons.map((w) =>
      w.range === 'Melee'
        ? { ...w, effectiveRange: 'Very Close' }
        : w,
    ),
  },
};
