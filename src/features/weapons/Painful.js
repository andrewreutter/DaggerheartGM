/**
 * SRD: Each time you make a successful attack, you must mark a Stress.
 */
export default {
  name: 'Painful',
  description: 'When you hit with this weapon, you must mark a Stress.',
  showTag: true,
  automated: true,
  tagText: 'Self: +1 Stress (applied)',
  onRollComplete({ attacker }) {
    attacker?.markStress(1);
  },
};
