export default {
  name: 'Startling',
  description: 'As an action, you can startle a creature within range (action card; costs 1 Stress).',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Startling', 'As an action, you can startle a creature within range (action card; costs 1 Stress).', {
      showTag: true,
      automated: true,
      tagText: 'Action card — costs 1 Stress',
      onRollComplete({ attacker, roll }) {
        if (!roll?._action) return;
        attacker?.markStress(1);
      },
    });
  },
};
