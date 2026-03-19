export default {
  name: 'Heavy',
  description: '-1 to Evasion',
  onCharacterRender: (ctx) => ctx.addStatMod('evasion', -1),
};
