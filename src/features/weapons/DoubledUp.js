export default {
  name: 'Doubled Up',
  description: 'When you attack with your primary weapon, you can deal damage to another target within Melee range.',
  showTag: true,
  automated: false,
  interactive: true,
  tagText: null,
  bannerStatus(tag) {
    return { text: tag.text, style: 'info' };
  },
  bannerInteraction: {
    type: 'target-picker',
    phase: 'post-apply',
    loop: false,
    getPrompt(tags) {
      const tag = tags?.find(t => t.name === 'Doubled Up');
      const match = tag?.text?.match(/^([^\s]+(?:\s+\w{2,4})?)\s*--/);
      const label = match ? match[1] : 'secondary damage';
      return `Doubled Up: deal ${label} to another Melee target?`;
    },
    skipLabel: 'Skip',
  },
};
