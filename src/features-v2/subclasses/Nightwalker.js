/**
 * Nightwalker subclass features — SRD: daggerheart-srd/subclasses/Nightwalker.md
 */

import { when, isActing } from '../engine/when.js';
import { queueInternalMutation } from '../engine/table.js';

const FS = 'Nightwalker';

function fearDominates(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  return h != null && f != null && f > h;
}

export const ShadowStepper = {
  name: 'Shadow Stepper',
  description:
    'You can move from shadow to shadow. When you move into an area of darkness or a shadow cast by another creature or object, you can mark a Stress to disappear from where you are and reappear inside another shadow within Far range. When you reappear, you are Cloaked.',
  chips: [
    {
      placements: ['card'],
      stressCost: 1,
      onUse(table) {
        const veryFar = table.me.shadowStepperVeryFarUnlocked === true;
        const rangeLabel = veryFar ? 'Very Far' : 'Far';
        table.me.actionLoop(
          'Shadow Stepper',
          `Teleport between shadows within ${rangeLabel} range (Very Far only while you have Fleeting Shadow). You become Cloaked when you reappear (GM places your token).`
        );
        table.me.addCondition('Cloaked');
      },
    },
  ],
};

export const DarkCloud = {
  name: 'Dark Cloud',
  description:
    "Make a Spellcast Roll (15). On a success, create a temporary dark cloud that covers any area within Close range. Anyone in this cloud can't see outside of it, and anyone outside of it can't see in. You're considered Cloaked from any adversary for whom the cloud blocks line of sight.",
  chips: [
    {
      placements: ['card'],
      onUse(table) {
        table.me.actionLoop(
          'Dark Cloud',
          'Spellcast (Finesse) vs Difficulty 15. On success, place a dark cloud covering any area in Close — sight does not pass through it. You are Cloaked from adversaries who have no line of sight to you through the cloud.',
          { trait: 'Finesse', difficulty: 15 }
        );
      },
    },
  ],
};

export const Adrenaline = {
  name: 'Adrenaline',
  description: "While you're Vulnerable, add your level to your damage rolls.",
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => table.me.hasCondition('Vulnerable'),
      (table) => {
        const lvl = table.me.level ?? 1;
        table.rolls?.damage?.addStatic({ name: 'Adrenaline', value: lvl });
      }
    ),
  },
};

export const FleetingShadow = {
  name: 'Fleeting Shadow',
  description:
    'Gain a permanent +1 bonus to your Evasion. You can use your "Shadow Stepper" feature to move within Very Far range.',
  passiveStatMods: {
    evasion: 1,
  },
  /** Merged by `applyDeclarativeFeatures` so **Shadow Stepper** uses Very Far (see `table.me.shadowStepperVeryFarUnlocked`). */
  shadowStepperVeryFarUnlocked: true,
};

export const VanishingAct = {
  name: 'Vanishing Act',
  description:
    'Mark a Stress to become Cloaked at any time. When Cloaked from this feature, you automatically clear the Restrained condition if you have it. You remain Cloaked in this way until you roll with Fear or until your next rest.',
  chips: [
    {
      placements: ['card'],
      stressCost: 1,
      onUse(table) {
        if (table.me.hasCondition('Restrained')) {
          table.me.removeCondition('Restrained');
        }
        table.me.addCondition('Cloaked');
        queueInternalMutation(table, 'setFeatureState', {
          featureKey: FS,
          key: 'vanishingActCloak',
          value: true,
        });
      },
    },
  ],
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.generatesHopeFear === true,
      (table) => table.featureState?.[FS]?.vanishingActCloak === true,
      fearDominates,
      (table) => {
        queueInternalMutation(table, 'setFeatureState', {
          featureKey: FS,
          key: 'vanishingActCloak',
          value: false,
        });
        table.me.removeCondition('Cloaked');
      }
    ),
    onRest(table) {
      if (table.featureState?.[FS]?.vanishingActCloak !== true) return;
      queueInternalMutation(table, 'setFeatureState', { featureKey: FS, key: 'vanishingActCloak', value: false });
      table.me.removeCondition('Cloaked');
    },
  },
};
