#!/usr/bin/env node
/**
 * Analyze SRD feature descriptions for trigger conditions ("When you X, you may do Z").
 * Outputs: (1) comprehensive trigger phrase counts, (2) regex detectability and multi-match report.
 *
 * Run from repo root: node scripts/analyze-srd-triggers.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRD_JSON = join(__dirname, '..', 'daggerheart-srd', '.build', '03_json');

// ── Load all SRD collections that contain feature-like text ─────────────────
function loadJson(name) {
  try {
    let raw = readFileSync(join(SRD_JSON, `${name}.json`), 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function* collectFeatureTexts() {
  const ancestries = loadJson('ancestries');
  for (const a of ancestries || []) {
    for (const f of a.feature || []) {
      if (f.text) yield { source: 'ancestries', parent: a.name, name: f.name, text: f.text };
    }
  }

  const communities = loadJson('communities');
  for (const c of communities || []) {
    for (const f of c.feature || []) {
      if (f.text) yield { source: 'communities', parent: c.name, name: f.name, text: f.text };
    }
  }

  const classes = loadJson('classes');
  for (const c of classes || []) {
    for (const f of c.feature || []) {
      if (f.text) yield { source: 'classes', parent: c.name, name: f.name, text: f.text };
    }
    if (c.hope_feature_text) {
      yield { source: 'classes', parent: c.name, name: c.hope_feature_name || 'Hope', text: c.hope_feature_text };
    }
  }

  const subclasses = loadJson('subclasses');
  for (const s of subclasses || []) {
    for (const arr of [s.foundation, s.mastery, s.specialization]) {
      if (!Array.isArray(arr)) continue;
      for (const f of arr) {
        if (f.text) yield { source: 'subclasses', parent: s.name, name: f.name, text: f.text };
      }
    }
  }

  const weapons = loadJson('weapons');
  for (const w of weapons || []) {
    for (const f of w.feature || []) {
      if (f.text) yield { source: 'weapons', parent: w.name, name: f.name, text: f.text };
    }
  }

  const armor = loadJson('armor');
  for (const a of armor || []) {
    for (const f of a.feature || []) {
      if (f.text) yield { source: 'armor', parent: a.name, name: f.name, text: f.text };
    }
  }

  const adversaries = loadJson('adversaries');
  for (const a of adversaries || []) {
    for (const f of a.feature || []) {
      if (f.text) yield { source: 'adversaries', parent: a.name, name: f.name, text: f.text };
    }
  }

  const beastforms = loadJson('beastforms');
  for (const b of beastforms || []) {
    for (const f of b.feature || []) {
      if (f.text) yield { source: 'beastforms', parent: b.name, name: f.name, text: f.text };
    }
  }

  const abilities = loadJson('abilities');
  for (const a of abilities || []) {
    if (a.text) yield { source: 'abilities', parent: a.name, name: a.name, text: a.text };
  }
}

// ── Trigger patterns: name, regex, capture group index (1 = first capture) ───
// We want to capture the condition "X" (the trigger), not the cost/effect.
const TRIGGER_PATTERNS = [
  { id: 'when_you', name: 'When you ...', re: /when you (would )?(?:take|make|succeed|roll|mark|deal|give|use|drop|are|have|do|act|attack|move|spend|clear|choose|describe|encourage|help|give a rally die to an ally)[^.]*?(?=,|\.|$)/gi },
  { id: 'when_you_short', name: 'When you [short]', re: /when you ([^,.]{10,80}?)(?=\s*,|\s*\.|$)/gi },
  { id: 'when_you_would', name: 'When you would ...', re: /when you would (mark [^.]*?|take [^.]*?)(?=,|\.|$)/gi },
  { id: 'after_you', name: 'After you ...', re: /after you (?:or a willing ally )?([^.]*?)(?=\s*,|\s*\.|$)/gi },
  { id: 'once_per_session', name: 'Once per session', re: /once per session/gi },
  { id: 'once_per_rest', name: 'Once per rest', re: /once per (?:long )?rest/gi },
  { id: 'while_', name: 'While ...', re: /while (?:you are |you're |_?channeling_?|flying|in beastform|this spell is active|_?unstoppable_?|in your shell)[^.]*?(?=,|\.|$)/gi },
  { id: 'during_', name: 'During ...', re: /during (?:a |your )?(?:rest|long rest|short rest)[^.]*?(?=,|\.|$)/gi },
  { id: 'if_you', name: 'If you ...', re: /if (?:you |the ward die result is )([^.]*?)(?=\s*,|\s*\.|$)/gi },
  { id: 'on_a_success', name: 'On a success(ful) ...', re: /on a (?:successful )?([^.]*?)(?=\s*,|\s*\.|$)/gi },
  { id: 'before_you', name: 'Before you ...', re: /before you ([^.]*?)(?=\s*,|\s*\.|$)/gi },
  { id: 'when_attack_against_you', name: 'When (an attack...) against you', re: /when (?:an? (?:attack )?[^.]*? against you[^.]*?)(?=,|\.|$)/gi },
  { id: 'when_creature', name: 'When a creature ...', re: /when (?:a creature|an adversary|the target)[^.]*?(?=,|\.|$)/gi },
  { id: 'when_you_take_damage', name: 'When you take X damage', re: /when you (?:take|would take) (minor|major|severe|physical|magic)[^.]*?(?=,|\.|$)/gi },
  { id: 'when_you_succeed_attack', name: 'When you succeed on an attack', re: /when you succeed on an (?:attack|agility roll|action roll)[^.]*?(?=,|\.|$)/gi },
  { id: 'when_you_roll', name: 'When you roll (with Fear...)', re: /when you roll with fear[^.]*?(?=,|\.|$)/gi },
  { id: 'when_ally', name: 'When (you give / ally...)', re: /when (?:you give a rally die to an ally|an ally within[^.]*?)(?=,|\.|$)/gi },
  { id: 'at_the_start', name: 'At the start/beginning of session', re: /at the (?:start|beginning) of (?:each |every )?session/gi },
  { id: 'at_the_end', name: 'At the end of session', re: /at the end of (?:each |every )?session/gi },
];

// Simpler extraction: just find "When you X" and capture X (first sentence or clause)
const WHEN_YOU_CAPTURE = /when you (would )?(.+?)(?=\s*, you can|\s*, you may|\s*\.|\s*$)/gis;
const AFTER_YOU_CAPTURE = /after you (.+?)(?=\s*, you can|\s*, you may|\s*\.|\s*$)/gis;
const ONCE_PER_CAPTURE = /once per (session|long rest|rest)(?:\s*,)?\s*(?:when you (.+?))?(?=\s*\.|\s*$)/gis;
const WHILE_CAPTURE = /while (.+?)(?=\s*, you|\s*, (?:you )?can|\s*\.|\s*$)/gis;
const WHEN_OTHER_CAPTURE = /when (?:an?|the) (.+?)(?=\s*, you|\s*, (?:you )?can|\s*\.|\s*$)/gis;

function normalizeTrigger(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/_\s*/g, ' ')
    .trim();
}

function extractTriggers(text) {
  const triggers = [];
  const seen = new Set();

  function add(label, capture) {
    const n = normalizeTrigger(capture);
    if (n && !seen.has(n)) {
      seen.add(n);
      triggers.push({ label, raw: capture, normalized: n });
    }
  }

  // When you X [, you can/may ...]
  let m;
  WHEN_YOU_CAPTURE.lastIndex = 0;
  while ((m = WHEN_YOU_CAPTURE.exec(text)) !== null) {
    add('when_you', m[2]);
  }

  AFTER_YOU_CAPTURE.lastIndex = 0;
  while ((m = AFTER_YOU_CAPTURE.exec(text)) !== null) {
    add('after_you', m[1]);
  }

  ONCE_PER_CAPTURE.lastIndex = 0;
  while ((m = ONCE_PER_CAPTURE.exec(text)) !== null) {
    if (m[1]) add('once_per', m[1]);
    if (m[2]) add('once_per_when', m[2]);
  }

  WHILE_CAPTURE.lastIndex = 0;
  while ((m = WHILE_CAPTURE.exec(text)) !== null) {
    add('while', m[1]);
  }

  WHEN_OTHER_CAPTURE.lastIndex = 0;
  while ((m = WHEN_OTHER_CAPTURE.exec(text)) !== null) {
    add('when_other', m[1]);
  }

  // Standalone frequency
  if (/once per session/i.test(text)) add('once_per', 'session');
  if (/once per long rest/i.test(text)) add('once_per', 'long rest');
  if (/once per rest(?!\s*while)/i.test(text)) add('once_per', 'rest');

  return triggers;
}

function runRegexDetectability(features) {
  const byPattern = {};
  for (const p of TRIGGER_PATTERNS) {
    byPattern[p.id] = { name: p.name, matchCount: 0, multiCount: 0, examples: [], multiExamples: [] };
  }

  for (const feat of features) {
    const text = feat.text;
    for (const p of TRIGGER_PATTERNS) {
      p.re.lastIndex = 0;
      const matches = [];
      let m;
      while ((m = p.re.exec(text)) !== null) matches.push(m);
      if (matches.length === 0) continue;
      byPattern[p.id].matchCount += 1;
      if (matches.length > 1) {
        byPattern[p.id].multiCount += 1;
        if (byPattern[p.id].multiExamples.length < 5) {
          byPattern[p.id].multiExamples.push({
            source: `${feat.source}/${feat.parent}/${feat.name}`,
            count: matches.length,
            snippet: text.slice(0, 120) + '...',
          });
        }
      }
      if (byPattern[p.id].examples.length < 3) {
        byPattern[p.id].examples.push({
          source: `${feat.source}/${feat.parent}/${feat.name}`,
          snippet: (matches[0][1] || matches[0][0] || '').slice(0, 80),
        });
      }
    }
  }

  return byPattern;
}

// ── Pattern: "When <actor> <verb>, you may/can <spend> to <action>." ─────────
// Canonical format: "you may"; SRD often uses "you can" — accept both for table.
//
// Improved actor/verb split: actor is either "you"/"you're" or (an?|the|another) + noun
// phrase; verb starts at a predicate verb (marks, has, succeeds, etc.) so we don't split
// "an adversary" into actor "an" and verb "adversary marks...".
const WHEN_MAY_TO_RE = /When\s+([\s\S]+?)\s+([\s\S]+?),\s*you (may|can)\s+([\s\S]*?)\s+to\s+([\s\S]+?)(?:\.|$)/gi;

// Predicate verbs that start the verb phrase (third-person/infinitive so we end the actor before them).
// Use full forms (marks, attacks) not optional s so "an attack roll" stays one noun phrase.
const VERB_START =
  'marks|makes|takes|has|have|moves|deals|succeeds|fails|is|are|would|causes|attacks|dies|enters|forces|spots|becomes|appears|summons|combines|rolls';
// When (determiner + noun phrase) (verb ...), you may/can ... to ...
// Noun phrase is greedy so "an attack roll against you succeeds" → actor "an attack roll against you", verb "succeeds"
const WHEN_ACTOR_VERB_RE = new RegExp(
  `When\\s+((?:an?|the|another)\\s+(?:(?!\\s+(?:${VERB_START})\\b)[\\s\\S])+)\\s+((?:${VERB_START})\\b[\\s\\S]+?),\\s*you (may|can)\\s+([\\s\\S]*?)\\s+to\\s+([\\s\\S]+?)(?:\\.|$)`,
  'gi'
);
// When you/you're (verb ...), you may/can ... to ...
const WHEN_YOU_VERB_RE = /When\s+(you|you're)\s+([\s\S]+?),\s*you (may|can)\s+([\s\S]*?)\s+to\s+([\s\S]+?)(?:\.|$)/gi;

function matchWhenMayTo(text) {
  const normalized = text.replace(/\s+/g, ' ').replace(/\*\*/g, '').trim();
  const matches = [];
  // Try determiner+noun first (so "an adversary marks" → actor "an adversary", verb "marks...")
  WHEN_ACTOR_VERB_RE.lastIndex = 0;
  let m;
  while ((m = WHEN_ACTOR_VERB_RE.exec(normalized)) !== null) {
    matches.push({
      actor: m[1].trim(),
      verb: m[2].trim(),
      mayOrCan: m[3].toLowerCase(),
      spend: m[4].trim(),
      action: m[5].trim(),
    });
  }
  // Then "When you/you're ..." (different clause shape, so no overlap with determiner pattern)
  WHEN_YOU_VERB_RE.lastIndex = 0;
  while ((m = WHEN_YOU_VERB_RE.exec(normalized)) !== null) {
    matches.push({
      actor: m[1].trim(),
      verb: m[2].trim(),
      mayOrCan: m[3].toLowerCase(),
      spend: m[4].trim(),
      action: m[5].trim(),
    });
  }
  // If no improved match, fall back to original regex (splits on first space)
  if (matches.length === 0) {
    WHEN_MAY_TO_RE.lastIndex = 0;
    while ((m = WHEN_MAY_TO_RE.exec(normalized)) !== null) {
      matches.push({
        actor: m[1].trim(),
        verb: m[2].trim(),
        mayOrCan: m[3].toLowerCase(),
        spend: m[4].trim(),
        action: m[5].trim(),
      });
    }
  }
  return matches;
}

function isNearMiss(text) {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const hasWhen = /\bwhen\b/.test(lower);
  const hasYouMay = /\byou may\b/.test(lower);
  const hasYouCan = /\byou can\b/.test(lower);
  const hasTo = /\bto\s+\w+/.test(lower);
  if (!hasWhen) return null;
  const matches = matchWhenMayTo(text);
  if (matches.length === 1) return null; // clean hit, not a near-miss
  if (matches.length > 1) return { reason: 'multiple matches', count: matches.length };
  // 0 matches but has "When" and some follow-up
  if (hasYouMay && !hasTo) return { reason: 'has "you may" but no " to " before action' };
  if (hasYouCan && hasTo) return { reason: 'uses "you can" instead of "you may"' };
  if (hasYouCan) return { reason: 'has "When" and "you can" (different structure)' };
  if (hasYouMay) return { reason: 'has "you may" but pattern did not match (e.g. no " to ")' };
  return { reason: 'has "When" but no "you may/can" in expected place' };
}

// ── Main ───────────────────────────────────────────────────────────────────
const allFeatures = [...collectFeatureTexts()];
console.log('=== SRD Feature Trigger Analysis ===\n');
console.log(`Total feature/ability texts analyzed: ${allFeatures.length}\n`);

// ── Part 0: "When <actor> <verb>, you may <spend> to <action>." table ───────
const singleMatchRows = [];
const zeroMatch = [];
const multiMatch = [];
const nearMisses = [];

for (const feat of allFeatures) {
  const matches = matchWhenMayTo(feat.text);
  if (matches.length === 0) {
    zeroMatch.push(feat);
    const nm = isNearMiss(feat.text);
    if (nm) nearMisses.push({ feat, ...nm });
  } else if (matches.length === 1) {
    singleMatchRows.push({
      source: feat.source,
      parent: feat.parent,
      name: feat.name,
      ...matches[0],
    });
  } else {
    multiMatch.push({ feat, matches });
  }
}

console.log('--- Part 0: Format "When <actor> <verb>, you may <spend> to <action>." ---\n');
console.log(`Set aside: ${zeroMatch.length} with 0 matches, ${multiMatch.length} with 2+ matches.`);
console.log(`Table: ${singleMatchRows.length} features with exactly one match.\n`);
console.log('Source / Parent / Name                                | Actor            | Verb (trunc)        | Spend (trunc)       | Action (trunc)   | may/can');
console.log('-'.repeat(155));
for (const row of singleMatchRows) {
  const src = `${row.source}/${row.parent}: ${row.name}`;
  const srcDisplay = src.length > 42 ? src.slice(0, 39) + '...' : src;
  const actorDisplay = row.actor.length > 18 ? row.actor.slice(0, 15) + '...' : row.actor;
  const verbDisplay = row.verb.length > 20 ? row.verb.slice(0, 17) + '...' : row.verb;
  const spendDisplay = row.spend.length > 20 ? row.spend.slice(0, 17) + '...' : row.spend;
  const actionDisplay = row.action.length > 20 ? row.action.slice(0, 17) + '...' : row.action;
  console.log(`${srcDisplay.padEnd(42)} | ${actorDisplay.padEnd(18)} | ${verbDisplay.padEnd(20)} | ${spendDisplay.padEnd(20)} | ${actionDisplay.padEnd(18)} | ${row.mayOrCan}`);
}

console.log('\n--- Near-misses (has "When" and/or "you may/can" but not exactly one full match) ---');
const byReason = new Map();
for (const { feat, reason, count } of nearMisses) {
  const key = typeof count === 'number' ? `${reason} (${count} matches)` : reason;
  if (!byReason.has(key)) byReason.set(key, []);
  byReason.get(key).push(feat);
}
for (const [reason, feats] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${reason}: ${feats.length} features`);
  for (const f of feats.slice(0, 5)) {
    const snippet = f.text.replace(/\s+/g, ' ').slice(0, 90) + (f.text.length > 90 ? '...' : '');
    console.log(`  - ${f.source}/${f.parent}: ${f.name}`);
    console.log(`    "${snippet}"`);
  }
  if (feats.length > 5) console.log(`  ... and ${feats.length - 5} more`);
}

console.log('\n--- Set aside: 2+ matches (first 15) ---');
for (const { feat, matches } of multiMatch.slice(0, 15)) {
  console.log(`\n${feat.source}/${feat.parent}: ${feat.name} (${matches.length} matches)`);
  for (const m of matches) {
    console.log(`  actor="${m.actor.slice(0, 30)}..." verb="..." spend="${m.spend.slice(0, 25)}..." action="${m.action.slice(0, 25)}..."`);
  }
}
if (multiMatch.length > 15) console.log(`\n... and ${multiMatch.length - 15} more with 2+ matches.`);

// Full table as CSV (actor, verb, spend, action, ...) for grouping
const csvPath = join(__dirname, '..', 'docs', 'srd-when-may-to-table.csv');
const escape = (s) => (s.includes(',') || s.includes('"') || s.includes('\n') ? `"${String(s).replace(/"/g, '""')}"` : s);
const header = 'source,parent,name,actor,verb,spend,action,mayOrCan';
const csvRows = singleMatchRows.map((r) => [r.source, r.parent, r.name, r.actor, r.verb, r.spend, r.action, r.mayOrCan].map(escape).join(','));
writeFileSync(csvPath, [header, ...csvRows].join('\n'), 'utf8');
console.log(`\nWrote ${singleMatchRows.length} rows to docs/srd-when-may-to-table.csv`);

// Part 1: Trigger phrase counts (extracted with capture patterns)
const triggerToCount = new Map();
const triggerToExamples = new Map();
const featuresWithTriggers = [];
const featuresWithMultipleTriggers = [];

for (const feat of allFeatures) {
  const triggers = extractTriggers(feat.text);
  if (triggers.length === 0) continue;
  featuresWithTriggers.push({ ...feat, triggers });
  if (triggers.length > 1) featuresWithMultipleTriggers.push({ ...feat, triggers });

  for (const t of triggers) {
    const key = `${t.label}: ${t.normalized}`;
    triggerToCount.set(key, (triggerToCount.get(key) || 0) + 1);
    if (!triggerToExamples.has(key)) triggerToExamples.set(key, []);
    if (triggerToExamples.get(key).length < 2) {
      triggerToExamples.get(key).push(`${feat.source}/${feat.parent}: ${feat.name}`);
    }
  }
}

// Human-readable prefix for each pattern (for "Prefixes" column)
const PATTERN_PREFIXES = {
  when_you: 'When you',
  when_other: 'When a creature/adversary',
  while: 'While',
  once_per: 'Once per',
  after_you: 'After you',
  once_per_when: 'Once per …, when you',
};

// Group by unique X: one row per distinct trigger condition value
const byUniqueX = new Map();
for (const [phrase, count] of triggerToCount) {
  const colon = phrase.indexOf(': ');
  const pattern = colon >= 0 ? phrase.slice(0, colon) : '—';
  const x = colon >= 0 ? phrase.slice(colon + 2) : phrase;
  const prefix = PATTERN_PREFIXES[pattern] || pattern;
  if (!byUniqueX.has(x)) {
    byUniqueX.set(x, { prefixes: new Set(), count: 0, examples: [] });
  }
  const row = byUniqueX.get(x);
  row.prefixes.add(prefix);
  row.count += count;
  const ex = triggerToExamples.get(phrase) || [];
  for (const e of ex) {
    if (!row.examples.includes(e)) row.examples.push(e);
  }
}

const sortedByX = [...byUniqueX.entries()].sort((a, b) => b[1].count - a[1].count);

console.log('--- Part 1: Trigger conditions (one row per unique X) ---\n');
console.log('X (trigger condition)                              | Prefixes                    | Count | Example sources');
console.log('-'.repeat(120));
for (const [x, row] of sortedByX) {
  const prefixesStr = [...row.prefixes].sort().join(', ');
  const xDisplay = x.length > 52 ? x.slice(0, 49) + '...' : x;
  const preDisplay = prefixesStr.length > 28 ? prefixesStr.slice(0, 25) + '...' : prefixesStr;
  const examplesStr = row.examples.slice(0, 2).join('; ');
  console.log(`${xDisplay.padEnd(52)} | ${preDisplay.padEnd(28)} | ${String(row.count).padStart(5)} | ${examplesStr.slice(0, 45)}`);
}

console.log('\n--- Summary ---');
console.log(`Features with at least one extracted trigger: ${featuresWithTriggers.length}`);
console.log(`Features with more than one trigger in same text: ${featuresWithMultipleTriggers.length}`);
console.log(`Unique trigger phrases (label + normalized text): ${triggerToCount.size}`);
console.log(`Unique values of X (one row each): ${byUniqueX.size}`);

// Part 2: Regex detectability
console.log('\n\n=== Part 2: Regex detectability and multi-match report ===\n');
const byPattern = runRegexDetectability(allFeatures);

console.log('Pattern ID              | Features matching | Features matching 2+ times | Sample (first match)');
console.log('-'.repeat(100));
for (const p of TRIGGER_PATTERNS) {
  const r = byPattern[p.id];
  const sample = r.examples[0] ? r.examples[0].snippet.slice(0, 45) : '—';
  console.log(
    `${p.id.padEnd(22)} | ${String(r.matchCount).padStart(17)} | ${String(r.multiCount).padStart(27)} | ${sample}`
  );
}

console.log('\n--- Features that match multiple trigger patterns (same text) ---');
for (const p of TRIGGER_PATTERNS) {
  const r = byPattern[p.id];
  if (r.multiExamples.length === 0) continue;
  console.log(`\n${p.id} (${p.name}):`);
  for (const ex of r.multiExamples.slice(0, 3)) {
    console.log(`  - ${ex.source}: ${ex.count} matches. Snippet: ${ex.snippet}`);
  }
}

console.log('\n--- Features whose text contains more than one distinct trigger (extracted) ---');
for (const f of featuresWithMultipleTriggers.slice(0, 25)) {
  console.log(`\n${f.source}/${f.parent}: ${f.name}`);
  for (const t of f.triggers) {
    console.log(`  • ${t.label}: "${t.normalized.slice(0, 70)}${t.normalized.length > 70 ? '...' : ''}"`);
  }
}

// ── Part 3: Trigger categories summary (X = trigger type, count = features using it) ──
const byCategory = new Map();
for (const [phrase, count] of triggerToCount) {
  const label = phrase.split(':')[0];
  const prev = byCategory.get(label) || { features: 0, phraseCount: 0 };
  prev.features += count;
  prev.phraseCount += 1;
  byCategory.set(label, prev);
}
console.log('\n\n=== Part 3: Trigger categories (count of features using each type) ===\n');
console.log('Category        | Feature-occurrences | Distinct phrases');
console.log('-'.repeat(55));
for (const [label, stats] of [...byCategory.entries()].sort((a, b) => b[1].features - a[1].features)) {
  console.log(`${label.padEnd(15)} | ${String(stats.features).padStart(18)} | ${stats.phraseCount}`);
}
