/**
 * Seraph class features — SRD: daggerheart-srd/classes/Seraph.md
 */

import {
  when,
  isPrayerDicePoolNonEmpty,
  prayerDiceAidRollEligible,
  hasPrayerDiceAidableDamage,
  isWithinFarRangeOfMe,
} from '../engine/when.js';

function alliesInCloseWithMarkedHp(table) {
  const selfId = table.me?.instanceId;
  return table.characters.filter((c) => {
    if (c.instanceId === selfId) return false;
    if (!['melee', 'veryClose', 'close'].includes(table.me.rangeFrom(c))) return false;
    const hp = c.currentHP;
    const max = c.maxHP;
    if (hp == null || max == null) return false;
    return hp < max;
  });
}

export const LifeSupport = {
  name: 'Life Support',
  description: 'Spend 3 Hope to clear a Hit Point on an ally within Close range.',
  chips: [
    {
      placements: ['card'],
      /** Game Table posts an action banner; Hope + HP clear apply on GM ack (not `activateV2OwnedCardChip`). */
      gameTableDeferUntilBannerAck: true,
      hopeCost: 3,
      selectTargets: (table) => alliesInCloseWithMarkedHp(table),
      isDisabled: (table) =>
        alliesInCloseWithMarkedHp(table).length === 0
          ? 'No ally in Close range with marked HP to heal.'
          : false,
      onUse(table, chip) {
        const ids = chip.get('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const ally = table.characters.find((c) => c.instanceId === id);
        if (!ally) return;
        ally.clearHP(1);
      },
    },
  ],
};

function spellcastDiceCount(table) {
  const me = table.me;
  if (!me?.traits || !me.spellcastTrait) return 0;
  const raw = me.spellcastTrait;
  const k = String(raw).toLowerCase();
  const v = me.traits[k] ?? me.traits[raw];
  if (typeof v === 'number') return Math.max(0, v);
  return Math.max(0, parseInt(v, 10) || 0);
}

function prayerDieSelectOptions(table) {
  const pool = table.me?.prayerDice?.pool ?? [];
  return pool.map((v, i) => ({ id: String(i), label: `d4 (${v})` }));
}

function firstPrayerAidDamageTargetId(table) {
  const me = table.me;
  if (!me?.instanceId) return null;
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount > 0)) continue;
    const tid = e.target?.instanceId;
    if (!tid) continue;
    if (tid === me.instanceId) return tid;
    const other = table.characters.find((c) => c.instanceId === tid);
    if (other && isWithinFarRangeOfMe(table, other)) return tid;
  }
  return null;
}

/** Remove and return one pool value from `chipState`'s selected die index, or `null` if invalid. */
function takePrayerDieValue(table, chipState) {
  const idx = parseInt(chipState.get('selectedId') ?? '0', 10);
  const pool = table.me?.prayerDice?.pool ?? [];
  if (idx < 0 || idx >= pool.length) return null;
  const v = pool[idx];
  table.me.removePrayerDieAt(idx);
  return v;
}

/**
 * Session pool + spend modes: **`table.me.prayerDice`**, **`setPrayerDicePool`**, **`removePrayerDieAt`**,
 * **`table.action.reducePendingDamageForTarget`** (mutates pending damage effects — see Feature Authoring Guide §C.2 / §C.3).
 * Host must set **`spellcastTrait`** on the character (subclass Spellcast key) for session-start count.
 *
 * **Spend die on a roll:** two **`reviewAction`** chips (**Action** vs **Damage**), same convention as Bard **Rally** —
 * the player picks the chip that matches which roll they are modifying.
 */
export const PrayerDice = {
  name: 'Prayer Dice',
  description:
    "At the beginning of each session, roll a number of d4s equal to your subclass's Spellcast trait and place them on your character sheet in the space provided. These are your Prayer Dice. You can spend any number of Prayer Dice to aid yourself or an ally within Far range. You can use a spent die's value to reduce incoming damage, add to a roll's result after the roll is made, or gain Hope equal to the result. At the end of each session, clear all unspent Prayer Dice.",
  hooks: {
    onSessionStart(table) {
      const n = spellcastDiceCount(table);
      if (n <= 0) return;
      const pool = [];
      for (let i = 0; i < n; i++) {
        pool.push(table.rollDie('d4'));
      }
      table.me.setPrayerDicePool(pool);
    },
  },
  chips: [
    when(
      isPrayerDicePoolNonEmpty,
      prayerDiceAidRollEligible,
      (table) => table.rolls?.action != null,
      {
        name: 'Prayer Die — Action',
        description:
          "Spend one Prayer Die to add its value to this action roll's total (after the roll is made).",
        placements: ['reviewAction'],
        isSelect: prayerDieSelectOptions,
        isDisabled: (table) =>
          (table.me?.prayerDice?.pool ?? []).length === 0 ? 'No Prayer Dice left in your pool.' : false,
        onUse(table, chipState) {
          const v = takePrayerDieValue(table, chipState);
          if (v == null) return;
          table.rolls.action.addStatic({ name: 'Prayer Die', value: v });
        },
      }
    ),
    when(
      isPrayerDicePoolNonEmpty,
      prayerDiceAidRollEligible,
      (table) => table.rolls?.damage != null,
      {
        name: 'Prayer Die — Damage',
        description:
          "Spend one Prayer Die to add its value to this damage roll's total (after the roll is made).",
        placements: ['reviewAction'],
        isSelect: prayerDieSelectOptions,
        isDisabled: (table) =>
          (table.me?.prayerDice?.pool ?? []).length === 0 ? 'No Prayer Dice left in your pool.' : false,
        onUse(table, chipState) {
          const v = takePrayerDieValue(table, chipState);
          if (v == null) return;
          table.rolls.damage.addStatic({ name: 'Prayer Die', value: v });
        },
      }
    ),
    when(
      isPrayerDicePoolNonEmpty,
      hasPrayerDiceAidableDamage,
      {
        name: 'Prayer Die — reduce damage',
        description:
          "Spend one Prayer Die to reduce incoming damage to you or an ally within Far range by the die's value.",
        placements: ['reviewAction'],
        isSelect: prayerDieSelectOptions,
        isDisabled: (table) =>
          (table.me?.prayerDice?.pool ?? []).length === 0 ? 'No Prayer Dice left in your pool.' : false,
        onUse(table, chipState) {
          const tid = firstPrayerAidDamageTargetId(table);
          if (!tid) return;
          const v = takePrayerDieValue(table, chipState);
          if (v == null) return;
          table.action.reducePendingDamageForTarget(tid, v);
        },
      }
    ),
    // Card snapshot has no `rolls` — do not use `prayerDiceAidRollEligible` here (that requires an
    // action/damage roll in progress). Hope spend is valid any time you have pool dice (SRD).
    when(
      isPrayerDicePoolNonEmpty,
      {
        name: 'Prayer Die — gain Hope',
        description: 'Spend one Prayer Die to gain Hope equal to its value.',
        placements: ['card'],
        isSelect: prayerDieSelectOptions,
        isDisabled: (table) =>
          (table.me?.prayerDice?.pool ?? []).length === 0 ? 'No Prayer Dice left in your pool.' : false,
        onUse(table, chipState) {
          const v = takePrayerDieValue(table, chipState);
          if (v == null) return;
          table.me.gainHope(v);
        },
      }
    ),
  ],
};
