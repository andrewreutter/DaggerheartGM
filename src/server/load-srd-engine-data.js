/**
 * Cached SRD collections for server-side engine / tooling (same shape as `useCharacterSrdData`).
 */

import { getCollection } from '../srd/index.js';

function buildSrdLookup(items) {
  const byId = {};
  if (!Array.isArray(items)) return byId;
  for (const item of items) {
    if (item?.id) byId[item.id] = item;
  }
  return byId;
}

let srdCache = null;

/** Same shape as `useCharacterSrdData` — cached for the server process. */
export async function loadSrdDataForV2Engine() {
  if (srdCache) return srdCache;
  const [classes, subclasses, ancestries, communities, armor, weapons, abilities, domains, beastforms] =
    await Promise.all([
      getCollection('classes'),
      getCollection('subclasses'),
      getCollection('ancestries'),
      getCollection('communities'),
      getCollection('armor'),
      getCollection('weapons'),
      getCollection('abilities'),
      getCollection('domains'),
      getCollection('beastforms'),
    ]);
  const safe = (arr) => (Array.isArray(arr) ? arr : []);
  srdCache = {
    classes: safe(classes),
    subclasses: safe(subclasses),
    ancestries: safe(ancestries),
    communities: safe(communities),
    armor: safe(armor),
    weapons: safe(weapons),
    abilities: safe(abilities),
    domains: safe(domains),
    beastforms: safe(beastforms),
    classesById: buildSrdLookup(classes),
    subclassesById: buildSrdLookup(subclasses),
    ancestriesById: buildSrdLookup(ancestries),
    communitiesById: buildSrdLookup(communities),
    armorById: buildSrdLookup(armor),
    weaponsById: buildSrdLookup(weapons),
    abilitiesById: buildSrdLookup(abilities),
    domainsById: buildSrdLookup(domains),
    beastformsById: buildSrdLookup(beastforms),
  };
  return srdCache;
}
