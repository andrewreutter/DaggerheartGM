/**
 * SRD: Household Friend — daggerheart-srd/beastforms/Household Friend.md
 */
import { Fragile } from './shared/Fragile.js';

export const Companion = {
  name: 'Companion',
  description:
    'When you Help an Ally, you can roll a **d8** as your advantage die.',
};

export const features = [Companion, Fragile];
