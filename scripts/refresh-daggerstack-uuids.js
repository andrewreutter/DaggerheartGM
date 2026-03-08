#!/usr/bin/env node
/**
 * Refresh the Daggerstack UUID → SRD slug mapping.
 *
 * Fetches the Daggerstack Nuxt JS bundle, extracts UUID+name pairs for all
 * game items (classes, subclasses, ancestries, communities, armor, weapons),
 * matches each to the corresponding SRD item by name, and writes the result
 * to data/daggerstack-uuid-map.json.
 *
 * Usage:
 *   npm run refresh:daggerstack      — run manually
 *
 * The mapping file is committed to git so the server can use it without
 * fetching the bundle at runtime. The nightly cron job in server.js calls
 * refreshDaggerstackUuidMap() to keep the map up to date.
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { getCollection } from '../src/srd/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DAGGERSTACK_BASE = 'https://daggerstack.com';
const MAP_PATH = join(__dirname, '..', 'data', 'daggerstack-uuid-map.json');

// ─── Bundle extraction helpers ────────────────────────────────────────────────

/**
 * Convert a JS object literal string (unquoted keys) to valid JSON.
 */
function jsLiteralToJson(str) {
  return str.replace(/"(?:[^"\\]|\\.)*"|(\b\w+)\s*:/g, (match, key) => {
    if (key) return `"${key}":`;
    return match;
  });
}

/**
 * Extract an array of objects from the bundle by scanning for UUID-shaped id
 * fields, walking backward to find the enclosing '{', forward to find the
 * matching '}', and parsing. Handles both JSON and JS object literal formats.
 */
function extractAllByField(text, field, expectedFields) {
  const results = [];
  const seenIds = new Set();
  const idRe = /"?id"?\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;

  let m;
  while ((m = idRe.exec(text)) !== null) {
    const id = m[1];
    if (seenIds.has(id)) continue;

    let braceCount = 0, objStart = -1;
    for (let i = m.index - 1; i >= Math.max(0, m.index - 5000); i--) {
      if (text[i] === '}') braceCount++;
      else if (text[i] === '{') {
        if (braceCount === 0) { objStart = i; break; }
        braceCount--;
      }
    }
    if (objStart < 0) continue;

    let depth = 0, objEnd = objStart;
    for (let i = objStart; i < Math.min(objStart + 20000, text.length); i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) { objEnd = i + 1; break; }
      }
    }
    if (objEnd <= objStart) continue;

    const slice = text.substring(objStart, objEnd);
    if (!expectedFields.every(f => slice.includes(`"${f}"`) || slice.includes(`${f}:`))) continue;

    try {
      let obj;
      try {
        obj = JSON.parse(slice);
      } catch {
        obj = JSON.parse(jsLiteralToJson(slice));
      }
      if (obj.id && !seenIds.has(obj.id)) {
        seenIds.add(obj.id);
        results.push(obj);
      }
    } catch {
      // ignore parse errors
    }
  }
  return results;
}

/**
 * Extract class data from the minified bundle by evaluating the relevant code
 * block. Class objects use minified variable references for their field values,
 * making JSON parsing impossible — but since we fetched this bundle ourselves,
 * eval is safe and handles any bundler output format changes.
 */
function extractClasses(text) {
  try {
    const storeIdx = text.indexOf('vt("baseClass"');
    if (storeIdx < 0) return [];
    const beforeStore = text.substring(Math.max(0, storeIdx - 500), storeIdx);
    const arrayMatch = beforeStore.match(/,(\w+)=\[([\w,]+)\],(\w+)=$/);
    if (!arrayMatch) return [];
    const arrayVar = arrayMatch[1];

    const classVarNames = arrayMatch[2].split(',');
    const firstClassObjIdx = text.indexOf(classVarNames[0] + '={name:');
    if (firstClassObjIdx < 0) return [];
    const beforeFirst = text.substring(Math.max(0, firstClassObjIdx - 5000), firstClassObjIdx);
    const nameStrIdx = beforeFirst.lastIndexOf('"Bard"');
    if (nameStrIdx < 0) return [];
    const blockStart = (firstClassObjIdx - 5000 < 0 ? 0 : firstClassObjIdx - 5000)
      + beforeFirst.lastIndexOf(',', nameStrIdx) + 1;

    const arrayLiteral = arrayVar + '=[' + arrayMatch[2] + ']';
    const arrayIdx = text.indexOf(arrayLiteral, firstClassObjIdx);
    if (arrayIdx < 0) return [];
    const blockEnd = arrayIdx + arrayLiteral.length;

    const code = text.substring(blockStart, blockEnd);
    const fn = new Function('var ' + code + '; return ' + arrayVar + ';');
    return fn();
  } catch (err) {
    console.warn('[daggerstack-uuid] extractClasses failed:', err.message);
    return [];
  }
}

/**
 * Find the UUID for a known item name by searching the bundle for the name
 * string and extracting the nearest UUID.  Used to rescue items that
 * extractAllByField misses due to bundler-specific object layouts.
 * Returns the UUID string, or null if not found.
 */
function findUuidForName(bundle, name, existingUuids) {
  const nameStr = JSON.stringify(name); // e.g. '"Troubadour"'
  const uuidRe = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g;
  let searchFrom = 0;
  let pos;
  while ((pos = bundle.indexOf(nameStr, searchFrom)) !== -1) {
    // Look for a UUID in the 2000 chars immediately before the name occurrence
    const before = bundle.substring(Math.max(0, pos - 2000), pos);
    const uuids = [...before.matchAll(uuidRe)].map(m => m[1]);
    // Take the last (closest) UUID before the name that isn't already mapped elsewhere
    for (let i = uuids.length - 1; i >= 0; i--) {
      const uuid = uuids[i];
      if (!existingUuids.has(uuid)) return uuid;
    }
    searchFrom = pos + nameStr.length;
  }
  return null;
}

/**
 * Fetch the Daggerstack bundle and extract UUID+name items for all collections.
 * Returns { classes, subclasses, ancestries, communities, armors, weapons }.
 */
async function fetchBundleItems() {
  const buildResp = await fetch(`${DAGGERSTACK_BASE}/_nuxt/builds/latest.json`);
  if (!buildResp.ok) throw new Error(`Could not fetch builds/latest.json: HTTP ${buildResp.status}`);
  const buildInfo = await buildResp.json();
  console.log(`[daggerstack-uuid] Build ID: ${buildInfo.id}`);

  const htmlResp = await fetch(`${DAGGERSTACK_BASE}/auth/login`);
  if (!htmlResp.ok) throw new Error(`Could not fetch login page: HTTP ${htmlResp.status}`);
  const html = await htmlResp.text();
  const importmapMatch = html.match(/<script type="importmap">([^<]+)<\/script>/);
  if (!importmapMatch) throw new Error('Could not find importmap in Daggerstack HTML');
  const importmap = JSON.parse(importmapMatch[1]);
  const entryUrl = DAGGERSTACK_BASE + importmap.imports['#entry'];

  console.log(`[daggerstack-uuid] Fetching bundle: ${entryUrl}`);
  const bundleResp = await fetch(entryUrl);
  if (!bundleResp.ok) throw new Error(`Could not fetch bundle: HTTP ${bundleResp.status}`);
  const bundle = await bundleResp.text();
  console.log(`[daggerstack-uuid] Bundle size: ${(bundle.length / 1024).toFixed(0)} KB`);

  const subclasses  = extractAllByField(bundle, 'spellcast', ['id', 'name', 'class', 'foundation']);
  const ancestries  = extractAllByField(bundle, 'features',  ['id', 'name', 'features', 'description']);
  const communities = extractAllByField(bundle, 'features',  ['id', 'name', 'features', 'description']);
  const armors      = extractAllByField(bundle, 'score',     ['id', 'name', 'score', 'majorThreshold', 'severeThreshold', 'tier']);
  const weapons     = extractAllByField(bundle, 'damage',    ['id', 'name', 'damage', 'trait', 'range', 'damageType']);
  const classes     = extractClasses(bundle);

  return { bundle, bundleItems: { classes, subclasses, ancestries, communities, armors, weapons } };
}

// ─── SRD name index helpers ───────────────────────────────────────────────────

/**
 * Known name discrepancies between Daggerstack's bundle and the SRD.
 * Key: Daggerstack name (lowercase); Value: SRD name (lowercase).
 */
const NAME_OVERRIDES = {
  'inferis':            'infernis',         // Daggerstack omits the 'n'
  'double-ended sword': 'dual-ended sword', // Daggerstack uses "Double", SRD uses "Dual"
};

/** Build a case-insensitive name → SRD item index for fast lookups. */
function buildNameIndex(items) {
  const index = {};
  for (const item of (items || [])) {
    if (item.name) index[item.name.toLowerCase()] = item;
  }
  return index;
}

/** Resolve a Daggerstack item name to the correct SRD index entry. */
function lookupByName(name, index) {
  const lower = name.toLowerCase();
  const canonical = NAME_OVERRIDES[lower] || lower;
  return index[canonical] || null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch the Daggerstack bundle, match items to SRD by name, and write the
 * UUID map to data/daggerstack-uuid-map.json.
 *
 * Exported for use by the nightly cron job in server.js.
 *
 * @returns {Promise<object>} The new UUID map.
 */
export async function refreshDaggerstackUuidMap() {
  const { bundle, bundleItems } = await fetchBundleItems();

  // Load SRD collections for name-matching
  // Note: the SRD parser uses 'armor' (singular); Daggerstack uses 'armors'
  const [srdClasses, srdSubclasses, srdAncestries, srdCommunities, srdArmor, srdWeapons] =
    await Promise.all([
      getCollection('classes'),
      getCollection('subclasses'),
      getCollection('ancestries'),
      getCollection('communities'),
      getCollection('armor'),
      getCollection('weapons'),
    ]);

  const indices = {
    classes:     buildNameIndex(srdClasses),
    subclasses:  buildNameIndex(srdSubclasses),
    ancestries:  buildNameIndex(srdAncestries),
    communities: buildNameIndex(srdCommunities),
    armor:       buildNameIndex(srdArmor),
    weapons:     buildNameIndex(srdWeapons),
  };

  // Mapping: Daggerstack extraction key → SRD collection name
  const COLLECTION_MAP = [
    { dsKey: 'classes',     srdCollection: 'classes'     },
    { dsKey: 'subclasses',  srdCollection: 'subclasses'  },
    { dsKey: 'ancestries',  srdCollection: 'ancestries'  },
    { dsKey: 'communities', srdCollection: 'communities' },
    { dsKey: 'armors',      srdCollection: 'armor'       },
    { dsKey: 'weapons',     srdCollection: 'weapons'     },
  ];

  const map = {};
  const unmatched = [];

  for (const { dsKey, srdCollection } of COLLECTION_MAP) {
    const dsItems = bundleItems[dsKey] || [];
    const index = indices[srdCollection];

    for (const item of dsItems) {
      if (!item.id || !item.name) continue;
      const srdItem = lookupByName(item.name, index);
      if (srdItem) {
        map[item.id] = { srdId: srdItem.id, collection: srdCollection, name: item.name };
      } else {
        unmatched.push({ collection: srdCollection, name: item.name, id: item.id });
      }
    }
  }

  // ── Rescue pass: find UUIDs for SRD subclasses not yet matched ─────────────
  // Some subclasses don't have the 'class' field and are missed by the main
  // extraction. For each still-missing SRD subclass, search the bundle for the
  // subclass name and extract the nearest UUID.
  const mappedSrdIds = new Set(Object.values(map).map(e => e.srdId));
  const mappedUuids = new Set(Object.keys(map));
  let rescued = 0;

  for (const srdSubclass of (srdSubclasses || [])) {
    if (mappedSrdIds.has(srdSubclass.id)) continue; // already mapped
    const uuid = findUuidForName(bundle, srdSubclass.name, mappedUuids);
    if (uuid) {
      map[uuid] = { srdId: srdSubclass.id, collection: 'subclasses', name: srdSubclass.name };
      mappedUuids.add(uuid);
      rescued++;
      console.log(`[daggerstack-uuid] Rescued subclass: ${srdSubclass.name}`);
    } else {
      console.warn(`[daggerstack-uuid] Could not find UUID for subclass: ${srdSubclass.name}`);
    }
  }

  // Safety check: warn if any previously-mapped UUID disappeared
  let existing = {};
  try {
    const raw = await readFile(MAP_PATH, 'utf8');
    existing = JSON.parse(raw);
  } catch { /* no existing map is fine */ }

  const disappeared = Object.keys(existing).filter(uuid => !map[uuid]);
  if (disappeared.length > 0) {
    console.warn(`[daggerstack-uuid] WARNING: ${disappeared.length} previously-mapped UUID(s) not found in new extraction:`);
    for (const uuid of disappeared) {
      console.warn(`  - ${uuid}: ${existing[uuid].collection}/${existing[uuid].name}`);
    }
  }

  await writeFile(MAP_PATH, JSON.stringify(map, null, 2));

  const matched = Object.keys(map).length;
  console.log(`[daggerstack-uuid] Done. Mapped: ${matched} (including ${rescued} rescued), Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) {
    // Filter out known false positives (beastforms, subclasses, and cross-collection
    // matches) to keep the warning actionable — only show items that could
    // genuinely be referenced by a player character UUID.
    const genuineUnmatched = unmatched.filter(u =>
      !bundleItems.subclasses.some(s => s.name === u.name) &&
      !bundleItems.ancestries.some(a => a.name === u.name && u.collection === 'communities') &&
      !bundleItems.communities.some(c => c.name === u.name && u.collection === 'ancestries')
    );
    if (genuineUnmatched.length > 0) {
      console.warn('[daggerstack-uuid] Unmatched items (not in SRD):',
        genuineUnmatched.map(u => `${u.collection}/${u.name}`).join(', '));
    }
  }

  return map;
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1] === __filename) {
  refreshDaggerstackUuidMap().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('[daggerstack-uuid] Failed:', err.message);
    process.exit(1);
  });
}
