/**
 * Divine Wielder subclass — SRD: daggerheart-srd/subclasses/Divine Wielder.md
 */

import { when, isActing } from '../engine/when.js';

function spellcastDiceCount(table) {
  const me = table.me;
  if (!me?.traits || !me.spellcastTrait) return 0;
  const raw = me.spellcastTrait;
  const k = String(raw).toLowerCase();
  const v = me.traits[k] ?? me.traits[raw];
  if (typeof v === 'number') return Math.max(0, v);
  return Math.max(0, parseInt(v, 10) || 0);
}

/** Attack uses a weapon (primary/secondary id present) — host should set `weaponId` on attack actions. */
function hasWeaponIdOnAttack(table) {
  return table.action?.type === 'attack' && table.action?.weaponId != null && table.action.weaponId !== '';
}

/** Two or more adversary targets selected (Spirit Weapon additional adversary). */
function spiritWeaponMultiAdversaryTargets(table) {
  const targets = table.action?.targets || [];
  if (targets.length < 2) return false;
  return targets.every((t) => t.isAdversary === true);
}

/** SRD Spirit Weapon only applies to weapons whose item range is Melee or Very Close (before range overrides). */
function isSpiritWeaponEligibleWeapon(table) {
  const wid = table.action?.weaponId;
  if (wid == null || wid === '') return false;
  const weapons = table.me?.weapons;
  if (!Array.isArray(weapons)) return false;
  const w = weapons.find((x) => x.id === wid);
  const br = w?.baseRange ?? null;
  return br === 'melee' || br === 'veryClose';
}

function alliesAndSelfInTouchRange(table) {
  return table.characters.filter((c) => {
    const r = table.me.rangeFrom(c);
    return r === 'melee' || r === 'veryClose' || r === 'close';
  });
}

export const SpiritWeapon = {
  name: 'Spirit Weapon',
  description:
    'When you have an equipped weapon with a range of Melee or Very Close, it can fly from your hand to attack an adversary within Close range and then return to you. You can **mark a Stress** to target an additional adversary within range with the same attack roll.',
  rangeOverrides: {
    melee: 'close',
    veryClose: 'close',
  },
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      hasWeaponIdOnAttack,
      isSpiritWeaponEligibleWeapon,
      spiritWeaponMultiAdversaryTargets,
      (table) => {
        table.me.markStress(1);
      }
    ),
  },
};

export const SparingTouch = {
  name: 'Sparing Touch',
  description:
    'Once per long rest, touch a creature and clear 2 Hit Points or 2 Stress from them.',
  chips: [
    {
      placements: ['card'],
      frequency: 'longRest',
      frequencyMaxUses: (table) => ((table.me?.tier ?? 1) >= 3 ? 2 : 1),
      description: 'Touch a creature in Melee, Very Close, or Close range; clear 2 HP or 2 Stress.',
      isSelect: () => [
        {
          id: 'hp',
          name: 'Clear 2 Hit Points',
          description: 'The touched creature clears 2 marked Hit Points.',
        },
        {
          id: 'stress',
          name: 'Clear 2 Stress',
          description: 'The touched creature clears 2 marked Stress.',
        },
      ],
      selectTargets: (table) => alliesAndSelfInTouchRange(table),
      isDisabled: (table) =>
        alliesAndSelfInTouchRange(table).length === 0
          ? 'No ally or self in Melee (touch) range.'
          : false,
      onUse(table, chip) {
        const mode = chip.get('selectedId');
        const ids = chip.get('selectedTargetIds') || [];
        const tid = ids[0];
        if (!tid || !mode) return;
        const target = table.characters.find((c) => c.instanceId === tid);
        if (!target) return;
        if (mode === 'hp') target.clearHP(2);
        else if (mode === 'stress') target.clearStress(2);
      },
    },
  ],
};

/**
 * Specialization — tier 3+. Replaces Seraph session-start Prayer Dice pool with (n+1) d4, drop lowest.
 * Also grants a second **Sparing Touch** use per long rest via **Sparing Touch** `frequencyMaxUses`.
 */
export const Devout = {
  name: 'Devout',
  description:
    'When you roll your Prayer Dice, you can roll an additional die and discard the lowest result. Additionally, you can use your "Sparing Touch" feature twice instead of once per long rest.',
  hooks: {
    onSessionStart(table) {
      if ((table.me?.tier ?? 1) < 3) return;
      const n = spellcastDiceCount(table);
      if (n <= 0) return;
      const rolls = [];
      for (let i = 0; i < n + 1; i++) {
        rolls.push(table.rollDie('d4'));
      }
      rolls.sort((a, b) => a - b);
      rolls.shift();
      table.me.setPrayerDicePool(rolls);
    },
  },
};

/** Mastery — tier 4+. */
export const SacredResonance = {
  name: 'Sacred Resonance',
  description:
    'When you roll damage for your "Spirit Weapon" feature, if any of the die results match, double the value of each matching die. For example, if you roll two 5s, they count as two 10s.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => (table.me?.tier ?? 1) >= 4,
      (table) => table.action?.type === 'attack',
      hasWeaponIdOnAttack,
      isSpiritWeaponEligibleWeapon,
      (table) => table.rolls?.damage != null,
      (table) => {
        const dice = table.rolls.damage.dice || [];
        const counts = new Map();
        for (const d of dice) {
          const v = d.value;
          if (v == null || typeof v !== 'number') continue;
          counts.set(v, (counts.get(v) || 0) + 1);
        }
        let extra = 0;
        for (const [v, c] of counts) {
          if (c >= 2) extra += v * c;
        }
        if (extra > 0) {
          table.rolls.damage.addStatic({ name: 'Sacred Resonance', value: extra });
        }
      }
    ),
  },
};
