/**
 * Regex-based parser for Daggerheart stat blocks from Reddit markdown and OCR text.
 *
 * Extracts structured adversary/environment data using multi-pattern field matching.
 * Designed to handle:
 *   - SRD-like markdown formatting
 *   - Plain text stat blocks
 *   - OCR output from stat card images (with common OCR artifact correction)
 *
 * Returns partial results with a confidence score so callers can decide
 * whether to accept the result or fall back to LLM parsing.
 */

import crypto from 'crypto';
import { ROLES } from './game-constants.js';

// ---------------------------------------------------------------------------
// Constants (shared via src/game-constants.js)
// ---------------------------------------------------------------------------

const VALID_ROLES = new Set(ROLES);

const ENV_TYPES = new Set(['traversal', 'exploration', 'social', 'event']);

const TRAIT_MAP = {
  phy: 'Phy', physical: 'Phy', phys: 'Phy',
  mag: 'Mag', magic: 'Mag', magical: 'Mag',
  dir: 'Dir', direct: 'Dir',
};

const RANGE_ALIASES = {
  melee: 'Melee',
  'very close': 'Very Close', veryclose: 'Very Close',
  close: 'Close',
  far: 'Far',
  'very far': 'Very Far', veryfar: 'Very Far',
};

// Confidence weights per field (adversary)
const ADV_WEIGHTS = {
  name: 0.15, tier: 0.05, role: 0.05, difficulty: 0.05,
  hp_max: 0.10, stress_max: 0.05, hp_thresholds: 0.05,
  attack: 0.15, experiences: 0.10, features: 0.25,
};

// Confidence weights per field (environment)
const ENV_WEIGHTS = {
  name: 0.15, tier: 0.10, type: 0.10, difficulty: 0.10,
  potential_adversaries: 0.10, features: 0.45,
};

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

const TITLE_CASE_MINOR = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'by', 'of', 'up', 'as', 'is', 'if',
]);

function toTitleCase(str) {
  return str.toLowerCase().split(/\s+/).map((word, i) =>
    (i === 0 || !TITLE_CASE_MINOR.has(word))
      ? word.charAt(0).toUpperCase() + word.slice(1)
      : word
  ).join(' ');
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

function stripMarkdown(text) {
  return text
    .replace(/\*\*_?|_?\*\*/g, '')    // bold markers
    .replace(/(?<!\*)\*(?!\*)/g, '')   // single-star italic (leave ** alone)
    .replace(/(?<!_)_(?!_)/g, ' ')     // underscores used as italic (replace with space)
    .replace(/^#+\s*/gm, '')           // heading markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // markdown links → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')   // inline images
    .replace(/^[-*]\s+/gm, '')         // list bullet markers
    .replace(/\|/g, ' | ')            // ensure pipe separators have spaces
    .replace(/[^\S\n]{2,}/g, ' ');     // collapse horizontal whitespace (preserve newlines)
}

/** Fix common OCR misrecognitions in numeric contexts. */
function fixOcrArtifacts(text) {
  return text
    .replace(/(\d)[Oo](\d)/g, '$10$2')       // 1O2 → 102
    .replace(/([+-])\s+(\d)/g, '$1$2')        // + 3 → +3
    .replace(/(\d)\s*[\/|]\s*(\d)/g, '$1/$2') // threshold spacing
    .replace(/\bl\b(?=\d)/gi, '1')            // lone l before digit → 1
    .replace(/\bO\b(?=\d)/gi, '0');           // lone O before digit → 0
}

function preprocess(text) {
  return fixOcrArtifacts(stripMarkdown(text));
}

// ---------------------------------------------------------------------------
// Per-field extractors — each returns the extracted value or null/undefined
// ---------------------------------------------------------------------------

function extractName(raw, title) {
  // Try markdown heading first (before stripping)
  const h1 = raw.match(/^#+\s+(.+)$/m);
  if (h1) return h1[1].trim();

  // Bold name at start
  const bold = raw.match(/^\*\*([^*]+)\*\*/m);
  if (bold) return bold[1].trim();

  // "Name:" label
  const labeled = raw.match(/^Name:\s*(.+)$/mi);
  if (labeled) return labeled[1].trim();

  // All-caps title line — common in OCR output from stat card images where the name is
  // rendered in large display text (e.g. "SPORENADO"). Capture ends with [A-Z] to anchor
  // on the last uppercase char; (?:\s.*)? tolerates trailing OCR noise from icons/artwork.
  const SECTION_HEADERS = /^(FEATURES?|PASSIVE|ACTION|REACTION|ATTACK|ATK|EXPERIENCES?|THRESHOLDS?|DIFFICULTY|IMPULSES?|HP|DC)$/;
  const allCaps = raw.match(/^([A-Z][A-Z\s\u2019'-]{2,}[A-Z])(?:\s*[x\xd7]\s*\d+)?(?:\s.*)?$/m);

  if (allCaps) {
    const candidate = allCaps[1].trim();
    if (!SECTION_HEADERS.test(candidate)) return toTitleCase(candidate);
  }

  // First line followed by a "Tier N" line (possibly with blank lines between) — strong
  // signal in Daggerheart stat blocks. Capture ends with [A-Z]; [^\n]* eats trailing
  // OCR noise on the title line; [\s\n]* allows blank lines before "Tier".
  {
    const tierFollows = raw.match(/^([A-Z][A-Za-z\s\u2019'-]{2,}[A-Z])(?:\s*[x\xd7]\s*\d+)?[^\n]*\n[\s\n]*Tier\s+\d/m);

    if (tierFollows) {
      const candidate = tierFollows[1].trim();
      if (!SECTION_HEADERS.test(candidate.toUpperCase())) return toTitleCase(candidate);
    }
  }

  // Pronoun-reference pattern: "...a/an WORD. It/They VERB..." — the entity's name
  // is referenced by pronoun in the description body. Common in stat cards where the
  // title is in a large decorative font that OCR cannot read (e.g. "formed a sporenado.
  // It will drag..."). The pattern requires the candidate to directly precede "It/They"
  // so adjectives and common filler nouns don't match.
  {
    const EXCLUDE_NOUNS = new Set([
      'creature', 'monster', 'entity', 'presence', 'spirit', 'shadow',
      'horror', 'beast', 'being', 'structure', 'thing', 'object', 'place',
      'area', 'zone', 'storm', 'force', 'power', 'presence',
    ]);
    const pronounRef = raw.match(
      /\b(?:a|an)\s+([a-z][a-z'-]{4,})\s*\.?\s*\n*\s*(?:It|They)\s+(?:will|is|are|has|have|can|was|were|may)\b/i
    );
    if (pronounRef) {
      const candidate = pronounRef[1].toLowerCase();
      if (!EXCLUDE_NOUNS.has(candidate)) {
        return candidate[0].toUpperCase() + candidate.slice(1);
      }
    }
  }

  // Fall back to post title
  if (title) return title.trim();

  return null;
}

/**
 * Like extractName but does NOT use the title fallback.
 * Used to detect whether a name was genuinely present in the text.
 */
function extractNameFromText(raw) {
  return extractName(raw, null);
}

function extractTierAndRole(text) {
  const patterns = [
    /Tier\s+(\d)\s+(bruiser|horde|leader|minion|ranged|skulk|social|solo|standard|support)/i,
    /Tier:\s*(\d)\s*[,|]\s*(?:Role|Type):\s*(\w+)/i,
    /T(\d)\s+(bruiser|horde|leader|minion|ranged|skulk|social|solo|standard|support)/i,
    /Tier\s+(\d)\s+(\w+)/i,
    /Tier:\s*(\d)/i,
    /Tier\s+(\d)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const tier = Math.max(1, Math.min(4, parseInt(m[1])));
      const roleRaw = (m[2] || '').toLowerCase();
      const role = normalizeRole(roleRaw);
      return { tier, role };
    }
  }
  return { tier: null, role: null };
}

function extractEnvType(text) {
  const patterns = [
    /Tier\s+\d\s+(traversal|exploration|social|event)/i,
    /Type:\s*(traversal|exploration|social|event)/i,
    /\b(traversal|exploration|social|event)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const t = m[1].toLowerCase();
      if (ENV_TYPES.has(t)) return t;
    }
  }
  return null;
}

function extractDifficulty(text) {
  const patterns = [
    /Difficulty:\s*(\d+)/i,
    /DC:\s*(\d+)/i,
    /Difficulty\s+(\d+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractHP(text) {
  const patterns = [
    /HP:\s*(\d+)/i,
    /Hit\s*Points?:\s*(\d+)/i,
    /(\d+)\s*HP\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractStress(text) {
  const patterns = [
    /Stress:\s*(\d+)/i,
    /(\d+)\s*Stress\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractThresholds(text) {
  const patterns = [
    /Thresholds?:\s*(\d+)\s*\/\s*(\d+)/i,
    /Major[:\s]+(\d+)\s*[,|\/]\s*Severe[:\s]+(\d+)/i,
    /Severe[:\s]+(\d+)\s*[,|\/]\s*Major[:\s]+(\d+)/i,  // reversed order
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      // Third pattern has reversed order
      if (/^Severe/i.test(re.source)) {
        return { major: parseInt(m[2]), severe: parseInt(m[1]) };
      }
      return { major: parseInt(m[1]), severe: parseInt(m[2]) };
    }
  }
  // Try "none"
  if (/Thresholds?:\s*none/i.test(text)) {
    return { major: null, severe: null };
  }
  return null;
}

function extractAttack(text) {
  const attack = { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' };
  let found = false;

  // Pattern: ATK: +N | Name: Range | damage trait
  const srdStyle = text.match(
    /ATK:\s*([+-]?\d+)\s*\|\s*([^:|]+?):\s*(Melee|Very Close|Close|Far|Very Far)\s*\|\s*(\S+)\s+(\w+)/i
  );
  if (srdStyle) {
    attack.modifier = parseInt(srdStyle[1]);
    attack.name = srdStyle[2].trim();
    attack.range = normalizeRange(srdStyle[3]);
    const { damage, trait } = parseDamageAndTrait(`${srdStyle[4]} ${srdStyle[5]}`);
    attack.damage = damage;
    attack.trait = trait;
    return attack;
  }

  // Pattern: Attack: Name, +N, Range, damage trait
  const commaStyle = text.match(
    /Attack:\s*([^,+]+?)\s*,\s*([+-]?\d+)\s*,\s*(Melee|Very Close|Close|Far|Very Far)\s*,\s*(\S+)\s+(\w+)/i
  );
  if (commaStyle) {
    attack.name = commaStyle[1].trim();
    attack.modifier = parseInt(commaStyle[2]);
    attack.range = normalizeRange(commaStyle[3]);
    const { damage, trait } = parseDamageAndTrait(`${commaStyle[4]} ${commaStyle[5]}`);
    attack.damage = damage;
    attack.trait = trait;
    return attack;
  }

  // Pattern: Name +N Range | damage trait  (compact card style)
  const compactStyle = text.match(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([+-]\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|?\s*(\d+d\d+(?:[+-]\d+)?)\s*(\w+)?/i
  );
  if (compactStyle) {
    attack.name = compactStyle[1].trim();
    attack.modifier = parseInt(compactStyle[2]);
    attack.range = normalizeRange(compactStyle[3]);
    const { damage, trait } = parseDamageAndTrait(
      `${compactStyle[4]} ${compactStyle[5] || 'phy'}`
    );
    attack.damage = damage;
    attack.trait = trait;
    return attack;
  }

  // Piecewise: try to find individual components
  const modMatch = text.match(/ATK:\s*([+-]?\d+)/i)
    || text.match(/Attack\s*(?:Modifier|Mod):\s*([+-]?\d+)/i);
  if (modMatch) { attack.modifier = parseInt(modMatch[1]); found = true; }

  const nameMatch = text.match(/Attack:\s*([A-Za-z][A-Za-z ]+?)(?:\s*[,|]|\s+[+-])/i)
    || text.match(/Attack\s*Name:\s*([^\n,|]+)/i);
  if (nameMatch) { attack.name = nameMatch[1].trim(); found = true; }

  const rangeMatch = text.match(/Range:\s*(Melee|Very Close|Close|Far|Very Far)/i)
    || text.match(/\b(Melee|Very Close|Close|(?:Very )?Far)\b/i);
  if (rangeMatch) { attack.range = normalizeRange(rangeMatch[1]); found = true; }

  const damageMatch = text.match(/Damage:\s*(\d+d\d+(?:[+-]\d+)?)\s*(\w+)?/i)
    || text.match(/(\d+d\d+(?:[+-]\d+)?)\s+(phy|mag|dir|physical|magical|magic|direct)/i);
  if (damageMatch) {
    const { damage, trait } = parseDamageAndTrait(
      `${damageMatch[1]} ${damageMatch[2] || 'phy'}`
    );
    attack.damage = damage;
    attack.trait = trait;
    found = true;
  }

  return found ? attack : null;
}

function extractExperiences(text) {
  const match = text.match(/Experiences?:\s*([^\n]+)/i);
  if (!match) return [];

  return match[1].split(/,\s*/).map(part => {
    const m = part.trim().match(/^(.+?)\s*([+-]\d+)$/);
    if (m) return { id: crypto.randomUUID(), name: m[1].trim(), modifier: parseInt(m[2]) };
    return null;
  }).filter(Boolean);
}

/**
 * Detect common list/table patterns in a feature description (typically from OCR text that
 * had its newlines preserved) and convert them to markdown.
 *
 * Patterns handled:
 *   - d-table ranges: "1-2: X. 3-4: Y." on a single line (OCR may have lost newlines)
 *     → each range entry becomes a markdown bullet "- **1-2:** X."
 *   - Numbered items concatenated without newlines: "1. Foo 2. Bar"
 *     → insert newlines before each number to yield markdown ordered list
 *
 * Only fires when a pattern appears ≥2 times (to avoid false positives on isolated
 * occurrences like "Steps 1-2 are..." or "see rule 1.").
 */
function formatListPatterns(text) {
  // Pattern: digit range followed by colon, e.g. "1-2:" or "11-12:"
  // Includes en-dash variant from OCR.
  const rangeRe = /(\d{1,2}[-–]\d{1,2}):\s*/g;
  const rangeMatches = [...text.matchAll(rangeRe)];

  if (rangeMatches.length >= 2) {
    // Split the text on each range marker and re-emit as markdown bullets.
    // We need to handle:
    //   "Use the list below to determine what they find: 1-2: Sugar Shrub..."
    // The preamble before the first range stays as a paragraph; everything
    // after becomes a list.
    const firstMatch = rangeMatches[0];
    const preamble = text.slice(0, firstMatch.index).trim();
    const listText = text.slice(firstMatch.index);

    // Replace each "N-M: " with a newline + bullet + bold label
    const listMd = listText.replace(rangeRe, (_, range) => `\n- **${range}:** `);

    return (preamble ? preamble + '\n' : '') + listMd.trim();
  }

  // Pattern: numbered items run together without newlines (OCR strips line breaks)
  // Match "1. Word" where the number is preceded by non-newline content
  // Only when at least 2 such patterns appear.
  const numberedRe = /(?<!\n)(\s+)(\d+)\.\s+([A-Z])/g;
  const numberedMatches = [...text.matchAll(numberedRe)];

  if (numberedMatches.length >= 2) {
    // Insert a newline before each "N. Capital" that isn't already at line start
    return text.replace(numberedRe, '\n$2. $3');
  }

  return text;
}

function extractFeatures(text) {
  const features = [];

  // Find the features section — look for "FEATURES" or "Features:" header
  const headerIdx = text.search(/\bFEATURES?\b:?\s*/i);
  const featureText = headerIdx >= 0 ? text.slice(headerIdx) : text;

  // Strategy 1: "Name - Type: description" — captures multi-line/multi-paragraph descriptions
  // Uses [\s\S]+? (non-greedy, crosses blank lines) with a lookahead that stops at the next
  // feature header or end of text.
  const featureBlockRe = /([A-Z][^\n.!?]*?)\s+[-\u2014]\s+(Passive|Action|Reaction)\s*[:.]\s*([\s\S]+?)(?=\n[A-Z][^\n]*\s+[-\u2014]\s+(?:Passive|Action|Reaction)|$)/gi;
  for (const m of featureText.matchAll(featureBlockRe)) {
    const name = m[1].trim().replace(/^[-*•]\s*/, '');
    const type = m[2].toLowerCase();
    // Preserve newlines; only collapse runs of horizontal whitespace
    const rawDesc = m[3].trim()
      .replace(/[^\S\n]+/g, ' ')   // collapse horizontal whitespace runs
      .replace(/\n{3,}/g, '\n\n'); // normalize excessive blank lines
    const description = formatListPatterns(rawDesc);
    if (name && description) {
      features.push({ id: crypto.randomUUID(), name, type, description });
    }
  }

  if (features.length > 0) return features;

  // Strategy 2: "Name (Type): description"
  const parenRe = /([A-Z][^\n(]*?)\s*\((Passive|Action|Reaction)\)\s*[:.]\s*([^\n]+)/gi;
  for (const m of featureText.matchAll(parenRe)) {
    const name = m[1].trim().replace(/^[-*•]\s*/, '');
    const type = m[2].toLowerCase();
    const description = m[3].trim();
    if (name && description) {
      features.push({ id: crypto.randomUUID(), name, type, description });
    }
  }

  if (features.length > 0) return features;

  // Strategy 3: Bold markdown "**Name - Type:** description" (before stripping)
  // This works on the raw text, so caller should try with both raw and stripped
  const boldRe = /\*\*([^*]+?)\s+[-\u2014]\s+(Passive|Action|Reaction)\*?\*?:?\s*([^\n]+)/gi;
  for (const m of text.matchAll(boldRe)) {
    const name = m[1].trim();
    const type = m[2].toLowerCase();
    const description = m[3].trim().replace(/\*+/g, '');
    if (name && description) {
      features.push({ id: crypto.randomUUID(), name, type, description });
    }
  }

  return features;
}

function extractDescription(text) {
  // Italic text after tier line (markdown format: _description_)
  const italicAfterTier = text.match(/Tier\s+\d\s+\w+\.?\s*_([^_]+)_/i);
  if (italicAfterTier) return italicAfterTier[1].trim();

  // Plain-text description between tier line and first known section header
  // Handles OCR output where the description is plain text on lines following "Tier X Type"
  // with possible blank lines (OCR line-wrapping artifacts) between them.
  const plainAfterTier = text.match(
    /Tier\s+\d\s+\w+\s*\n+([\s\S]+?)(?=\n\s*(?:Impulses?|Difficulty|Potential\s+Adversaries?|FEATURES?)\s*[:\n])/i
  );
  if (plainAfterTier) {
    const desc = plainAfterTier[1].trim().replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
    if (desc.length > 20) return desc;
  }

  const labeled = text.match(/Description:\s*([^\n]+(?:\n(?!(?:Tier|HP|Stress|Difficulty|Attack|Experience|Feature|Motive|Potential))[^\n]+)*)/i);
  if (labeled) return labeled[1].trim().replace(/\n/g, ' ');

  return null;
}

function extractMotive(text) {
  const patterns = [
    /Motives?\s*(?:&|and)\s*Tactics?:\s*([^\n]+)/i,
    /Motives?:\s*([^\n]+)/i,
    /Tactics?:\s*([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractImpulses(text) {
  // Capture the first line plus any continuation lines that don't start a new section.
  // OCR output often wraps long impulse lists across two lines.
  const match = text.match(
    /Impulses?:\s*([\s\S]+?)(?=\n\s*(?:Difficulty|Potential\s+Adversaries?|FEATURES?|THRESHOLDS?)\s*[:\n]|$)/i
  );
  if (!match) return '';
  return match[1].trim().replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
}

function extractPotentialAdversaries(text) {
  const match = text.match(/Potential\s+Adversaries?:\s*([^\n]+)/i);
  if (!match) return [];
  const raw = match[1].trim();
  if (!raw || raw.toLowerCase() === 'any' || raw.toLowerCase() === 'none') return [];

  // Expand "Category (Name1, Name2)" groups only when the parenthetical is a
  // comma-separated list of sub-names (e.g. "Beasts (Bear, Dire Wolf)" → "Bear, Dire Wolf").
  // When the parenthetical is a role/type descriptor without commas
  // (e.g. "Sporebottles (Horde/Swarm)"), keep the category name and discard the descriptor.
  const expanded = raw.replace(/([^,()]+)\(([^)]+)\)/g, (_, prefix, inner) => {
    if (inner.includes(',')) return inner;
    return prefix.trim();
  });
  return expanded.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name }));
}

// ---------------------------------------------------------------------------
// Helpers (shared with SRD parser logic)
// ---------------------------------------------------------------------------

function normalizeRole(raw) {
  const t = (raw || '').toLowerCase();
  if (t.startsWith('horde')) return 'horde';
  if (t === 'solo') return 'standard';
  return VALID_ROLES.has(t) ? t : null;
}

function normalizeRange(raw) {
  return RANGE_ALIASES[(raw || '').toLowerCase()] || 'Melee';
}

function parseDamageAndTrait(damageStr) {
  if (!damageStr) return { damage: '', trait: 'Phy' };
  const parts = damageStr.trim().split(/\s+/);
  const damage = parts[0] || '';
  const traitRaw = (parts[1] || '').toLowerCase();
  const trait = TRAIT_MAP[traitRaw] || 'Phy';
  return { damage, trait };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a text stat block into a structured Daggerheart adversary or environment.
 *
 * @param {string} text       - Raw text (Reddit markdown selftext or OCR output)
 * @param {string} collection - 'adversaries' | 'environments'
 * @param {string} [title]    - Post title (fallback for name extraction)
 * @returns {{ item: object, confidence: number, missing: string[] }}
 */
export function parseStatBlock(text, collection = 'adversaries', title = '') {
  if (!text || !text.trim()) {
    const empty = collection === 'environments' ? emptyEnvironment() : emptyAdversary();
    if (title) empty.name = title;
    return { item: empty, confidence: title ? 0.15 : 0, missing: Object.keys(collection === 'environments' ? ENV_WEIGHTS : ADV_WEIGHTS), nameIsTitle: !!title };
  }

  const raw = text;
  const processed = preprocess(text);

  // Extract features from BOTH raw (markdown) and processed (stripped) text
  const rawFeatures = extractFeatures(raw);
  const processedFeatures = extractFeatures(processed);
  const features = rawFeatures.length >= processedFeatures.length ? rawFeatures : processedFeatures;

  if (collection === 'environments') {
    return parseEnvironment(raw, processed, title, features);
  }
  return parseAdversary(raw, processed, title, features);
}

function extractCountFromText(raw) {
  const m = raw.match(/^[A-Z].*[x\xd7]\s*(\d+)/m);
  return m ? parseInt(m[1]) : null;
}

function parseAdversary(raw, processed, title, features) {
  const nameFromText = extractNameFromText(raw);
  const name = nameFromText || (title ? title.trim() : null);
  const nameIsTitle = !nameFromText && !!title;
  const count = extractCountFromText(raw);
  const { tier, role } = extractTierAndRole(processed);
  const difficulty = extractDifficulty(processed);
  const hp_max = extractHP(processed);
  const stress_max = extractStress(processed);
  const hp_thresholds = extractThresholds(processed);
  const attack = extractAttack(processed);
  const experiences = extractExperiences(processed);
  const description = extractDescription(raw) || extractDescription(processed);
  const motive = extractMotive(processed);

  const item = {
    name: name || '',
    count: count || 1,
    tier: tier || 1,
    role: role || 'standard',
    description: description || '',
    motive: motive || '',
    difficulty: difficulty || 10,
    hp_max: hp_max || 6,
    stress_max: stress_max || 3,
    hp_thresholds: hp_thresholds || { major: null, severe: null },
    attack: attack || { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences,
    features,
  };

  const { confidence, missing } = scoreAdversary(item, {
    name, tier, role, difficulty, hp_max, stress_max, hp_thresholds, attack, experiences, features,
  });

  return { item, confidence, missing, nameIsTitle };
}

function parseEnvironment(raw, processed, title, features) {
  const nameFromText = extractNameFromText(raw);
  const name = nameFromText || (title ? title.trim() : null);
  const nameIsTitle = !nameFromText && !!title;
  const { tier } = extractTierAndRole(processed);
  const type = extractEnvType(processed);
  const difficulty = extractDifficulty(processed);
  const description = extractDescription(raw) || extractDescription(processed);
  const impulses = extractImpulses(processed) || extractImpulses(raw);
  const potential_adversaries = extractPotentialAdversaries(processed);

  const item = {
    name: name || '',
    tier: tier || 1,
    type: type || 'exploration',
    description: description || '',
    impulses: impulses || '',
    difficulty: difficulty || 10,
    potential_adversaries,
    features,
  };

  const { confidence, missing } = scoreEnvironment(item, {
    name, tier, type, difficulty, potential_adversaries, features,
  });

  return { item, confidence, missing, nameIsTitle };
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

function scoreAdversary(item, extracted) {
  let confidence = 0;
  const missing = [];

  if (extracted.name) confidence += ADV_WEIGHTS.name; else missing.push('name');
  if (extracted.tier) confidence += ADV_WEIGHTS.tier; else missing.push('tier');
  if (extracted.role) confidence += ADV_WEIGHTS.role; else missing.push('role');
  if (extracted.difficulty) confidence += ADV_WEIGHTS.difficulty; else missing.push('difficulty');
  if (extracted.hp_max) confidence += ADV_WEIGHTS.hp_max; else missing.push('hp_max');
  if (extracted.stress_max) confidence += ADV_WEIGHTS.stress_max; else missing.push('stress_max');
  if (extracted.hp_thresholds) confidence += ADV_WEIGHTS.hp_thresholds; else missing.push('hp_thresholds');
  if (extracted.attack) confidence += ADV_WEIGHTS.attack; else missing.push('attack');
  if (extracted.experiences.length > 0) confidence += ADV_WEIGHTS.experiences; else missing.push('experiences');
  if (extracted.features.length > 0) confidence += ADV_WEIGHTS.features; else missing.push('features');

  return { confidence, missing };
}

function scoreEnvironment(item, extracted) {
  let confidence = 0;
  const missing = [];

  if (extracted.name) confidence += ENV_WEIGHTS.name; else missing.push('name');
  if (extracted.tier) confidence += ENV_WEIGHTS.tier; else missing.push('tier');
  if (extracted.type) confidence += ENV_WEIGHTS.type; else missing.push('type');
  if (extracted.difficulty) confidence += ENV_WEIGHTS.difficulty; else missing.push('difficulty');
  if (extracted.potential_adversaries.length > 0) confidence += ENV_WEIGHTS.potential_adversaries; else missing.push('potential_adversaries');
  if (extracted.features.length > 0) confidence += ENV_WEIGHTS.features; else missing.push('features');

  return { confidence, missing };
}

// ---------------------------------------------------------------------------
// Empty defaults
// ---------------------------------------------------------------------------

function emptyAdversary() {
  return {
    name: '', tier: 1, role: 'standard', description: '', motive: '',
    difficulty: 10, hp_max: 6, stress_max: 3,
    hp_thresholds: { major: null, severe: null },
    attack: { name: '', range: 'Melee', modifier: 0, trait: 'Phy', damage: '' },
    experiences: [], features: [],
  };
}

function emptyEnvironment() {
  return {
    name: '', tier: 1, type: 'exploration', description: '', impulses: '', difficulty: 10,
    potential_adversaries: [], features: [],
  };
}

/**
 * Merge two parse results, preferring the one with more data for each field.
 * Useful for combining selftext parse + OCR parse.
 */
export function mergeResults(a, b) {
  if (!a || a.confidence === 0) return b || a;
  if (!b || b.confidence === 0) return a;

  const merged = { ...a.item };
  const bItem = b.item;

  // Prefer an actually-extracted name over a title-fallback name
  if (a.nameIsTitle && !b.nameIsTitle && bItem.name) {
    merged.name = bItem.name;
  } else if (!merged.name && bItem.name) {
    merged.name = bItem.name;
  }
  if (merged.tier === 1 && bItem.tier !== 1) merged.tier = bItem.tier;
  if (merged.role === 'standard' && bItem.role && bItem.role !== 'standard') merged.role = bItem.role;
  if (merged.type === 'exploration' && bItem.type && bItem.type !== 'exploration') merged.type = bItem.type;
  if (!merged.description && bItem.description) merged.description = bItem.description;
  if (!merged.motive && bItem.motive) merged.motive = bItem.motive;
  if (merged.difficulty === 10 && bItem.difficulty !== 10) merged.difficulty = bItem.difficulty;
  if ((merged.hp_max === 6 || !merged.hp_max) && bItem.hp_max && bItem.hp_max !== 6) merged.hp_max = bItem.hp_max;
  if ((merged.stress_max === 3 || !merged.stress_max) && bItem.stress_max && bItem.stress_max !== 3) merged.stress_max = bItem.stress_max;

  if (!merged.hp_thresholds?.major && bItem.hp_thresholds?.major) {
    merged.hp_thresholds = bItem.hp_thresholds;
  }
  if ((!merged.attack?.name || !merged.attack?.damage) && bItem.attack?.name) {
    merged.attack = bItem.attack;
  }
  if (merged.experiences?.length === 0 && bItem.experiences?.length > 0) {
    merged.experiences = bItem.experiences;
  }
  if (merged.features?.length === 0 && bItem.features?.length > 0) {
    merged.features = bItem.features;
  }
  if (merged.potential_adversaries?.length === 0 && bItem.potential_adversaries?.length > 0) {
    merged.potential_adversaries = bItem.potential_adversaries;
  }
  if (!merged.impulses && bItem.impulses) merged.impulses = bItem.impulses;

  // Recompute confidence from the merged item
  const confidence = Math.max(a.confidence, b.confidence);
  const missing = a.missing.filter(f => b.missing.includes(f));

  return { item: merged, confidence, missing };
}

/**
 * Detect whether a stat block text is more likely an adversary or environment,
 * then parse it as that collection.
 *
 * Runs parseStatBlock for both collections and uses keyword-based heuristics
 * to tiebreak when confidence scores are close. Returns the winner along with
 * the detected collection name.
 *
 * @param {string} text   - Raw stat block text
 * @param {string} [title] - Optional title hint (fallback for name)
 * @returns {{ collection: 'adversaries'|'environments', item: object, confidence: number, missing: string[] }}
 */
export function detectCollection(text, title = '') {
  const advResult = parseStatBlock(text, 'adversaries', title);
  const envResult = parseStatBlock(text, 'environments', title);

  // Strong keyword signals override confidence scores
  const hasHP        = /\b(HP|Hit Points?|Stress)\b/i.test(text);
  const hasAttack    = /\b(ATK|Attack)\b/i.test(text);
  const hasThresh    = /\bThresholds?\b/i.test(text);
  const hasImpulses  = /\bImpulses?\b/i.test(text);
  const hasPotAdv    = /\bPotential\s+Adversar/i.test(text);

  const advSignals = (hasHP ? 1 : 0) + (hasAttack ? 1 : 0) + (hasThresh ? 1 : 0);
  const envSignals = (hasImpulses ? 1 : 0) + (hasPotAdv ? 1 : 0);

  if (envSignals > advSignals) return { collection: 'environments', ...envResult };
  if (advSignals > envSignals) return { collection: 'adversaries', ...advResult };

  // Equal signals — fall back to confidence comparison
  if (envResult.confidence > advResult.confidence) return { collection: 'environments', ...envResult };
  return { collection: 'adversaries', ...advResult };
}
