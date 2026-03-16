/**
 * Sorcerer class features.
 *
 * Hooks implemented:
 *   onFeatureActivated — Channel Raw Power: gain Hope or add a persistent spell-damage modifier
 *
 * requiresInputForFeature — declares that Channel Raw Power needs a card-level number input
 *   before being dispatched, so CharacterHoverCard can render an inline prompt.
 */
export default {
  name: 'Sorcerer',

  /**
   * Descriptor consumed by CharacterHoverCard.handleFeatureUse to prompt the player
   * for a card level before dispatching the feature.
   *
   * { [featureName]: { type, label, min, max, default } }
   */
  requiresInputForFeature: {
    'Channel Raw Power': { type: 'number', label: 'Card level', min: 1, max: 10, default: 1 },
  },

  /**
   * "Channel Raw Power" (once per long rest) — two sub-options:
   *   • "Gain Hope equal to the card level" — immediately grants Hope
   *   • "Enhance your next spell: +2×level damage" — adds a persistent modifier chip
   *
   * @param {{ featureName: string, subFeatureName: string|null, inputValue: number|null,
   *           selfEl: object, updateActiveElement: Function }} ctx
   *   selfEl is a wrapped entity (has .gainHope, .instanceId, .activeModifiers, etc.)
   */
  onFeatureActivated({ featureName, subFeatureName, inputValue, selfEl, updateActiveElement }) {
    if (featureName !== 'Channel Raw Power') return;
    const level = typeof inputValue === 'number' && inputValue > 0 ? inputValue : 1;

    const subLower = (subFeatureName ?? '').toLowerCase();
    if (subLower.includes('hope') || subLower.includes('gain')) {
      selfEl.gainHope(level);
      return;
    }

    if (subLower.includes('enhance') || subLower.includes('spell') || subLower.includes('damage')) {
      const mod = {
        id: `channel-raw-power-${selfEl.instanceId}-${Date.now()}`,
        name: 'Channel Raw Power',
        bonus: 2 * level,
        appliesTo: 'spell-damage',
        type: 'persistent',
        refreshOn: 'longRest',
      };
      const existing = selfEl.activeModifiers ?? [];
      updateActiveElement(selfEl.instanceId, { activeModifiers: [...existing, mod] });
    }
  },
};
