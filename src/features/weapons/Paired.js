export default {
  name: 'Paired',
  description: 'Bonus to primary weapon damage to targets within Melee range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Paired', 'Bonus to primary weapon damage to targets within Melee range.', {});
  },
};
