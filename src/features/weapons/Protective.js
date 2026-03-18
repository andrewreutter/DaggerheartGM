export default {
  name: 'Protective',
  description: 'Bonus to Armor Score.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Protective', 'Bonus to Armor Score.', {
      onCharacterRender: (ctx) => ctx.addStatMod('armorScore', 1),
    });
  },
};
