export default {
  name: 'Quick',
  description: 'When you make an attack, you can mark a Stress to target another creature within range.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Quick', 'When you make an attack, you can mark a Stress to target another creature within range.', {
      showTag: true,
      automated: false,
      interactive: true,
      tagText: 'Mark Stress to target another creature in range',
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
    });
  },
};
