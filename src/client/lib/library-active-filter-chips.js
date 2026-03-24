import { getLibraryFilterConfig } from './library-filter-config.js';
import { LIBRARY_DEFAULT_INCLUDES } from './library-default-filters.js';

const SOURCE_LABELS = {
  own: 'Mine',
  srd: 'SRD',
  public: 'Public',
  hod: 'HoD',
  fcg: 'FCG',
};

function includesMatchDefault(includes) {
  const a = [...(includes || [])].sort().join('\0');
  const b = [...LIBRARY_DEFAULT_INCLUDES].sort().join('\0');
  return a === b;
}

function truncateForChip(s, max = 48) {
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Human-readable source selection for chip labels (matches filter bar semantics: [] = All). */
export function formatIncludesForChipLabel(includes) {
  const arr = includes || [];
  if (arr.length === 0) return 'All';
  return arr.map(k => SOURCE_LABELS[k] || k).join(', ');
}

function formatTypeValuesForChip(collection, types) {
  return (types || []).map(val => {
    if (collection === 'adversaries' && typeof val === 'string') {
      return val.charAt(0).toUpperCase() + val.slice(1);
    }
    return String(val);
  }).join(', ');
}

/**
 * One chip per filter *dimension* that differs from defaults. Clicking resets that dimension
 * to `useCollectionSearch` defaults (same as clearing that row in CollectionFilters: sources → Mine+SRD, tier/type → All, etc.).
 *
 * @param {object} filters — `useCollectionSearch` filters
 * @param {string} collection — active library tab id
 * @returns {Array<{ key: string, label: string, kind: string, title?: string }>}
 */
export function getActiveLibraryFilterChipSpecs(filters, collection) {
  const { includes = [], tiers = [], types = [], extraTypes = [], search, includeScaledUp } = filters || {};
  const cfg = getLibraryFilterConfig(collection);
  const chips = [];

  const q = (search || '').trim();
  if (q) {
    const shown = truncateForChip(q);
    chips.push({
      key: 'resetSearch',
      label: `Search: "${shown}"`,
      kind: 'resetSearch',
      title: 'Clear search',
    });
  }

  if (!includesMatchDefault(includes)) {
    const src = formatIncludesForChipLabel(includes);
    chips.push({
      key: 'resetIncludes',
      label: `Source: ${src}`,
      kind: 'resetIncludes',
      title: 'Reset sources to Mine + SRD',
    });
  }

  const rankLabel = cfg.rankMode === 'level' ? 'Level' : cfg.rankMode === 'none' ? null : 'Tier';
  if (rankLabel && tiers.length > 0) {
    const tierStr = [...tiers].sort((a, b) => a - b).join(', ');
    chips.push({
      key: 'resetTier',
      label: `${rankLabel}: ${tierStr}`,
      kind: 'resetTier',
      title: `Reset ${rankLabel.toLowerCase()} filter (all tiers)`,
    });
  }

  const typeLab = (cfg.typeLabel || '').trim() || 'Type';
  if (cfg.typeOptions && cfg.typeOptions.length > 0 && types.length > 0) {
    const typeStr = formatTypeValuesForChip(collection, types);
    chips.push({
      key: 'resetType',
      label: `${typeLab}: ${typeStr}`,
      kind: 'resetType',
      title: `Reset ${typeLab.toLowerCase()} filter`,
    });
  }

  const extraLab = (cfg.extraTypeLabel || '').trim() || 'Extra';
  if (cfg.extraTypeOptions && cfg.extraTypeOptions.length > 0 && extraTypes.length > 0) {
    const extraStr = extraTypes.join(', ');
    chips.push({
      key: 'resetExtraType',
      label: `${extraLab}: ${extraStr}`,
      kind: 'resetExtraType',
      title: `Reset ${extraLab.toLowerCase()} filter`,
    });
  }

  if (collection === 'adversaries' && tiers.length === 1 && includeScaledUp) {
    chips.push({
      key: 'resetIncludeScaled',
      label: `Include Scaled: on (T${tiers[0]})`,
      kind: 'resetIncludeScaled',
      title: 'Turn off Include Scaled',
    });
  }

  return chips;
}

/**
 * @param {{ kind: string }} spec — from `getActiveLibraryFilterChipSpecs`
 * @param {(key: string, value: *) => void} setFilter — `useCollectionSearch` `setFilter`
 */
export function applyLibraryFilterChipClear(spec, setFilter) {
  if (!spec || !setFilter) return;
  switch (spec.kind) {
    case 'resetSearch':
      setFilter('search', '');
      break;
    case 'resetIncludes':
      setFilter('includes', [...LIBRARY_DEFAULT_INCLUDES]);
      break;
    case 'resetTier':
      setFilter('tier', null);
      break;
    case 'resetType':
      setFilter('type', null);
      break;
    case 'resetExtraType':
      setFilter('extraType', null);
      break;
    case 'resetIncludeScaled':
      setFilter('includeScaledUp', false);
      break;
    default:
      break;
  }
}
