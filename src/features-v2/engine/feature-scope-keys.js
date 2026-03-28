/** Shared `featureState` scope keys — avoid import cycles between `table.js` and `feature-loader.js`. */

/** Default `_sourceScopeKey` for SRD Druid class row (`classes:srd-cls-druid`) — shared Beastform/Evolution persistence. */
export const SRD_CLASS_DRUID_SCOPE_KEY = 'classes:srd-cls-druid';

/** SRD Rogue class — shared `featureState` bag (`table.source` for class features). */
export const SRD_CLASS_ROGUE_SCOPE_KEY = 'classes:srd-cls-rogue';

/** Warden of the Elements subclass — `sourceScopeKey` on `registry.subclasses['srd-sub-warden-of-the-elements']`. */
export const WARDEN_OF_THE_ELEMENTS_SCOPE_KEY = 'WardenOfTheElements';

/** Winged Sentinel subclass — `sourceScopeKey` on `registry.subclasses['srd-sub-winged-sentinel']`. */
export const WINGED_SENTINEL_SCOPE_KEY = 'WingedSentinel';
