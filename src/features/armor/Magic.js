export default {
  name: 'Magic',
  description: 'Armor Slots can only be used against magic damage.',
  /** Magic-damage-only gate — the UI hides the armor button for non-magic damage. */
  allowsArmorFor: 'mag',
};
