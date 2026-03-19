export default {
  name: 'Charged',
  description: 'Before an attack, mark a Stress to add an extra damage die. The Stress is marked when the roll is acknowledged.',
  showTag: true,
  automated: true,
  tagText: '+1 damage die, mark 1 Stress (applied on dismiss)',
  onRollComplete({ attacker }) {
    attacker?.markStress(1);
  },
};
