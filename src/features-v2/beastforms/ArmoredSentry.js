/**
 * SRD: Armored Sentry — daggerheart-srd/beastforms/Armored Sentry.md
 */

export const ArmoredShell = {
  name: 'Armored Shell',
  description:
    "Your hardened exterior gives you resistance to physical damage. Additionally, **mark an Armor Slot** to retract into your shell. While in your shell, physical damage is reduced by a number equal to your Armor Score (after applying resistance), but you can't perform other actions without leaving this form.",
};

export const Cannonball = {
  name: 'Cannonball',
  description:
    "**Mark a Stress** to allow an ally to throw or launch you at an adversary. To do so, the ally makes an attack roll using Agility or Strength (their choice) against a target within Close range. On a success, the adversary takes **d12+2** physical damage using the thrower's Proficiency. You can **spend a Hope** to target an additional adversary within Very Close range of the first. The second target takes half the damage dealt to the first target.",
};

export const features = [ArmoredShell, Cannonball];
