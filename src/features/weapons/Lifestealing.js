export default {
  name: 'Lifestealing',
  description: 'After an attack, roll a d6. On a 6, clear 1 HP.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Lifestealing', 'After an attack, roll a d6. On a 6, clear 1 HP.', {
      showTag: true,
      automated: true,
      tagText: 'Roll d6 — 6 = clear 1 HP',
      appendRollParts() {
        return ['Lifesteal [d6]'];
      },
      onRollComplete({ attacker, roll }) {
        const sub = (roll?.subItems || []).find(s => (s.pre || '').trim() === 'Lifesteal');
        if (!sub || parseInt(sub.result, 10) !== 6) return;
        attacker?.clearHp(1);
      },
    });
  },
};
