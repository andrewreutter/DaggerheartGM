/**
 * Splendor domain — Divination (domain spell card)
 * SRD: Once per long rest, spend 3 Hope to ask one yes-or-no question about the near future; GM resolves the vision.
 */

export const Divination = {
  name: 'Divination',
  description:
    'Once per long rest, **spend 3 Hope** to reach out to the forces beyond and ask one "yes or no" question about an event, person, place, or situation in the near future. For a moment, the present falls away and you see the answer before you.',
  hopeCost: 3,
  frequency: 'longRest',
  onUse(table) {
    table.me.actionLoop(
      'Divination',
      'Once per long rest — spend 3 Hope to ask one yes-or-no question about an event, person, place, or situation in the near future. The present falls away; you see the answer before you (GM resolves the vision).',
      {}
    );
  },
};
