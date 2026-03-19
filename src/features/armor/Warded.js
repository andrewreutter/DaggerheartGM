export default {
  name: 'Warded',
  description: 'Magic damage against you is reduced by your Armor Score before the threshold is applied.',
  modifyPreThresholdDamage(dmgTotal, { target, dmgType }) {
    if (dmgType !== 'mag') return dmgTotal;
    return Math.max(0, dmgTotal - (target.armorScore ?? 0));
  },
};
