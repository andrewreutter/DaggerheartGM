import { Brutal } from '../weapon_properties/Brutal.js';

/** SRD item — Bloodstone (roll table 25). Delegates Brutal weapon behavior. */
export const Bloodstone = {
  name: 'Bloodstone',
  description:
    "You can attach this stone to a weapon that doesn't already have a feature. The weapon gains the following feature. Brutal: When you roll the maximum value on a damage die, roll an additional damage die.",
  hooks: Brutal.hooks,
};
