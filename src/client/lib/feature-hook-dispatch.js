/**
 * Feature hook dispatch for merged `activeFeatures` rows (V2 / character-calc).
 */

/**
 * @param {object[]} activeFeatures
 * @param {string} hookName
 * @param {object} context
 */
export function runCharacterHook(activeFeatures, hookName, context) {
  if (!Array.isArray(activeFeatures)) return;
  const charEl = hookName === 'onRoll' ? context._characterEl : null;
  for (const feature of activeFeatures) {
    if (typeof feature[hookName] !== 'function') continue;
    const name = feature.name;
    let featureForHook = feature;
    if (hookName === 'onRoll' && charEl && typeof context.updateActiveElement === 'function') {
      const get = (key, defaultVal) => {
        const bag = charEl._originFeatureState?.[name];
        return bag != null && key in bag ? bag[key] : defaultVal;
      };
      const set = (key, value) => {
        const current = charEl._originFeatureState ?? {};
        const featureBag = current[name] ?? {};
        const next = { ...current, [name]: { ...featureBag, [key]: value } };
        charEl._originFeatureState = next;
        context.updateActiveElement(charEl.instanceId, { _originFeatureState: next });
      };
      featureForHook = { ...feature, get, set };
    }
    try {
      const ctx = { ...context, source: feature.source, feature: featureForHook };
      feature[hookName](ctx);
    } catch (err) {
      console.error(`[features] ${name}.${hookName} threw:`, err);
    }
  }
}
