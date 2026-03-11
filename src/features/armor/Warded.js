export default {
  name: 'Warded',
  description: 'Magic damage against you is reduced by your Armor Score before the threshold is applied.',
  /**
   * Subtract the wearer's Armor Score from magic damage before threshold
   * computation. Runs as a pre-threshold damage modifier.
   */
  modifyPreThresholdDamage(dmgTotal, { target, dmgType }) {
    if (dmgType !== 'mag') return dmgTotal;
    return Math.max(0, dmgTotal - (target.armorScore ?? 0));
  },
};
