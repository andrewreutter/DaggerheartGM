/**
 * Druid class features.
 *
 * Hooks implemented:
 *   onFeatureActivated — Beastform and Evolution: set activeBeastform from roll._beastform
 */
export default {
  name: 'Druid',

  /**
   * Called from GMTableView's handleBannerAcknowledge when the Druid uses
   * Beastform (1 Stress, once/rest) or Evolution (3 Hope, hope ability).
   * Both features set activeBeastform on the character element.
   *
   * @param {{ featureName: string, selfEl: object, updateActiveElement: Function, roll: object }} ctx
   */
  onFeatureActivated({ featureName, selfEl, updateActiveElement, roll }) {
    if (featureName !== 'Beastform' && featureName !== 'Evolution') return;
    if (!selfEl?.instanceId) return;
    if (!roll?._beastform) return;
    updateActiveElement(selfEl.instanceId, { activeBeastform: roll._beastform });
  },
};
