export default {
  name: 'Quiet',
  description: '+2 to stealth rolls.',
  onCharacterRender: (ctx) => ctx.addRollModifier({ trait: 'stealth', bonus: 2, label: 'Quiet' }),
};
