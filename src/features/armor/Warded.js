/**
 * SRD: You reduce incoming magic damage by your Armor Score before applying it to your damage thresholds.
 */
export default {
  name: 'Warded',
  description: 'Magic damage against you is reduced by your Armor Score before the threshold is applied.',
  modifyPreThresholdDamage({ target, dmgType, roll }) {
    if (dmgType !== 'mag') return roll.damageTotal;
    return Math.max(0, roll.damageTotal - (target.armorScore ?? 0));
  },
};
