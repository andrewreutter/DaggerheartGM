export default {
  name: 'Bouncing',
  automated: false,
  interactive: true,
  tagText: 'Mark Stress to hit additional targets in range',
  description: 'Mark 1 or more Stress to hit that many targets in range.',

  bannerInteraction: {
    type: 'target-picker',
    phase: 'post-apply',
    loop: true, // stays in target-picker phase until user clicks Done
    prompt: 'Bouncing: mark Stress to hit another target?',
    skipLabel: 'Done',
  },
};
