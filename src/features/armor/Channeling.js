export default {
  name: 'Channeling',
  description: '+1 to Spellcast rolls.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Channeling', '+1 to Spellcast rolls.', {
      onCharacterRender: (ctx) => ctx.addRollModifier({ trait: 'spellcast', bonus: 1, label: 'Channeling' }),
    });
  },
};
