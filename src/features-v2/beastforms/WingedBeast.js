/**
 * SRD: Winged Beast — daggerheart-srd/beastforms/Winged Beast.md
 */

export const BirdsEyeView = {
  name: "Bird's-Eye View",
  description:
    'You can fly at will. Once per rest while you are airborne, you can ask the GM a question about the scene below you without needing to roll. The first time a character makes a roll to act on this information, they gain advantage on the roll.',
};

export const HollowBones = {
  name: 'Hollow Bones',
  description: 'You gain a -2 penalty to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: -2,
    severeThreshold: -2,
  },
};

export const features = [BirdsEyeView, HollowBones];
