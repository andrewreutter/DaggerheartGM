/**
 * SRD: On a successful attack, roll a d6. On a result of 6, clear a Hit Point or clear a Stress.
 */
export default {
  name: 'Lifestealing',
  description: 'On a successful attack, roll a d6. On a 6, clear 1 HP.',
  showTag: true,
  automated: true,
  tagText: 'Roll d6 — 6 = clear 1 HP',
  appendRollParts: ['Lifesteal [d6]'],
  onRollComplete({ attacker, roll }) {
    const sub = (roll?.subItems || []).find(s => (s.pre || '').trim() === 'Lifesteal');
    if (!sub || parseInt(sub.result, 10) !== 6) return;
    attacker?.clearHp(1);
  },
};
