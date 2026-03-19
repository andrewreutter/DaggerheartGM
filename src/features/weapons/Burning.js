export default {
  name: 'Burning',
  description: 'When you roll a 6 on a damage die, the target must mark a Stress.',
  onBanner: banner => banner.addAutomatedNarration(),
  onBannerAck(roll, target) {
    const sixes = roll?.sub('damage')?.values()?.filter(v => v === 6).length || 0;
    if (sixes > 0) target.markStress(sixes);
  },
};
