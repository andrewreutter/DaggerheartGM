/**
 * Grace domain — Deft Deceiver (Tier 1)
 * SRD: Spend a Hope to gain advantage on a roll to deceive or trick someone into believing a lie you tell them.
 */

export const DeftDeceiver = {
  name: 'Deft Deceiver',
  description:
    '**Spend a Hope** to gain advantage on a roll to deceive or trick someone into believing a lie you tell them.',
  chips: [
    {
      placements: ['intent'],
      label: 'Deft Deceiver',
      hopeCost: 1,
      description:
        'Spend 1 Hope to add an advantage die to your next action roll to deceive or trick someone into believing a lie you tell them.',
      onUse(table) {
        table.rolls?.action?.addAdvantageDie?.('Deft Deceiver');
      },
    },
  ],
};
