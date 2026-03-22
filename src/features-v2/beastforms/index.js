/**
 * SRD Beastform registry — one entry per row in `beastforms.json`, keyed by `srd-bst-*` id.
 * Per-form modules export **named feature objects** + `features` (like weapon/armor properties); this
 * barrel marries them to generated SRD ids via `marryBeastformFeatures`.
 * Regenerate base data: `node scripts/generate-beastform-srd-data.mjs`
 */

import { BEASTFORM_ITEMS } from './srd-data.js';
import { marryBeastformFeatures } from './marry.js';
import { features as agileScoutFeatures } from './AgileScout.js';
import { features as householdFriendFeatures } from './HouseholdFriend.js';
import { features as nimbleGrazerFeatures } from './NimbleGrazer.js';
import { features as packPredatorFeatures } from './PackPredator.js';
import { features as aquaticScoutFeatures } from './AquaticScout.js';
import { features as stalkingArachnidFeatures } from './StalkingArachnid.js';
import { features as armoredSentryFeatures } from './ArmoredSentry.js';
import { features as powerfulBeastFeatures } from './PowerfulBeast.js';
import { features as mightyStriderFeatures } from './MightyStrider.js';
import { features as strikingSerpentFeatures } from './StrikingSerpent.js';
import { features as pouncingPredatorFeatures } from './PouncingPredator.js';
import { features as wingedBeastFeatures } from './WingedBeast.js';
import { features as greatPredatorFeatures } from './GreatPredator.js';
import { features as mightyLizardFeatures } from './MightyLizard.js';
import { features as greatWingedBeastFeatures } from './GreatWingedBeast.js';
import { features as aquaticPredatorFeatures } from './AquaticPredator.js';
import { features as legendaryBeastFeatures } from './LegendaryBeast.js';
import { features as legendaryHybridFeatures } from './LegendaryHybrid.js';
import { features as massiveBehemothFeatures } from './MassiveBehemoth.js';
import { features as terribleLizardFeatures } from './TerribleLizard.js';
import { features as mythicAerialHunterFeatures } from './MythicAerialHunter.js';
import { features as epicAquaticBeastFeatures } from './EpicAquaticBeast.js';
import { features as mythicBeastFeatures } from './MythicBeast.js';
import { features as mythicHybridFeatures } from './MythicHybrid.js';

/** @type {Record<string, object[]>} */
const BEASTFORM_FEATURE_LISTS = {
  'srd-bst-agile-scout': agileScoutFeatures,
  'srd-bst-household-friend': householdFriendFeatures,
  'srd-bst-nimble-grazer': nimbleGrazerFeatures,
  'srd-bst-pack-predator': packPredatorFeatures,
  'srd-bst-aquatic-scout': aquaticScoutFeatures,
  'srd-bst-stalking-arachnid': stalkingArachnidFeatures,
  'srd-bst-armored-sentry': armoredSentryFeatures,
  'srd-bst-powerful-beast': powerfulBeastFeatures,
  'srd-bst-mighty-strider': mightyStriderFeatures,
  'srd-bst-striking-serpent': strikingSerpentFeatures,
  'srd-bst-pouncing-predator': pouncingPredatorFeatures,
  'srd-bst-winged-beast': wingedBeastFeatures,
  'srd-bst-great-predator': greatPredatorFeatures,
  'srd-bst-mighty-lizard': mightyLizardFeatures,
  'srd-bst-great-winged-beast': greatWingedBeastFeatures,
  'srd-bst-aquatic-predator': aquaticPredatorFeatures,
  'srd-bst-legendary-beast': legendaryBeastFeatures,
  'srd-bst-legendary-hybrid': legendaryHybridFeatures,
  'srd-bst-massive-behemoth': massiveBehemothFeatures,
  'srd-bst-terrible-lizard': terribleLizardFeatures,
  'srd-bst-mythic-aerial-hunter': mythicAerialHunterFeatures,
  'srd-bst-epic-aquatic-beast': epicAquaticBeastFeatures,
  'srd-bst-mythic-beast': mythicBeastFeatures,
  'srd-bst-mythic-hybrid': mythicHybridFeatures,
};

const byId = Object.fromEntries(
  BEASTFORM_ITEMS.map((row) => {
    const list = BEASTFORM_FEATURE_LISTS[row.id];
    if (!list) return [row.id, row];
    return [row.id, { ...row, features: marryBeastformFeatures(row, list) }];
  })
);

export default byId;

export { BEASTFORM_ITEMS, marryBeastformFeatures };

/**
 * @param {number} characterTier — party tier 1–4 (character level thresholds)
 * @returns {object[]} beastforms whose `tier` is ≤ `characterTier`, sorted by tier then name
 */
export function beastformsAtOrBelowTier(characterTier) {
  const t = Math.max(1, Math.min(4, Number(characterTier) || 1));
  return Object.values(byId)
    .filter((b) => b.tier <= t)
    .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}
