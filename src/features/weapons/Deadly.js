export default {
  name: 'Deadly',
  description: 'When you deal Severe damage, the target must mark an additional HP.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Deadly', 'When you deal Severe damage, the target must mark an additional HP.', {
      showTag: true,
      automated: true,
      tagText: '+1 HP on Severe damage (applied)',
      modifyHpLoss(hpLoss) {
        return hpLoss >= 3 ? hpLoss + 1 : hpLoss;
      },
    });
  },
};
