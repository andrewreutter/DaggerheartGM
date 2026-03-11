export default {
  name: 'Doubled Up',
  automated: false,
  interactive: true,
  tagText: null, // tagText is dynamic — set from secondaryDamage in buildWeaponRollText (Phase 3)
  description: 'When you attack with your primary weapon, you can deal damage to another target within Melee range.',

  bannerStatus(tag) {
    return { text: tag.text, style: 'info' };
  },

  bannerInteraction: {
    type: 'target-picker',
    phase: 'post-apply',
    loop: false,
    // Prompt is dynamic based on the secondary damage string in the tag text
    getPrompt(tags) {
      const tag = tags?.find(t => t.name === 'Doubled Up');
      const match = tag?.text?.match(/^([^\s]+(?:\s+\w{2,4})?)\s*--/);
      const label = match ? match[1] : 'secondary damage';
      return `Doubled Up: deal ${label} to another Melee target?`;
    },
    skipLabel: 'Skip',
  },
};
