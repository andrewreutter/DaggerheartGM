export default {
  name: 'Flexible',
  description: '+1 Evasion.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Flexible', '+1 Evasion.', {
      onCharacterRender: (ctx) => ctx.addStatMod('evasion', 1),
    });
  },
};
