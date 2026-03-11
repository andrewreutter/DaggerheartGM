export default {
  name: 'Lucky',
  automated: false,
  interactive: true,
  tagText: 'Mark Stress to reroll on Fear',
  description: 'On a failed attack, mark a Stress to reroll your attack.',

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
};
