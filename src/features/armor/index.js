/**
 * Armor features barrel — builds a lookup map from feature name to feature object.
 */
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

const featureList = [
  Fortified, Painful, Resilient, Reinforced, Warded, Physical, Magic,
  Flexible, Heavy, VeryHeavy, Gilded, Difficult, Channeling, Quiet,
];

/** @type {Record<string, object>} */
const armorFeatures = Object.fromEntries(featureList.map(f => [f.name, f]));

export default armorFeatures;
