import { computeScaledStats, ROLE_STAT_SCALING } from './adversary-defaults.js';

/**
 * Adversaries tab: when upscaled tier is selected, keep only rows scaled up from a lower tier
 * (drops native at-tier adversaries and roles without scaling rules).
 */
export function applyAdversaryScaledFilter(items, { includeScaledUp, singleTier }) {
  if (!includeScaledUp || singleTier == null) return items;
  return items
    .map(item => {
      const itemTier = item.tier ?? 1;
      if (itemTier >= singleTier) return item;
      const role = item.role || 'standard';
      if (!ROLE_STAT_SCALING[role]) return item;
      const scaled = computeScaledStats(item, role, itemTier, singleTier);
      return { ...item, ...scaled, tier: singleTier, _scaledFromTier: itemTier };
    })
    .filter(item => item._scaledFromTier != null);
}

/**
 * Library "All" merged list: same scaling/filter for `adversaries` rows only.
 */
export function applyLibraryAllAdversaryScaling(items, { includeScaledUp, tiers }) {
  const singleTier = tiers.length === 1 ? tiers[0] : null;
  if (!includeScaledUp || singleTier == null) return items;
  return items
    .map(item => {
      if (item._collection !== 'adversaries') return item;
      const itemTier = item.tier ?? 1;
      if (itemTier >= singleTier) return item;
      const role = item.role || 'standard';
      if (!ROLE_STAT_SCALING[role]) return item;
      const scaled = computeScaledStats(item, role, itemTier, singleTier);
      return { ...item, ...scaled, tier: singleTier, _scaledFromTier: itemTier };
    })
    .filter(item => item._collection !== 'adversaries' || item._scaledFromTier != null);
}
