import { formatFeatScopeLabel, getLibraryFilterConfig } from './library-filter-config.js';
import { LIBRARY_DEFAULT_INCLUDES, getLibraryIncludeMode } from './library-default-filters.js';

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

/** Human-readable source selection for chip labels (matches single-select Include strip). */
export function formatIncludesForChipLabel(includes, collection) {
  const mode = getLibraryIncludeMode(includes);
  const catalogLabel = collection === 'scenes' || collection === 'maps' ? 'DT' : 'SRD';
  if (mode === 'all') return 'All';
  if (mode === 'mine_srd') return `Mine + ${catalogLabel}`;
  if (mode === 'own') return 'Mine';
  if (mode === 'srd') return catalogLabel;
  if (mode === 'public') return 'Public';
  return 'All';
}

function formatTypeValuesForChip(collection, types) {
  return (types || []).map(val => {
    if (collection === 'adversaries' && typeof val === 'string') {
      return val.charAt(0).toUpperCase() + val.slice(1);
    }
    if (collection === 'features' && typeof val === 'string') {
      return formatFeatScopeLabel(val);
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
    const src = formatIncludesForChipLabel(includes, collection);
    chips.push({
      key: 'resetIncludes',
      label: `Source: ${src}`,
      kind: 'resetIncludes',
      title: collection === 'scenes' || collection === 'maps' ? 'Reset sources to Mine + DT' : 'Reset sources to Mine + SRD',
    });
  }

  const rankLabel = cfg.rankMode === 'level' ? 'Level' : cfg.rankMode === 'none' ? null : 'Tier';
  if (rankLabel && tiers.length > 0) {
    const tierStr =
      collection === 'adversaries' && tiers.length === 1 && includeScaledUp
        ? `${tiers[0]} (scaled up)`
        : [...tiers].sort((a, b) => a - b).join(', ');
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

  return chips;
}

/**
 * Filter chips for Library “All” tab (`useLibraryAllSearch` filters).
 */
export function getActiveLibraryAllFilterChipSpecs(filters) {
  const {
    includes = [],
    tiers = [],
    levels = [],
    advRole = [],
    envType = [],
    ablDomain = [],
    wpnSlot = [],
    wpnPhyMag = [],
    featScope = [],
    search,
    includeScaledUp,
  } = filters || {};
  const chips = [];

  const q = (search || '').trim();
  if (q) {
    chips.push({
      key: 'resetSearch',
      label: `Search: "${truncateForChip(q)}"`,
      kind: 'resetSearch',
      title: 'Clear search',
    });
  }

  if (!includesMatchDefault(includes)) {
    chips.push({
      key: 'resetIncludes',
      label: `Source: ${formatIncludesForChipLabel(includes)}`,
      kind: 'resetIncludes',
      title: 'Reset sources to Mine + SRD',
    });
  }

  if (tiers.length > 0) {
    const tierLabel =
      tiers.length === 1 && includeScaledUp
        ? `${tiers[0]} (scaled up)`
        : [...tiers].sort((a, b) => a - b).join(', ');
    chips.push({
      key: 'resetTier',
      label: `Tier: ${tierLabel}`,
      kind: 'resetTierAll',
      title: 'Reset tier filter',
    });
  }

  if (levels.length > 0) {
    chips.push({
      key: 'resetLevel',
      label: `Level: ${[...levels].sort((a, b) => a - b).join(', ')}`,
      kind: 'resetLevelAll',
      title: 'Reset level filter',
    });
  }

  if (advRole.length > 0) {
    chips.push({
      key: 'resetAdvRole',
      label: `Role: ${advRole.join(', ')}`,
      kind: 'resetAdvRole',
      title: 'Reset role filter',
    });
  }

  if (envType.length > 0) {
    chips.push({
      key: 'resetEnvType',
      label: `Env type: ${envType.join(', ')}`,
      kind: 'resetEnvType',
      title: 'Reset environment type filter',
    });
  }

  if (ablDomain.length > 0) {
    chips.push({
      key: 'resetAblDomain',
      label: `Domain: ${ablDomain.join(', ')}`,
      kind: 'resetAblDomain',
      title: 'Reset domain filter',
    });
  }

  if (wpnSlot.length > 0) {
    chips.push({
      key: 'resetWpnSlot',
      label: `Slot: ${wpnSlot.join(', ')}`,
      kind: 'resetWpnSlot',
      title: 'Reset weapon slot filter',
    });
  }

  if (wpnPhyMag.length > 0) {
    chips.push({
      key: 'resetWpnPhyMag',
      label: `Damage: ${wpnPhyMag.join(', ')}`,
      kind: 'resetWpnPhyMag',
      title: 'Reset damage type filter',
    });
  }

  if (featScope.length > 0) {
    chips.push({
      key: 'resetFeatScope',
      label: `Feat scope: ${featScope.map(formatFeatScopeLabel).join(', ')}`,
      kind: 'resetFeatScope',
      title: 'Reset V2 feature scope filter',
    });
  }

  return chips;
}

/**
 * @param {{ kind: string }} spec — from `getActiveLibraryAllFilterChipSpecs`
 * @param {(key: string, value: *) => void} setFilter — `useLibraryAllSearch` `setFilter`
 */
export function applyLibraryAllFilterChipClear(spec, setFilter) {
  if (!spec || !setFilter) return;
  switch (spec.kind) {
    case 'resetSearch':
      setFilter('search', '');
      break;
    case 'resetIncludes':
      setFilter('includes', [...LIBRARY_DEFAULT_INCLUDES]);
      break;
    case 'resetTierAll':
      setFilter('tier', null);
      break;
    case 'resetLevelAll':
      setFilter('level', null);
      break;
    case 'resetAdvRole':
      setFilter('advRole', null);
      break;
    case 'resetEnvType':
      setFilter('envType', null);
      break;
    case 'resetAblDomain':
      setFilter('ablDomain', null);
      break;
    case 'resetWpnSlot':
      setFilter('wpnSlot', null);
      break;
    case 'resetWpnPhyMag':
      setFilter('wpnPhyMag', null);
      break;
    case 'resetFeatScope':
      setFilter('featScope', null);
      break;
    case 'resetIncludeScaled':
      setFilter('includeScaledUp', false);
      break;
    default:
      break;
  }
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
