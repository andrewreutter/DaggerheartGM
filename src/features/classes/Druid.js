/**
 * Druid class features.
 *
 * Hooks implemented:
 *   onFeatureActivated — Beastform and Evolution: set activeBeastform from roll._beastform
 *   onFeatureActivated — Elemental Incarnation (Warden of the Elements): set activeChanneledElement
 *   onDamageReceived — Elemental Incarnation: clear activeChanneledElement on Severe damage
 */
export default {
  name: 'Druid',

  /** Features that always use action-notification path (no dice roll) so GM ack applies state. */
  forceActionNotificationFeatures: ['Elemental Incarnation'],

  /**
   * Called from GMTableView's handleBannerAcknowledge when the Druid uses
   * Beastform (1 Stress, once/rest), Evolution (3 Hope, hope ability), or
   * Elemental Incarnation (1 Stress, set channeled element).
   *
   * @param {{ featureName: string, subFeatureName: string, selfEl: object, updateActiveElement: Function, roll: object }} ctx
   */
  onFeatureActivated({ featureName, subFeatureName, selfEl, updateActiveElement, roll }) {
    if (featureName === 'Beastform' || featureName === 'Evolution') {
      if (!selfEl?.instanceId) return;
      if (!roll?._beastform) return;
      updateActiveElement(selfEl.instanceId, { activeBeastform: roll._beastform });
      return;
    }
    if (featureName === 'Drop out of Beastform') {
      if (!selfEl?.instanceId) return;
      updateActiveElement(selfEl.instanceId, { activeBeastform: null, selectedBeastformAdvantage: null });
      return;
    }
    if (featureName === 'Elemental Incarnation') {
      if (!selfEl?.instanceId) return;
      const sub = (subFeatureName ?? '').toLowerCase();
      const element = ['fire', 'earth', 'water', 'air'].find(e => sub.includes(e)) ?? null;
      selfEl.setFlag('activeChanneledElement', element);
      return;
    }
  },

  /**
   * Called from GMTableView's applyDamageToTarget when a character takes HP damage.
   * Elemental Incarnation: clear Channeling on Severe damage (hpLoss >= 3).
   */
  onDamageReceived({ character, hpLoss }) {
    if (hpLoss >= 3 && character.activeChanneledElement) {
      character.setFlag('activeChanneledElement', null);
    }
  },
};
