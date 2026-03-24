# V1 → V2 Game Table cutover — analysis

**Purpose:** Single place to understand what “V2” means in this repo, what is **not** coming back, what the **VTT still does imperatively**, and where to look next. Update this file when `GMTableView.jsx` / bridge code gains or loses major call patterns.

**Related:** [`docs/v2-migration-tracker.md`](v2-migration-tracker.md) § **V2 UI integration backlog** & **Tech Debt**; [`docs/v2-game-table-polestar.md`](v2-game-table-polestar.md); bridge hardening [`docs/v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md).

**Implementation plan (remaining work):** [`.cursor/plans/v2-game-table-cutover-completion.plan.md`](../.cursor/plans/v2-game-table-cutover-completion.plan.md)

---

## 1. Terminology (read this first)

| Term | Meaning |
|------|---------|
| **V2 engine / registry** | `src/features-v2/`, `loadCharacterFeatures`, `buildTableSnapshot` / `table`, declarative chips, `hooks.onIntent` / `onReviewAction` / … — **authoritative rules** in unit tests + engine. |
| **Merged `activeFeatures`** | Per-character flat list from `character-calc` + V2 merge — **the only** feature source on the table at runtime (no separate Phase 1 registry import). |
| **VTT bridge (legacy *shape*)** | `wrapEntity` / `wrapRoll` (`src/client/lib/table-entity-roll.js`), `runCharacterHook` (`src/client/lib/feature-hook-dispatch.js`), and **descriptor fields** still named like old IoC: `onRoll`, `onBannerAck`, `modifyPreThresholdDamage`, … — **not** a second registry; these are **thin dispatch** over merged rows for React/GMTableView until the cutover finishes. |
| **“Phase 1” in tables below** | **Behavior category** (how the GM table used to invoke features), **not** the deleted `src/features/` package. |

**Deleted and not returning:** The **`src/features/`** tree (Phase D). There is **no** `weaponFeatures` / `armorFeatures` **import map** in client code anymore. Resolvers in [`src/client/lib/game-table-mechanics.js`](../src/client/lib/game-table-mechanics.js) scan **`activeFeatures`** only.

**Not present in repo:** `runHook`, `runPipelineHook`, `runCharacterPipelineHook` — **no matches** in `.js`/`.jsx`; the old cutover doc’s “imported but unused” row was obsolete.

---

## 2. Current architecture snapshot (2026-03)

| Layer | Role | Key files |
|-------|------|-----------|
| **Engine** | Phases, chips, mutations, tests | `src/features-v2/engine/`, `table.js`, `chip-system.js` |
| **Bridge** | Banner → `gameState`, review chips, partition mutations | `src/client/lib/v2-action-loop-bridge.js`, `v2-cross-sheet-lifecycle.js` |
| **Table ops** | Apply V2 mutations to elements | `src/client/lib/table-ops.js` (`applyV2BannerMutations`, `partitionV2BannerChipMutations`, …) |
| **GM shell** | Imperative damage, rolls, V2 review chip wiring, session start | [`src/client/components/GMTableView.jsx`](../src/client/components/GMTableView.jsx) (~6.5k lines) — still the **largest** hybrid surface |
| **Wrappers** | Mutable entity/roll helpers for hooks that expect objects with `.markStress()`, `.reroll()`, … | `table-entity-roll.js` |

**Phase A+ (2026-03):** The separate **`ancestryBannerReactions`** / declarative **`placement: 'banner'`** GMTableView→`DiceRoller` surface is **removed**; interactive pending-roll UI is the V2 **`collectV2ReviewActionChips`** strip only. **`displayOverridesByRollId`** remains for display tweaks (e.g. Fearless hope color). Pending-roll narration lines for weapon tags come from **`automated: true`** + **`description`** via **`buildRollBaseBannerNarrationParts`** in [`game-table-mechanics.js`](../src/client/lib/game-table-mechanics.js). Infernis **Fearless** is a V2 **`reviewAction`** chip.

**`DiceRoller.jsx`:** Phase 1 Ranger banner tools are **off** (`usePhase1RangerBannerTools = false`); V2 review chips own Hold Them Off / Focus-style flows. `V2_REVIEW_ACTION_PHASE1_DEDUPE` is an **empty** set (Phase E); kept for tests / future dedupe.

**Phase B (done per tracker):** `handleV2ReviewChip` chains server banner follow-ups (`postBannerAddDamage`, `postBannerRerollDie`, action-roll patches). **`resolveV2ReviewChipPicker`** + **`V2ReviewChipRow`** implement **`isSelect` / `multiSelect` / `selectTargets`** with Apply — the old cutover note “early-return blocked” is **obsolete**.

**Start Session:** Clears session trackers, Rally `featureState`, then runs **`hooks.onSessionStart`** from merged **`activeFeatures`** via **`buildTableSnapshot`** + **`applyMutations`** + **`applyV2LifecycleMutations`** (see `runSessionStartClear` in `GMTableView.jsx`).

---

## 3. Parity matrix — behavior → status → direction

Statuses: **Hybrid** = VTT still uses wrappers / `runCharacterHook` / local `GMTableView` logic; **Engine** = rules live in `features-v2` + tests; **Cutover target** = drive behavior from hydrated `table` + chips only.

| # | Behavior / area | Current mechanism | Status | Cutover target |
|---|-----------------|-------------------|--------|----------------|
| 1 | **`wrappedPartyCharacters`** | `wrapEntity` per character for hooks | Hybrid | Eventually optional if hooks consume `table.actors` only |
| 2 | **Damage pipeline `applyDamageToTarget`** | `wrapEntity`/`wrapRoll`, `modifyPreThresholdDamage`, `modifyHpLoss`, ad hoc elemental/ranger/focus | Hybrid | Single hydrated action loop per damage application + `reviewAction`/`reviewOutcome` |
| 3 | **Pre-threshold damage** | `activeFeatures` + armor name descriptor on element | Hybrid | Same stage, engine-driven effects |
| 4 | **HP loss after thresholds** | `modifyHpLoss` on weapon rows | Hybrid | Engine `reviewOutcome` mutations |
| 5 | **Armor slot reduction** | Declarative + armor feature hooks | Hybrid | Fully via `useArmor` / `table.action` + chips |
| 6 | **Parry** | `resolveParryWeaponFeature` + async `postRollSilent` | Hybrid | Keep async server roll; narrow wrapper use |
| 7 | **`onDamageReceived` / `onHpDealt`** | `runCharacterHook` | Hybrid | `onReviewOutcome` / resolve hooks only |
| 8 | **Weapon `onRollComplete`** | `runCharacterHook` on tag-filtered weapon rows | Hybrid | Post-resolve engine hook or banner follow-up |
| 9 | **Weapon tags** | `rewriteDamage`, `buildRollBaseBannerNarrationParts` / `buildWeaponTagBannerNarrationParts`, roll tags | Hybrid | Intent/review chips where missing (see tracker backlog) |
| 10 | **Pre-roll `onRoll`** | `runCharacterHook` + origin name filter | Hybrid | `postPlayerIntent` + `runV2IntentPhaseForTraitRoll` alignment |
| 11 | **Roll-meta banner UI (review / display)** | V2 **`collectV2ReviewActionChips`** strip + `displayOverridesByRollId`; Bone **I See It Coming** defense uses `getISeeItComingDefenseBonus` | Hybrid | Fewer wrapper-only display paths |
| 12 | **Virtual weapon ack** | `resolveVirtualWeaponBehavior` + `wrapEntity`/`wrapRoll` | Hybrid | Same resolver; reduce wrapper surface |
| 13 | **Class feature activation** | `onFeatureActivated` + batch updates | Hybrid | Engine `activateChip` / table mutations |
| 14 | **Rest moves** | `getRestMovesForCharacter` + `wrapEntity` in ack | Hybrid | Optional V2 `hooks.onRest` parity |
| 15 | **Cross-sheet Rally / Beastform** | V2 chips + table state; some flows incomplete | Hybrid | Tracker rows: Rally merge, Beastform VTT |

### 3.1 Hook dispatch inventory

_To be completed in **Phase E** of the [completion plan](../.cursor/plans/v2-game-table-cutover-completion.plan.md): table of `runCharacterHook` and related dispatcher sites with columns **Hook**, **Location**, **Disposition** (`removed` / `engine` / `exception: …`)._

---

## 4. Explicit gaps (unchanged themes)

1. **Banner surface:** V2 **`collectV2ReviewActionChips`** strip is the **only** interactive banner chip row (legacy **`ancestryBannerReactions`** removed).
2. **`applyV2BannerMutations` `default`:** Unknown mutation types are **skipped** and logged from `handleV2ReviewChip` when combined with `unsupported` from `partitionV2BannerChipMutations` — new engine mutation types need explicit handling in `table-ops.js` + tests.
3. **Content coverage:** Many abilities/items/consumables still **Unclaimed** in the tracker; the table can expose **hybrid** behavior until those modules exist.
4. **Tech debt (tracker):** Rally session clear, rest banner extensibility, domain loadout on table, Beastform parity, etc. — **product/engine** follow-ups, not a single PR.

---

## 5. Maintenance

- **Phase A complete:** banner pipeline cleanup per [phase-6-banner-pipeline-cleanup.plan.md](../.cursor/plans/phase-6-banner-pipeline-cleanup.plan.md) (merged into completion plan Phase A).
- Each phase of the [completion plan](../.cursor/plans/v2-game-table-cutover-completion.plan.md) lists required edits to this file (**§2–§4**, and **§3.1** after Phase E).
- When deleting or migrating a **`runCharacterHook`** / **`wrapEntity`** call site, update the matrix row (and **§3.1** when present) and the completion plan if scope shifts.
- Keep **§1 Terminology** aligned with [`docs/feature-authoring-guide.md`](feature-authoring-guide.md) (authoring uses **`table`**, not wrappers).
