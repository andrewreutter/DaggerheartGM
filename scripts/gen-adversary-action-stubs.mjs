/**
 * One-off: generate adversary action stub modules + PASSIVE prefix pass.
 *   node scripts/gen-adversary-action-stubs.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADV_DIR = join(__dirname, '../src/features-v2/adversary_features');
const SRD_PATH = join(__dirname, '../daggerheart-srd/.build/03_json/adversaries.json');

const MAKES_ATTACK_RE = /\bmakes?\b.*?\battack\b/is;
const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const RANGE_IN_ATTACK = /make an attack[^.]{0,160}\b(Melee|Very Close|Close|Far|Very Far)\b/i;
const STANDARD = /standard attack/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

function parseFeatureName(rawName) {
  const s = String(rawName || '');
  const lastDash = s.lastIndexOf(' - ');
  if (lastDash >= 0) {
    const name = s.slice(0, lastDash).trim();
    const typeRaw = s.slice(lastDash + 3).toLowerCase().trim();
    const type = ['action', 'reaction', 'passive'].includes(typeRaw) ? typeRaw : 'passive';
    return { name, type };
  }
  return { name: s.trim(), type: 'passive' };
}

function featText(f) {
  return (f.text || f.description || '').trim();
}

function toExportBase(name) {
  return name
    .replace(/['']/g, '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

let text = readFileSync(SRD_PATH, 'utf8');
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const raw = JSON.parse(text);

const byName = new Map();
for (const row of raw) {
  for (const f of row.feature || []) {
    const { name, type } = parseFeatureName(f.name);
    if (type !== 'action') continue;
    if (!byName.has(name)) byName.set(name, featText(f));
  }
}

function bucket(desc) {
  const rawStr = String(desc || '');
  const attackMatch = ATTACK_DESC_RE.exec(rawStr);
  if (attackMatch) return 'ATTACKSHAPED_RANGE';
  const forceAttack = !attackMatch && MAKES_ATTACK_RE.test(rawStr);
  const dicePatterns = !attackMatch && !forceAttack && rawStr ? [...rawStr.matchAll(DICE_PATTERN_RE)] : [];
  if (forceAttack) {
    const d = rawStr;
    if (
      STANDARD.test(d) ||
      /shared attack|two targets|three targets|all .*within|each\.|Combine this damage/i.test(d)
    ) {
      return 'ATTACKSHAPED_DAMAGE';
    }
    if (RANGE_IN_ATTACK.test(d)) return 'ATTACKSHAPED_RANGE';
    return 'ATTACKSHAPED_DAMAGE';
  }
  if (dicePatterns.length > 0) return 'ACTIONSECONDARY';
  return null;
}

const todoLine = {
  ATTACKSHAPED_RANGE: ' * TODO ATTACKSHAPED RANGE: Descriptor + roll wiring for range-scoped attack actions (see `adversary-roll-descriptors.js`).',
  ATTACKSHAPED_DAMAGE:
    ' * TODO ATTACKSHAPED DAMAGE: Descriptor + roll wiring for standard/multi-target attack actions (see `adversary-roll-descriptors.js`).',
  ACTIONSECONDARY:
    ' * TODO ACTIONSECONDARY clientHoverUseRoll: Secondary dice / saves / pools (`clientHoverUseRoll`, banner chips per authoring guide).',
};

const filesToCreate = [];
for (const [name, desc] of byName) {
  const b = bucket(desc);
  if (!b) continue;
  const exportBase = toExportBase(name);
  filesToCreate.push({
    name,
    exportName: exportBase,
    fileBase: exportBase,
    bucket: b,
    description: desc,
  });
}

filesToCreate.sort((a, b) => a.fileBase.localeCompare(b.fileBase));

for (const item of filesToCreate) {
  const path = join(ADV_DIR, `${item.fileBase}.js`);
  const body = `/**
 * Adversary action — ${item.name} (SRD)
 *
${todoLine[item.bucket]}
 */
export const ${item.exportName} = {
  name: ${JSON.stringify(item.name)},
  type: 'action',
  description: ${JSON.stringify(item.description)},
};
`;
  writeFileSync(path, body, 'utf8');
}

// PASSIVE prefix: all *.js except index
for (const ent of readdirSync(ADV_DIR)) {
  if (!ent.endsWith('.js') || ent === 'index.js') continue;
  const p = join(ADV_DIR, ent);
  let src = readFileSync(p, 'utf8');
  if (src.includes('TODO PASSIVE')) continue;
  const next = src.replace(/\* TODO \[/g, '* TODO PASSIVE [');
  if (next !== src) writeFileSync(p, next, 'utf8');
}

function regenerateAdversaryFeaturesIndex() {
  const files = readdirSync(ADV_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort();
  const rows = [];
  for (const f of files) {
    const src = readFileSync(join(ADV_DIR, f), 'utf8');
    const m = src.match(/export const (\w+) =/);
    if (!m) throw new Error(`No export const in ${f}`);
    rows.push({ file: f, sym: m[1] });
  }
  const header = `/**
 * V2 adversary features — one module per SRD feature name (passive + action stubs).
 * Maintain descriptors in individual \`*.js\` files here; this barrel exports the merged registry.
 */

`;
  const imports = rows.map((e) => `import { ${e.sym} } from './${e.file}';`).join('\n');
  const named = rows.map((e) => e.sym).join(',\n  ');
  const defaultEntries = rows
    .map((e) => {
      if (e.sym === 'OverwhelmReaction') return `  'Overwhelm::reaction': ${e.sym}`;
      return `  [${e.sym}.name]: ${e.sym}`;
    })
    .join(',\n');
  const out = `${header}${imports}

export {
  ${named},
};

export default {
${defaultEntries},
};
`;
  writeFileSync(join(ADV_DIR, 'index.js'), out, 'utf8');
}

regenerateAdversaryFeaturesIndex();

console.log(`Wrote ${filesToCreate.length} action stub files under ${ADV_DIR}`);
console.log(
  'Buckets:',
  Object.fromEntries(
    ['ATTACKSHAPED_RANGE', 'ATTACKSHAPED_DAMAGE', 'ACTIONSECONDARY'].map((k) => [
      k,
      filesToCreate.filter((x) => x.bucket === k).length,
    ])
  )
);
console.log('Regenerated adversary_features/index.js');
