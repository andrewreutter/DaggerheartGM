export default {
  name: 'Lifestealing',
  automated: true,
  tagText: 'Roll d6 — 6 = clear 1 HP',

  appendRollParts() {
    return ['Lifesteal [d6]'];
  },

  /** Restore 1 HP on the attacker when the Lifesteal die rolls a 6. */
  onRollComplete({ attacker, roll }) {
    const sub = (roll?.subItems || []).find(s => (s.pre || '').trim() === 'Lifesteal');
    if (!sub || parseInt(sub.result, 10) !== 6) return;
    attacker?.clearHp(1);
  },
};
