export default {
  name: 'Locked On',
  description: 'On a successful attack, your next primary weapon attack against the same target automatically succeeds.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Locked On', 'On a successful attack, your next primary weapon attack against the same target automatically succeeds.', {});
  },
};
