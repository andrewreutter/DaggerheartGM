export default {
  name: 'Returning',
  description: 'When this weapon is thrown within its range, it appears in your hand immediately after the attack.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Returning', 'When this weapon is thrown within its range, it appears in your hand immediately after the attack.', {});
  },
};
