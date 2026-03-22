/**
 * Wizard class features — per-feature descriptors.
 *
 * SRD (class): Whether through an institution or individual study, those known as wizards acquire and hone immense
 * magical power over years of learning using a variety of tools, including books, stones, potions, and herbs.
 *
 * SRD (Not This Time, Hope): **Spend 3 Hope** to force an adversary within Far range to reroll an attack or damage roll.
 *
 * Implementation: Not This Time — hope ability (3 Hope to force adversary reroll); UI in ResultBanner.
 */

/** @type {Record<string, object>} */
const features = {
  'Not This Time': {
    name: 'Not This Time',
    class: 'Wizard',
    hopeAbility: {
      name: 'Not This Time',
      hopeCost: 3,
      description: 'When an adversary rolls against you or an ally, you may spend 3 Hope to force them to reroll.',
      triggeredOn: 'adversary-roll',
      bannerInteraction: {
        type: 'reroll-button',
        phase: 'pre-apply',
        prompt: 'Not This Time (3 Hope)',
      },
    },
  },
};

export default features;
