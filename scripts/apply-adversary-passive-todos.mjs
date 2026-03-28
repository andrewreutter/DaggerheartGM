/**
 * Deprecated: use `scripts/apply-adversary-feature-todos.mjs` for all adversary feature types
 * (passive, action, reaction) with taxonomized TODOs. This script only rewrote passives and
 * skipped actions — kept for reference.
 *
 *   node scripts/apply-adversary-passive-todos.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADV_DIR = join(__dirname, '../src/features-v2/adversary_features');

function parseModule(content) {
  const nameM = content.match(/name:\s*"((?:[^"\\]|\\.)*)"/);
  const descM = content.match(/description:\s*"((?:[^"\\]|\\.)*)"/s);
  const typeM = content.match(/type:\s*'(\w+)'/);
  return {
    name: nameM?.[1] ?? '',
    desc: descM?.[1] ?? '',
    type: typeM?.[1] ?? 'passive',
    hasAffinities: /\bdamageAffinities\s*:/.test(content),
    hasChips: /\bchips\s*:/.test(content),
  };
}

/** @param {string} tag @param {string} text @param {Map<string, string>} m */
function addTodo(m, tag, text) {
  const key = `${tag}::${text}`;
  if (!m.has(key)) m.set(key, { tag, text });
}

function buildTodos(name, desc, hasAffinities, hasChips) {
  /** @type {Map<string, {tag: string, text: string}>} */
  const m = new Map();

  if (!name) {
    addTodo(m, 'DEFER', 'Fix module: missing `name` field.');
    return [...m.values()];
  }
  if (!desc) {
    addTodo(m, 'DEFER', 'Fix module: missing `description` field.');
    return [...m.values()];
  }

  const d = desc;

  // --- Named families (shared tags for batching) ---
  if (/^Horde\s*\(/i.test(name)) {
    addTodo(
      m,
      'HORDE',
      'When half or more HP is marked, standard attack damage becomes this passive’s dice expression (per SRD).'
    );
    return [...m.values()];
  }
  if (/^Minion\s*\(/i.test(name)) {
    const n = name.match(/\((\d+)\)/);
    addTodo(
      m,
      'MINION',
      n
        ? `Defeat on any damage; for every ${n[1]} damage to this pool, defeat another minion in range (per SRD).`
        : 'Minion defeat-on-hit and spill rules (per SRD).'
    );
    return [...m.values()];
  }
  if (/^Relentless\s*\(/i.test(name)) {
    addTodo(
      m,
      'RELENTLESS',
      'Allow up to the stated number of spotlights per GM turn; Fear spend to spotlight unchanged (per SRD).'
    );
    return [...m.values()];
  }

  // --- Explicit one-offs (still use global tags) ---
  if (name === 'Ghost') {
    addTodo(
      m,
      'AFFINITY',
      hasAffinities
        ? 'Physical resistance — registry has `damageAffinities`; ensure damage pipeline applies to adversaries.'
        : 'Physical resistance (per SRD).'
    );
    addTodo(m, 'MOVEMENT', 'Mark Stress to move up to Close range through solid objects (not automated).');
    return [...m.values()];
  }
  if (name === 'Terrifying') {
    addTodo(m, 'AURA', 'Successful attack: PCs within Close lose Hope; GM gains Fear (not automated).');
    addTodo(m, 'TRACK', 'Card toggle is bookkeeping only; apply Hope/Fear manually per SRD.');
    return [...m.values()];
  }

  // --- Registry-only affinity rows (short SRD line) ---
  const affinityOnly = [
    'Arcane Form',
    'Wards',
    'Obsidian Scales',
    'Only Bones',
    'Unyielding',
    'Warped Fortitude',
  ];
  if (affinityOnly.includes(name) && hasAffinities) {
    addTodo(
      m,
      'AFFINITY',
      'Resistance line — registry has `damageAffinities`; ensure incoming damage respects type (per SRD).'
    );
    return [...m.values()];
  }

  // --- Phrase matchers (multiple tags per description) ---
  if (/countdown/i.test(d)) {
    addTodo(m, 'COUNTDOWN', 'Countdown activation, ticks, maximum value, and trigger effects (per SRD).');
  }
  if (/token on (their|the) stat block/i.test(d)) {
    addTodo(m, 'TOKEN', 'Two-step spotlight token: first spotlight sets intent, second clears and acts (per SRD).');
  }
  if (/spend a handful of gold|handfuls of gold|handful of gold/i.test(d)) {
    addTodo(m, 'GOLD', 'Gold pools, disadvantage bypass, HP-for-gold, attack bonus from gold (per SRD).');
  }
  if (/social actions|presence roll.*merchant|against the merchant/i.test(d)) {
    addTodo(m, 'SOCIAL', 'Social roll modifiers, discounts, disadvantage on future rolls (per SRD).');
  }
  if (/resistant to|resistance to/i.test(d) && !hasAffinities) {
    addTodo(m, 'AFFINITY', 'Damage type resistance — add `damageAffinities` and/or pipeline (per SRD).');
  }
  if (/immune to all damage|immune to/i.test(d)) {
    addTodo(m, 'AFFINITY', 'Immunity or special damage rules (per SRD).');
  }
  if (/armor slot without receiving|mark an armor slot/i.test(d) && /without receiving|can't mark an armor slot/i.test(d)) {
    addTodo(
      m,
      'ARMOR',
      'Target marks Armor Slot without benefit; if they cannot, mark extra HP instead (per SRD).'
    );
  }
  if (/When .+ takes (physical )?damage, reduce it by/i.test(d) || /takes damage, reduce it by/i.test(d)) {
    addTodo(m, 'DAMAGE', 'Flat or rolled damage reduction before thresholds (per SRD).');
  }
  if (/deal(s)? \*\*/i.test(d) && /instead of (their|the) standard damage/i.test(d)) {
    addTodo(m, 'DAMAGE', 'Replace standard attack damage with stated dice under condition (per SRD).');
  }
  if (/double damage/i.test(d) || /deals double damage/i.test(d)) {
    addTodo(m, 'DAMAGE', 'Double damage under stated condition (per SRD).');
  }
  if (/direct damage/i.test(d)) {
    addTodo(m, 'DAMAGE', '“Direct damage” bypasses armor/threshold rules as per SRD table conventions.');
  }
  if (/half damage/i.test(d)) {
    addTodo(m, 'DAMAGE', 'Half damage on success vs full on failure where stated (per SRD).');
  }
  if (/lose a hope|lose \*\*?\d*d?\d*\*\*? hope/i.test(d) || /they lose a hope/i.test(d)) {
    addTodo(m, 'RESOURCE', 'PC Hope loss (per SRD trigger).');
  }
  if (/gain a fear|gain \*\*/i.test(d) && /fear/i.test(d.toLowerCase())) {
    addTodo(m, 'RESOURCE', 'GM Fear gain (per SRD trigger).');
  }
  if (/spend a fear|\*\*Spend a Fear\*\*/i.test(d)) {
    addTodo(m, 'RESOURCE', 'GM Fear spend (per SRD).');
  }
  if (/mark a stress|\*\*Mark a Stress\*\*/i.test(d)) {
    addTodo(m, 'RESOURCE', 'Adversary Stress mark for movement/ability (per SRD).');
  }
  if (/can't spend hope to use features|can't spend hope/i.test(d)) {
    addTodo(m, 'RESOURCE', 'Block or gate PC Hope spend on features vs this adversary (per SRD).');
  }
  if (/both physical and magic|physical and magic/i.test(d)) {
    addTodo(m, 'DAMAGE', 'Standard attack damage counts as both physical and magic for thresholds/tags (per SRD).');
  }
  if (/roll \*\*2d4\*\*|attack modifier/i.test(d) && /2d4/i.test(d)) {
    addTodo(m, 'ROLL', 'Use rolled dice as attack modifier instead of static mod (per SRD).');
  }
  if (/After making a standard attack,.*move anywhere|After making a standard attack/i.test(d) && /move anywhere within Far range/i.test(d)) {
    addTodo(m, 'MOVEMENT', 'After standard attack, reposition within stated range (per SRD).');
  }
  if (/disadvantage/i.test(d)) {
    addTodo(m, 'ROLL', 'Disadvantage on stated rolls (per SRD).');
  }
  if (/\badvantage\b/i.test(d) && !/disadvantage/i.test(d)) {
    addTodo(m, 'ROLL', 'Advantage on stated attacks or rolls (per SRD).');
  }
  if (/reaction roll|reaction roll\./i.test(d) || /reaction roll/i.test(d)) {
    addTodo(m, 'ROLL', 'Reaction rolls (trait as stated) and outcomes (per SRD).');
  }
  if (/evasion is halved/i.test(d) || /Evasion is halved/i.test(d)) {
    addTodo(m, 'EVASION', 'Halve target Evasion against stated attacks (per SRD).');
  }
  if (/bonus to (their )?difficulty/i.test(d) || /\+[0-9]+ bonus to (their )?difficulty/i.test(d)) {
    addTodo(m, 'DIFFICULTY', 'Difficulty modifier while condition holds (per SRD).');
  }
  if (/teleport/i.test(d)) {
    addTodo(m, 'MOVEMENT', 'Teleport timing, range, and costs (per SRD).');
  }
  if (/While flying|while .+ is flying|Divine Flight|Deadly Flight|Flight\b|Flying\b|Levitation/i.test(d)) {
    addTodo(m, 'MOVEMENT', 'Flying movement, range swaps, and rider rules (per SRD).');
    if (/spend a fear.*far range/i.test(d)) {
      addTodo(m, 'RESOURCE', 'Fear spend to extend movement before action (per SRD).');
    }
  }
  if (/knocked back|knock(?:s)? back/i.test(d)) {
    addTodo(m, 'MOVEMENT', 'Forced movement range (per SRD).');
  }
  if (/from one shadow to another|through stone and earth|through solid objects/i.test(d)) {
    addTodo(m, 'MOVEMENT', 'Special movement or phasing (per SRD).');
  }
  if (/Climber\b|^Climber/i.test(name)) {
    addTodo(m, 'MOVEMENT', 'Climb speed / vertical movement (per SRD).');
  }
  if (/_Vulnerable_|_Restrained_|_Hidden_|_Glow|_Entranced_|_Guilty_|become(s)? _/i.test(d)) {
    addTodo(m, 'CONDITION', 'Apply/remove conditions on targets (per SRD).');
  }
  if (/summon/i.test(d)) {
    addTodo(m, 'SUMMON', 'Summon placement, tier, and count (per SRD).');
  }
  if (/attack all targets|against two targets|make their standard attack against/i.test(d)) {
    addTodo(m, 'MULTI_TARGET', 'Multi-target or sweep attacks (per SRD).');
  }
  if (/spotlight/i.test(d) && !/^Relentless/i.test(name)) {
    addTodo(m, 'SPOTLIGHT', 'Spotlight/Fear interactions (per SRD).');
  }
  if (/Within (Close|Far|Melee|Very (Close|Far)) range/i.test(d) && /(lose|gain|hope|fear|stress|disadvantage)/i.test(d)) {
    addTodo(m, 'AURA', 'Range-limited effect on PCs (per SRD).');
  }
  if (/environmental damage|earthquake|avalanche|rubble/i.test(d)) {
    addTodo(m, 'ENVIRONMENT', 'Environmental hazard damage and Restrained from terrain (per SRD).');
  }
  if (/head/i.test(d) && /Hydra|heads?/i.test(d)) {
    addTodo(m, 'HEAD', 'Head count, lose head on Major+ damage, spotlight cap (per SRD).');
  }
  if (/Major or greater damage.*additional hp|additional hp.*physical/i.test(d)) {
    addTodo(m, 'DAMAGE', 'Extra HP marks on threshold (per SRD).');
  }
  if (/construct|zombie hulk|patchwork/i.test(d) && /additional hp/i.test(d)) {
    addTodo(m, 'CONSTRUCT', 'Construct brittle/extra HP rules (per SRD).');
  }
  if (hasChips) {
    addTodo(m, 'TRACK', 'Card chips are UI helpers; remaining mechanics manual unless wired.');
  }

  if (m.size === 0) {
    addTodo(m, 'SRD', 'Automate or surface each clause in `description` (tag by area: damage, rolls, resources, movement).');
  }

  return [...m.values()];
}

function rewriteFile(path, content) {
  const { name, desc, type, hasAffinities, hasChips } = parseModule(content);
  if (type === 'action') {
    return { changed: false };
  }
  const todos = buildTodos(name, desc, hasAffinities, hasChips);
  const todoBlock = todos.map((t) => ` * TODO PASSIVE [${t.tag}]: ${t.text}`).join('\n');

  const header = `/**\n * Adversary passive — ${name} (SRD)\n *\n${todoBlock}\n */\n`;

  const re = /^\/\*\*[\s\S]*?\*\/\s*\n(?=export\b)/m;
  if (!re.test(content)) {
    console.warn('No JSDoc block found:', path);
    return { changed: false };
  }
  const replaced = content.replace(re, header);
  if (replaced === content) {
    return { changed: false };
  }
  writeFileSync(path, replaced, 'utf8');
  return { changed: true };
}

function main() {
  const files = readdirSync(ADV_DIR).filter((f) => f.endsWith('.js') && f !== 'index.js');
  let changed = 0;
  for (const f of files.sort()) {
    const p = join(ADV_DIR, f);
    const content = readFileSync(p, 'utf8');
    if (rewriteFile(p, content).changed) changed++;
  }
  console.log(`Rewrote JSDoc on ${changed} / ${files.length} files under adversary_features/`);
}

main();
