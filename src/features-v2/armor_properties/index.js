import { Burning } from './Burning.js';
import { Channeling } from './Channeling.js';
import { Difficult } from './Difficult.js';
import { Flexible } from './Flexible.js';
import { Gilded } from './Gilded.js';
import { Heavy } from './Heavy.js';
import { Quiet } from './Quiet.js';
import { Truthseeking } from './Truthseeking.js';
import { VeryHeavy } from './VeryHeavy.js';
import { Warded } from './Warded.js';

export { Burning, Channeling, Difficult, Flexible, Gilded, Heavy, Quiet, Truthseeking, VeryHeavy, Warded };

export default {
  [Burning.name]: Burning,
  [Channeling.name]: Channeling,
  [Difficult.name]: Difficult,
  [Flexible.name]: Flexible,
  [Gilded.name]: Gilded,
  [Heavy.name]: Heavy,
  [Quiet.name]: Quiet,
  [Truthseeking.name]: Truthseeking,
  [VeryHeavy.name]: VeryHeavy,
  [Warded.name]: Warded,
};
