/**
 * SRD item — Skeleton Key (roll table 16)
 *
 * Advantage on the Finesse Roll when using this key to open a locked door.
 */

import { when } from '../engine/when.js';

export const SkeletonKey = {
  name: 'Skeleton Key',
  description:
    'When you use this key to open a locked door, you gain advantage on the Finesse Roll.',
  advantageTriggers: [
    when(
      (table) => table.action?.trait === 'Finesse',
      'Finesse Rolls to open a locked door with this key'
    ),
  ],
};
