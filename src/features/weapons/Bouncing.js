export default {
  name: 'Bouncing',
  description: 'Mark 1 or more Stress to hit that many targets in range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Bouncing', 'Mark 1 or more Stress to hit that many targets in range.', {
      showTag: true,
      automated: false,
      interactive: true,
      tagText: 'Mark Stress to hit additional targets in range',
      bannerInteraction: {
        type: 'target-picker',
        phase: 'post-apply',
        loop: true,
        prompt: 'Bouncing: mark Stress to hit another target?',
        skipLabel: 'Done',
      },
    });
  },
};
