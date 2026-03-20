/**
 * SRD: When you deal Severe damage, the target must mark an additional HP.
 */
export default {
  name: 'Deadly',
  description: 'When you deal Severe damage, the target must mark an additional HP.',
  showTag: true,
  automated: true,
  tagText: '+1 HP on Severe damage (applied)',
  modifyHpLoss({ roll }) {
    return roll.hpLoss >= 3 ? roll.hpLoss + 1 : roll.hpLoss;
  },
};
