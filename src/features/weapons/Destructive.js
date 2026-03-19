export default {
  name: 'Destructive',
  description: '-1 to Agility; on a successful attack, all adversaries within Very Close range must mark a Stress.',
  onCharacterRender: (ctx) => ctx.addStatMod('agility', -1),
};
