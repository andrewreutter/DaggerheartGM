/**
 * Firbolg ancestry — feature hooks keyed by feature name.
 *
 * SRD (ancestry): Firbolgs are bovine humanoids typically recognized by their broad noses and long, drooping ears. They
 * are tall and muscular creatures, with heights ranging from around 5 feet to 7 feet, and possess remarkable strength.
 * On average, firbolgs live for about 150 years.
 *
 * SRD (Charge): When you succeed on an Agility Roll to move from Far or Very Far range into Melee range with one or
 * more targets, you can **mark a Stress** to deal **1d12** physical damage to all targets within Melee range.
 *
 * SRD (Unshakable): When you would mark a Stress, roll a **d6.** On a result of 6, don't mark it.
 */
export default {
  Charge: {
    chips: [
      {
        placement: 'preroll',
        label: 'I moved this turn (Charge)',
        isVisible: (ctx) => ctx.roll.isMine && ctx.roll._traitKey === 'agility',
        onUse: ({roll}) => roll.addAdvantageDie('Charge'),
      },
    ],
  },
  Unshakable: {
    async onMarkStress({ character, amount, source, rollDice, postAction }) {
      const results = await Promise.all(Array.from({ length: amount }, () => rollDice('1d6')));
      const rolls = results.map((r) => r?.value ?? 0);
      const sixes = rolls.filter((v) => v === 6).length;
      const marked = amount - sixes;
      const rollStr = rolls.join(', ');
      if (sixes >= amount) {
        postAction(`Rolled ${rollStr} — Stress not marked.`);
        return { cancel: true };
      }
      if (sixes > 0) {
        postAction(`Rolled ${rollStr} — ${marked} Stress marked (${sixes} cancelled).`);
        return { reduceBy: sixes };
      }
      postAction(`Rolled ${rollStr} — ${amount} Stress marked.`);
      return {};
    },
  },
};
