/**
 * Primal Origin subclass (Sorcerer) — SRD: daggerheart-srd/subclasses/Primal Origin.md
 */

import { when, isActing, isTargeted } from '../engine/when.js';

function weaponDealsMagicDamage(w) {
  if (!w) return false;
  const feats = w.features;
  if (Array.isArray(feats) && feats.some((f) => typeof f === 'string' && /otherworldly/i.test(f))) {
    return true;
  }
  if (typeof w.damage === 'string' && /magic/i.test(w.damage)) return true;
  return false;
}

/** Spellcast roll, or weapon attack using a weapon that deals magic damage. */
function isSpellcastOrMagicWeaponAttack(table) {
  const t = table.action?.type;
  if (t === 'spellcast') return true;
  if (t === 'attack') {
    const wid = table.action?.weaponId;
    const list = table.me?.weapons ?? [];
    const w = (wid ? list.find((x) => x.id === wid) : null) ?? list[0];
    return weaponDealsMagicDamage(w);
  }
  return false;
}

/** Pending magic damage from this actor's attack/spell to the current target (review phase). */
function pendingMagicDamageFromActorToTarget(table) {
  const tid = table.action?.target?.instanceId;
  const sid = table.me?.instanceId;
  if (!tid || !sid) return false;
  return (table.action?.effects ?? []).some(
    (e) =>
      e.type === 'damage' &&
      e.damageType === 'magic' &&
      e.target?.instanceId === tid &&
      // Prefer source match when hydrated; allow missing source (legacy synthetics) while isActing.
      (e.source?.instanceId == null || e.source.instanceId === sid)
  );
}

function isHelpingAllySpellcast(table) {
  return (
    table.action?.type === 'tagTeam' &&
    table.action?.tagTeamPartnerInstanceId === table.me?.instanceId
  );
}

export const ManipulateMagic = {
  name: 'Manipulate Magic',
  description:
    'Your primal origin allows you to modify the essence of magic itself. After you cast a spell or make an attack using a weapon that deals magic damage, you can **mark a Stress** to do one of the following:\n\n- Extend the spell or attack\'s reach by one range\n- Gain a +2 bonus to the action roll\'s result\n- Double a damage die of your choice\n- Hit an additional target within range',
  chips: [
    when(
      isActing,
      isSpellcastOrMagicWeaponAttack,
      (table) => table.rolls?.action != null,
      {
        name: 'Manipulate Magic (+2 action)',
        placements: ['intent'],
        stressCost: 1,
        description: 'Mark 1 Stress: +2 to this action roll.',
        onUse(table) {
          table.rolls?.action?.addStatic({ name: 'Manipulate Magic', value: 2 });
        },
      }
    ),
    when(isActing, isSpellcastOrMagicWeaponAttack, {
      name: 'Manipulate Magic (extend reach)',
      placements: ['intent'],
      stressCost: 1,
      description: 'Mark 1 Stress: extend this spell or attack reach by one range band (GM applies).',
      onUse(table) {
        table.me.actionLoop(
          'Manipulate Magic',
          'Extend reach by one range band — resolve with the GM.'
        );
      },
    }),
    when(
      isActing,
      isSpellcastOrMagicWeaponAttack,
      (table) => (table.rolls?.damage?.dice?.length ?? 0) > 0,
      {
        name: 'Manipulate Magic (double die)',
        placements: ['reviewAction'],
        stressCost: 1,
        description: 'Mark 1 Stress: double one damage die you rolled (adds another die of the same size).',
        isSelect: (table) =>
          (table.rolls?.damage?.dice ?? []).map((d, i) => ({
            id: d.name != null ? String(d.name) : `die-${i}`,
            name: `Double ${d.name ?? d.die ?? 'die'}`,
          })),
        onUse(table, chip) {
          const id = chip.get('selectedId');
          const dice = table.rolls?.damage?.dice ?? [];
          const d = dice.find((x, i) => (x.name != null ? String(x.name) : `die-${i}`) === id);
          if (!d) return;
          table.rolls.damage.addDie({
            name: `Manipulate Magic (${d.name ?? 'die'})`,
            die: d.die ?? 'd6',
            value: d.value,
          });
        },
      }
    ),
    when(isActing, isSpellcastOrMagicWeaponAttack, {
      name: 'Manipulate Magic (extra target)',
      placements: ['reviewAction'],
      stressCost: 1,
      description: 'Mark 1 Stress: hit an additional target within range (GM resolves).',
      onUse(table) {
        table.me.actionLoop(
          'Manipulate Magic',
          'Hit an additional target within range — resolve with the GM.'
        );
      },
    }),
  ],
};

export const EnchantedAid = {
  name: 'Enchanted Aid',
  description:
    'You can enhance the magic of others with your essence. When you Help an Ally with a Spellcast Roll, you can roll a **d8** as your advantage die. Once per long rest, after an ally has made a Spellcast Roll with your help, you can swap the results of their Duality Dice.',
  chips: [
    when(
      isHelpingAllySpellcast,
      (table) => table.rolls?.action != null,
      {
        name: 'Enchanted Aid (d8)',
        placements: ['intent'],
        description: 'Roll a d8 as your advantage die on this help (Spellcast Tag Team).',
        onUse(table) {
          table.rolls?.action?.addDie({ name: 'Enchanted Aid', die: 'd8' });
        },
      }
    ),
    when(
      isHelpingAllySpellcast,
      (table) =>
        table.rolls?.action?.hopeDie != null && table.rolls?.action?.fearDie != null,
      {
        name: 'Enchanted Aid (swap Duality)',
        placements: ['reviewAction'],
        frequency: 'longRest',
        description:
          'Once per long rest: after this ally Spellcast Roll with your help, swap their Hope and Fear dice.',
        onUse(table) {
          table.rolls?.action?.swapHopeFear?.();
        },
      }
    ),
  ],
};

export const ArcaneCharge = {
  name: 'Arcane Charge',
  description:
    'You can gather magical energy to enhance your capabilities. When you take magic damage, you become _Charged_. Alternatively, you can **spend 2 Hope** to become _Charged_. When you successfully make an attack that deals magic damage while _Charged_, you can clear your _Charge_ to either gain a +10 bonus to the damage roll or gain a +3 bonus to the Difficulty of a reaction roll the spell causes the target to make. You stop being _Charged_ at your next long rest.',
  chips: [
    {
      placements: ['card'],
      hopeCost: 2,
      description: 'Spend 2 Hope to become Charged.',
      onUse(table) {
        table.me.addCondition('Charged');
      },
    },
    when(
      isActing,
      (table) => table.action?.type === 'attack' || table.action?.type === 'spellcast',
      pendingMagicDamageFromActorToTarget,
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => table.me.hasCondition('Charged'),
      {
        name: 'Arcane Charge (discharge)',
        placements: ['reviewAction'],
        description:
          'Clear Charged: +10 magic damage, or +3 to a reaction Difficulty the target must roll (GM applies).',
        isSelect: () => [
          { id: 'dmg10', name: '+10 to damage roll' },
          { id: 'rx3', name: '+3 to reaction roll Difficulty (GM)' },
        ],
        onUse(table, chip) {
          const id = chip.get('selectedId');
          table.me.removeCondition('Charged');
          if (id === 'dmg10') {
            table.rolls?.damage?.addStatic({ name: 'Arcane Charge', value: 10 });
          } else if (id === 'rx3') {
            table.me.actionLoop(
              'Arcane Charge',
              '+3 to the Difficulty of a reaction roll this spell causes the target to make.'
            );
          }
        },
      }
    ),
  ],
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      (table) =>
        (table.action?.effects ?? []).some(
          (e) =>
            e.stat === 'currentHP' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.damageType === 'magic' &&
            (e.amount ?? 0) > 0
        ),
      (table) => {
        table.me.addCondition('Charged');
      }
    ),
    onRest(table) {
      if (table.action?.type === 'longRest' && table.me.hasCondition('Charged')) {
        table.me.removeCondition('Charged');
      }
    },
  },
};
