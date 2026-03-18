export default {
  name: 'Burning',
  description: 'When you roll a 6 on a damage die, the target must mark a Stress.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Burning', 'When you roll a 6 on a damage die, the target must mark a Stress.', {
      onBanner(banner) {
        banner.addNarration('6 on damage die → target marks Stress', 'automated');
      },
      onDamageApplied({ target, roll }) {
        const damageSub = roll?.sub('damage');
        if (!damageSub) return;
        const sixes = (damageSub.values() || []).filter(v => v === 6).length;
        if (sixes > 0) target.markStress(sixes);
      },
      bannerStatus(tag, roll) {
        const damageSub = roll?.sub('damage');
        if (!damageSub) return null;
        const sixes = (damageSub.values() || []).filter(v => v === 6).length;
        return sixes > 0
          ? { text: `Triggered! (+${sixes} Stress)`, style: 'green' }
          : { text: 'No trigger (no 6 rolled)', style: 'muted' };
      },
    });
  },
};
