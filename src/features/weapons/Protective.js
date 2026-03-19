export default {
  name: 'Protective',
  description: 'Bonus to Armor Score.',
  onCharacterRender: (ctx) => ctx.addStatMod('armorScore', 1),
};
