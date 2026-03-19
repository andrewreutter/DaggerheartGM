/**
 * Weapon features barrel.
 *
 * Each weapon file exports a single feature descriptor: { name, description?, ...hooks }.
 * The barrel registers each via addFeature. Descriptors are in weaponFeatures only
 * (no feature list / no character sheet feature cards).
 */
import { createFeatureBuilder } from '../add-feature.js';
import Painful       from './Painful.js';
import Invigorating  from './Invigorating.js';
import Lifestealing   from './Lifestealing.js';
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
import Destructive   from './Destructive.js';
import Cumbersome    from './Cumbersome.js';
import Heavy         from './Heavy.js';
import Protective   from './Protective.js';
import Barrier       from './Barrier.js';
import DoubleDuty    from './DoubleDuty.js';
import Brave         from './Brave.js';
import Paired        from './Paired.js';
import Otherworldly  from './Otherworldly.js';
import Parry         from './Parry.js';
import Returning     from './Returning.js';
import Hooked        from './Hooked.js';
import Eruptive      from './Eruptive.js';
import Persuasive    from './Persuasive.js';
import Dueling       from './Dueling.js';
import Retractable   from './Retractable.js';
import Timebending   from './Timebending.js';
import Healing       from './Healing.js';
import Hot           from './Hot.js';
import Greedy        from './Greedy.js';
import Concussive    from './Concussive.js';
import Long          from './Long.js';
import Grappling     from './Grappling.js';
import Sheltering    from './Sheltering.js';
import LockedOn      from './LockedOn.js';
import Deflecting    from './Deflecting.js';

const builders = [
  Painful, Invigorating, Lifestealing, Charged, Startling,
  Reliable, Sharpwing, Bonded, Scary, Deadly,
  Powerful, Massive, Brutal, SelfCorrecting, Serrated,
  Burning, Reloading, Quick, Devastating, Lucky,
  Bouncing, Versatile, DoubledUp,
  Cumbersome, Heavy, Protective, Barrier, DoubleDuty, Brave, Paired, Otherworldly, Parry,
  Destructive,
  Returning, Hooked, Eruptive, Persuasive, Dueling, Retractable, Timebending, Healing, Hot, Greedy, Concussive, Long, Grappling, Sheltering, LockedOn, Deflecting,
];

/** @type {Record<string, object>} feature name → descriptor */
const weaponFeatures = {};

for (const builder of builders) {
  const character = createFeatureBuilder({
    targetMap: weaponFeatures,
    sourceType: 'weapon',
    source: builder.name,
  });
  const { name, description, ...hooks } = builder;
  character.addFeature(name, description, hooks);
}

export default weaponFeatures;
