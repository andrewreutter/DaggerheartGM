/**
 * SRD: Agile Scout — daggerheart-srd/beastforms/Agile Scout.md
 */
import { Fragile } from './shared/Fragile.js';

export const Agile = {
  name: 'Agile',
  description:
    'Your movement is silent, and you can **spend a Hope** to move up to Far range without rolling.',
};

/** Ordered list married to `BEASTFORM_ITEMS` by feature `name` (see `marry.js`). */
export const features = [Agile, Fragile];
