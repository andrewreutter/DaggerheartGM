/**
 * SRD consumable — Hopehold Flare (common roll table 37).
 * daggerheart-srd/consumables/Hopehold Flare.md
 */

import { when } from '../engine/when.js';

const FS = 'Hopehold Flare';
const SCOPE = 'consumables:srd-cns-hopehold-flare';

function hopeholdBag(table) {
  if (table.source?.get) {
    const active = table.source.get('active');
    const activatorInstanceId = table.source.get('activatorInstanceId');
    if (active !== undefined && active !== null) {
      return { active, activatorInstanceId };
    }
    if (activatorInstanceId !== undefined && activatorInstanceId !== null) {
      return { active, activatorInstanceId };
    }
  }
  return table.featureState?.[SCOPE] ?? table.featureState?.[FS];
}

/** SRD "within Close range": Melee, Very Close, or Close (not Far / Very Far). */
function isWithinCloseRange(activator, other) {
  const b = activator?.rangeFrom?.(other);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function isActivatingCharacterWithActiveFlare(table) {
  const bag = hopeholdBag(table);
  return (
    bag?.active === true &&
    table.me?.instanceId != null &&
    table.me.instanceId === bag.activatorInstanceId
  );
}

function batchHasSpendHope(table) {
  return (table.mutationBatch || []).some(
    (m) => m.type === 'spendHope' && (m.payload?.amount ?? 0) > 0
  );
}

/** Activator is still on the table (required for range checks). */
function activatorOnTable(table) {
  const id = hopeholdBag(table)?.activatorInstanceId;
  return Boolean(id) && table.characters.some((c) => c.instanceId === id);
}

export const HopeholdFlare = {
  name: 'Hopehold Flare',
  description:
    'When you use this flare, allies within Close range roll a d6 when they spend a Hope. On a result of 6, they gain the effect of that Hope without spending it. The flare lasts until the end of the scene.',
  onUse(table) {
    table.source.set('active', true);
    table.source.set('activatorInstanceId', table.me.instanceId);
    table.me.actionLoop(
      'Hopehold Flare',
      'Allies within Close range roll a d6 when they spend Hope; on a 6, they gain the effect without spending it. Lasts until the scene ends.'
    );
  },
  hooks: {
    onStateChange: when(
      isActivatingCharacterWithActiveFlare,
      batchHasSpendHope,
      activatorOnTable,
      (table) => {
        const bag = hopeholdBag(table);
        const activator = table.characters.find((c) => c.instanceId === bag.activatorInstanceId);

        for (const m of table.mutationBatch) {
          if (m.type !== 'spendHope') continue;
          const id = m.payload?.instanceId;
          const amount = Math.max(0, Math.floor(Number(m.payload?.amount) || 0));
          if (!id || amount < 1) continue;

          const spender = table.characters.find((c) => c.instanceId === id);
          if (!spender) continue;
          if (!isWithinCloseRange(activator, spender)) continue;

          const roll = table.rollDie('d6');
          if (roll === 6) {
            spender.gainHope(amount);
            spender.actionLoop(
              'Hopehold Flare',
              `Rolled ${roll} on the Hopehold Flare d6 — regain ${amount} Hope (effect without spending).`
            );
          }
        }
      }
    ),
    onSceneEnd: when(isActivatingCharacterWithActiveFlare, (table) => {
      table.source.set('active', false);
      table.source.set('activatorInstanceId', null);
    }),
  },
};
