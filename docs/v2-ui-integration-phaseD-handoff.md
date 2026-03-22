# V2 UI integration — Phase D handoff (Game Table dispatch)

**Completed:** Phase D of the V2-only Game Table plan — table runtime no longer imports `src/features/` directly from `GMTableView.jsx`, `DiceRoller.jsx`, or `CharacterHoverCard.jsx`; `wrapEntity` / `wrapRoll` live in `src/client/lib/table-entity-roll.js` (Phase 1 modules re-export them).

## What landed

| Area | Change |
|------|--------|
| **Canonical wrappers** | `src/client/lib/table-entity-roll.js` — `wrapEntity`, `wrapRoll`, `wrapBanner`. `src/features/entity.js` and `src/features/roll.js` re-export from here. |
| **Facade** | `src/client/lib/game-table-mechanics.js` — re-exports registry maps + `runHook` / `runCharacterHook`, `shouldUsePhase1RegistryFallback()`, resolvers (`resolveParryWeaponFeature`, `resolveResilientArmorFeature`, `resolveArmorModifyPreThresholdDescriptor`, `resolveWeaponOnBannerAckDescriptor`), DiceRoller display helpers (`getWeaponTagAutomatedForBanner`, …). |
| **V2 flag off** | Behavior matches pre–Phase D (Phase 1 registry fallbacks still run). |
| **V2 flag on** | Skips Phase 1 **registry fallbacks** where `activeFeatures` / V2 bridges are intended to own the flow: weapon `onRollComplete`, ancestry `onRoll` (no chips), `modifyHpLoss` tag registry loop, weapon tag banner narration (`onBanner`), DiceRoller automated / interactive / conditional tag styling from Phase 1 registry. Prefers **`activeFeatures`** rows for Parry, Resilient last-slot, armor pre-threshold / `onAfterMarkArmor`, weapon `onBannerAck`. |
| **origin-lifecycle** | `wrapEntity` from `table-entity-roll.js` only (no `src/features/` import). |

## Phase E — suggested next steps

1. **Remove remaining `src/features/registry.js` usage from `game-table-mechanics.js`** by sourcing weapon/armor/class/ancestry behavior from `src/features-v2/` + `loadCharacterFeatures` / declarative payloads only, then delete or shrink Phase 1 re-exports.
2. ~~**`V2_REVIEW_ACTION_PHASE1_DEDUPE`**~~ **Done (Phase E):** set is empty; `DiceRoller` gates Phase 1 Hold Them Off / Ranger’s Focus reroll UI with `shouldUsePhase1RegistryFallback()` so V2 review chips are not duplicated on-banner.
3. **Session / class / ancestry** — `runSessionStartClear`, `ancestryFeatures` iteration for `onSessionStart`, `classFeatures.onFeatureActivated`, `virtualWeaponBehaviors`, and ancestry banner reactions still use Phase 1 registry inside `GMTableView` via the facade; migrate to V2 hooks or explicit bridge contracts.
4. **CharacterHoverCard** — still uses `weaponFeatures` for `buildWeaponRollText` / `runHook(rewriteDamage)`; Phase C/E: drive rewrite + tag text from V2 weapon properties only.
5. **DiceRoller** — still uses `weaponFeatures` for `showTag` filter, `bannerInteraction` (Quick / Doubled Up / Bouncing), and post-apply phases; either port to V2 or document as Phase 1 until replaced.
6. **Tests** — `test/unit/game-table-mechanics.test.js` covers the facade; extend when Phase E deletes registry imports.
7. **Docs** — update `docs/v2-v1-cutover.md` import surface when Phase E removes `game-table-mechanics` → `features/registry` dependency.

## Regression

- `npm run test:unit` — include `test/unit/game-table-mechanics.test.js`.
