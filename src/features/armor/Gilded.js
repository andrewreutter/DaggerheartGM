export default {
  name: 'Gilded',
  description: '+1 Presence.',
  onCharacterRender: (ctx) => ctx.addStatMod('presence', 1),
};
