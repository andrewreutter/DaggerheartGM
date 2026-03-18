export default {
  name: 'Cumbersome',
  description: '-1 to Finesse',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Cumbersome', '-1 to Finesse', {
      onCharacterRender: (ctx) => ctx.addStatMod('finesse', -1),
    });
  },
};
