/**
 * Feature action parser utilities.
 *
 * Extracts structured action metadata from Daggerheart feature description text
 * so the UI can render appropriate interactive controls (Use buttons, cost badges,
 * dice rolls, announce buttons, passive stat badges, sub-feature cards).
 */

/**
 * parseFeatureAction(description) — primary extraction.
 *
 * Returns:
 *   hopeCost      — Hope to spend
 *   stressCost    — Stress to mark
 *   armorMark     — Armor Slots to mark
 *   armorClear    — Armor Slots to clear
 *   dice          — array of unique dice expressions found (e.g. ['d6', '2d4'])
 *   spellcastDC   — numeric DC for "Spellcast Roll (N)" patterns, or null
 *   frequency     — 'session' | 'rest' | 'longRest' | null
 *   cycle         — alias for frequency (for rest-cycle tracking)
 *   isActive      — true when any cost, dice, or frequency is present
 *   impliesTarget — true when description mentions a target
 *   targetType    — 'adversary' | 'character' | null
 */
export function parseFeatureAction(description) {
  if (!description) return { isActive: false };
  const lower = description.toLowerCase();

  // ── Hope cost ───────────────────────────────────────────────────────────────
  let hopeCost = 0;
  const hopeMatch =
    lower.match(/(?:spend|costs?)\s+(\d+)\s+hope/) ||
    lower.match(/(\d+)\s+hope/);
  if (hopeMatch) {
    hopeCost = parseInt(hopeMatch[1], 10);
  } else if (/spend a hope/.test(lower)) {
    hopeCost = 1;
  }

  // ── Stress cost ─────────────────────────────────────────────────────────────
  let stressCost = 0;
  const stressExplicit = lower.match(/mark\s+(\d+)\s+stress|spend\s+(\d+)\s+stress/);
  if (stressExplicit) {
    stressCost = parseInt(stressExplicit[1] || stressExplicit[2], 10);
  } else if (/mark a stress|mark 1 stress/.test(lower)) {
    stressCost = 1;
  }

  // ── Armor operations ────────────────────────────────────────────────────────
  let armorMark = 0;
  const armorMarkMatch = lower.match(/mark\s+(\d+)\s+armor(?:\s+slot)?/);
  if (armorMarkMatch) {
    armorMark = parseInt(armorMarkMatch[1], 10);
  } else if (/mark an armor slot/.test(lower)) {
    armorMark = 1;
  }

  let armorClear = 0;
  const armorClearMatch = lower.match(/clear\s+(\d+)\s+armor(?:\s+slot)?/);
  if (armorClearMatch) {
    armorClear = parseInt(armorClearMatch[1], 10);
  } else if (/clear an armor slot/.test(lower)) {
    armorClear = 1;
  }

  // ── Dice expressions ────────────────────────────────────────────────────────
  const diceMatches = description.match(/\b\d*d\d+\b/gi);
  const dice = diceMatches ? [...new Set(diceMatches.map(d => d.toLowerCase()))] : [];

  // ── Spellcast DC ────────────────────────────────────────────────────────────
  let spellcastDC = null;
  const spellcastMatch = description.match(/spellcast roll\s*\((\d+)\)/i);
  if (spellcastMatch) spellcastDC = parseInt(spellcastMatch[1], 10);

  // ── Frequency / usage cycle ─────────────────────────────────────────────────
  let frequency = null;
  if (/once per session|once a session|beginning of (?:each|every) session|at the start of (?:each|every) session/i.test(lower)) {
    frequency = 'session';
  } else if (/once per long rest|after (?:a|your) long rest/i.test(lower)) {
    frequency = 'longRest';
  } else if (/once per rest|once per short rest|after (?:a|your) rest\b|per rest/i.test(lower)) {
    frequency = 'rest';
  }

  // ── Target detection ────────────────────────────────────────────────────────
  const impliesTarget = /\btarget\b|\badversary\b|\bally\b|\benemy\b/i.test(lower);
  let targetType = null;
  if (/adversary|enemy/i.test(lower)) {
    targetType = 'adversary';
  } else if (/\bally\b|another player character|another character/i.test(lower)) {
    targetType = 'character';
  } else if (impliesTarget) {
    targetType = 'adversary';
  }

  const isActive =
    hopeCost > 0 || stressCost > 0 || armorMark > 0 || armorClear > 0 ||
    dice.length > 0 || spellcastDC != null || frequency != null;

  return {
    hopeCost, stressCost, armorMark, armorClear,
    dice, spellcastDC,
    frequency, cycle: frequency,
    isActive, impliesTarget, targetType,
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
  // This prevents inline emphasis like **spend a Hope** (no colon) from being treated as a section header.
  const boldTokens = description.split(/(\*\*[^*\n]*?:\*\*\s*|\*\*[^*\n]+?\*\*:\s*)/);
  // boldTokens: [preamble, '**Name1**: ', content1, '**Name2**: ', content2, ...]
  if (boldTokens.length >= 5) {
    const boldItems = [];
    for (let i = 1; i < boldTokens.length - 1; i += 2) {
      const nameMatch = boldTokens[i].match(/\*\*([^*]+?)\*\*/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/:$/, '').trim();
      const desc = boldTokens[i + 1].trim();
      // Require at least 20 chars of description so inline emphasis doesn't count
      if (name && desc.length >= 20) boldItems.push({ name, description: desc, ...parseFeatureAction(desc) });
    }
    if (boldItems.length >= 2) return boldItems;
  }

  // Italic: split on _Name_: tokens
  const italicTokens = description.split(/(_[^_\n]{1,60}?_:?\s*)/);
  if (italicTokens.length >= 5) {
    const italicItems = [];
    for (let i = 1; i < italicTokens.length - 1; i += 2) {
      const nameMatch = italicTokens[i].match(/_([^_]+?)_/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/:$/, '').trim();
      const desc = italicTokens[i + 1].trim();
      if (name && desc.length > 3) italicItems.push({ name, description: desc, ...parseFeatureAction(desc) });
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
      return bullets.map(b => {
        const colonIdx = b.indexOf(':');
        const name = colonIdx > 0 && colonIdx < 40 ? b.slice(0, colonIdx).trim() : b.slice(0, 30).trim();
        const desc = colonIdx > 0 && colonIdx < 40 ? b.slice(colonIdx + 1).trim() : b;
        return { name, description: desc, ...parseFeatureAction(desc) };
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

  const evasionMatch = description.match(/([+-]?\d+)\s+(?:to\s+)?evasion\b/i);
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
    const freqLabel = action.frequency === 'session' ? 'Once/session'
      : action.frequency === 'longRest' ? 'Once/long rest'
      : 'Once/rest';
    badges.push({ label: freqLabel, style: 'frequency' });
  }
  return badges;
}
