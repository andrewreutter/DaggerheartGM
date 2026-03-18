export default {
  name: 'Heavy',
  description: '-1 Evasion.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Heavy', '-1 Evasion.', {
      onCharacterRender: (ctx) => ctx.addStatMod('evasion', -1),
    });
  },
};
