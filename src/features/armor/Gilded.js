export default {
  name: 'Gilded',
  description: '+1 Presence.',
  onCharacterBuild({ character, armor }) {
    character.addFeature('Gilded', '+1 Presence.', {
      onCharacterRender: (ctx) => ctx.addStatMod('presence', 1),
    });
  },
};
