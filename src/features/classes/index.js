/**
 * Class features barrel — lookup map from class name to class feature object.
 */
import Wizard    from './Wizard.js';
import Bard      from './Bard.js';
import Druid     from './Druid.js';
import Guardian  from './Guardian.js';
import Ranger    from './Ranger.js';
import Rogue     from './Rogue.js';
import Seraph    from './Seraph.js';
import Sorcerer  from './Sorcerer.js';

const featureList = [Wizard, Bard, Druid, Guardian, Ranger, Rogue, Seraph, Sorcerer];

/** @type {Record<string, object>} */
const classFeatures = Object.fromEntries(featureList.map(f => [f.name, f]));

export default classFeatures;
