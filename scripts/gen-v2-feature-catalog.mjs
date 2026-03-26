/**
 * Emits `src/features-v2/generated/feature-catalog.json` — one row per V2 feature instance
 * derived from `src/features-v2/registry.js`. Run after registry changes:
 *   node scripts/gen-v2-feature-catalog.mjs
 *
 * Each row's `tier` matches the source SRD row when that source has a tier (or a clear
 * tier band — subclasses foundation/spec/mastery, abilities via spell level → PC tier).
 */

import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { makeSrdListId } from '../src/srd/srd-list-ids.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src/features-v2/generated/feature-catalog.json');

/** Same bands as `tierFromLevel` in character-calc (spell level → minimum PC tier). */
function tierFromLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return null;
  if (n >= 8) return 4;
  if (n >= 5) return 3;
  if (n >= 2) return 2;
  return 1;
}

function normFeatureName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveCatalogTier(scope, parentId, featName, getItem) {
  try {
    if (scope === 'subclasses') {
      const sub = await getItem('subclasses', parentId);
      if (!sub) return null;
      const fn = normFeatureName(featName);
      const buckets = [
        [sub.foundation_features, 1],
        [sub.specialization_features, 2],
        [sub.mastery_features, 3],
      ];
      for (const [arr, tier] of buckets) {
        if (!Array.isArray(arr)) continue;
        for (const f of arr) {
          if (normFeatureName(f.name) === fn) return tier;
        }
      }
      return null;
    }
    if (scope === 'abilities') {
      const ab = await getItem('abilities', parentId);
      if (!ab || ab.level == null || ab.level === '') return null;
      return tierFromLevel(ab.level);
    }
    if (scope === 'beastforms') {
      const bf = await getItem('beastforms', parentId);
      if (!bf || bf.tier == null || bf.tier === '') return null;
      const t = Number(bf.tier);
      return Number.isFinite(t) && t >= 1 ? t : null;
    }
  } catch {
    return null;
  }
  return null;
}

function slugPart(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'x';
}

/**
 * @param {object} row — registry row (class, beastform, item, …)
 * @returns {object[]}
 */
function gatherFeatureObjectsFromRow(row) {
  if (!row || typeof row !== 'object') return [];
  let list = Array.isArray(row.features)
    ? row.features
    : row.feature
      ? Array.isArray(row.feature)
        ? row.feature
        : [row.feature]
      : [];
  if (
    list.length === 0 &&
    (row.hooks != null || row.chips != null || row.passiveStatMods != null || row.when != null) &&
    typeof row.name === 'string'
  ) {
    list = [row];
  }
  if (
    list.length === 0 &&
    typeof row.name === 'string' &&
    typeof row.description === 'string' &&
    row.features === undefined &&
    row.feature == null
  ) {
    list = [row];
  }
  return list.filter(f => f && typeof f === 'object' && typeof f.name === 'string');
}

async function pushCatalogRow(rows, scope, parentId, parentName, feat, usedIds, getItem) {
  const name = feat.name.trim() || 'Unnamed';
  const base = `v2feat:${scope}:${slugPart(parentId)}:${slugPart(name)}`;
  let id = base;
  let n = 1;
  while (usedIds.has(id)) {
    id = `${base}-${n++}`;
  }
  usedIds.add(id);

  const description = typeof feat.description === 'string' ? feat.description : '';

  const tier = await resolveCatalogTier(scope, parentId, name, getItem);

  /** @type {Record<string, unknown>} */
  const row = {
    id,
    name,
    description,
    _scope: scope,
    _parentId: parentId,
    _parentName: parentName,
    _source: 'v2',
    clone_count: 0,
    play_count: 0,
  };
  if (tier != null) row.tier = tier;

  if (scope === 'weapon_properties') {
    row._resolveV2 = { _source: 'weapon_property', name };
  } else if (scope === 'armor_properties') {
    row._resolveV2 = { _source: 'armor_property', name };
  } else if (scope === 'ancestries') {
    row._resolveV2 = { _sourceScopeKey: `ancestries:${parentId}`, name };
  } else if (scope === 'classes' || scope === 'subclasses' || scope === 'communities') {
    row._resolveV2 = { _sourceScopeKey: `${scope}:${parentId}`, name };
  } else if (scope === 'abilities') {
    row._resolveV2 = { _sourceScopeKey: `abilities:${parentId}`, name };
  } else if (scope === 'beastforms') {
    row._resolveV2 = { _sourceScopeKey: `beastforms:${parentId}`, name };
  } else if (scope === 'items') {
    row._resolveV2 = { _sourceScopeKey: `items:${parentId}`, name };
  } else if (scope === 'consumables') {
    row._resolveV2 = { _sourceScopeKey: `consumables:${parentId}`, name };
  }

  rows.push(row);
}

async function main() {
  const { default: registry } = await import(join(ROOT, 'src/features-v2/registry.js'));
  const { warmCache, getItem } = await import(join(ROOT, 'src/srd/index.js'));
  await warmCache();

  const rows = [];
  const usedIds = new Set();

  async function walkKeyedFeatures(scope, entries) {
    for (const [parentId, row] of Object.entries(entries)) {
      const parentName =
        row && typeof row === 'object' && typeof row.name === 'string'
          ? row.name
          : parentId;
      const feats = gatherFeatureObjectsFromRow(row);
      for (const f of feats) {
        await pushCatalogRow(rows, scope, parentId, parentName, f, usedIds, getItem);
      }
    }
  }

  await walkKeyedFeatures('classes', registry.classes || {});
  await walkKeyedFeatures('subclasses', registry.subclasses || {});
  await walkKeyedFeatures('communities', registry.communities || {});

  for (const [parentId, feat] of Object.entries(registry.ancestries || {})) {
    if (!feat || typeof feat !== 'object') continue;
    const ancestryTag = parentId.includes('.') ? parentId.split('.')[0] : parentId;
    await pushCatalogRow(rows, 'ancestries', parentId, ancestryTag, feat, usedIds, getItem);
  }

  for (const [propName, feat] of Object.entries(registry.weapon_properties || {})) {
    if (!feat || typeof feat !== 'object' || typeof feat.name !== 'string') continue;
    await pushCatalogRow(rows, 'weapon_properties', propName, propName, feat, usedIds, getItem);
  }

  for (const [propName, feat] of Object.entries(registry.armor_properties || {})) {
    if (!feat || typeof feat !== 'object' || typeof feat.name !== 'string') continue;
    await pushCatalogRow(rows, 'armor_properties', propName, propName, feat, usedIds, getItem);
  }

  for (const [abilityId, row] of Object.entries(registry.abilities || {})) {
    if (!row || typeof row !== 'object') continue;
    // One catalog row per ability: barrel may register legacy slug aliases alongside makeSrdListId keys.
    if (typeof row.name === 'string') {
      const canon = makeSrdListId('abilities', row.name);
      if (abilityId !== canon) continue;
    }
    const parentName = typeof row.name === 'string' ? row.name : abilityId;
    const feats = gatherFeatureObjectsFromRow(row);
    const list = feats.length > 0 ? feats : typeof row.name === 'string' ? [row] : [];
    for (const f of list) {
      await pushCatalogRow(rows, 'abilities', abilityId, parentName, f, usedIds, getItem);
    }
  }

  for (const [bfId, row] of Object.entries(registry.beastforms || {})) {
    if (!row || typeof row !== 'object') continue;
    const parentName = typeof row.name === 'string' ? row.name : bfId;
    const feats = gatherFeatureObjectsFromRow(row);
    for (const f of feats) {
      await pushCatalogRow(rows, 'beastforms', bfId, parentName, f, usedIds, getItem);
    }
  }

  for (const [itemId, row] of Object.entries(registry.items || {})) {
    if (!row || typeof row !== 'object') continue;
    const parentName = typeof row.name === 'string' ? row.name : itemId;
    const feats = gatherFeatureObjectsFromRow(row);
    for (const f of feats) {
      await pushCatalogRow(rows, 'items', itemId, parentName, f, usedIds, getItem);
    }
  }

  for (const [cId, row] of Object.entries(registry.consumables || {})) {
    if (!row || typeof row !== 'object') continue;
    const parentName = typeof row.name === 'string' ? row.name : cId;
    const feats = gatherFeatureObjectsFromRow(row);
    for (const f of feats) {
      await pushCatalogRow(rows, 'consumables', cId, parentName, f, usedIds, getItem);
    }
  }

  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ generated: true, rows }, null, 2)}\n`, 'utf8');
  console.log(`[gen-v2-feature-catalog] wrote ${rows.length} rows → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
