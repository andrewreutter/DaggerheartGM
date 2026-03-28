/**
 * Creates `src/features-v2/adversary_features/*Reaction.js` (or PascalCase) for each unique
 * SRD reaction feature. `Overwhelm` reaction uses `OverwhelmReaction.js` (passive `Overwhelm.js` exists).
 * Run `node scripts/apply-adversary-feature-todos.mjs` after to fill JSDoc TODOs.
 *
 *   node scripts/gen-adversary-reaction-stubs.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADV_DIR = join(__dirname, '../src/features-v2/adversary_features');
const SRD_PATH = join(__dirname, '../daggerheart-srd/.build/03_json/adversaries.json');

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
    if (type !== 'reaction') continue;
    if (!byName.has(name)) byName.set(name, featText(f));
  }
}

let n = 0;
for (const [name, desc] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const isOverwhelm = name === 'Overwhelm';
  const exportName = isOverwhelm ? 'OverwhelmReaction' : toExportBase(name);
  const fileBase = isOverwhelm ? 'OverwhelmReaction' : toExportBase(name);
  const path = join(ADV_DIR, `${fileBase}.js`);
  if (existsSync(path)) continue;
  const body = `/**
 * Adversary reaction — ${name} (SRD)
 *
 * TODO REACTION [PLACEHOLDER]: Run scripts/apply-adversary-feature-todos.mjs to expand.
 */
export const ${exportName} = {
  name: ${JSON.stringify(name)},
  type: 'reaction',
  description: ${JSON.stringify(desc)},
};
`;
  writeFileSync(path, body, 'utf8');
  n++;
}
console.log(`Created ${n} new reaction stub(s) (${byName.size} unique reaction names total).`);
