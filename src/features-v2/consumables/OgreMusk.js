/**
 * SRD consumable — Ogre Musk (common roll table 45).
 * daggerheart-srd/consumables/Ogre Musk.md
 */

const MOD_ID = 'ogre-musk-untrackable';

export const OgreMusk = {
  name: 'Ogre Musk',
  description:
    'You can use this musk to prevent anyone from tracking you by mundane or magical means until your next rest.',
  onUse(table) {
    table.me.removeActiveModifier(MOD_ID);
    table.me.addActiveModifier({
      id: MOD_ID,
      name: 'Untrackable (Ogre Musk)',
      type: 'consumable',
      refreshOn: 'rest',
    });
  },
};
