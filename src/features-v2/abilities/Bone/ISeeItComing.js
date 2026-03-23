/**
 * Bone domain — I See It Coming (Tier 1)
 * SRD: When targeted by an attack from beyond Melee range, mark Stress to roll d4 and add to Evasion vs that attack.
 */

import { when, isTargeted } from '../../engine/when.js';

function attackFromBeyondMelee(table) {
  const a = table.action?.attacker;
  if (!a || !table.me) return false;
  if (table.action?.type !== 'attack') return false;
  const band = table.me.rangeFrom(a);
  if (band == null) return false;
  return band !== 'melee';
}

function rollD4Uint() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % 4) + 1;
}

export const ISeeItComing = {
  name: 'I See It Coming',
  description:
    "When you're targeted by an attack made from beyond Melee range, you can **mark a Stress** to roll a **d4** and gain a bonus to your Evasion equal to the result against the attack.",
  chips: [
    when(
      isTargeted,
      attackFromBeyondMelee,
      {
        name: 'I See It Coming',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark 1 Stress: roll a d4 and add the result to your Evasion against this attack.',
        onUse(table) {
          const n = table.rollDie('d4');
          table.feature.set('iSeeItComingEvasionBonus', n);
        },
        temporaryStatMods: {
          evasion: (t) => t.feature.get('iSeeItComingEvasionBonus') ?? 0,
        },
      }
    ),
    {
      placement: 'banner',
      label: 'I See It Coming',
      stressCost: 1,
      description:
        'Mark 1 Stress: roll a d4 and add the result to your Evasion against this ranged attack (Game Table).',
      isVisible(ctx) {
        const roll = ctx.roll;
        const character = ctx.character;
        const raw = ctx.characterRaw ?? character;
        if (roll._attackerType !== 'adversary') return false;
        const tid = raw?.instanceId ?? character?.instanceId ?? character?.id;
        const sel =
          roll._selectedTargetInstanceId ??
          (Array.isArray(roll._selectedTargetInstanceIds) && roll._selectedTargetInstanceIds[0]);
        if (sel !== tid) return false;
        const r = roll._attackRangeFt;
        if (r == null || r <= 5) return false;
        const hasDmg = (roll.subItems || []).some((s) => /damage/i.test(s.pre || '') && s.input);
        if (!hasDmg) return false;
        if (roll._rollDbId != null && raw?._iSeeItComingRollBonus?.[roll._rollDbId] != null) return false;
        return true;
      },
      activate(roll, character, ctx) {
        const { characterRaw, updateActiveElement } = ctx || {};
        if (!characterRaw || roll._rollDbId == null || typeof updateActiveElement !== 'function') return;
        character.markStress(1);
        const n = rollD4Uint();
        const prev = characterRaw._iSeeItComingRollBonus || {};
        updateActiveElement(characterRaw.instanceId, {
          _iSeeItComingRollBonus: { ...prev, [roll._rollDbId]: n },
        });
      },
    },
  ],
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      (t) => t.action?.type === 'attack',
      (t) => {
        if ((t.feature.get('iSeeItComingEvasionBonus') ?? 0) > 0) {
          t.feature.set('iSeeItComingEvasionBonus', 0);
        }
      }
    ),
  },
};
