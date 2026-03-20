/**
 * Sorcerer class features — per-feature descriptors.
 *
 * SRD (class): Not all innate magic users choose to hone their craft, but those who do can become powerful sorcerers.
 * The act of becoming a formidable sorcerer is not the practice of acquiring power, but learning to cultivate and
 * control the power one already possesses.
 *
 * SRD (Channel Raw Power): Once per long rest, you can place a domain card from your loadout into your vault and choose
 * to either: Gain Hope equal to the level of the card; or Enhance a spell that deals damage, gaining a bonus to your
 * damage roll equal to twice the level of the card.
 *
 * SRD (Volatile Magic, Hope): **Spend 3 Hope** to reroll any number of your damage dice on an attack that deals magic damage.
 *
 * Implementation: Channel Raw Power — onFeatureActivated gain Hope or add spell-damage modifier; requiresInput for card level.
 */

/** @type {Record<string, object>} */
const features = {
  'Channel Raw Power': {
    name: 'Channel Raw Power',
    class: 'Sorcerer',
    requiresInput: { type: 'number', label: 'Card level', min: 1, max: 10, default: 1 },
    onFeatureActivated({ subFeatureName, inputValue, selfEl, updateActiveElement }) {
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
  },
};

export default features;
