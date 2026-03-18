export default {
  name: 'Greedy',
  description: 'Spend a handful of gold to gain +1 to your Proficiency on a damage roll.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Greedy', 'Spend a handful of gold to gain +1 to your Proficiency on a damage roll.', {});
  },
};
