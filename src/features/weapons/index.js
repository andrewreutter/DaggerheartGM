/**
 * Weapon features barrel — builds a lookup map from feature name to feature object.
 */
import Painful       from './Painful.js';
import Invigorating  from './Invigorating.js';
import Lifestealing  from './Lifestealing.js';
import Charged       from './Charged.js';
import Startling     from './Startling.js';
import Reliable      from './Reliable.js';
import Sharpwing     from './Sharpwing.js';
import Bonded        from './Bonded.js';
import Scary         from './Scary.js';
import Deadly        from './Deadly.js';
import Powerful      from './Powerful.js';
import Massive       from './Massive.js';
import Brutal        from './Brutal.js';
import SelfCorrecting from './SelfCorrecting.js';
import Serrated      from './Serrated.js';
import Burning       from './Burning.js';
import Reloading     from './Reloading.js';
import Quick         from './Quick.js';
import Devastating   from './Devastating.js';
import Lucky         from './Lucky.js';
import Bouncing      from './Bouncing.js';
import Versatile     from './Versatile.js';
import DoubledUp     from './DoubledUp.js';
import Cumbersome    from './Cumbersome.js';
import Heavy         from './Heavy.js';
import Protective    from './Protective.js';
import Barrier       from './Barrier.js';
import DoubleDuty    from './DoubleDuty.js';
import Brave         from './Brave.js';
import Paired        from './Paired.js';
import Otherworldly  from './Otherworldly.js';
import Parry         from './Parry.js';

const featureList = [
  Painful, Invigorating, Lifestealing, Charged, Startling,
  Reliable, Sharpwing, Bonded, Scary, Deadly,
  Powerful, Massive, Brutal, SelfCorrecting, Serrated,
  Burning, Reloading, Quick, Devastating, Lucky,
  Bouncing, Versatile, DoubledUp,
  Cumbersome, Heavy, Protective, Barrier, DoubleDuty, Brave, Paired, Otherworldly, Parry,
];

/** @type {Record<string, object>} */
const weaponFeatures = Object.fromEntries(featureList.map(f => [f.name, f]));

export default weaponFeatures;
