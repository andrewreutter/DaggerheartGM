export default {
  name: 'Grappling',
  description: 'On a successful attack, spend a Hope to Restrain the target or pull them into Melee range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Grappling', 'On a successful attack, spend a Hope to Restrain the target or pull them into Melee range.', {});
  },
};
