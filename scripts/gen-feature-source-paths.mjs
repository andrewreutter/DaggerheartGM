/**
 * Generates `src/features-v2/generated/feature-source-paths.js` — maps registry ids / feature names
 * to paths under `src/features-v2/` for the feature source viewer. Run after adding modules:
 *   node scripts/gen-feature-source-paths.mjs
 *
 * After resolving paths from registry keys, `mergeSrdListSlugAliases` duplicates entries under
 * `makeSrdListId(collection, row.name)` so unified library / `/api/srd` ids (from `src/srd/srd-list-ids.js`)
 * match even when hand-authored registry keys differ.
 */

import { readdirSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { makeSrdListId } from '../src/srd/srd-list-ids.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../src/features-v2');
const OUT = join(ROOT, 'generated/feature-source-paths.js');

/**
 * Unified library / `/api/srd` use `makeSrdListId(collection, name)` from row names.
 * Registry keys are hand-authored and can differ from that slug (e.g. apostrophes). Duplicate
 * path entries under the API id so source lookup works for both.
 */
function mergeSrdListSlugAliases(pathById, registrySlice, collection) {
  if (!registrySlice || typeof registrySlice !== 'object') return;
  const additions = {};
  for (const [registryId, filePath] of Object.entries(pathById)) {
    const row = registrySlice[registryId];
    if (!row || typeof row.name !== 'string' || !row.name.trim()) continue;
    const apiId = makeSrdListId(collection, row.name);
    if (apiId === registryId) continue;
    const existing = pathById[apiId] ?? additions[apiId];
    if (existing != null && existing !== filePath) {
      console.warn(
        `[gen-feature-source-paths] SRD list id alias collision (${collection}): "${apiId}" → ${existing} vs ${filePath} (registry ${registryId})`,
      );
      continue;
    }
    additions[apiId] = filePath;
  }
  Object.assign(pathById, additions);
}

function relFeaturesPath(absFile) {
  return relative(ROOT, absFile).replace(/\\/g, '/');
}

function toImportUrl(absPath) {
  return pathToFileURL(absPath).href;
}

async function importModule(absPath) {
  return import(toImportUrl(absPath));
}

async function walkJsFiles(dir, { skip = () => false } = {}) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'generated' || ent.name === 'shared' || ent.name === 'engine') continue;
      out.push(...(await walkJsFiles(p, { skip })));
    } else if (ent.name.endsWith('.js') && !skip(p)) {
      out.push(p);
    }
  }
  return out;
}

async function main() {
  const registry = (await import(toImportUrl(join(ROOT, 'registry.js')))).default;

  const pathByAbilityId = {};
  const abilityFiles = await walkJsFiles(join(ROOT, 'abilities'), {
    skip: (p) => p.endsWith(`${join('abilities', 'index.js')}`) || p.endsWith('abilities/index.js'),
  });
  for (const file of abilityFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.abilities || {}).find((k) => registry.abilities[k] === v);
      if (id) pathByAbilityId[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathByAbilityId, registry.abilities, 'abilities');

  const pathByClassId = {};
  const classFiles = (await walkJsFiles(join(ROOT, 'classes'))).filter(
    (p) => !p.endsWith('classes/index.js'),
  );
  for (const file of classFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.classes || {}).find((k) => {
        const row = registry.classes[k];
        return row?.features?.includes(v) || row?.feature === v;
      });
      if (id) pathByClassId[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathByClassId, registry.classes, 'classes');

  const pathBySubclassId = {};
  const subFiles = (await walkJsFiles(join(ROOT, 'subclasses'))).filter(
    (p) => !p.endsWith('subclasses/index.js'),
  );
  for (const file of subFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.subclasses || {}).find((k) => {
        const row = registry.subclasses[k];
        return row?.features?.includes(v) || row?.feature === v;
      });
      if (id) pathBySubclassId[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathBySubclassId, registry.subclasses, 'subclasses');

  const pathByAncestryKey = {};
  const anFiles = (await walkJsFiles(join(ROOT, 'ancestries'))).filter(
    (p) => !p.endsWith('ancestries/index.js'),
  );
  for (const file of anFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.ancestries || {}).find((k) => registry.ancestries[k] === v);
      if (id) pathByAncestryKey[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathByAncestryKey, registry.ancestries, 'ancestries');

  const pathByCommunityId = {};
  const comFiles = (await walkJsFiles(join(ROOT, 'communities'))).filter(
    (p) => !p.endsWith('communities/index.js'),
  );
  for (const file of comFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.communities || {}).find((k) => {
        const row = registry.communities[k];
        return row?.features?.includes(v) || row?.feature === v;
      });
      if (id) pathByCommunityId[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathByCommunityId, registry.communities, 'communities');

  /** Same array references as in `beastforms/index.js` — avoids ambiguous name matches (e.g. shared "Aquatic"). */
  const { BEASTFORM_FEATURE_LISTS } = await import(toImportUrl(join(ROOT, 'beastforms/index.js')));
  const pathByBeastformId = {};
  const bstFiles = (await walkJsFiles(join(ROOT, 'beastforms'))).filter(
    (p) =>
      !p.endsWith('beastforms/index.js') &&
      !p.endsWith('srd-data.js') &&
      !p.endsWith('marry.js'),
  );
  for (const file of bstFiles) {
    const mod = await importModule(file);
    if (!Array.isArray(mod.features)) continue;
    const hit = Object.entries(BEASTFORM_FEATURE_LISTS).find(([, list]) => list === mod.features);
    if (hit) pathByBeastformId[hit[0]] = relFeaturesPath(file);
  }
  mergeSrdListSlugAliases(pathByBeastformId, registry.beastforms, 'beastforms');

  const pathByItemId = {};
  const itemFiles = (await walkJsFiles(join(ROOT, 'items'))).filter((p) => !p.endsWith('items/index.js'));
  for (const file of itemFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.items || {}).find((k) => {
        const row = registry.items[k];
        if (row === v) return true;
        return row?.features?.includes(v) || row?.feature === v;
      });
      if (id) pathByItemId[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathByItemId, registry.items, 'items');

  const pathByConsumableId = {};
  const consFiles = (await walkJsFiles(join(ROOT, 'consumables'))).filter(
    (p) => !p.endsWith('consumables/index.js'),
  );
  for (const file of consFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object') continue;
      const id = Object.keys(registry.consumables || {}).find((k) => {
        const row = registry.consumables[k];
        if (row === v) return true;
        return row?.features?.includes(v) || row?.feature === v;
      });
      if (id) pathByConsumableId[id] = relFeaturesPath(file);
    }
  }
  mergeSrdListSlugAliases(pathByConsumableId, registry.consumables, 'consumables');

  const pathByWeaponPropertyName = {};
  const wpFiles = (await walkJsFiles(join(ROOT, 'weapon_properties'))).filter(
    (p) => !p.endsWith('weapon_properties/index.js'),
  );
  for (const file of wpFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object' || typeof v.name !== 'string') continue;
      const hit = Object.keys(registry.weapon_properties || {}).find((k) => registry.weapon_properties[k] === v);
      if (hit) pathByWeaponPropertyName[v.name] = relFeaturesPath(file);
    }
  }

  const pathByArmorPropertyName = {};
  const apFiles = (await walkJsFiles(join(ROOT, 'armor_properties'))).filter(
    (p) => !p.endsWith('armor_properties/index.js'),
  );
  for (const file of apFiles) {
    const mod = await importModule(file);
    for (const v of Object.values(mod)) {
      if (!v || typeof v !== 'object' || typeof v.name !== 'string') continue;
      const hit = Object.keys(registry.armor_properties || {}).find((k) => registry.armor_properties[k] === v);
      if (hit) pathByArmorPropertyName[v.name] = relFeaturesPath(file);
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });

  const banner = `// AUTO-GENERATED by scripts/gen-feature-source-paths.mjs — do not edit\n`;

  const body = `${banner}
export const pathByAbilityId = ${JSON.stringify(pathByAbilityId, null, 2)};

export const pathByClassId = ${JSON.stringify(pathByClassId, null, 2)};

export const pathBySubclassId = ${JSON.stringify(pathBySubclassId, null, 2)};

export const pathByAncestryKey = ${JSON.stringify(pathByAncestryKey, null, 2)};

export const pathByCommunityId = ${JSON.stringify(pathByCommunityId, null, 2)};

export const pathByBeastformId = ${JSON.stringify(pathByBeastformId, null, 2)};

export const pathByItemId = ${JSON.stringify(pathByItemId, null, 2)};

export const pathByConsumableId = ${JSON.stringify(pathByConsumableId, null, 2)};

export const pathByWeaponPropertyName = ${JSON.stringify(pathByWeaponPropertyName, null, 2)};

export const pathByArmorPropertyName = ${JSON.stringify(pathByArmorPropertyName, null, 2)};
`;

  writeFileSync(OUT, body, 'utf8');
  console.log('Wrote', OUT);
  console.log(
    'counts:',
    Object.keys(pathByAbilityId).length,
    'abilities',
    Object.keys(pathByClassId).length,
    'classes',
    Object.keys(pathBySubclassId).length,
    'subclasses',
    Object.keys(pathByAncestryKey).length,
    'ancestry',
    Object.keys(pathByCommunityId).length,
    'communities',
    Object.keys(pathByBeastformId).length,
    'beastforms',
    Object.keys(pathByItemId).length,
    'items',
    Object.keys(pathByConsumableId).length,
    'consumables',
    Object.keys(pathByWeaponPropertyName).length,
    'weapon props',
    Object.keys(pathByArmorPropertyName).length,
    'armor props',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
