export default {
  name: 'Reloading',
  automated: false,
  tagText: 'Roll d6 after attack — 1 = must reload',
  description: 'After you make an attack, roll a d6. On a 1, you must mark a Stress to reload before firing again.',

  appendRollParts() {
    return ['Reload [d6]'];
  },

  bannerStatus(tag, roll) {
    if (!roll?.subItems) return null;
    const sub = roll.subItems.find(s => (s.pre || '').trim() === 'Reload');
    if (!sub) return null;
    const result = parseInt(sub.result, 10);
    return result === 1
      ? { text: 'Must reload! (rolled 1)', style: 'red' }
      : { text: `Loaded (rolled ${result})`, style: 'green' };
  },
};
