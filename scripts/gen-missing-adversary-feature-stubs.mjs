/**
 * Creates registry modules for SRD adversary features that are not yet present under
 * `src/features-v2/adversary_features/`. The original `gen-adversary-action-stubs.mjs` only
 * emitted actions whose descriptions matched attack/dice heuristics; everything else stayed
 * unmapped in `docs/adversary-feature-todo-report.md`.
 *
 *   node scripts/gen-missing-adversary-feature-stubs.mjs
 *
 * Then: `node scripts/apply-adversary-feature-todos.mjs` (optional normalize) and
 * `npm run report:adversary-feature-todos`.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'node:vm';
import { buildAdversaryFeatureTodoLines } from './lib/adversary-feature-todo-builder.mjs';

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

function featureLookupKey(name, type) {
  return `${name}::${type ?? 'passive'}`;
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

function parseExportObject(content) {
  const m = content.match(/export const (\w+)\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if (!m) return null;
  try {
    const obj = vm.runInNewContext(`(${m[2]})`, Object.create(null), { timeout: 500 });
    return { exportName: m[1], obj };
  } catch {
    return null;
  }
}

function loadRegistryKeys() {
  /** @type {Map<string, string>} key -> file */
  const map = new Map();
  for (const f of readdirSync(ADV_DIR)) {
    if (!f.endsWith('.js') || f === 'index.js') continue;
    const content = readFileSync(join(ADV_DIR, f), 'utf8');
    const parsed = parseExportObject(content);
    if (!parsed?.obj?.name) continue;
    const t = parsed.obj.type ?? 'passive';
    map.set(featureLookupKey(parsed.obj.name, t), f);
  }
  return map;
}

function titleForType(type) {
  if (type === 'action') return 'action';
  if (type === 'reaction') return 'reaction';
  return 'passive';
}

function regenerateIndex() {
  const files = readdirSync(ADV_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort();
  const rows = [];
  for (const f of files) {
    const content = readFileSync(join(ADV_DIR, f), 'utf8');
    const parsed = parseExportObject(content);
    if (!parsed) {
      throw new Error(`Cannot parse ${f}`);
    }
    rows.push({ file: f, sym: parsed.exportName });
  }
  const header = `/**
 * V2 adversary features — one module per SRD feature name (passive + action + reaction stubs).
 * Maintain descriptors in individual \`*.js\` files here; this barrel exports the merged registry.
 * Registry keys are \`descriptor.name\` except \`Overwhelm::reaction\` (name collision with passive).
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

function main() {
  let text = readFileSync(SRD_PATH, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) throw new Error('adversaries.json: expected array');

  /** @type {Map<string, { description: string }>} */
  const srdFeatures = new Map();
  for (const row of raw) {
    for (const f of row.feature || []) {
      const { name, type } = parseFeatureName(f?.name);
      if (!name) continue;
      const key = featureLookupKey(name, type);
      if (!srdFeatures.has(key)) {
        srdFeatures.set(key, { description: featText(f) });
      }
    }
  }

  const registry = loadRegistryKeys();
  const created = [];
  const usedFiles = new Set();

  for (const [key, { description }] of srdFeatures) {
    if (registry.has(key)) continue;

    const type = key.split('::')[1] || 'passive';
    const name = key.slice(0, key.lastIndexOf('::'));

    let exportBase = toExportBase(name);
    if (!exportBase) {
      console.warn('Skip empty export base for key:', key);
      continue;
    }

    let fileBase = exportBase;
    let fileName = `${fileBase}.js`;
    let path = join(ADV_DIR, fileName);

    if (existsSync(path)) {
      const parsed = parseExportObject(readFileSync(path, 'utf8'));
      const existingKey = parsed?.obj
        ? featureLookupKey(parsed.obj.name, parsed.obj.type ?? 'passive')
        : null;
      if (existingKey === key) continue;

      const suffix = type === 'action' ? 'Action' : type === 'reaction' ? 'Reaction' : 'Passive';
      fileBase = `${exportBase}${suffix}`;
      fileName = `${fileBase}.js`;
      path = join(ADV_DIR, fileName);
      if (existsSync(path)) {
        console.warn(`Collision, skipping ${key} → ${fileName}`);
        continue;
      }
    }

    if (usedFiles.has(fileName)) {
      console.warn(`Filename already used in this run: ${fileName} (${key})`);
      continue;
    }
    usedFiles.add(fileName);

    const todoLines = buildAdversaryFeatureTodoLines({
      name,
      type,
      description,
      hasAffinities: false,
      hasChips: false,
    });
    const todoBlock = todoLines.join('\n');
    const header = `/**
 * Adversary ${titleForType(type)} — ${name} (SRD)
 *
${todoBlock}
 */
`;

    const body = `${header}export const ${fileBase} = {
  name: ${JSON.stringify(name)},
  type: ${JSON.stringify(type)},
  description: ${JSON.stringify(description)},
};
`;

    writeFileSync(path, body, 'utf8');
    created.push({ key, fileName });
  }

  if (created.length === 0) {
    console.log('No missing SRD features; registry already complete.');
    return;
  }

  regenerateIndex();
  console.log(`Created ${created.length} stub(s):`);
  for (const c of created) console.log(`  ${c.key} → ${c.fileName}`);
  console.log('Regenerated adversary_features/index.js');
}

main();
