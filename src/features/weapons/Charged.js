export default {
  name: 'Charged',
  automated: true,
  tagText: '+1 damage die, mark 1 Stress (applied on dismiss)',
  /**
   * Mark 1 Stress on the attacker when a Charged weapon roll (or action
   * notification) completes.  Charged always uses `_attackerInstanceId`
   * so `attacker` is resolved from that field in the hook context.
   */
  onRollComplete({ attacker }) {
    attacker?.markStress(1);
  },
};
