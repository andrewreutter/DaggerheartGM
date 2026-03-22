export const Pompous = {
  name: 'Pompous',
  description: 'You must have a Presence of 0 or lower to use this weapon.',
  /**
   * `table.source` is a shallow copy of the weapon row during declarative render (not the shared registry).
   * Merge `weaponRenderHints` from `applyDeclarativeFeatures` onto the element so `table.me.weapons` get `isDisabled`.
   */
  onRender(table) {
    if ((table.me?.traits?.presence ?? 0) > 0) {
      table.source.isDisabled = true;
      table.source.disabledReason = 'Requires Presence ≤ 0';
    } else {
      table.source.isDisabled = false;
    }
  },
};
