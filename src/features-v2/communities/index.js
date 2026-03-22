import { Privilege } from './Highborne.js';
import { WellRead } from './Loreborne.js';
import { Dedicated } from './Orderborne.js';
import { Steady } from './Ridgeborne.js';
import { KnowTheTide } from './Seaborne.js';
import { Scoundrel } from './Slyborne.js';
import { LowLightLiving } from './Underborne.js';
import { NomadicPack } from './Wanderborne.js';
import { Lightfoot } from './Wildborne.js';

export {
  Privilege,
  WellRead,
  Dedicated,
  Steady,
  KnowTheTide,
  Scoundrel,
  LowLightLiving,
  NomadicPack,
  Lightfoot,
};

/** Registry shape for `loadCharacterFeatures`: keyed by SRD community id (`srd-com-*`). */
export default {
  'srd-com-highborne': { features: [Privilege] },
  'srd-com-loreborne': { features: [WellRead] },
  'srd-com-orderborne': { features: [Dedicated] },
  'srd-com-ridgeborne': { features: [Steady] },
  'srd-com-seaborne': { features: [KnowTheTide] },
  'srd-com-slyborne': { features: [Scoundrel] },
  'srd-com-underborne': { features: [LowLightLiving] },
  'srd-com-wanderborne': { features: [NomadicPack] },
  'srd-com-wildborne': { features: [Lightfoot] },
};
