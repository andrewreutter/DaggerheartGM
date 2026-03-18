/**
 * Armor features barrel — builder pattern aligned with ancestries/communities.
 *
 * Each armor file exports { name, description, onCharacterBuild({ character, armor }) }.
 * The barrel creates a character builder (shared addFeature) and an armor context object,
 * then runs builder.onCharacterBuild({ character, armor }). Descriptors are registered
 * in armorFeatures only (no feature list / no character sheet feature cards).
 */
import { createFeatureBuilder } from '../add-feature.js';
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

const builders = [
  Fortified, Painful, Resilient, Reinforced, Warded, Physical, Magic,
  Flexible, Heavy, VeryHeavy, Gilded, Difficult, Channeling, Quiet,
  Sharp, Burning, Timeslowing, Shifting, Hopeful, Impenetrable,
];

/** @type {Record<string, object>} feature name → descriptor */
const armorFeatures = {};

for (const builder of builders) {
  const character = createFeatureBuilder({
    targetMap: armorFeatures,
    sourceType: 'armor',
    source: builder.name,
  });
  const armor = { name: builder.name, description: builder.description };
  builder.onCharacterBuild({ character, armor });
}

export default armorFeatures;
