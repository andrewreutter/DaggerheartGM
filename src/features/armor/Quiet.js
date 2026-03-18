export default {
  name: 'Quiet',
  description: '+2 to stealth rolls.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Quiet', '+2 to stealth rolls.', {
      onCharacterRender: (ctx) => ctx.addRollModifier({ trait: 'stealth', bonus: 2, label: 'Quiet' }),
    });
  },
};
