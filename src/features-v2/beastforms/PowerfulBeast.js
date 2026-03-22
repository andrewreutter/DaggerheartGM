/**
 * SRD: Powerful Beast — daggerheart-srd/beastforms/Powerful Beast.md
 */

export const Rampage = {
  name: 'Rampage',
  description:
    'When you roll a 1 on a damage die, you can roll a **d10** and add the result to the damage roll. Additionally, before you make an attack roll, you can **mark a Stress** to gain a +1 bonus to your Proficiency for that attack.',
};

export const ThickHide = {
  name: 'Thick Hide',
  description: 'You gain a +2 bonus to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: 2,
    severeThreshold: 2,
  },
};

export const features = [Rampage, ThickHide];
