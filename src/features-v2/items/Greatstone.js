import { Powerful } from '../weapon_properties/Powerful.js';

/** SRD item — Greatstone (roll table 26). Delegates Powerful weapon behavior. */
export const Greatstone = {
  name: 'Greatstone',
  description:
    "You can attach this stone to a weapon that doesn't already have a feature. The weapon gains the following feature. Powerful: On a successful attack, roll an additional damage die and discard the lowest result.",
  hooks: Powerful.hooks,
};
