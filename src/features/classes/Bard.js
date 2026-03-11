export default {
  name: 'Bard',

  /**
   * "Rally" — the Bard's Hope ability grants Rally Die modifiers to allies.
   * These are stored as `activeModifiers` on the character element and render
   * as amber toggle chips in `CharacterExperiences`.
   *
   * Activating a Rally Die modifier costs Hope (via `onUseHopeAbility` in
   * `CharacterFeatureList` / `handleFeatureUse` in `CharacterHoverCard`).
   * The modifier adds bonus dice to the next action roll.
   *
   * This descriptor documents the mechanic; the actual modifier handling is
   * in the `activeModifiers` system in CharacterDisplay + CharacterHoverCard.
   */
  hopeAbility: {
    name: 'Rally',
    description: "Grant an ally a Rally Die they can add to their next action roll.",
    triggeredOn: 'hope-ability',
    producesModifier: {
      type: 'rally',
      dice: 'd6',
      label: 'Rally Die',
      refreshOn: 'use',
    },
  },
};
