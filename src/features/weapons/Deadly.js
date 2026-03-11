export default {
  name: 'Deadly',
  automated: true,
  tagText: '+1 HP on Severe damage (applied)',
  description: 'When you deal Severe damage, the target must mark an additional HP.',
  /** Add +1 HP loss on Severe damage (hpLoss ≥ 3). */
  modifyHpLoss(hpLoss) {
    return hpLoss >= 3 ? hpLoss + 1 : hpLoss;
  },
};
