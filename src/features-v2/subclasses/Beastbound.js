/**
 * Beastbound Ranger subclass — SRD: daggerheart-srd/subclasses/Beastbound.md
 */

import { when, isTargeted } from '../engine/when.js';
import { queueInternalMutation } from '../engine/table.js';

/**
 * Adversary attack vs the ranger where the adversary is in **Melee** range of the ranger’s position.
 * Treats the companion as sharing the ranger’s space when the companion has no separate map token
 * (see **Battle-Bonded** SRD: attacker must be within the companion’s Melee range).
 */
function adversaryInMeleeOfSharedCompanionSpace(table) {
  const actor = table.action?.actor;
  if (!actor || actor.isAdversary !== true) return false;
  return table.me?.rangeFrom(actor) === 'melee';
}

export const Companion = {
  name: 'Companion',
  description:
    "You have an animal companion of your choice (at the GM's discretion). They stay by your side unless you tell them otherwise.\n\nTake the Ranger Companion sheet. When you level up your character, choose a level-up option for your companion from this sheet as well.",
};

export const ExpertTraining = {
  name: 'Expert Training',
  description: 'Choose an additional level-up option for your companion.',
};

export const BattleBonded = {
  name: 'Battle-Bonded',
  description:
    "When an adversary attacks you while they're within your companion's Melee range, you gain a +2 bonus to your Evasion against the attack.",
  hooks: {
    onIntent: when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      adversaryInMeleeOfSharedCompanionSpace,
      (table) => {
        queueInternalMutation(table, 'addTemporaryStatMod', {
          instanceId: table.me.instanceId,
          stat: 'evasion',
          value: 2,
        });
      }
    ),
  },
};

export const AdvancedTraining = {
  name: 'Advanced Training',
  description: 'Choose two additional level-up options for your companion.',
};

export const LoyalFriend = {
  name: 'Loyal Friend',
  description:
    "Once per long rest, when the damage from an attack would mark your companion's last Stress or your last Hit Point and you're within Close range of each other, you or your companion can rush to the other's side and take that damage instead.",
};
