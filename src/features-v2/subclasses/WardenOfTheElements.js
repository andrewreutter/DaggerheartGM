/**
 * Warden of the Elements subclass — SRD: daggerheart-srd/subclasses/Warden of the Elements.md
 */

import {
  when,
  isActing,
  isTargeted,
  hasDamage,
  anAttackSucceeds,
  againstYou,
  youTakeSevereDamage,
} from '../engine/when.js';

const FS = 'WardenOfTheElements';

function warden(table) {
  return table.featureState?.[FS] ?? {};
}

function masteryUnlocked(table) {
  return (table.me?.tier ?? 1) >= 4;
}

function clearChannel(table) {
  table.source.set('channeledElement', null);
  table.source.set('auraActive', false);
}

/** Elemental Aura affects creatures within Close range of the warden (same bands as Earth ally aura). */
function withinElementalAuraClose(me, victim) {
  const band = me?.rangeFrom(victim);
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

/** "You or an ally" — the warden or another player character in the aura. */
function isYouOrAllyCharacter(me, victim) {
  if (!me || !victim) return false;
  if (victim.instanceId === me.instanceId) return true;
  return victim.isCharacter === true;
}

export const ElementalIncarnation = {
  name: 'Elemental Incarnation',
  /** Game Table: run `onReviewAction` after HP is applied (side effects only — not pre-HP mitigation). */
  runOnReviewActionAfterHpApplied: true,
  /**
   * Game Table (Phase C damage pipeline): run hydrated `createActionLoop(...).runPhase('reviewOutcome')`
   * at damage commit (after final `hpLoss` is known, before `markHp`). See `runV2DamageApplyReviewOutcomePhase`.
   */
  runOnVttDamageApplyReviewOutcome: true,
  description:
    'Mark a Stress to Channel one of the following elements until you take Severe damage or until your next rest:\n\n- Fire: When an adversary within Melee range deals damage to you, they take 1d10 magic damage.\n- Earth: Gain a bonus to your damage thresholds equal to your Proficiency.\n- Water: When you deal damage to an adversary within Melee range, all other adversaries within Very Close range must mark a Stress.\n- Air: You can hover, gaining advantage on Agility Rolls.',
  passiveStatMods: when(
    (table) => warden(table).channeledElement === 'earth',
    {
      majorThreshold: (table) => table.me?.proficiency ?? 1,
      severeThreshold: (table) => table.me?.proficiency ?? 1,
    }
  ),
  chips: [
    {
      placements: ['card'],
      stressCost: 1,
      selectPresentation: 'iconGrid',
      isSelect: () => [
        { id: 'fire', name: 'Fire', description: 'Retaliation when struck in Melee; ends on Severe or rest.' },
        { id: 'earth', name: 'Earth', description: '+Proficiency to Major and Severe thresholds.' },
        { id: 'water', name: 'Water', description: 'Splash Stress to nearby foes when you deal Melee damage.' },
        { id: 'air', name: 'Air', description: 'Hover: advantage on Agility rolls.' },
      ],
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (id !== 'fire' && id !== 'earth' && id !== 'water' && id !== 'air') return;
        table.source.set('channeledElement', id);
      },
    },
  ],
  hooks: {
    onIntent(table) {
      const w = warden(table);
      if (!w.channeledElement) return;
      // Air (CONV-003): only `onIntent` queues the advantage die — declarative `advantageTriggers` are not applied in `createActionLoop`.
      if (w.channeledElement === 'air' && isActing(table) && table.action?.trait === 'Agility') {
        table.rolls?.action?.addAdvantageDie('Elemental Incarnation (Air)');
      }
      if (
        masteryUnlocked(table) &&
        w.channeledElement === 'fire' &&
        isActing(table) &&
        table.rolls?.damage &&
        (table.action?.type === 'attack' || table.action?.type === 'spellcast')
      ) {
        const p = table.me?.proficiency ?? 1;
        table.rolls.damage.addStatic({ name: 'Elemental Dominion (Fire)', value: p });
      }
    },
    onReviewAction(table) {
      const w = warden(table);
      if (!w.channeledElement) return;

      if (
        w.channeledElement === 'fire' &&
        isTargeted(table) &&
        hasDamage(table) &&
        table.action?.actor?.isAdversary === true
      ) {
        const atk = table.action.actor;
        if (table.me.rangeFrom(atk) === 'melee') {
          const v = table.rollDie('d10');
          (table.action.effects ?? []).push({
            type: 'damage',
            target: atk,
            amount: v,
            damageType: 'magic',
          });
        }
      }

      if (
        w.channeledElement === 'water' &&
        isActing(table) &&
        table.action?.type === 'attack' &&
        table.rolls?.action?.isSuccess === true
      ) {
        const tgt = table.action?.target;
        if (!tgt?.isAdversary) return;
        const meleeBand = table.me.rangeFrom(tgt);
        if (meleeBand != null && meleeBand !== 'melee') return;
        for (const a of table.adversaries) {
          if (a.instanceId === tgt.instanceId) continue;
          if (tgt.rangeFrom(a) === 'veryClose') {
            a.markStress(1);
          }
        }
      }

      if (
        w.channeledElement === 'air' &&
        w.auraActive === true &&
        (table.action?.type === 'attack' || table.action?.type === 'reaction')
      ) {
        const atk = table.action?.actor;
        const me = table.me;
        if (!atk || !me) return;
        for (const e of table.action.effects ?? []) {
          if (e.type !== 'damage' || typeof e.amount !== 'number' || e.amount <= 0) continue;
          const tid = e.target?.instanceId;
          if (!tid) continue;
          const victim = table.actors.find((a) => a.instanceId === tid);
          if (!victim || !isYouOrAllyCharacter(me, victim)) continue;
          if (!withinElementalAuraClose(me, victim)) continue;
          if (victim.rangeFrom(atk) === 'melee') continue;
          const red = table.rollDie('d8');
          e.amount = Math.max(0, e.amount - red);
        }
      }
    },
    onReviewOutcome(table) {
      const w = warden(table);
      if (w.channeledElement && youTakeSevereDamage(table)) {
        clearChannel(table);
        return;
      }
      if (w.channeledElement === 'fire' && w.auraActive === true) {
        for (const e of table.action?.effects ?? []) {
          if (e.stat !== 'currentHP' || !(e.amount > 0)) continue;
          const id = e.target?.instanceId;
          if (!id) continue;
          const adv = table.adversaries.find((a) => a.instanceId === id);
          if (!adv) continue;
          const band = table.me.rangeFrom(adv);
          if (band === 'melee' || band === 'veryClose' || band === 'close') {
            adv.markStress(1);
          }
        }
      }
    },
    onRest(table) {
      table.source.set('channeledElement', null);
      table.source.set('auraActive', false);
      table.source.set('auraUsedThisRest', false);
    },
  },
};

export const ElementalAura = {
  name: 'Elemental Aura',
  description:
    'Once per rest while Channeling, you can assume an aura matching your element. The aura affects targets within Close range until your Channeling ends.\n\n- Fire: When an adversary marks 1 or more Hit Points, they must also mark a Stress.\n- Earth: Your allies gain a +1 bonus to Strength.\n- Water: When an adversary deals damage to you, you can mark a Stress to move them anywhere within Very Close range of where they are.\n- Air: When you or an ally takes damage from an attack beyond Melee range, reduce the damage by 1d8.',
  chips: [
    {
      placements: ['card'],
      frequency: 'rest',
      description: 'Assume your elemental aura until Channeling ends.',
      isDisabled: (table) => {
        if (!warden(table).channeledElement) return 'Channel an element first (Elemental Incarnation).';
        if (warden(table).auraUsedThisRest === true) return 'Elemental Aura already used this rest.';
        return false;
      },
      onUse(table) {
        table.source.set('auraActive', true);
        table.source.set('auraUsedThisRest', true);
        const el = warden(table).channeledElement;
        if (el === 'earth') {
          table.me.actionLoop(
            'Elemental Aura (Earth)',
            'Allies within Close range gain +1 Strength while your aura lasts (GM tracks trait rolls).'
          );
        }
      },
    },
    when(
      (table) => warden(table).channeledElement === 'water' && warden(table).auraActive === true,
      isTargeted,
      hasDamage,
      {
        name: 'Elemental Aura (Water)',
        placements: ['reviewAction'],
        stressCost: 1,
        description: 'After an adversary deals damage to you, mark a Stress to reposition them within Very Close (GM).',
        onUse(table) {
          table.me.actionLoop(
            'Elemental Aura (Water)',
            'Mark 1 Stress: move the attacker anywhere within Very Close range of their current position (GM).'
          );
        },
      }
    ),
  ],
  hooks: {
    onIntent(table) {
      const w = warden(table);
      if (!w.channeledElement || w.channeledElement !== 'earth' || w.auraActive !== true) return;
      const actor = table.action?.actor;
      if (!actor?.isCharacter || actor.instanceId === table.me.instanceId) return;
      if (table.action?.trait !== 'Strength') return;
      const band = table.me.rangeFrom(actor);
      if (band !== 'melee' && band !== 'veryClose' && band !== 'close') return;
      table.rolls?.action?.addStatic({ name: 'Elemental Aura (Earth)', value: 1 });
    },
  },
};

export const ElementalDominion = {
  name: 'Elemental Dominion',
  /** @see ElementalIncarnation — Game Table damage commit (`runV2DamageApplyReviewOutcomePhase`). Earth: d6-per-HP reduction updates `adjustedHpLoss`. */
  runOnVttDamageApplyReviewOutcome: true,
  description:
    'You further embody your element. While Channeling, you gain the following benefit:\n\n- Fire: You gain a +1 bonus to your Proficiency for attacks and spells that deal damage.\n- Earth: When you would mark Hit Points, roll a d6 per Hit Point marked. For each result of 6, reduce the number of Hit Points you mark by 1.\n- Water: When an attack against you succeeds, you can mark a Stress to make the attacker temporarily Vulnerable.\n- Air: You gain a +1 bonus to your Evasion and can fly.',
  passiveStatMods: when(
    (table) => masteryUnlocked(table) && warden(table).channeledElement === 'air',
    { evasion: 1 }
  ),
  chips: [
    when(
      (table) => masteryUnlocked(table) && warden(table).channeledElement === 'water',
      anAttackSucceeds,
      againstYou,
      {
        name: 'Elemental Dominion (Water)',
        placements: ['reviewAction'],
        stressCost: 1,
        description: 'Make the attacker Vulnerable.',
        onUse(table) {
          const atk = table.action?.actor;
          if (atk?.isAdversary) atk.addCondition('Vulnerable');
        },
      }
    ),
  ],
  hooks: {
    onReviewOutcome: when(
      (table) => masteryUnlocked(table) && warden(table).channeledElement === 'earth',
      isTargeted,
      (table) =>
        (table.action?.effects ?? []).some(
          (e) =>
            e.stat === 'currentHP' &&
            e.target?.instanceId === table.me?.instanceId &&
            typeof e.amount === 'number' &&
            e.amount > 0
        ),
      (table) => {
        for (const e of table.action?.effects ?? []) {
          if (
            e.stat === 'currentHP' &&
            e.target?.instanceId === table.me?.instanceId &&
            typeof e.amount === 'number' &&
            e.amount > 0
          ) {
            let amt = e.amount;
            let cleared = 0;
            for (let i = 0; i < amt; i++) {
              if (table.rollDie('d6') === 6) cleared += 1;
            }
            e.amount = Math.max(0, amt - cleared);
            break;
          }
        }
      }
    ),
  },
};
