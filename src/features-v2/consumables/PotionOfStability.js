/**
 * SRD consumable — Potion of Stability (common roll table 13).
 * daggerheart-srd/consumables/Potion of Stability.md
 *
 * Drink during a rest to gain one additional downtime move (`placement: 'rest'` chip).
 * `onUse` removes the item and sets `featureState['consumables:srd-cns-potion-of-stability'].restBonusActive`
 * so `passiveStatMods` (CONV-011) still apply until the rest is acknowledged.
 */

import { when } from '../engine/when.js';

const CONSUMABLE_ID = 'srd-cns-potion-of-stability';
const SCOPE = `consumables:${CONSUMABLE_ID}`;

function hasPotionInInventory(table) {
  const inv = table?.me?.inventory;
  if (!Array.isArray(inv)) return false;
  return inv.some(
    (e) =>
      e &&
      typeof e === 'object' &&
      (e.id === CONSUMABLE_ID || /potion\s+of\s+stability/i.test(String(e.name || '')))
  );
}

export const PotionOfStability = {
  name: 'Potion of Stability',
  sourceScopeKey: SCOPE,
  description:
    'You can drink this potion to choose one additional downtime move.',
  passiveStatMods: when(
    (t) => t.source.get('restBonusActive') === true,
    {
      numShortRestSlots: 1,
      numLongRestSlots: 1,
    }
  ),
  chips: [
    {
      name: 'Drink — extra downtime move',
      placements: ['rest'],
      description: 'Consume this potion to gain one additional downtime move this rest.',
      isDisabled: (table) => (!hasPotionInInventory(table) ? 'No Potion of Stability in inventory' : false),
      onUse(table) {
        if (!hasPotionInInventory(table)) return;
        table.me.inventory.remove('Potion of Stability');
        table.source.set('restBonusActive', true);
      },
    },
  ],
};
