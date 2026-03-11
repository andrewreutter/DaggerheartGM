export default {
  name: 'Quick',
  automated: false,
  interactive: true,
  tagText: 'Mark Stress to target another creature in range',
  description: 'When you make an attack, you can mark a Stress to target another creature within range.',

  bannerStatus() {
    return { text: 'Mark Stress to target another creature', style: 'info' };
  },

  bannerInteraction: {
    type: 'target-picker',
    phase: 'post-apply',
    loop: false,
    prompt: 'Quick: mark Stress to hit another target?',
    skipLabel: 'Done',
  },
};
