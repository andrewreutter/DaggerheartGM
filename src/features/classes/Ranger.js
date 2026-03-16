/**
 * Ranger class features.
 *
 * Hooks implemented:
 *   onFeatureActivated — sets focusTargetId when "Ranger's Focus" is activated
 *   onHpDealt          — marks 1 Stress on the Ranger when they deal HP damage to their Focus target
 */
export default {
  name: 'Ranger',

  /**
   * "Ranger's Focus" — the Ranger picks an adversary as their Focus target.
   * Stored as `focusTargetId` on the character element.
   *
   * Called from GMTableView's onFeatureActivated dispatch when the Ranger uses
   * the feature and the GM selects a target via the ActionBanner target picker.
   *
   * @param {{ featureName: string, targetEl: object|null, selfEl: object, updateActiveElement: Function }} ctx
   */
  onFeatureActivated({ featureName, targetEl, selfEl, updateActiveElement }) {
    if (featureName !== "Ranger's Focus") return;
    if (!selfEl?.instanceId) return;
    updateActiveElement(selfEl.instanceId, { focusTargetId: targetEl?.instanceId ?? null });
  },

  /**
   * When the Ranger deals ≥1 HP damage to their Focus target, mark 1 Stress on themselves.
   *
   * @param {{ character: object, hpDealt: number, target: object, updateActiveElement: Function }} ctx
   *   character — the attacker (wrapped entity; has .class, .focusTargetId, .markStress, etc.)
   *   target    — entity that received the damage (has .instanceId)
   */
  onHpDealt({ character, hpDealt, target }) {
    if (hpDealt < 1) return;
    if (!character.focusTargetId) return;
    if (target?.instanceId !== character.focusTargetId) return;
    character.markStress(1);
  },
};
