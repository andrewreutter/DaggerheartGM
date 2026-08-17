import { ROLES, ENV_TYPES } from './constants.js';
import { normalizePersistedIncludes } from './library-default-filters.js';

/**
 * Library browse: which collections use unified paginated API + per-tab filter UI.
 * Must match server UNIFIED_COLLECTIONS / SRD_COLLECTION_NAMES order.
 */
export const SRD_UNIFIED_COLLECTIONS = [
  'abilities',
  'adversaries',
  'ancestries',
  'armor',
  'beastforms',
  'campaign_frames',
  'classes',
  'communities',
  'consumables',
  'domains',
  'environments',
  'items',
  'rules',
  'subclasses',
  'weapons',
  'features',
];

/** Read-only SRD collections backed by documents / reference text rather than editable library records. */
export const LIBRARY_READONLY_SRD_COLLECTIONS = new Set([
  'campaign_frames',
  'rules',
]);

/** Library cards/modals should not offer clone for pure reference / generated collections. */
export const LIBRARY_NON_CLONEABLE_COLLECTIONS = new Set([
  'features',
  ...LIBRARY_READONLY_SRD_COLLECTIONS,
]);

/** V2 registry buckets for Library `features` tab scope filter */
export const FEAT_SCOPE_OPTIONS = [
  'classes',
  'subclasses',
  'ancestries',
  'communities',
  'weapon_properties',
  'armor_properties',
  'abilities',
  'beastforms',
  'items',
  'consumables',
];

/** Display label for V2 feature scope filter keys (underscores → spaces, title case). */
export function formatFeatScopeLabel(val) {
  if (val == null || String(val) === '') return '';
  return String(val)
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Library tabs where the user can create a new item and edit/delete own items (Mine).
 * All 13 SRD unified collections plus scenes and adventures.
 * Characters are excluded — they live inside tables, not in the library.
 */
export const LIBRARY_USER_EDITABLE_COLLECTIONS = new Set([
  ...SRD_UNIFIED_COLLECTIONS.filter(c => !LIBRARY_READONLY_SRD_COLLECTIONS.has(c)),
  'scenes',
  'adventures',
]);

/** localStorage key — bumped when default source filters change */
export const LIBRARY_FILTERS_PERSIST_KEY = 'dh_collectionFilters_v2';

/** Single search string shared across all Library collection tabs (see useCollectionSearch `sharedSearchKey`). */
export const LIBRARY_SEARCH_GLOBAL_KEY = 'dh_library_search_query';

/** Source (Mine / All / SRD / …) selection shared across all Library SRD tabs (see useCollectionSearch `sharedIncludesKey`). */
export const LIBRARY_INCLUDES_GLOBAL_KEY = 'dh_library_includes_sources';

/** Read library-wide search string from localStorage (used with `LIBRARY_SEARCH_GLOBAL_KEY`). */
export function readSharedSearchQuery(sharedSearchKey) {
  if (!sharedSearchKey) return '';
  try {
    const g = localStorage.getItem(sharedSearchKey);
    return g != null ? g : '';
  } catch {
    return '';
  }
}

/** Read library-wide `includes` array from localStorage; `null` if unset or invalid (caller keeps per-tab default). */
export function readSharedIncludes(sharedKey) {
  if (!sharedKey) return null;
  try {
    const raw = localStorage.getItem(sharedKey);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return normalizePersistedIncludes(parsed);
  } catch {
    return null;
  }
}

/** SRD domain spell domains (abilities.domain) */
export const ABILITY_DOMAINS = ['Arcana', 'Blade', 'Bone', 'Codex', 'Grace', 'Midnight', 'Sage', 'Splendor', 'Valor'];

export const WEAPON_SLOT_TYPES = ['Primary', 'Secondary'];
export const WEAPON_PHY_MAG = ['Physical', 'Magical'];

/** Spell card levels 1–9 (abilities.level in SRD) */
export const ABILITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * @typedef {object} LibraryFilterTabConfig
 * @property {string} [typeLabel]
 * @property {string[]|null} [typeOptions] - null = hide type row
 * @property {string} [extraTypeLabel]
 * @property {string[]|null} [extraTypeOptions] - second filter row (e.g. Physical/Magical)
 * @property {'tier'|'level'|'none'} [rankMode] - tier 1–4, level 1–9, none
 * @property {boolean} [showIncludeScaled]
 * @property {string} [defaultSort]
 */

/** @type {Record<string, LibraryFilterTabConfig>} */
export const LIBRARY_FILTER_CONFIG = {
  adversaries: { typeLabel: 'Role', typeOptions: ROLES, rankMode: 'tier', showIncludeScaled: true, defaultSort: 'popularity' },
  environments: { typeLabel: 'Type', typeOptions: ENV_TYPES, rankMode: 'tier', defaultSort: 'popularity' },
  abilities: {
    typeLabel: 'Domain',
    typeOptions: ABILITY_DOMAINS,
    rankMode: 'level',
    defaultSort: 'name',
  },
  weapons: {
    typeLabel: 'Slot',
    typeOptions: WEAPON_SLOT_TYPES,
    extraTypeLabel: 'Damage',
    extraTypeOptions: WEAPON_PHY_MAG,
    rankMode: 'tier',
    defaultSort: 'name',
  },
  armor: { typeLabel: '', typeOptions: null, rankMode: 'tier', defaultSort: 'name' },
  beastforms: { typeLabel: '', typeOptions: null, rankMode: 'tier', defaultSort: 'name' },
  campaign_frames: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  ancestries: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  classes: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  communities: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  consumables: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  domains: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  items: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  rules: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  subclasses: { typeLabel: '', typeOptions: null, rankMode: 'none', defaultSort: 'name' },
  features: {
    typeLabel: 'Scope',
    typeOptions: FEAT_SCOPE_OPTIONS,
    rankMode: 'tier',
    defaultSort: 'name',
  },
  /** User + public + official DT starter scenes; denormalized `tier` on the row. */
  scenes: { typeLabel: '', typeOptions: null, rankMode: 'tier', defaultSort: 'popularity' },
};

export function getLibraryFilterConfig(collection) {
  return LIBRARY_FILTER_CONFIG[collection] || { rankMode: 'tier', defaultSort: 'name', typeOptions: null };
}

/** Collections with custom detail panes in ItemDetailModal (not generic JSON) */
export const LIBRARY_CUSTOM_DETAIL_COLLECTIONS = new Set(['adversaries', 'environments', 'scenes', 'adventures']);

/** SRD unified tabs that use the generic structured read-only detail view */
export const LIBRARY_GENERIC_DETAIL_COLLECTIONS = SRD_UNIFIED_COLLECTIONS.filter(
  c => !LIBRARY_CUSTOM_DETAIL_COLLECTIONS.has(c)
);
