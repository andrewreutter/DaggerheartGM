/**
 * Scans `src/features-v2/adversary_features/*.js` for `* TODO …` JSDoc lines and
 * `daggerheart-srd/.build/03_json/adversaries.json` for statblock coverage.
 *
 * Writes `docs/adversary-feature-todo-report.md`.
 *
 *   node scripts/gen-adversary-feature-todo-report.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'node:vm';
import { makeSrdListId } from '../src/srd/srd-list-ids.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ADV_DIR = join(ROOT, 'src/features-v2/adversary_features');
const SRD_ADV = join(ROOT, 'daggerheart-srd/.build/03_json/adversaries.json');
const OUT = join(ROOT, 'docs/adversary-feature-todo-report.md');

/** Unique registry modules listed per taxonomy row (alphabetical); "+N more" when truncated. */
const MAX_TAXONOMY_EXAMPLES = 4;

/** Same as `parseFeatureName` in `src/srd/parser.js` / inventory scripts. */
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

function parseExportObject(content) {
  const m = content.match(/export const \w+\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if (!m) return null;
  try {
    return vm.runInNewContext(`(${m[1]})`, Object.create(null), { timeout: 400 });
  } catch {
    return null;
  }
}

function countTodoLines(content) {
  return (content.match(/^\s*\*\s*TODO\s+/gm) || []).length;
}

function main() {
  const files = readdirSync(ADV_DIR)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort();

  /** @type {Map<string, { file: string, name: string, type: string, todoCount: number }>} */
  const byKey = new Map();
  /** @type {Map<string, number>} */
  const taxonomyTotal = new Map();
  /** @type {Map<string, Set<string>>} */
  const taxonomyExamples = new Map();

  for (const f of files) {
    const content = readFileSync(join(ADV_DIR, f), 'utf8');
    const obj = parseExportObject(content);
    if (!obj || obj.name == null) continue;
    const t = obj.type ?? 'passive';
    const key = featureLookupKey(obj.name, t);
    const todoCount = countTodoLines(content);
    const exampleLabel = `${obj.name} (${t})`;
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*\*\s*TODO\s+(\w+)\s+\[([^\]]+)\]\s*:/);
      if (!m) continue;
      const taxKey = `${m[1]} [${m[2]}]`;
      taxonomyTotal.set(taxKey, (taxonomyTotal.get(taxKey) ?? 0) + 1);
      if (!taxonomyExamples.has(taxKey)) taxonomyExamples.set(taxKey, new Set());
      taxonomyExamples.get(taxKey).add(exampleLabel);
    }
    byKey.set(key, { file: f, name: obj.name, type: t, todoCount });
  }

  let text = readFileSync(SRD_ADV, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const adversaries = JSON.parse(text);
  if (!Array.isArray(adversaries)) throw new Error('adversaries.json: expected array');

  const featuresNoTodos = [];
  for (const [, info] of [...byKey.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    if (info.todoCount === 0) {
      featuresNoTodos.push(`${info.name} (${info.type}) — \`${info.file}\``);
    }
  }

  const adversariesWithAllFeaturesClear = [];
  const adversariesWithMissingModule = [];
  const adversariesWithNoFeatures = [];
  /** @type {Set<string>} */
  const unmappedKeys = new Set();
  let totalFeatureRefs = 0;
  let mappedFeatureRefs = 0;
  let unmappedFeatureRefs = 0;

  for (const row of adversaries) {
    const advName = row.name || '';
    const advId = makeSrdListId('adversaries', advName);
    const feats = row.feature;
    if (!Array.isArray(feats) || feats.length === 0) {
      adversariesWithNoFeatures.push(`${advName} (\`${advId}\`)`);
      continue;
    }
    const missing = [];
    let maxTodos = 0;
    let anyTodo = false;
    for (const raw of feats) {
      const { name, type } = parseFeatureName(raw?.name);
      if (!name) continue;
      totalFeatureRefs += 1;
      const key = featureLookupKey(name, type);
      const mod = byKey.get(key);
      if (!mod) {
        missing.push(`${name} (${type})`);
        unmappedKeys.add(key);
        unmappedFeatureRefs += 1;
        continue;
      }
      mappedFeatureRefs += 1;
      if (mod.todoCount > 0) anyTodo = true;
      maxTodos = Math.max(maxTodos, mod.todoCount);
    }
    if (missing.length > 0) {
      adversariesWithMissingModule.push({
        advName,
        advId,
        missing,
      });
    } else if (!anyTodo) {
      adversariesWithAllFeaturesClear.push(`${advName} (\`${advId}\`)`);
    }
  }

  const taxonomySorted = [...taxonomyTotal.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const totalTodoLines = [...taxonomyTotal.values()].reduce((a, b) => a + b, 0);
  const totalModules = byKey.size;
  const modulesWithTodos = [...byKey.values()].filter((x) => x.todoCount > 0).length;
  const topTax = taxonomySorted[0];
  const topTaxonomyHint = topTax
    ? `**Largest taxonomy bucket (batch target):** \`${topTax[0]}\` (${topTax[1]} TODO lines). Implementing one shared pattern for this tag often clears many modules at once.`
    : '_No TODO taxonomy lines — nothing to batch._';

  const generatedAt = new Date().toISOString();

  const md = `<!-- Generated by scripts/gen-adversary-feature-todo-report.mjs — do not edit by hand. -->
# Adversary feature TODO burndown

Generated: **${generatedAt}**

Source: \`src/features-v2/adversary_features/*.js\` (JSDoc \`* TODO …\` lines) and SRD \`daggerheart-srd/.build/03_json/adversaries.json\`.

## Summary

| Metric | Value |
| --- | ---: |
| Registry modules (excl. \`index.js\`) | ${totalModules} |
| Modules with ≥1 TODO line | ${modulesWithTodos} |
| Modules with **zero** TODO lines | ${totalModules - modulesWithTodos} |
| **Total TODO lines** (all modules) | ${totalTodoLines} |
| SRD adversary statblocks | ${adversaries.length} |
| SRD feature references (name+type rows across statblocks) | ${totalFeatureRefs} |
| **Mapped** feature references (registry module exists for \`name::type\`) | ${mappedFeatureRefs} |
| **Unmapped** feature references (no module — see section below) | ${unmappedFeatureRefs} |
| Unique unmapped \`name::type\` keys | ${unmappedKeys.size} |

## Counts by taxonomy

Each line is \`* TODO <scope> [<tag>]: …\`. Counts are **line occurrences** (a module can contribute multiple lines to the same taxonomy). **Examples** list up to ${MAX_TAXONOMY_EXAMPLES} **distinct** registry features (alphabetical by \`name (type)\`); \`(+N more)\` means additional modules share that tag.

| Taxonomy | Count | Examples |
| --- | ---: | --- |
${taxonomySorted
  .map(([k, n]) => {
    const all = [...(taxonomyExamples.get(k) ?? [])].sort((a, b) => a.localeCompare(b));
    const shown = all.slice(0, MAX_TAXONOMY_EXAMPLES);
    const rest = all.length - shown.length;
    const examplesCell =
      shown.length === 0
        ? '—'
        : `${shown.map((x) => `\`${x}\``).join(', ')}${rest > 0 ? ` _(+${rest} more)_` : ''}`;
    return `| \`${k}\` | ${n} | ${examplesCell} |`;
  })
  .join('\n')}

${taxonomySorted.length === 0 ? '_No TODO lines found._\n' : ''}

## Features with no remaining TODOs

Modules whose JSDoc contains **no** \`* TODO\` lines (${featuresNoTodos.length} total).

${featuresNoTodos.length ? featuresNoTodos.map((x) => `- ${x}`).join('\n') : '_None — every module still has at least one TODO._'}

## Adversaries with no features with remaining TODOs

Statblocks where **each** feature name+type maps to a registry module and **every** such module has **zero** TODO lines (${adversariesWithAllFeaturesClear.length} total).

${adversariesWithAllFeaturesClear.length ? adversariesWithAllFeaturesClear.map((x) => `- ${x}`).join('\n') : '_None — every statblock still has at least one feature with TODOs (or see missing mappings below)._'}

${adversariesWithNoFeatures.length ? `## Statblocks with no features array\n\n${adversariesWithNoFeatures.map((x) => `- ${x}`).join('\n')}\n` : ''}
${adversariesWithMissingModule.length ? `## Statblocks with unmapped feature names\n\nThese adversaries reference a feature name+type that did not match any scanned module (\`name::type\` key). Add a \`src/features-v2/adversary_features/<Export>.js\` template (or extend stub generators) so the registry covers the name.\n\n${adversariesWithMissingModule.map((x) => `### ${x.advName} (\`${x.advId}\`)\n\n${x.missing.map((m) => `- ${m}`).join('\n')}`).join('\n\n')}\n` : ''}
## How to refresh this report

This file is **generated**. Do not edit it by hand — your changes would be overwritten.

From the repository root:

\`\`\`bash
npm run report:adversary-feature-todos
\`\`\`

Equivalent: \`node scripts/gen-adversary-feature-todo-report.mjs\`

**When to run:** after any change to \`src/features-v2/adversary_features/*.js\` (implementations or JSDoc TODO lines), to \`index.js\`, to stub generators, or after updating the \`daggerheart-srd\` submodule that changes \`adversaries.json\`. Commit the updated \`docs/adversary-feature-todo-report.md\` when metrics move so the next session starts from current numbers.

---

## For the next agent

You are continuing **adversary V2 / Game Table** work. **Primary objective:** complete as many adversary **features** (registry modules) and **statblocks** (all mapped features implemented and TODOs cleared) as possible. Strategic batches are encouraged when they share mechanics.

**Before you do anything else:** run \`npm run report:adversary-feature-todos\` if this file might be stale (or if you are unsure).

**Recommended priorities (maximize coverage per unit of work):**

1. **Unmapped SRD features (${unmappedKeys.size} unique \`name::type\`, ${unmappedFeatureRefs} references)** — ${unmappedFeatureRefs > 0 ? 'If the section *Statblocks with unmapped feature names* above is non-empty, **add or generate stub modules** so every SRD feature resolves in the registry. Until a feature is mapped, no adversary that uses it can ever be "fully done."' : 'None right now — all SRD feature rows map to a module.'}
2. **Batch by taxonomy** — ${topTaxonomyHint}
3. **Clear whole statblocks** — When a module’s TODOs are fully implemented, remove the corresponding \`* TODO …\` lines (or narrow them) in that file only; re-run the report to see adversaries move toward the "no remaining TODOs" lists.
4. **Follow project rules** — \`src/features-v2/adversary_features/TODO_TAGS.md\`, \`.cursor/rules/v2-framework-boundaries.mdc\`, and \`docs/feature-authoring-guide.md\` for engine vs per-feature code.

**Handoff rule:** When you stop, run \`npm run report:adversary-feature-todos\`, commit \`docs/adversary-feature-todo-report.md\`, and leave this file as the single place the **next** agent should open to see progress and what to do next.

---

*Static sections in this file are defined in \`scripts/gen-adversary-feature-todo-report.mjs\`.*
`;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`Total TODO lines: ${totalTodoLines}; taxonomy buckets: ${taxonomySorted.length}`);
  console.log(`Modules with 0 TODOs: ${totalModules - modulesWithTodos}; statblocks all-clear: ${adversariesWithAllFeaturesClear.length}`);
}

main();
