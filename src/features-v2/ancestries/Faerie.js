/**
 * Faerie Ancestry Features
 */

import { when, isTargeted } from '../engine/when.js';

/**
 * Luckbender: Once per session, after you or a willing ally within Close range makes an action roll,
 * you can spend 3 Hope to reroll the Duality Dice.
 * 
 * This is a reviewOutcome-phase chip that rerolls both Hope and Fear dice.
 */
export const Luckbender = {
  name: 'Luckbender',
  description: 'Once per session, after you or a willing ally within Close range makes an action roll, you can spend 3 Hope to reroll the Duality Dice.',
  
  chips: [
    when(
      (table) => {
        // Review chip only when an action roll exists (Hope/Fear d12s)
        if (!table.rolls?.action) return false;
        if (table.me.isActing) return true;

        const ally = table.action?.actor;
        if (!ally?.isCharacter) return false;

        // Close range (SRD): ally must be within Close — use documented Actor API only
        const band = table.me.rangeFrom(ally);
        if (!band) return false; // tokens not on map — cannot verify distance
        return band === 'melee' || band === 'veryClose' || band === 'close';
      },
      {
        name: 'Luckbender',
        description: 'Spend 3 Hope to reroll the Duality Dice (Hope and Fear dice).',
        placements: ['reviewOutcome'],
        hopeCost: 3,
        frequency: 'session',
        onUse: (table) => {
          // Reroll both Hope and Fear dice
          table.rolls?.action?.hopeDie?.reroll();
          table.rolls?.action?.fearDie?.reroll();
        },
      }
    ),
  ],
};

/**
 * Wings: You can fly. While flying, you can mark a Stress after an adversary makes an attack
 * against you to gain a +2 bonus to your Evasion against that attack.
 * 
 * This feature grants flight movement mode, a card toggle for flying state,
 * and a reviewOutcome-phase chip for the evasion reaction.
 */
export const Wings = {
  name: 'Wings',
  description: 'You can fly. While flying, you can mark a Stress after an adversary makes an attack against you to gain a +2 bonus to your Evasion against that attack.',
  
  movementModes: ['fly'],
  
  chips: [
    // Card toggle to track flying state
    {
      name: 'Wings',
      description: 'Toggle flying. While flying, you can react to adversary attacks for +2 Evasion.',
      placements: ['card'],
      isToggle: true,
      onUse: (table, chip) => {
        table.feature.set('flying', chip.isOn);
      },
    },
    // ReviewOutcome-phase evasion reaction (only available while flying)
    when(
      isTargeted,
      (table) => table.feature.get('flying') === true,
      {
        name: 'Wings',
        description: 'Mark a Stress to gain +2 Evasion against this attack.',
        placements: ['reviewOutcome'],
        stressCost: 1,
        temporaryStatMods: { evasion: 2 },
      }
    ),
  ],
};
