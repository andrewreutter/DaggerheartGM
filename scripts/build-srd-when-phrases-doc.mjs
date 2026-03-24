/**
 * Regenerates docs/srd-when-phrases.md from daggerheart-srd/.build/03_json.
 * Groups structurally identical templates (named adversary/domain slots) and a few
 * clear synonym pairs; every phrase belongs to exactly one group.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dirname, '..');
const JSON_DIR = path.join(ROOT, 'daggerheart-srd/.build/03_json');
const OUT = path.join(ROOT, 'docs/srd-when-phrases.md');

function walkStrings(obj, out) {
  if (obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    out.push(obj);
    return;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) walkStrings(x, out);
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) walkStrings(obj[k], out);
  }
}

function extractWhenClauses(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const results = [];
  const re = /\bWhen\b/g;
  let m;
  while ((m = re.exec(flat)) !== null) {
    const start = m.index;
    let i = start + 4;
    while (i < flat.length && flat[i] === ' ') i++;
    while (i < flat.length) {
      const c = flat[i];
      if (c === ',') break;
      if (c === '.' || c === '!' || c === '?') {
        const next = flat[i + 1];
        if (next === undefined || next === ' ') break;
      }
      i++;
    }
    let phrase = flat.slice(start, i).trim();
    phrase = phrase.replace(/\s*\*\*+\s*$/, '').trim();
    if (phrase.length > 4) results.push(phrase);
  }
  return results;
}

/**
 * Some JSON strings contain one comma-bounded clause with "… and …" joining two
 * conditions. For this doc, each side is a distinct trigger phrase. Noun phrases
 * like "plants and animals" stay intact (not listed here).
 */
const WHEN_CLAUSE_AND_SPLITS = {
  'When an ally within Close range has 2 or fewer Hit Points and would take damage': [
    'When an ally within Close range has 2 or fewer Hit Points',
    'When an ally within Close range would take damage',
  ],
  'When an attack from the Bramble causes a target to mark HP and there are three or more Tangle Bramble Minions within Close range': [
    'When an attack from the Bramble causes a target to mark HP',
    'When there are three or more Tangle Bramble Minions within Close range',
  ],
  'When the Zombie is within Melee range of a creature and at least one other Zombie is within Close range': [
    'When the Zombie is within Melee range of a creature',
    'When at least one other Zombie is within Close range',
  ],
  'When you move in a straight line into Melee range of a target from at least Close range and make an attack against that target in the same action': [
    'When you move in a straight line into Melee range of a target from at least Close range',
    'When you make an attack against that target in the same action',
  ],
  'When you speak a specific trigger word or action and open the chest': [
    'When you speak a specific trigger word or action',
    'When you open the chest',
  ],
  'When you spotlight the Elemental and they don\'t have a token on their stat block': [
    'When you spotlight the Elemental',
    'When they don\'t have a token on their stat block',
  ],
  'When you spotlight the Elemental and they have a token on their stat block': [
    'When you spotlight the Elemental',
    'When they have a token on their stat block',
  ],
  'When you spotlight the Ooze and they don\'t have a token on their stat block': [
    'When you spotlight the Ooze',
    'When they don\'t have a token on their stat block',
  ],
  'When you spotlight the Ooze and they have a token on their stat block': [
    'When you spotlight the Ooze',
    'When they have a token on their stat block',
  ],
  'When you spotlight the Turret and they don\'t have a token on their stat block': [
    'When you spotlight the Turret',
    'When they don\'t have a token on their stat block',
  ],
  'When you spotlight the Turret and they have a token on their stat block': [
    'When you spotlight the Turret',
    'When they have a token on their stat block',
  ],
  'When you spotlight the Zombie and they don\'t have a token on their stat block': [
    'When you spotlight the Zombie',
    'When they don\'t have a token on their stat block',
  ],
  'When you spotlight the Zombie and they have a token on their stat block': [
    'When you spotlight the Zombie',
    'When they have a token on their stat block',
  ],
  'When you\'re in Beastform and an ally within Close range marks 2 or more Hit Points': [
    'When you\'re in Beastform',
    'When an ally within Close range marks 2 or more Hit Points',
  ],
};

function expandWhenClause(phrase) {
  if (Object.prototype.hasOwnProperty.call(WHEN_CLAUSE_AND_SPLITS, phrase)) {
    return WHEN_CLAUSE_AND_SPLITS[phrase];
  }
  return [phrase];
}

function buildCounts() {
  const files = fs.readdirSync(JSON_DIR).filter((f) => f.endsWith('.json'));
  const counts = new Map();
  for (const file of files) {
    let buf = fs.readFileSync(path.join(JSON_DIR, file), 'utf8');
    if (buf.charCodeAt(0) === 0xfeff) buf = buf.slice(1);
    const raw = JSON.parse(buf);
    const strings = [];
    walkStrings(raw, strings);
    for (const s of strings) {
      for (const p of extractWhenClauses(s)) {
        for (const q of expandWhenClause(p)) {
          counts.set(q, (counts.get(q) || 0) + 1);
        }
      }
    }
  }
  return counts;
}

/** More specific rules first. */
const TEMPLATE_GROUPS = [
  {
    title: 'Four or more domain cards in loadout from a named domain',
    re: /^When 4 or more of the domain cards in your loadout are from the \w+ domain$/,
  },
  {
    title: 'Spotlight adversary — spotlight the named adversary',
    re: /^When you spotlight the .+$/,
  },
  {
    title: 'Named adversary makes a successful attack against a PC',
    re: /^When the .+ makes a successful attack against a PC$/,
  },
  {
    title: 'Named adversary makes a successful attack (no “against a PC” clause)',
    re: /^When the .+ makes a successful attack$/,
  },
];

/** Exact-phrase synonym sets (must not overlap templates). */
const SYNONYM_GROUPS = [
  {
    title: 'Successful attack on your turn (alternate wordings)',
    phrases: [
      'When you make a successful attack',
      'When you succeed on an attack',
      'When you succeed on an attack against a target',
    ],
  },
  {
    title: 'Critical success on an attack (weapon vs generic wording)',
    phrases: ['When you critically succeed on an attack', 'When you critically succeed on a weapon attack'],
  },
  {
    title: 'Bard journal hook — “when’s the last time you performed…” (wording variants in JSON)',
    phrases: [
      "When's the last time you performed it for a crowd",
      "When's the last time you performed it for a crowd?_",
    ],
  },
];

function buildGroups(counts) {
  const assigned = new Set();
  const groups = [];

  for (const { title, re } of TEMPLATE_GROUPS) {
    const members = [];
    for (const [phrase, n] of counts) {
      if (re.test(phrase)) {
        members.push({ phrase, n });
        assigned.add(phrase);
      }
    }
    if (members.length === 0) continue;
    members.sort((a, b) => b.n - a.n || a.phrase.localeCompare(b.phrase));
    const total = members.reduce((s, m) => s + m.n, 0);
    groups.push({ title, members, total });
  }

  for (const { title, phrases } of SYNONYM_GROUPS) {
    const members = [];
    for (const p of phrases) {
      if (counts.has(p)) {
        members.push({ phrase: p, n: counts.get(p) });
        assigned.add(p);
      }
    }
    if (members.length === 0) continue;
    const total = members.reduce((s, m) => s + m.n, 0);
    members.sort((a, b) => b.n - a.n || a.phrase.localeCompare(b.phrase));
    groups.push({ title, members, total });
  }

  for (const [phrase, n] of counts) {
    if (assigned.has(phrase)) continue;
    groups.push({ title: phrase, members: [{ phrase, n }], total: n });
  }

  groups.sort((a, b) => b.total - a.total || a.title.localeCompare(b.title));
  return groups;
}

function escapeMd(s) {
  return s.replace(/\|/g, '\\|');
}

function main() {
  const counts = buildCounts();
  const totalOcc = [...counts.values()].reduce((a, b) => a + b, 0);
  const groups = buildGroups(counts);

  let md = `# SRD "When …" trigger phrases

This document lists **comma- or sentence-bounded** clauses that begin with **When** (capital \`W\` only) in \`daggerheart-srd/.build/03_json/*.json\`. Each string field is scanned separately; repeated boilerplate (e.g. the same class feature text in multiple places) increases occurrence counts. A few JSON clauses join two conditions with **and**; those are split into **two** distinct phrases (each occurrence of the source clause increments both), except noun phrases like “plants and animals”.

**Totals**

- **${totalOcc}** total phrase occurrences across the corpus (after **and**-splits).
- **${counts.size}** distinct phrase wordings.
- **${groups.length}** groups below (template/synonym merges + singletons).

**Grouping**

- **Template groups**: same sentence shape with a **named adversary**, **domain name**, or other slot filled in — one row per exact wording; rolled-up count is the sum.
- **Synonym groups**: alternate wordings that describe the **same trigger** (e.g. “make a successful attack” vs “succeed on an attack”).
- **Singletons**: a group whose title is the exact phrase.

---

`;

  for (const g of groups) {
    md += `### ${g.title}\n\n`;
    md += `**Group total: ${g.total}** occurrence${g.total === 1 ? '' : 's'}\n\n`;
    md += '| Exact phrase | Occurrences |\n| --- | ---: |\n';
    for (const { phrase, n } of g.members) {
      md += `| ${escapeMd(phrase)} | ${n} |\n`;
    }
    md += '\n';
  }

  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`totalOcc=${totalOcc} groups=${groups.length}`);
}

main();
