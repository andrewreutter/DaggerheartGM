/**
 * Sorcerer class features — SRD: daggerheart-srd/classes/Sorcerer.md
 */

import { when, isActing } from '../engine/when.js';

export const ArcaneSense = {
  name: 'Arcane Sense',
  description:
    'You can sense the presence of magical people and objects within Close range.',
};

export const MinorIllusion = {
  name: 'Minor Illusion',
  description:
    'Make a Spellcast Roll (10). On a success, you create a minor visual illusion no larger than yourself within Close range. This illusion is convincing to anyone at Close range or farther.',
  onUse(table) {
    table.me.actionLoop(
      'Minor Illusion',
      'Attempt to create a minor visual illusion within Close range.',
      { difficulty: 10 }
    );
  },
};

function hasDamageDice(table) {
  return (table.rolls?.damage?.dice?.length ?? 0) > 0;
}

/** Pending magic damage to this attack's primary target (host fills `action.effects` during review). */
function pendingMagicDamageToAttackTarget(table) {
  const tid = table.action?.target?.instanceId;
  if (!tid) return false;
  return (table.action?.effects ?? []).some(
    (e) =>
      e.type === 'damage' &&
      e.damageType === 'magic' &&
      e.target?.instanceId === tid
  );
}

export const VolatileMagic = {
  name: 'Volatile Magic',
  description:
    'Spend 3 Hope to reroll any number of your damage dice on an attack that deals magic damage.',
  chips: [
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      hasDamageDice,
      pendingMagicDamageToAttackTarget,
      {
        description:
          'Spend 3 Hope to reroll your damage dice on this magic attack (queues rerolls for each die in the pool; selective rerolls need host support).',
        placements: ['reviewAction'],
        hopeCost: 3,
        onUse(table) {
          table.rolls?.damage?.rerollAllDice();
        },
      }
    ),
  ],
};

function parseChannelRawPowerSelection(selectedId) {
  if (selectedId == null || typeof selectedId !== 'string') return null;
  const pipe = selectedId.lastIndexOf('|');
  if (pipe <= 0) return null;
  const cardId = selectedId.slice(0, pipe);
  const mode = selectedId.slice(pipe + 1);
  if (!cardId || (mode !== 'hope' && mode !== 'spell')) return null;
  return { cardId, mode };
}

export const ChannelRawPower = {
  name: 'Channel Raw Power',
  description:
    'Once per long rest, you can place a domain card from your loadout into your vault and choose to either:\n\n- Gain Hope equal to the level of the card.\n- Enhance a spell that deals damage, gaining a bonus to your damage roll equal to twice the level of the card.',
  frequency: 'longRest',
  isSelect: (table) => {
    const cards = table.me?.domainLoadout ?? [];
    const out = [];
    for (const c of cards) {
      if (!c || typeof c !== 'object' || c.id == null) continue;
      const id = String(c.id);
      const lvl = Number(c.level ?? c.tier ?? 1);
      const label = c.name ?? 'Domain card';
      out.push({
        id: `${id}|hope`,
        name: `${label} — gain ${lvl} Hope (card moves to vault)`,
      });
      out.push({
        id: `${id}|spell`,
        name: `${label} — +${2 * lvl} magic spell damage once (card moves to vault)`,
      });
    }
    return out;
  },
  isDisabled: (table) => (table.me?.domainLoadout?.length ?? 0) === 0,
  onUse(table, chip) {
    const parsed = parseChannelRawPowerSelection(chip.get('selectedId'));
    if (!parsed) return;
    const { cardId, mode } = parsed;
    const card = (table.me.domainLoadout || []).find((c) => c && String(c.id) === cardId);
    const level = Number(card?.level ?? card?.tier ?? 1);
    table.me.moveDomainCardToVault(cardId);
    if (mode === 'hope') {
      table.me.gainHope(level);
    } else {
      table.feature.set('channelRawPowerDamageBonus', 2 * level);
    }
  },
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => (table.feature.get('channelRawPowerDamageBonus') ?? 0) > 0,
      pendingMagicDamageToAttackTarget,
      (table) => {
        const bonus = table.feature.get('channelRawPowerDamageBonus');
        table.rolls?.damage?.addStatic({ name: 'Channel Raw Power', value: bonus });
        table.feature.set('channelRawPowerDamageBonus', 0);
      }
    ),
    onRest(table) {
      if (table.action?.type === 'longRest') {
        table.feature.set('channelRawPowerDamageBonus', 0);
      }
    },
  },
};
