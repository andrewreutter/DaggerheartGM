/**
 * SRD: After you make an attack, roll a d6. On a result of 1, you must mark a Stress to reload this weapon before you can fire it again.
 */
export default {
  name: 'Reloading',
  description: 'After you make an attack, roll a d6. On a 1, you must mark a Stress to reload before firing again.',
  showTag: true,
  automated: false,
  tagText: 'Roll d6 after attack — 1 = must reload',
  appendRollParts: ['Reload [d6]'],
  chips: [
    {
      placement: 'banner',
      label: 'Mark 1 Stress to reload (Reloading)',
      stressCost: 1,
      isVisible: (ctx) => {
        if (!ctx.roll?.subItems) return false;
        const sub = ctx.roll.subItems.find(s => (s.pre || '').trim() === 'Reload');
        if (!sub) return false;
        const result = parseInt(sub.result, 10);
        return result === 1;
      },
    },
  ],
};
