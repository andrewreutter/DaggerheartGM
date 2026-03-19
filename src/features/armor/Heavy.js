export default {
  name: 'Heavy',
  description: '-1 Evasion.',
  onCharacterRender: (ctx) => ctx.addStatMod('evasion', -1),
};
