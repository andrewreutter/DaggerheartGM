export default {
  name: 'Retractable',
  description: 'The blade can be hidden in the hilt to avoid detection.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Retractable', 'The blade can be hidden in the hilt to avoid detection.', {});
  },
};
