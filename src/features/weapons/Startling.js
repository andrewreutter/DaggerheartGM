export default {
  name: 'Startling',
  automated: true,
  tagText: 'Action card — costs 1 Stress',
  /**
   * Mark 1 Stress on the attacker when the Startling action notification
   * completes. Only runs on action notifications (`_action: true`).
   */
  onRollComplete({ attacker, roll }) {
    if (!roll?._action) return;
    attacker?.markStress(1);
  },
};
