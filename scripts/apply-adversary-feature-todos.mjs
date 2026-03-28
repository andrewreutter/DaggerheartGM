/**
 * Rewrites JSDoc TODO blocks on every `src/features-v2/adversary_features/*.js` (except index)
 * using SRD-taxonomized tags. Parses each module with `vm` to read `name`, `type`, `description`.
 *
 *   node scripts/apply-adversary-feature-todos.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'node:vm';
import { buildAdversaryFeatureTodoLines } from './lib/adversary-feature-todo-builder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADV_DIR = join(__dirname, '../src/features-v2/adversary_features');

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

function titleForType(type) {
  if (type === 'action') return 'action';
  if (type === 'reaction') return 'reaction';
  return 'passive';
}

function rewriteFile(path, content) {
  const parsed = parseExportObject(content);
  if (!parsed) {
    console.warn('Could not parse export:', path);
    return false;
  }
  const { obj } = parsed;
  const name = obj.name ?? '';
  const type = obj.type ?? 'passive';
  const description = obj.description ?? '';
  const hasAffinities = !!obj.damageAffinities;
  const hasChips = Array.isArray(obj.chips) && obj.chips.length > 0;
  const adversaryAuraReminder =
    typeof obj.adversaryAuraReminder === 'string' ? obj.adversaryAuraReminder : undefined;

  const todoLines = buildAdversaryFeatureTodoLines({
    name,
    type,
    description,
    hasAffinities,
    hasChips,
    adversaryAuraReminder,
  });
  const todoBlock = todoLines.join('\n');
  const header = `/**\n * Adversary ${titleForType(type)} — ${name} (SRD)\n *\n${todoBlock}\n */\n`;

  const re = /^\/\*\*[\s\S]*?\*\/\s*\n(?=export\b)/m;
  if (!re.test(content)) {
    console.warn('No JSDoc block found:', path);
    return false;
  }
  const replaced = content.replace(re, header);
  if (replaced === content) return false;
  writeFileSync(path, replaced, 'utf8');
  return true;
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
    const { exportName } = parsed;
    rows.push({ file: f, sym: exportName });
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
  const files = readdirSync(ADV_DIR).filter((f) => f.endsWith('.js') && f !== 'index.js');
  let changed = 0;
  for (const f of files.sort()) {
    const p = join(ADV_DIR, f);
    const content = readFileSync(p, 'utf8');
    if (rewriteFile(p, content)) changed++;
  }
  regenerateIndex();
  console.log(`Rewrote JSDoc on ${changed} / ${files.length} files; regenerated index.js`);
}

main();
