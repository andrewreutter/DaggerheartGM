/**
 * Feature name → V2 class/subclass descriptor for character recompute (merge with SRD feature rows).
 * Replaces Phase 1 `classFeatures` lookups in character-calc.
 */

import v2Classes from '../../features-v2/classes/index.js';
import v2Subclasses from '../../features-v2/subclasses/index.js';

const byName = Object.create(null);

for (const row of Object.values(v2Classes)) {
  for (const f of row?.features || []) {
    if (f && typeof f.name === 'string' && f.name) {
      byName[f.name] = f;
    }
  }
}

for (const row of Object.values(v2Subclasses)) {
  for (const f of row?.features || []) {
    if (f && typeof f.name === 'string' && f.name) {
      byName[f.name] = f;
    }
  }
}

export const v2ClassSubclassFeatureDescriptorsByName = byName;
