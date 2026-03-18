export default {
  name: 'Scary',
  description: 'On a successful attack, the target must mark a Stress.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Scary', 'On a successful attack, the target must mark a Stress.', {
      showTag: true,
      automated: true,
      tagText: 'Target: +1 Stress (applied)',
      onDamageApplied({ target }) {
        target.markStress();
      },
    });
  },
};
