/**
 * Class features barrel — lookup map from class name to class feature object.
 */
import Wizard from './Wizard.js';
import Bard   from './Bard.js';

const featureList = [Wizard, Bard];

/** @type {Record<string, object>} */
const classFeatures = Object.fromEntries(featureList.map(f => [f.name, f]));

export default classFeatures;
