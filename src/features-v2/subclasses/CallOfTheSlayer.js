/**
 * Call of the Slayer subclass (Warrior) — SRD: daggerheart-srd/subclasses/Call of the Slayer.md
 */

import { when, isActing, youSucceedOnAnAttack } from '../engine/when.js';
import { parseLeadingDamageDice } from '../../client/lib/dice-utils.js';

const SOURCE_SCOPE = 'CallOfTheSlayer';

/** Shared subclass row for `table.source` / tests (`sourceScopeKey` on registry). */
export const CallOfTheSlayerRow = {
  name: 'Call of the Slayer',
  sourceScopeKey: SOURCE_SCOPE,
};

function hopeDominates(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  return h != null && f != null && h > f;
}

function poolBelowProficiency(table) {
  if (typeof table.source?.get !== 'function') return false;
  const pool = table.source.get('slayerDiceCount') ?? 0;
  const prof = table.me?.proficiency ?? 1;
  return pool < prof;
}

/** Roll n d6; apply Weapon Specialist once-per-long-rest reroll of 1s when applicable. */
function rollSlayerDiceSpend(table, n) {
  const faces = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const v = table.rollDie('d6');
    faces.push(v);
    total += v;
  }
  const rerollAvailable = table.source.get('weaponSpecialistSlayerRerollAvailable') === true;
  if (rerollAvailable && faces.some((x) => x === 1)) {
    for (let i = 0; i < faces.length; i++) {
      if (faces[i] === 1) {
        const nv = table.rollDie('d6');
        total = total - 1 + nv;
        faces[i] = nv;
      }
    }
    table.source.set('weaponSpecialistSlayerRerollAvailable', false);
  } else if (rerollAvailable) {
    table.source.set('weaponSpecialistSlayerRerollAvailable', false);
  }
  return total;
}

function slayerSpendSelectOptions(table) {
  const pool = table.source.get('slayerDiceCount') ?? 0;
  if (pool <= 0) return [];
  return Array.from({ length: pool }, (_, i) => ({
    id: String(i + 1),
    name: `Spend ${i + 1} Slayer die${i === 0 ? '' : 'ce'}`,
  }));
}

function primaryWeaponAttack(table) {
  const wid = table.action?.weaponId;
  const p = table.me?.primaryWeapon?.id;
  return wid != null && p != null && wid === p;
}

function secondaryDamageDieNotation(table) {
  const sec = table.me?.secondaryWeapon;
  if (!sec?.damage) return null;
  const p = parseLeadingDamageDice(String(sec.damage).trim());
  if (!p?.die) return null;
  const qtyRaw = p.qty === '' || p.qty == null ? 1 : parseInt(String(p.qty), 10);
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
  return qty === 1 ? p.die : `${qty}${p.die}`;
}

export const Slayer = {
  name: 'Slayer',
  description:
    'You gain a pool of dice called Slayer Dice. On a roll with Hope, you can place a **d6** on this card instead of gaining a Hope, adding the die to the pool. You can store a number of Slayer Dice equal to your Proficiency. When you make an attack roll or damage roll, you can spend any number of these Slayer Dice, rolling them and adding their result to the roll. At the end of each session, clear any unspent Slayer Dice on this card and gain a Hope per die cleared.',
  hooks: {
    /** New session: clear unspent dice from last session and gain 1 Hope per die (idempotent if run twice). */
    onSessionStart(table) {
      // Session-start table snapshots sometimes omit `table.source` (no `_sourceObject` on the
      // active feature); skip cleanly rather than throw and break Start Session ack.
      if (typeof table.source?.get !== 'function' || typeof table.source?.set !== 'function') return;
      const n = table.source.get('slayerDiceCount') ?? 0;
      if (n <= 0) return;
      table.me.gainHope(n);
      table.source.set('slayerDiceCount', 0);
    },
  },
  chips: [
    when(
      isActing,
      (table) => table.action?.generatesHopeFear === true,
      hopeDominates,
      poolBelowProficiency,
      {
        name: 'Slayer (bank d6)',
        placements: ['reviewAction'],
        description:
          'Place a d6 on this card instead of gaining a Hope from Hope dominating this roll (max dice = Proficiency). Host: do not apply Hope gain if you bank.',
        onUse(table) {
          const pool = table.source.get('slayerDiceCount') ?? 0;
          const prof = table.me?.proficiency ?? 1;
          if (pool >= prof) return;
          table.source.set('slayerDiceCount', pool + 1);
          table.action?.addNarration?.(
            'Slayer: banked a Slayer d6 — forgo the Hope you would gain from Hope dominating.'
          );
        },
      }
    ),
    when(
      isActing,
      (table) => table.rolls?.action != null,
      (table) => (table.source.get('slayerDiceCount') ?? 0) > 0,
      {
        name: 'Slayer (spend on action roll)',
        placements: ['intent'],
        description: 'Spend any number of Slayer Dice; roll them and add the total to this action roll.',
        isSelect: (table) => slayerSpendSelectOptions(table),
        onUse(table, chip) {
          const n = parseInt(String(chip.get('selectedId') ?? ''), 10);
          if (!Number.isFinite(n) || n < 1) return;
          const pool = table.source.get('slayerDiceCount') ?? 0;
          if (n > pool) return;
          const total = rollSlayerDiceSpend(table, n);
          table.source.set('slayerDiceCount', pool - n);
          table.rolls?.action?.addStatic?.({ name: 'Slayer', value: total });
        },
      }
    ),
    when(
      isActing,
      (table) => table.rolls?.damage != null,
      (table) => (table.source.get('slayerDiceCount') ?? 0) > 0,
      {
        name: 'Slayer (spend on damage roll)',
        placements: ['reviewAction'],
        description: 'Spend any number of Slayer Dice; roll them and add the total to this damage roll.',
        isSelect: (table) => slayerSpendSelectOptions(table),
        onUse(table, chip) {
          const n = parseInt(String(chip.get('selectedId') ?? ''), 10);
          if (!Number.isFinite(n) || n < 1) return;
          const pool = table.source.get('slayerDiceCount') ?? 0;
          if (n > pool) return;
          const total = rollSlayerDiceSpend(table, n);
          table.source.set('slayerDiceCount', pool - n);
          table.rolls?.damage?.addStatic?.({ name: 'Slayer', value: total });
        },
      }
    ),
  ],
};

export const WeaponSpecialist = {
  name: 'Weapon Specialist',
  description:
    'You can wield multiple weapons with dangerous ease. When you succeed on an attack, you can **spend a Hope** to add one of the damage dice from your secondary weapon to the damage roll. Additionally, once per long rest when you roll your Slayer Dice, reroll any 1s.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.source.set('weaponSpecialistSlayerRerollAvailable', true);
    },
  },
  chips: [
    when(
      youSucceedOnAnAttack,
      (table) => table.rolls?.damage != null,
      primaryWeaponAttack,
      (table) => secondaryDamageDieNotation(table) != null,
      {
        placements: ['reviewAction'],
        hopeCost: 1,
        description:
          'Spend 1 Hope to add your secondary weapon’s leading damage die to this damage roll.',
        onUse(table) {
          const die = secondaryDamageDieNotation(table);
          if (!die) return;
          table.rolls?.damage?.addDie?.({ name: 'Weapon Specialist', die });
        },
      }
    ),
  ],
};

export const MartialPreparation = {
  name: 'Martial Preparation',
  description:
    "You're an inspirational warrior to all who travel with you. Your party gains access to the Martial Preparation downtime move. To use this move during a rest, describe how you instruct and train with your party. You and each ally who chooses this downtime move gain a **d6** Slayer Die. A PC with a Slayer Die can spend it to roll the die and add the result to an attack or damage roll of their choice.",
  chips: [
    {
      placements: ['card'],
      frequency: 'longRest',
      description:
        'During a long rest, describe training with your party. The GM tracks which allies take the Martial Preparation downtime move and gives each a d6 Slayer Die (same spend rules as Slayer dice).',
      onUse(table) {
        table.me.actionLoop(
          'Martial Preparation',
          'Party access to the Martial Preparation downtime move — you and each ally who chooses it gain a d6 Slayer Die (GM distributes).'
        );
      },
    },
  ],
};
