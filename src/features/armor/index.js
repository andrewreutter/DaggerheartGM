/**
 * Armor features barrel.
 *
 * Each armor file exports a single feature descriptor: { name, description?, ...hooks }.
 * The barrel builds and registers each descriptor. Descriptors are in armorFeatures only
 * (no feature list / no character sheet feature cards).
 */
import { buildFeatureDescriptor, registerFeature } from '../descriptor-util.js';
import Fortified  from './Fortified.js';
import Painful    from './Painful.js';
import Resilient  from './Resilient.js';
import Reinforced from './Reinforced.js';
import Warded     from './Warded.js';
import Physical   from './Physical.js';
import Magic      from './Magic.js';
import Flexible   from './Flexible.js';
import Heavy      from './Heavy.js';
import VeryHeavy  from './VeryHeavy.js';
import Gilded     from './Gilded.js';
import Difficult  from './Difficult.js';
import Channeling from './Channeling.js';
import Quiet      from './Quiet.js';
import Sharp      from './Sharp.js';
import Burning    from './Burning.js';
import Timeslowing from './Timeslowing.js';
import Shifting   from './Shifting.js';
import Hopeful    from './Hopeful.js';
import Impenetrable from './Impenetrable.js';

/** Dictionary of feature name → descriptor (each file exports a single descriptor). */
const builderDict = {
  Fortified, Painful, Resilient, Reinforced, Warded, Physical, Magic,
  Flexible, Heavy, VeryHeavy, Gilded, Difficult, Channeling, Quiet,
  Sharp, Burning, Timeslowing, Shifting, Hopeful, Impenetrable,
};

/** @type {Record<string, object>} feature name → descriptor */
const armorFeatures = {};

for (const builder of Object.values(builderDict)) {
  const { name, description, ...hooks } = builder;
  const descriptor = buildFeatureDescriptor(name, description, hooks, {
    targetMap: armorFeatures,
    sourceType: 'armor',
    source: builder.name,
  });
  registerFeature(descriptor, { targetMap: armorFeatures });
}

export default armorFeatures;
