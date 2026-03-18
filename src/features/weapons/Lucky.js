export default {
  name: 'Lucky',
  description: 'On a failed attack, mark a Stress to reroll your attack.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Lucky', 'On a failed attack, mark a Stress to reroll your attack.', {
      showTag: true,
      automated: false,
      interactive: true,
      tagText: 'Mark Stress to reroll on Fear',
      bannerInteraction: {
        type: 'reroll-button',
        phase: 'pre-apply',
        triggeredWhen: 'fear',
        prompt: 'Lucky: Reroll? (mark 1 Stress)',
      },
      bannerStatus(tag, roll) {
        if (!roll) return null;
        return roll.dominant === 'fear'
          ? { text: 'Fear! Mark Stress to reroll?', style: 'red' }
          : { text: 'Not triggered (no Fear)', style: 'muted' };
      },
    });
  },
};
