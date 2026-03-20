/**
 * Bard class features — per-feature descriptors.
 *
 * SRD (class): Bards are the most charismatic people in all the realms. Members of this class are masters of captivation
 * and specialize in a variety of performance types, including singing, playing musical instruments, weaving tales, or
 * telling jokes. Whether performing for an audience or speaking to an individual, bards thrive in social situations.
 *
 * SRD (Make a Scene, Hope): **Spend 3 Hope** to temporarily _Distract_ a target within Close range, giving them a -2
 * penalty to their Difficulty.
 *
 * SRD (Rally): Once per session, describe how you rally the party and give yourself and each of your allies a Rally Die.
 * At level 1, your Rally Die is a **d6**. A PC can spend their Rally Die to roll it, adding the result to their action
 * roll, reaction roll, damage roll, or to clear a number of Stress equal to the result. At the end of each session, clear
 * all unspent Rally Dice. At level 5, your Rally Die increases to a **d8**.
 *
 * Implementation: Make a Scene — onFeatureActivated applies difficultyMod on target adversary. Rally — hope ability,
 * forceActionNotification so GM ack applies state.
 */

/** @type {Record<string, object>} */
const features = {
  'Make a Scene': {
    name: 'Make a Scene',
    class: 'Bard',
    onFeatureActivated({ targetEl, updateActiveElement }) {
      if (!targetEl?.instanceId) return;
      const current = targetEl.difficultyMod ?? 0;
      updateActiveElement(targetEl.instanceId, { difficultyMod: current - 2 });
    },
  },

  Rally: {
    name: 'Rally',
    class: 'Bard',
    forceActionNotification: true,
    hopeAbility: {
      name: 'Rally',
      description: "Grant an ally a Rally Die they can add to their next action roll.",
      triggeredOn: 'hope-ability',
      producesModifier: {
        type: 'rally',
        dice: 'd6',
        label: 'Rally Die',
        mode: 'clearStress',
        consumeOnUse: true,
        refreshOn: 'use',
      },
    },
  },
};

export default features;
