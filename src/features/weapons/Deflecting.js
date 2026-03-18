export default {
  name: 'Deflecting',
  description: 'When attacked, mark an Armor Slot to gain a bonus to Evasion equal to your available Armor Score.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Deflecting', 'When attacked, mark an Armor Slot to gain a bonus to Evasion equal to your available Armor Score.', {});
  },
};
