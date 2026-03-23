/**
 * SRD item — Arcane Prism (roll table 17)
 *
 * Place and activate at your token position. Allies within Close range of the prism gain +1 to
 * Spellcast Rolls. While active the prism cannot be moved (position is fixed). After you
 * deactivate it, it cannot be activated again until your next long rest.
 */

import { when, isActing } from '../engine/when.js';

function calcRangeBand(dist) {
  if (dist <= 5) return 'melee';
  if (dist <= 10) return 'veryClose';
  if (dist <= 30) return 'close';
  if (dist <= 100) return 'far';
  return 'veryFar';
}

function rangeBandBetweenPoints(x1, y1, x2, y2) {
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const dx = x1 - x2;
  const dy = y1 - y2;
  return calcRangeBand(Math.sqrt(dx * dx + dy * dy));
}

function isAllySpellcasterInCloseOfPrism(table) {
  const actor = table.action?.actor;
  if (!actor?.isCharacter) return false;
  const px = table.feature.get('prismTokenX');
  const py = table.feature.get('prismTokenY');
  const band = rangeBandBetweenPoints(px, py, actor.tokenX, actor.tokenY);
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

export const ArcanePrism = {
  name: 'Arcane Prism',
  description:
    "Position this prism in a location of your choosing and activate it. All allies within Close range of it gain a +1 bonus to their Spellcast Rolls. While activated, the prism can't be moved. Once the prism is deactivated, it can't be activated again until your next long rest.",
  hooks: {
    onIntent: when(
      (t) => t.action?.type === 'spellcast',
      (t) => t.feature.get('prismActive') === true,
      isAllySpellcasterInCloseOfPrism,
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Arcane Prism', value: 1 });
      }
    ),
    onRest: when(
      (t) => t.action?.type === 'longRest',
      (table) => {
        table.feature.set('prismCooldownUntilLongRest', false);
        table.feature.set('prismActive', false);
        table.feature.set('prismTokenX', null);
        table.feature.set('prismTokenY', null);
      }
    ),
  },
  chips: [
    when(
      isActing,
      (t) => t.feature.get('prismCooldownUntilLongRest') !== true,
      (t) => t.feature.get('prismActive') !== true,
      (t) => t.me?.tokenX != null && t.me?.tokenY != null,
      {
        name: 'Activate Arcane Prism',
        placements: ['card'],
        description:
          'Place and activate the prism at your current token position. Allies within Close range gain +1 to Spellcast Rolls while it stays active; the prism cannot be moved until deactivated.',
        onUse(table) {
          table.feature.set('prismActive', true);
          table.feature.set('prismTokenX', table.me.tokenX);
          table.feature.set('prismTokenY', table.me.tokenY);
        },
      }
    ),
    when(
      isActing,
      (t) => t.feature.get('prismActive') === true,
      {
        name: 'Deactivate Arcane Prism',
        placements: ['card'],
        description:
          "Deactivate the prism. It can't be activated again until your next long rest.",
        onUse(table) {
          table.feature.set('prismActive', false);
          table.feature.set('prismTokenX', null);
          table.feature.set('prismTokenY', null);
          table.feature.set('prismCooldownUntilLongRest', true);
        },
      }
    ),
  ],
};
