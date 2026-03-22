import { when, isActing } from '../engine/when.js';

/**
 * Warrior class features — SRD: daggerheart-srd/classes/Warrior.md
 */

export const NoMercy = {
  name: 'No Mercy',
  description:
    'Spend 3 Hope to gain a +1 bonus to your attack rolls until your next rest.',
  hopeCost: 3,
  onUse(table) {
    table.feature.set('noMercyActive', true);
  },
  hooks: {
    onIntent: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.feature.get('noMercyActive') === true,
      (table) => {
        table.rolls?.action?.addStatic({ name: 'No Mercy', value: 1 });
      }
    ),
    onRest(table) {
      table.feature.set('noMercyActive', false);
    },
  },
};

const isLeaveMeleeReaction = (table) =>
  table.action?.type === 'reaction' &&
  table.action?.reactionContext?.kind === 'leaveMelee' &&
  table.me?.isActing;

/** Adversary token left this character's Melee range — for `hooks.onTokenMove` (map move detection). */
function adversaryLeftMyMelee(table) {
  const mover = table.tokenMove?.mover;
  const me = table.me;
  if (!table.tokenMove || !mover || !me?.isCharacter) return false;
  if (mover.instanceId === me.instanceId) return false;
  if (!mover.isAdversary) return false;
  const was = mover.lastPosition?.rangeFrom(me);
  const now = mover.rangeFrom(me);
  return was === 'melee' && now != null && now !== 'melee';
}

const aooOutcomeChip = {
  name: 'Attack of Opportunity',
  description:
    'Choose one effect on a success, or two if you critically succeed.',
  placements: ['reviewAction'],
  multiSelect: true,
  maxSelections: (table) => (table.rolls?.action?.isCritical === true ? 2 : 1),
  isSelect: () => [
    { id: 'restrain', label: "They can't move from where they are" },
    { id: 'damage', label: 'Deal damage equal to your primary weapon' },
    { id: 'moveWith', label: 'You move with them' },
  ],
  onUse(table, chip) {
    const selected = chip.get('selectedIds');
    if (!Array.isArray(selected) || selected.length === 0) return;
    const max = table.rolls?.action?.isCritical === true ? 2 : 1;
    if (selected.length > max) return;
    const mover = table.action?.target;
    if (!mover?.instanceId) return;

    for (const id of selected) {
      if (id === 'restrain') {
        mover.restrictMovement('Stopped by Attack of Opportunity');
      } else if (id === 'damage') {
        const w = table.me?.primaryWeapon;
        const diceExpr = w?.damage != null ? String(w.damage) : 'd6';
        table.action.addDamageRoll({
          name: 'Attack of Opportunity',
          dice: diceExpr,
          damageType: 'physical',
          targets: [mover],
        });
      } else if (id === 'moveWith') {
        table.me.actionLoop('Follow', 'Move with the adversary.');
      }
    }
  },
};

export const AttackOfOpportunity = {
  name: 'Attack of Opportunity',
  description:
    "If an adversary within Melee range attempts to leave that range, make a reaction roll using a trait of your choice against their Difficulty. Choose one effect on a success, or two if you critically succeed:\n\n- They can't move from where they are.\n- You deal damage to them equal to your primary weapon's damage.\n- You move with them.",
  chips: [
    when(isLeaveMeleeReaction, (table) => table.rolls?.action?.isSuccess === true, aooOutcomeChip),
  ],
  hooks: {
    onTokenMove: when(adversaryLeftMyMelee, (table) => {
      const mover = table.tokenMove.mover;
      const dc = mover.effectiveDifficulty != null ? mover.effectiveDifficulty : '—';
      table.me.actionLoop(
        'Attack of Opportunity',
        `An adversary is leaving your Melee range. Make a reaction roll using a trait of your choice against ${mover.name}'s Difficulty (${dc}).`
      );
    }),
  },
};

export const CombatTraining = {
  name: 'Combat Training',
  description:
    'You ignore burden when equipping weapons. When you deal physical damage, you gain a bonus to your damage roll equal to your level.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => {
        const level = table.me?.level ?? 1;
        if (level <= 0) return;
        const targetId = table.action?.target?.instanceId;
        for (const e of table.action?.effects || []) {
          if (e.type !== 'damage' || e.target?.instanceId !== targetId || typeof e.amount !== 'number') {
            continue;
          }
          if (e.damageType === 'magic') continue;
          e.amount += level;
        }
      }
    ),
  },
};
