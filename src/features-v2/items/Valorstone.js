import { Resilient } from '../armor_properties/Resilient.js';

/** SRD item — Valorstone (roll table 15). Delegates Resilient armor behavior. */
export const Valorstone = {
  name: 'Valorstone',
  description:
    "You can attach this stone to armor that doesn't already have a feature. The armor gains the following feature. Resilient: Before you mark your last Armor Slot, roll a d6. On a result of 6, reduce the severity by one threshold without marking an Armor Slot.",
  hooks: Resilient.hooks,
};
