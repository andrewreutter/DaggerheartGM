export default {
  name: 'Invigorating',
  automated: true,
  tagText: 'Roll d4 — 4 = clear 1 Stress',

  appendRollParts() {
    return ['Invigorate [d4]'];
  },

  /** Clear 1 Stress on the attacker when the Invigorate die rolls a 4. */
  onRollComplete({ attacker, roll }) {
    const sub = (roll?.subItems || []).find(s => (s.pre || '').trim() === 'Invigorate');
    if (!sub || parseInt(sub.result, 10) !== 4) return;
    attacker?.clearStress(1);
  },
};
