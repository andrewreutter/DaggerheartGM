export default {
  name: 'Sheltering',
  description: 'When you mark an Armor Slot, it reduces damage for you and all allies within Melee range who took the same damage.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Sheltering', 'When you mark an Armor Slot, it reduces damage for you and all allies within Melee range who took the same damage.', {});
  },
};
