/**
 * Bard class features — SRD: daggerheart-srd/classes/Bard.md
 */

import { when } from '../engine/when.js';

/** SRD "within Close range": Melee, Very Close, or Close bands (not Far / Very Far). */
function isWithinCloseRange(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function adversariesWithinClose(table) {
  return table.adversaries.filter((a) => isWithinCloseRange(table, a));
}

export const MakeAScene = {
  name: 'Make a Scene',
  description:
    'Spend 3 Hope to temporarily Distract a target within Close range, giving them a -2 penalty to their Difficulty.',
  chips: [
    {
      placements: ['card'],
      hopeCost: 3,
      // SRD: one adversary ("a target"). Host UI picks one id; engine stores it on activation.
      multiSelect: false,
      selectTargets: (table) => adversariesWithinClose(table),
      isDisabled: (table) => adversariesWithinClose(table).length === 0,
      onUse(table, chipState) {
        // `selectedTargetIds` is not set here — `activateChip(..., { selectedTargetIds })` (host or tests)
        // runs first and calls `chipState.set('selectedTargetIds', ...)` in chip-system.js (same as Life Support).
        const targetInstanceId = (chipState.get('selectedTargetIds') || [])[0];
        if (!targetInstanceId) return;
        const adv = table.adversaries.find((a) => a.instanceId === targetInstanceId);
        if (!adv) return;
        if (!isWithinCloseRange(table, adv)) return;
        adv.applyStatMod('difficulty', -2);
      },
    },
  ],
};

/** Wordsmith (Epic Poetry): Rally Die is a d10 instead of the Bard’s normal d6/d8 progression. */
const WORDSMITH_SUBCLASS_ID = 'srd-sub-wordsmith';

/** Troubadour **Maestro**: after Rally, each ally may choose Hope or Stress (`featureState.Rally.maestroRallyChoices`). */
const TROUBADOUR_SUBCLASS_ID = 'srd-sub-troubadour';

function rallyDieSizeForBard(me) {
  if (!me?.isCharacter) return 'd6';
  if (me.subclassId === WORDSMITH_SUBCLASS_ID) return 'd10';
  return (me.level ?? 1) >= 5 ? 'd8' : 'd6';
}

/** First Rally Die token on this actor (matches Phase 1 `activeModifiers` + `name === 'Rally Die'`). */
function rallyDieModifierFromActor(me) {
  const mods = me?.activeModifiers ?? [];
  return mods.find((m) => m && m.name === 'Rally Die') ?? null;
}

/** Feature-state map: who still has a granted Rally Die this session (`table.feature` key **`partyDice`**). */
function partyDiceEntryForActor(table) {
  const a = table.action?.actor;
  if (!a?.isCharacter || !a.instanceId) return null;
  const pd = table.feature.get('partyDice');
  if (!pd || typeof pd !== 'object') return null;
  return pd[a.instanceId] ?? null;
}

/** `partyDice` row for **`table.me`** (card / cross-sheet: no `action.actor`). */
function partyDiceEntryForMe(table) {
  const id = table.me?.instanceId;
  if (!id) return null;
  const pd = table.feature.get('partyDice');
  if (!pd || typeof pd !== 'object') return null;
  return pd[id] ?? null;
}

function actionActorHasRallyGrantAndDie(table) {
  return partyDiceEntryForActor(table) != null && rallyDieModifierFromActor(table.action.actor) != null;
}

function meHasRallyGrantAndDie(table) {
  return partyDiceEntryForMe(table) != null && rallyDieModifierFromActor(table.me) != null;
}

/** Roll the die, add to the chosen pool, and clear this actor from **`partyDice`** (spent for this session). */
function spendRallyDieIntoPool(table, pool) {
  const actor = table.action?.actor;
  if (!actor?.isCharacter) return;
  const mod = rallyDieModifierFromActor(actor);
  if (!mod) return;
  const fallback = partyDiceEntryForActor(table)?.dice;
  const notation = mod.dice || fallback || 'd6';
  const v = table.rollDie(notation);
  if (pool === 'action') {
    table.rolls?.action?.addStatic({ name: 'Rally Die', value: v });
  } else {
    table.rolls?.damage?.addStatic({ name: 'Rally Die', value: v });
  }
  const pd = { ...(table.feature.get('partyDice') || {}) };
  delete pd[actor.instanceId];
  table.feature.set('partyDice', pd);
}

/** Roll the die, clear Stress equal to the result, and clear **`partyDice`** for **`table.me`**. */
function spendRallyDieClearStress(table) {
  const me = table.me;
  if (!me?.isCharacter) return;
  const mod = rallyDieModifierFromActor(me);
  if (!mod) return;
  const fallback = partyDiceEntryForMe(table)?.dice;
  const notation = mod.dice || fallback || 'd6';
  const v = table.rollDie(notation);
  me.clearStress(v);
  const pd = { ...(table.feature.get('partyDice') || {}) };
  delete pd[me.instanceId];
  table.feature.set('partyDice', pd);
}

/**
 * **Once per session** (card default action): set **`table.feature`** key **`partyDice`** (per-instance die
 * size) and queue **`appendActiveModifier`** for every party character (Phase 1 **`activeModifiers`**).
 *
 * **Spend Rally Die** (two **reviewAction** chips): **`table.action.actor`** spends on **either** the action
 * roll or the damage roll — player picks the matching chip. Clears **`partyDice`** for that actor (modifier
 * tokens remain for Phase 1 display until the host syncs).
 *
 * **Spend — Clear Stress** (card): roll the die and clear Stress equal to the result. **`showOnOtherSheets`** so
 * allies without the Bard class still see the control under Modifiers (see `collectChipsForOtherCharacterSheets`).
 *
 * **Troubadour Maestro:** `featureState.Rally.maestroRallyChoices` (ally instanceId → pending / choice); **Maestro** subclass chips (`Troubadour.js`). **Wordsmith Epic Poetry:** d10 advantage on Tag Team help (`Wordsmith.js`).
 */
export const Rally = {
  name: 'Rally',
  description:
    'Once per session, describe how you rally the party and give yourself and each of your allies a Rally Die. At level 1, your Rally Die is a d6. A PC can spend their Rally Die to roll it, adding the result to their action roll, reaction roll, damage roll, or to clear a number of Stress equal to the result. At the end of each session, clear all unspent Rally Dice. At level 5, your Rally Die increases to a d8.',
  frequency: 'session',
  onUse(table) {
    const die = rallyDieSizeForBard(table.me);
    const partyDice = {};
    for (const c of table.characters) {
      partyDice[c.instanceId] = { dice: die };
      c.addActiveModifier({
        id: `rally-die-${c.instanceId}`,
        name: 'Rally Die',
        dice: die,
        type: 'rally',
        refreshOn: 'session',
      });
    }
    table.feature.set('partyDice', partyDice);

    if (table.me.subclassId === TROUBADOUR_SUBCLASS_ID) {
      const maestroRallyChoices = {};
      for (const c of table.characters) {
        if (c.instanceId !== table.me.instanceId) {
          maestroRallyChoices[c.instanceId] = null;
        }
      }
      table.feature.set('maestroRallyChoices', maestroRallyChoices);
    }
  },
  chips: [
    when(
      (table) => table.action?.actor?.isCharacter === true,
      actionActorHasRallyGrantAndDie,
      (table) => table.rolls?.action != null,
      {
        name: 'Spend Rally Die — Action',
        description: 'Roll your Rally Die and add the result to this action roll (clears your Rally Die for this session).',
        placements: ['reviewAction'],
        showOnOtherSheets: true,
        onUse(table) {
          spendRallyDieIntoPool(table, 'action');
        },
      }
    ),
    when(
      (table) => table.action?.actor?.isCharacter === true,
      actionActorHasRallyGrantAndDie,
      (table) => table.rolls?.damage != null,
      {
        name: 'Spend Rally Die — Damage',
        description: 'Roll your Rally Die and add the result to this damage roll (clears your Rally Die for this session).',
        placements: ['reviewAction'],
        showOnOtherSheets: true,
        onUse(table) {
          spendRallyDieIntoPool(table, 'damage');
        },
      }
    ),
    when(meHasRallyGrantAndDie, {
      name: 'Spend Rally Die — Clear Stress',
      description:
        'Roll your Rally Die and clear a number of Stress equal to the result (clears your Rally Die for this session).',
      placements: ['card'],
      showOnOtherSheets: true,
      onUse(table) {
        spendRallyDieClearStress(table);
      },
    }),
  ],
};
