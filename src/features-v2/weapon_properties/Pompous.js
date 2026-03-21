export const Pompous = {
  name: 'Pompous',
  description: 'You must have a Presence of 0 or lower to use this weapon.',
  /**
   * Character rendering: merge `weaponRenderHints` from `applyDeclarativeFeatures` onto the element;
   * `table.me.primaryWeapon` / `weapons[]` include `isDisabled` / `disabledReason` when hints are merged.
   * The Game Table UI must respect `isDisabled` on weapon views (see V2 UI integration backlog).
   */
  onRender(table) {
    const presence = table.me?.traits?.presence ?? 0;
    if (presence > 0) {
      return { isDisabled: true, disabledReason: 'Requires Presence ≤ 0' };
    }
    return { isDisabled: false };
  },
};
