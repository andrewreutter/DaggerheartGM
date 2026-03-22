/**
 * SRD: Mighty Lizard — daggerheart-srd/beastforms/Mighty Lizard.md
 */

export const PhysicalDefense = {
  name: 'Physical Defense',
  description: 'You gain a +3 bonus to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: 3,
    severeThreshold: 3,
  },
};

export const SnappingStrike = {
  name: 'Snapping Strike',
  description:
    'When you succeed on an attack against a target within Melee range, you can **spend a Hope** to clamp that opponent in your jaws, making them temporarily _Restrained_ and _Vulnerable._',
};

export const features = [PhysicalDefense, SnappingStrike];
