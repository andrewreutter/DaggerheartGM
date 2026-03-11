export default {
  name: 'Burning',
  automated: true,
  tagText: '6 on damage die → target marks Stress',
  description: 'When you roll a 6 on a damage die, the target must mark a Stress.',

  /** Target marks 1 Stress when any damage die rolled a 6. */
  onDamageApplied({ target, roll }) {
    if (roll?.sub('damage')?.hasValue(6)) {
      target.markStress();
    }
  },

  bannerStatus(tag, roll) {
    const damageSub = roll?.sub('damage');
    if (!damageSub) return null;
    return damageSub.hasValue(6)
      ? { text: 'Triggered! (+1 Stress)', style: 'green' }
      : { text: 'No trigger (no 6 rolled)', style: 'muted' };
  },
};
