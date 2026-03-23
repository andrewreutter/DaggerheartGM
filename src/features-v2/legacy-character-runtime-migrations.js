/**
 * Registry-owned legacy table-runtime field migrations (no feature names in client normalizers).
 * Each row merges a legacy top-level character key into `featureState[scopeKey]` and drops the legacy key.
 */

export const LEGACY_CHARACTER_RUNTIME_MIGRATIONS = [
  {
    legacyKey: 'activeChanneledElement',
    scopeKey: 'WardenOfTheElements',
    stateKey: 'channeledElement',
    /** @param {unknown} v */
    mergeValue: (v) => (typeof v === 'string' ? v : null),
  },
];
