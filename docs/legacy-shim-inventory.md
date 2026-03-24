# Legacy shim inventory (baseline)

Reference for phased removal. See project plan "Eliminate legacy shims".

| Area | Mechanism | Files | Persisted | Risk |
|------|-----------|-------|-----------|------|
| Feature usage keys | `Name-idx` vs guide `entry.key` | `feature-usage-key.js`, hover/defer | `featureUsage` | Medium |
| Ranger focus | `focusTargetId` vs `focusTargetInstanceId` | `table-ops.js`, `table.js`, `db.js` | character element | Medium |
| Beastform state | Druid scope vs `Beastform`/`Evolution` bags + `activeBeastform` | `beastform-parse.js`, `feature-loader` | `featureState`, element | High |
| Consumables | Flat `featureState['Name']` vs scoped `consumables:id` | `HopeholdFlare.js`, `BlindingOrb.js` | `featureState` | Medium |
| Banner UI | ~~root `onBanner`~~ removed; `placement: 'banner'` chips only | `GMTableView.jsx`, `ISeeItComing.js` | — | Medium |
| Card model | `useLegacyTextFallback` text Use strip | `build-feature-card-model.js`, `GuideFeatureCard.jsx` | — | Medium |
| Loader | ~~Inline `virtualFeature` / `virtualFeatures`~~ removed | `feature-loader.js` | — | Done |
| Preroll | `canvasChips` alias | `GMTableView.jsx` | — | Low |
| Weapon tags | ~~`f.onBanner` narration~~ → `automated` + `buildRollBaseBannerNarrationParts` | `game-table-mechanics.js`, `GMTableView.jsx` | — | Done |

**Permanent (not shims):** `/gm-table` URL canonicalization (`router.js`); uncontrolled forms API; optional `GET /api/data` bulk.
