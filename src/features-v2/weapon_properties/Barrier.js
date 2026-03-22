export const Barrier = {
  name: 'Barrier',
  description: '+X to Armor Score; -1 to Evasion (X = weapon tier + 1)',
  passiveStatMods: {
    armorScore: (table) => {
      const tier = parseInt(table.source?.tier ?? 1, 10) || 1;
      return tier + 1;
    },
    evasion: -1,
  },
};
