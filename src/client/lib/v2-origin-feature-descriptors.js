/**
 * Feature-name → V2 ancestry/community descriptor for sheet display (AncestryFeatureCard, Use-button gating).
 * Replaces Phase 1 `originFeatures` / registry `ancestryFeatures` for metadata-only UI in CharacterDisplay.
 */

import v2AncestryFeatures from '../../features-v2/ancestries/index.js';
import v2CommunityRows from '../../features-v2/communities/index.js';

const byName = Object.create(null);

for (const desc of Object.values(v2AncestryFeatures)) {
  if (desc && typeof desc.name === 'string' && desc.name) {
    byName[desc.name] = desc;
  }
}

for (const row of Object.values(v2CommunityRows)) {
  const feats = row?.features;
  if (!Array.isArray(feats)) continue;
  for (const f of feats) {
    if (f && typeof f.name === 'string' && f.name) {
      byName[f.name] = f;
    }
  }
}

export const v2OriginFeatureDescriptorsByName = byName;

export function getV2OriginFeatureDescriptor(featureName) {
  return featureName ? byName[featureName] ?? null : null;
}
