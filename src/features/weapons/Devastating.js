export default {
  name: 'Devastating',
  description: 'Before an attack roll, mark a Stress to use a d20 as your damage die.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Devastating', 'Before an attack roll, mark a Stress to use a d20 as your damage die.', {
      showTag: true,
      automated: true,
      tagText: 'd20 damage die, mark 1 Stress (active)',
    });
  },
};
