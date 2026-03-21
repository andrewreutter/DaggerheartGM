/**
 * Clank Ancestry Features (V2)
 *
 * SRD source: daggerheart-srd/ancestries/Clank.md
 */

export const PurposefulDesign = {
  name: 'Purposeful Design',
  description:
    'Decide who made you and for what purpose. At character creation, choose one of your Experiences that best aligns with this purpose and gain a permanent +1 bonus to it.',
  chips: [
    {
      description: 'Choose an Experience to gain a permanent +1 bonus.',
      placements: ['create'],
      isSelect: (table) =>
        (table.me?.experiences || []).map((e) => ({ id: e.id, name: e.name })),
      onUse: (table, chip) => {
        const selectedId = chip.get('selectedId');
        if (selectedId) {
          table.me?.addExperienceBonus(selectedId, 1);
        }
      },
    },
  ],
};

export const Efficient = {
  name: 'Efficient',
  description:
    'When you take a short rest, you can choose a long rest move instead of a short rest move.',
  passiveStatMods: {
    numLongMovesInShortRest: 1,
  },
};
