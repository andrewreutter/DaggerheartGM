export default {
  name: 'Wizard',

  /**
   * "Not This Time" — when an adversary rolls with Hope/Fear dice, a Wizard
   * with ≥3 Hope may spend 3 Hope to force a reroll.
   *
   * The UI renders per-wizard "Not This Time (3 Hope)" buttons on adversary
   * roll banners when `wizardsWithHope` is non-empty.
   * The handler (`onNotThisTime` in GMTableView) deducts 3 Hope and rerolls.
   *
   * This descriptor documents the mechanic; the button itself is rendered by
   * `ResultBanner` using the `wizardsWithHope` + `onNotThisTime` props.
   */
  hopeAbility: {
    name: 'Not This Time',
    hopeCost: 3,
    description: 'When an adversary rolls against you or an ally, you may spend 3 Hope to force them to reroll.',
    triggeredOn: 'adversary-roll',
    bannerInteraction: {
      type: 'reroll-button',
      phase: 'pre-apply',
      prompt: 'Not This Time (3 Hope)',
    },
  },
};
