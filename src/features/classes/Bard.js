export default {
  name: 'Bard',

  /**
   * Force Rally through the action-notification path instead of the dice-roll path.
   * Rally's description mentions "d6" and "d8" (the die sizes for the modifier chips),
   * which causes parseFeatureAction to detect dice and route it as a roll. Forcing it
   * as an action ensures the banner shows "Rally" (not "0") and the Rally Die modifiers
   * are distributed to all characters on GM acknowledge.
   */
  forceActionNotificationFeatures: ['Rally'],

  /**
   * "Rally" — the Bard's Hope ability grants Rally Die modifiers to allies.
   * These are stored as `activeModifiers` on the character element and render
   * as amber toggle chips in `CharacterExperiences`.
   */
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

  /**
   * "Make a Scene" (Hope ability) — reduces target adversary's effective
   * difficulty by 2 by applying a `difficultyMod` field on its active element.
   *
   * Called from GMTableView via `runHook(classFeatures, ['Bard'], 'onFeatureActivated', ctx)`.
   * Stacks if used multiple times on the same adversary.
   */
  onFeatureActivated({ featureName, targetEl, updateActiveElement }) {
    if (featureName !== 'Make a Scene') return;
    if (!targetEl?.instanceId) return;
    const current = targetEl.difficultyMod ?? 0;
    updateActiveElement(targetEl.instanceId, { difficultyMod: current - 2 });
  },
};
