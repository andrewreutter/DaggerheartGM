/**
 * Firbolg ancestry builder.
 *
 * Features:
 *   Charge     — Pre-roll toggle: "I moved" then Agility roll gains benefit on success (add advantage d6).
 *   Unshakable — Before marking Stress, roll d6; on 6 do not mark (onMarkStress).
 */
export default {
  name: 'Firbolg',
  description: 'Firbolgs are large, peaceful humanoids with a deep connection to nature and the wild. They are known for their strength and resilience.',

  features: [
    {
      name: 'Charge',
      description: 'When you move and then make an Agility roll, you gain a benefit on success (add advantage d6).',
      onAct(ctx) {
        ctx.canvas.addChip({
          label: 'I moved this turn (Charge)',
          isVisible: (r) => r.isMine && r._traitKey === 'agility',
          onUse: (r) => r.addAdvantageDie('Charge'),
        });
      },
    },
    {
      name: 'Unshakable',
      description: 'Before you mark Stress, you can roll a d6. On a 6, you do not mark the Stress.',
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
  ],
};
