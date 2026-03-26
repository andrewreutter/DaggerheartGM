/**
 * Feature utilities for sub-feature detection, passive stat parsing, and cost badges.
 * Action metadata for class/ancestry/ability features comes from merged V2 rows
 * (`deriveFeatureActionFromV2Row` / `buildActionForFeatureUse`).
 */

import {
  enrichHoverActionMeta,
  extractEmbeddedResourceCostsFromText,
  extractAdvantageConditionFromText,
} from '../../features-v2/engine/hover-action-enrich.js';
import { getFrequencyCycleWord } from './frequency-cycle-ui.jsx';

export {
  deriveFeatureActionFromV2Row,
  buildActionForFeatureUse,
} from './v2-derive-feature-action.js';

export { enrichHoverActionMeta, extractEmbeddedResourceCostsFromText, extractAdvantageConditionFromText };

/**
 * Merge embedded sub-option text into action-shaped metadata (bold/italic/bullet splits).
 */
function mergeEmbeddedSubAction(desc) {
  const e = extractEmbeddedResourceCostsFromText(desc);
  const enriched = enrichHoverActionMeta({ description: desc });
  const spellcastDC = enriched.spellcastDC ?? null;
  const spellcastVsRoll = enriched.spellcastVsRoll === true;
  const adv = extractAdvantageConditionFromText(desc);
  const isActive =
    e.hopeCost > 0 ||
    e.stressCost > 0 ||
    e.armorMark > 0 ||
    e.armorClear > 0 ||
    e.frequency != null ||
    spellcastDC != null ||
    spellcastVsRoll;
  return {
    hopeCost: e.hopeCost,
    stressCost: e.stressCost,
    armorMark: e.armorMark,
    armorClear: e.armorClear,
    dice: [],
    spellcastDC,
    spellcastVsRoll,
    frequency: e.frequency,
    cycle: e.frequency,
    isActive,
    impliesTarget: !!enriched.impliesTarget,
    targetType: enriched.targetType ?? null,
    advantageCondition: adv,
  };
}

/**
 * parseSubFeatures(description) — detects independently clickable sub-options.
 *
 * Patterns detected:
 *   1. Markdown bold sub-sections: **Name:** description (Gifted Performer songs, etc.)
 *   2. Markdown italic sub-sections: _Name_: description (Elemental Incarnation, etc.)
 *   3. Bullet/numbered lists after "choose one/two/either" preamble
 *
 * Returns [] when fewer than 2 sub-options are found.
 */
export function parseSubFeatures(description) {
  if (!description) return [];

  // Bold: split only on **Name:** tokens where a colon appears inside OR right after the closing **.
  const boldTokens = description.split(/(\*\*[^*\n]*?:\*\*\s*|\*\*[^*\n]+?\*\*:\s*)/);
  if (boldTokens.length >= 5) {
    const boldItems = [];
    for (let i = 1; i < boldTokens.length - 1; i += 2) {
      const nameMatch = boldTokens[i].match(/\*\*([^*]+?)\*\*/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/:$/, '').trim();
      const rawSegment = boldTokens[i + 1].trim();
      const desc = rawSegment.replace(/\s*\*\*[^*\n]+\*\*.*$/s, '').trim();
      const merged = mergeEmbeddedSubAction(desc);
      const hopeInName = name.match(/\((\d+)\s*[Hh]ope\)/);
      if (hopeInName) merged.hopeCost = parseInt(hopeInName[1], 10);
      if (name && rawSegment.length >= 20) {
        boldItems.push({ name, description: desc, ...merged });
      }
    }
    if (boldItems.length >= 2) return boldItems;
  }

  // Italic: split on _Name_: tokens
  const italicTokens = description.split(/(_[^_\n]{1,60}?_:?\s*)/);
  if (italicTokens.length >= 5) {
    const italicItems = [];
    for (let i = 1; i < italicTokens.length - 1; i += 2) {
      if (!italicTokens[i].includes(':')) continue;
      const nameMatch = italicTokens[i].match(/_([^_]+?)_/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/:$/, '').trim();
      const desc = italicTokens[i + 1].trim();
      if (name && desc.length > 3) italicItems.push({ name, description: desc, ...mergeEmbeddedSubAction(desc) });
    }
    if (italicItems.length >= 2) return italicItems;
  }

  // Bullet/numbered list after "choose" preamble
  if (/choose\s+(?:one|two|either|up to \d+)/i.test(description)) {
    const bullets = [];
    let m;
    const bulletRe = /^[\t ]*[-•*]\s+(.+)$/gm;
    while ((m = bulletRe.exec(description)) !== null) bullets.push(m[1].trim());
    if (bullets.length < 2) {
      const numRe = /^[\t ]*\d+[.)]\s+(.+)$/gm;
      while ((m = numRe.exec(description)) !== null) bullets.push(m[1].trim());
    }
    if (bullets.length >= 2) {
      return bullets.map((b) => {
        const colonIdx = b.indexOf(':');
        const name = colonIdx > 0 && colonIdx < 40 ? b.slice(0, colonIdx).trim() : b.slice(0, 30).trim();
        const desc = colonIdx > 0 && colonIdx < 40 ? b.slice(colonIdx + 1).trim() : b;
        return { name, description: desc, ...mergeEmbeddedSubAction(desc) };
      });
    }
  }

  return [];
}

/**
 * parsePassiveStats(description) — extracts stat effects for hover highlighting
 * on traits/defense rows.
 *
 * Returns [{ stat, value, label }].
 */
export function parsePassiveStats(description) {
  if (!description) return [];
  const stats = [];

  const evasionMatch = description.match(
    /([+-]?\d+)\s+(?:bonus\s+)?(?:to\s+)?(?:your\s+)?evasion\b/i
  );
  if (evasionMatch) stats.push({ stat: 'evasion', value: parseInt(evasionMatch[1], 10), label: `${evasionMatch[1]} Evasion` });

  const threshMatch = description.match(/([+-]?\d+)\s+(?:to\s+(?:your\s+)?(?:damage\s+)?)?thresholds?\b/i);
  if (threshMatch) stats.push({ stat: 'threshold', value: parseInt(threshMatch[1], 10), label: `${threshMatch[1]} dmg threshold` });

  if (/[+-]?\s*(?:your\s+)?level\s+to\s+(?:your\s+)?damage/i.test(description)) {
    stats.push({ stat: 'damage', value: null, label: '+level to damage' });
  }

  const hpMatch = description.match(/([+-]\d+)\s+(?:additional\s+)?(?:hit\s+points?|hp)\b/i);
  if (hpMatch) stats.push({ stat: 'hp', value: parseInt(hpMatch[1], 10), label: `${hpMatch[1]} HP` });

  return stats;
}

/**
 * Build human-readable cost badges array from a parsed action.
 * Used by FeatureChip and ActionBanner to show what a feature costs.
 * Returns [{ label, style }].
 */
export function buildCostBadges(action) {
  const badges = [];
  if (action.hopeCost > 0) badges.push({ label: `${action.hopeCost} Hope`, style: 'hope' });
  if (action.stressCost > 0) badges.push({ label: `${action.stressCost} Stress`, style: 'stress' });
  if (action.armorClear > 0) badges.push({ label: `Clear ${action.armorClear} Armor`, style: 'armor' });
  if (action.armorMark > 0) badges.push({ label: `Mark ${action.armorMark} Armor`, style: 'armor' });
  if (action.frequency) {
    const w = getFrequencyCycleWord(action.frequency);
    if (w) badges.push({ label: w, style: 'frequency' });
  }
  return badges;
}
