export default {
  name: 'Flexible',
  description: '+1 Evasion.',
  onCharacterRender: (ctx) => ctx.addStatMod('evasion', 1),
};
