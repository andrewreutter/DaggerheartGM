/**
 * Splendor domain — Shape Material (domain spell card, Level 5)
 * SRD: Spend 1 Hope to shape natural material you touch; area ≤ your size; only within Close range of the touch point.
 */

export const ShapeMaterial = {
  name: 'Shape Material',
  description:
    '**Spend a Hope** to shape a section of natural material you\'re touching (such as stone, ice, or wood) to suit your purpose. The area of the material can be no larger than you. For example, you can form a rudimentary tool or create a door.\n\nYou can only affect the material within Close range of where you\'re touching it.',
  hopeCost: 1,
  onUse(table) {
    table.me.actionLoop(
      'Shape Material',
      'Spend 1 Hope to shape natural material you are touching (such as stone, ice, or wood). The shaped area can be no larger than you (e.g. a rudimentary tool or a door). You can only affect material within Close range of where you are touching it.',
      {}
    );
  },
};
