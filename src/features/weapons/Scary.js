export default {
  name: 'Scary',
  automated: true,
  tagText: 'Target: +1 Stress (applied)',
  description: 'On a successful attack, the target must mark a Stress.',
  /** Target marks 1 Stress on a successful hit. */
  onDamageApplied({ target }) {
    target.markStress();
  },
};
