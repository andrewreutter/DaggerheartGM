export default {
  name: 'Hot',
  description: 'This weapon cuts through solid material.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Hot', 'This weapon cuts through solid material.', {});
  },
};
