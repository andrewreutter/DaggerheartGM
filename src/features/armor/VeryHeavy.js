export default {
  name: 'Very Heavy',
  description: '-2 Evasion; -1 Agility.',
  onCharacterRender(ctx) {
    ctx.addStatMod('evasion', -2);
    ctx.addStatMod('agility', -1);
  },
};
