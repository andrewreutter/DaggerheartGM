/**
 * SRD consumable — Morphing Clay (common roll table 15).
 * daggerheart-srd/consumables/Morphing Clay.md
 */

export const MorphingClay = {
  name: 'Morphing Clay',
  description:
    'You can spend a Hope to use this clay, altering your face enough to make you unrecognizable until your next rest.',
  hopeCost: 1,
  onUse(table) {
    table.me.removeActiveModifier('morphing-clay-disguise');
    table.me.addActiveModifier({
      id: 'morphing-clay-disguise',
      name: 'Disguised (Morphing Clay)',
      type: 'consumable',
      refreshOn: 'rest',
    });
  },
};
