export default {
  name: 'Hooked',
  description: 'On a successful attack, you can pull the target into Melee range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Hooked', 'On a successful attack, you can pull the target into Melee range.', {});
  },
};
