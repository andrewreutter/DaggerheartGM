/**
 * Standalone Stress spend on the weapon card (not tied to attack resolve or intent).
 * SRD: "Mark a Stress to crack the whip…" — use `card` placement so it does not require
 * being inside an attack action loop.
 */
export const Startling = {
  name: 'Startling',
  description:
    'Mark a Stress to crack the whip and force all adversaries within Melee range back to Close range.',
  chips: [
    {
      placements: ['card'],
      stressCost: 1,
      description:
        'Crack the whip: each adversary in Melee range with you is forced back to Close range.',
      isDisabled(table) {
        const advs = table.adversaries ?? [];
        return !advs.some((a) => table.me.rangeFrom(a) === 'melee');
      },
      onUse(table) {
        for (const adv of table.adversaries ?? []) {
          if (table.me.rangeFrom(adv) !== 'melee') continue;
          adv.move(
            (t) => t.me.rangeFrom(adv) === 'close',
            'Forced back to Close range'
          );
        }
      },
    },
  ],
};
