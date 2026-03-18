export default {
  name: 'Concussive',
  description: 'On a successful attack, spend a Hope to knock the target back to Far range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Concussive', 'On a successful attack, spend a Hope to knock the target back to Far range.', {});
  },
};
