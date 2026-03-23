/**
 * Sage domain — Conjured Steeds (Tier 2)
 * SRD: Spend any Hope for that many steeds until long rest or steeds take damage; travel / Far movement narrative; riders −2 attack / +2 damage.
 */

import { when, isActing } from '../../engine/when.js';

function hopeSpendOptions(table) {
  const h = Math.max(0, Math.floor(table.me?.hope ?? 0));
  if (h < 1) {
    return [{ id: 'none', name: 'Need at least 1 Hope' }];
  }
  return Array.from({ length: h }, (_, i) => {
    const n = i + 1;
    return {
      id: String(n),
      name: `${n} Hope (${n} steed${n === 1 ? '' : 's'})`,
    };
  });
}

export const ConjuredSteeds = {
  name: 'Conjured Steeds',
  description:
    '**Spend any number of Hope** to conjure that many magical steeds (such as horses, camels, or elephants) that you and your allies can ride until your next long rest or the steeds take any damage. The steeds double your land speed while traveling and, when in danger, allow you to move within Far range without having to roll. Creatures riding a steed gain a -2 penalty to attack rolls and a +2 bonus to damage rolls.',
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.feature.get('conjuredSteedsActive') === true,
      (t) => t.action?.type === 'attack',
      (t) => {
        t.rolls?.action?.addStatic({ name: 'Conjured Steeds (riding)', value: -2 });
      }
    ),
    onReviewAction: when(
      isActing,
      (t) => t.feature.get('conjuredSteedsActive') === true,
      (t) => t.action?.type === 'attack',
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => {
        t.rolls?.damage?.addStatic({ name: 'Conjured Steeds (riding)', value: 2 });
      }
    ),
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('conjuredSteedsActive', false);
      table.feature.set('_conjuredSteedsHopeCost', undefined);
    },
  },
  chips: [
    {
      placements: ['card'],
      name: 'Conjure steeds',
      isDisabled: (table) =>
        (table.me?.hope ?? 0) < 1 ? 'Need at least 1 Hope to conjure steeds.' : false,
      isSelect: (table) => hopeSpendOptions(table),
      hopeCost: (table) => {
        const v = table.feature.get('_conjuredSteedsHopeCost');
        return typeof v === 'number' ? v : 1;
      },
      description:
        'Spend 1+ Hope: conjure that many magical steeds until your next long rest or the steeds take damage. While riding, you take −2 to attack rolls and +2 to damage (ally riders: GM).',
      onUse(table, chip) {
        const raw = chip.get?.('selectedId') ?? '1';
        if (raw === 'none') return;
        const n = Number.parseInt(String(raw), 10);
        if (!Number.isFinite(n) || n < 1) return;
        table.feature.set('_conjuredSteedsHopeCost', n);
        table.feature.set('conjuredSteedsActive', true);
        table.me.actionLoop(
          'Conjured Steeds',
          `Spend ${n} Hope: conjure ${n} magical steed${n === 1 ? '' : 's'} for you and your allies until your next long rest or the steeds take damage. While traveling, steeds double land speed; in danger, riders may move within Far range without a roll (GM). Creatures riding take −2 to attack rolls and +2 to damage while mounted.`
        );
      },
    },
    {
      placements: ['card'],
      name: 'Steeds dispersed',
      isDisabled: (table) =>
        table.feature.get('conjuredSteedsActive') !== true
          ? 'No conjured steeds are active to dismiss.'
          : false,
      description:
        'When conjured steeds take any damage, they vanish — clear active steeds (or use at long rest cleanup if the table forgot).',
      onUse(table) {
        table.feature.set('conjuredSteedsActive', false);
        table.feature.set('_conjuredSteedsHopeCost', undefined);
        table.me.actionLoop(
          'Conjured Steeds — dispersed',
          'The magical steeds fade after taking damage or when dismissed.'
        );
      },
    },
  ],
};
