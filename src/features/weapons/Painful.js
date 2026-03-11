export default {
  name: 'Painful',
  automated: true,
  tagText: 'Self: +1 Stress (applied)',
  /** Mark 1 Stress on the attacker when the weapon roll completes. */
  onRollComplete({ attacker }) {
    attacker?.markStress(1);
  },
};
