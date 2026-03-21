export const Barrier = {
  name: 'Barrier',
  description: '+X to Armor Score; -1 to Evasion (X = weapon tier + 1)',
  passiveStatMods: {
    // armorScore bonus scales with weapon tier: +2 at T1, +3 at T2, +4 at T3, +5 at T4
    // Tier is read from the source weapon via table.me.weapons (self._weaponId identifies it).
    armorScore: (table) => (table.me?.primaryWeapon?.tier ?? 1) + 1,
    armorScore: (table, self) => {
      const weapon = table.me?.weapons?.find((w) => w.id === self?._weaponId);
      return (weapon?.tier ?? 1) + 1;
    },
    evasion: -1,
  },
};
