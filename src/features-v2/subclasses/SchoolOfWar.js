/**
 * School of War subclass (Wizard) — SRD: daggerheart-srd/subclasses/School of War.md
 */

import { when, isActing, youSucceedOnAnAttack } from '../engine/when.js';

const SOURCE_SCOPE = 'SchoolOfWar';

export const SchoolOfWarRow = {
  name: 'School of War',
  sourceScopeKey: SOURCE_SCOPE,
};

/** Extra damage dice from Face Your Fear — specialization (tier 2+) and mastery (tier 3+) scale via character tier. */
function faceYourFearDamageDice(table) {
  const t = table.me?.tier ?? 1;
  if (t >= 3) return '3d10';
  if (t >= 2) return '2d10';
  return '1d10';
}

function succeedWithFear(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  return (
    h != null &&
    f != null &&
    f > h &&
    table.rolls?.action?.isSuccess === true
  );
}

function isAttackOrSpellcast(table) {
  const t = table.action?.type;
  return t === 'attack' || t === 'spellcast';
}

export const Battlemage = {
  name: 'Battlemage',
  description:
    "You've focused your studies on becoming an unconquerable force on the battlefield. Gain an additional Hit Point slot.",
  passiveStatMods: {
    maxHP: 1,
  },
};

export const FaceYourFear = {
  name: 'Face Your Fear',
  description:
    'When you succeed with Fear on an attack roll, you deal an extra **1d10** magic damage.',
  hooks: {
    onReviewAction: when(
      isActing,
      isAttackOrSpellcast,
      succeedWithFear,
      (table) => {
        const die = faceYourFearDamageDice(table);
        table.rolls?.damage?.addDie({ name: 'Face Your Fear', die: die });
      }
    ),
  },
};

export const ConjureShield = {
  name: 'Conjure Shield',
  description:
    'You can maintain a protective barrier of magic. While you have at least 2 Hope, you add your Proficiency to your Evasion.',
  passiveStatMods: {
    evasion: (table) => ((table.me?.hope ?? 0) >= 2 ? (table.me?.proficiency ?? 0) : 0),
  },
};

/** Die scaling merged into Face Your Fear via tier (tier 2+ = 2d10). */
export const FueledByFear = {
  name: 'Fueled by Fear',
  description:
    'The extra magic damage from your "Face Your Fear" feature increases to **2d10**.',
};

/** Die scaling merged into Face Your Fear via tier (tier 3+ = 3d10). */
export const HaveNoFear = {
  name: 'Have No Fear',
  description:
    'The extra magic damage from your "Face Your Fear" feature increases to **3d10.**',
};

export const ThriveInChaos = {
  name: 'Thrive in Chaos',
  description:
    'When you succeed on an attack, you can **mark a Stress** after rolling damage to force the target to mark an additional Hit Point.',
  chips: [
    when(
      youSucceedOnAnAttack,
      (table) => (table.rolls?.damage?.dice?.length ?? 0) > 0,
      {
        name: 'Thrive in Chaos',
        placements: ['reviewAction'],
        stressCost: 1,
        description: 'Mark 1 Stress: the target marks 1 additional Hit Point.',
        onUse(table) {
          table.action?.target?.markHP(1);
        },
      }
    ),
  ],
};
