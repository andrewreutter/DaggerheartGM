export default {
  name: 'Double Duty',
  description: '+1 to Armor Score; +1 to primary weapon damage within Melee range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Double Duty', '+1 to Armor Score; +1 to primary weapon damage within Melee range.', {
      onCharacterRender: (ctx) => ctx.addStatMod('armorScore', 1),
    });
  },
};
