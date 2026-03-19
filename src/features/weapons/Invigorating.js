export default {
  name: 'Invigorating',
  description: 'After an attack, roll a d4. On a 4, clear 1 Stress.',
  showTag: true,
  automated: true,
  tagText: 'Roll d4 — 4 = clear 1 Stress',
  appendRollParts() {
    return ['Invigorate [d4]'];
  },
  onRollComplete({ attacker, roll }) {
    const sub = (roll?.subItems || []).find(s => (s.pre || '').trim() === 'Invigorate');
    if (!sub || parseInt(sub.result, 10) !== 4) return;
    attacker?.clearStress(1);
  },
};
