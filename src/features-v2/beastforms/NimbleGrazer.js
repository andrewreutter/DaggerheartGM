/**
 * SRD: Nimble Grazer — daggerheart-srd/beastforms/Nimble Grazer.md
 */
import { Fragile } from './shared/Fragile.js';

export const ElusivePrey = {
  name: 'Elusive Prey',
  description:
    'When an attack roll against you would succeed, you can **mark a Stress** and roll a **d4.** Add the result to your Evasion against this attack.',
};

export const features = [ElusivePrey, Fragile];
