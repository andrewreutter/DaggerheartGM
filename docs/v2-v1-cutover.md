# V1 → V2 Game Table cutover matrix (Phase A inventory)

**Scope:** Behaviors in [`src/client/components/GMTableView.jsx`](../src/client/components/GMTableView.jsx) that depend on Phase 1 [`src/features/`](../src/features/) (`wrapEntity`, `wrapRoll`, `runHook` / `runCharacterHook`, registry maps).  
**Goal for V2-only mode:** Replace these with [`src/features-v2/`](../src/features-v2/) + bridges (`v2-action-loop-bridge.js`, `v2-cross-sheet-lifecycle.js`, `table-ops.js` apply helpers) per the V2-only Game Table plan (Phase A–F in repo planning docs).  
**Related:** Phase B bridge hardening — [`docs/v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md). Phase D table dispatch facade — [`docs/v2-ui-integration-phaseD-handoff.md`](v2-ui-integration-phaseD-handoff.md).

---

## Import surface (Phase 1)

| Symbol | Source | In `GMTableView` |
|--------|--------|------------------|
| `wrapEntity` | `features/entity.js` → `client/lib/table-entity-roll.js` | Widespread — resource mutations, hook contexts |
| `wrapRoll` | `features/roll.js` → `client/lib/table-entity-roll.js` | Banner/chip/ancestry reaction paths |
| `runHook`, `runCharacterHook` | `features/hooks.js` | `onRoll`, `onRollComplete`, `onDamageReceived`, `onHpDealt` |
| `runPipelineHook`, `runCharacterPipelineHook` | `features/hooks.js` | **Imported but unused** (dead code — safe to delete when touching imports) |
| `weaponFeatures`, `armorFeatures`, `classFeatures` | `features/registry.js` | Tag pipelines, armor, class activation, weapon banner narration |
| `ancestryFeatures` | `registry.js` (alias of `originFeatures`) | Ancestry/community descriptors, session hooks, pre-roll chips |
| `virtualWeaponBehaviors` | `features/ancestries/index.js` re-export | Virtual weapon ack (`_featureNeedsTarget`) |

---

## Parity matrix: behavior → V2 direction

Statuses: **V2 engine** = logic exists in `features-v2` + unit tests; **VTT** = Game Table wiring still Phase 1 or bridge-only; **Blocked** = needs content, API, or product call.

| # | Behavior / call site | Phase 1 mechanism | V2 target (directional) | Notes |
|---|----------------------|-------------------|---------------------------|-------|
| 1 | **`wrappedPartyCharacters`** | `wrapEntity` per character | `table.me` / snapshot `buildTableSnapshot` | Used everywhere hooks need mutable entity API |
| 2 | **Damage pipeline `applyDamageToTarget`** | `wrapEntity` + `wrapRoll` + `ctx` | `reviewOutcome` / pending damage in action loop + `table.action.*` | Core V2 cutover surface |
| 3 | **Pre-threshold damage** | `activeFeatures[].modifyPreThresholdDamage` + `armorFeatures[name].modifyPreThresholdDamage` | Class/armor/weapon V2 features with same pipeline stage | Guardian Unstoppable, Warded, etc. |
| 4 | **HP loss after thresholds** | `modifyHpLoss` on weapon `activeFeatures` + `weaponFeatures[name]` | Weapon property V2 modules | Deadly-on-Severe, etc. |
| 5 | **Armor slot reduction** | `armorFeatures[feature].armorReduction` | Armor property V2 | |
| 6 | **Impenetrable** | Local + `wrapEntity` | Armor V2 + table ops | Mixed declarative / local |
| 7 | **`onDamageReceived`** | `runCharacterHook(..., 'onDamageReceived')` | Feature hooks on damage outcome | Warden Severe channel, etc. |
| 8 | **`handleApplyDamage`** — Parry | `weaponFeatures['Parry'].onBeforeDamageApplied` | Weapon V2 + async roll | Silent server roll stays in `api.js` |
| 9 | **Resilient last slot** | `armorFeatures['Resilient'].onLastArmorSlot` | Armor V2 `reviewAction` / outcome | |
| 10 | **Damage modifiers** (`damageModifiers`) | Ad hoc apply loop | Chip / `reviewAction` mutations | |
| 11 | **Elemental Fire/Water** (channeled) | Ad hoc in `handleApplyDamage` | Subclass V2 + snapshot | Partially duplicated vs engine |
| 12 | **Burning / Sharp armor** | Ad hoc | Armor property V2 | |
| 13 | **Ranger Focus / stress** | Ad hoc + `wrapEntity(target).markStress` | Ranger V2 + registry | V2 sheet on: V2 review chips + Phase 1 Ranger banner toggles off (`DiceRoller` + empty `V2_REVIEW_ACTION_PHASE1_DEDUPE`) |
| 14 | **Locked On** | Ad hoc state | Weapon V2 | |
| 15 | **`onHpDealt`** | `runCharacterHook(..., 'onHpDealt')` | Attacker hooks in action loop / resolve | Guardian, Ranger, etc. |
| 16 | **`handleBannerAcknowledge`** — Rest | `wrapEntity` + `getRestMoveDefinition().onApply` | Rest stays hybrid; V2 optional | |
| 17 | **Start Session** | `runSessionStartClear` → `ancestryFeatures[name].onSessionStart` | `hooks.onSessionStart` in V2 registry + table clear | Rally `featureState` clear already partially wired |
| 18 | **Rally / Heart d4 ack** | Server banner endpoints | Same + V2 `featureState` | |
| 19 | **Virtual weapon ack** | `virtualWeaponBehaviors[name].onAcknowledge` | Weapon/ancestry V2 virtual behaviors | Uses `wrapRoll` + `wrapEntity` |
| 20 | **Weapon `onBannerAck`** (tags × targets) | `weaponFeatures[name].onBannerAck` | Weapon property V2 + banner hydration | Overlaps weapon tag automation |
| 21 | **Ancestry card toggle `_cardToggle`** | `ancestryFeatures` + `toggleChip.onToggle` | Origin V2 + `featureState` | Galapa Retract, etc. |
| 22 | **Wings of Light stress** | Ad hoc | Subclass V2 | |
| 23 | **`classFeatures[]._featureName.onFeatureActivated`** | `wrapEntity` + batch update | `classes/*.js` V2 | Beastform, Make a Scene, etc. |
| 24 | **Weapon `onRollComplete`** (action + dice ack paths) | `runCharacterHook` / `runHook` on weapon features | Weapon V2 post-resolve | Two call sites (~1687, ~1831) |
| 25 | **Ancestry banner reactions** | `ancestryBannerReactions` useMemo: `onBanner`, `isVisible`, `onBannerAck`/`acknowledge`, `wrapRoll` | **VTT:** Full parity needs `collectChips` + banner merge; engine has chip descriptors | Largest Phase 1 surface |
| 26 | **Pre-roll `onRoll`** | `runCharacterHook` / `runHook` ancestry | `onAct` / intent chips in V2 | `postPlayerIntent` sync |
| 27 | **Pre-roll canvas chips** | `ancestryFeatures` preroll chips + `wrapEntity` | V2 intent / card chips | |
| 28 | **`getBannerNarration`** | `weaponFeatures[name].onBanner` | Weapon V2 automated narration | |
| 29 | **Display overrides** | `chip.render` / `renderWhenOff` | Same pattern on V2 chip descriptors | |
| 30 | **Adversary target disadvantage** | `activeFeatures[].onTargeted` | V2 defensive hooks or snapshot | Orc Sturdy, etc. |
| 31 | **`characterDisplayByInstanceId`** | `recomputeCharacter` (separate file, still P1 registry) + `mergeV2DeclarativeSheetOverlay` | Phase C in parent plan — single recompute path when flag on | Not all in GMTableView but feeds props |

---

## V2 wiring already present in `GMTableView` (additive)

- `mergeV2DeclarativeSheetOverlay` / `v2SheetLive` / `buildV2RegistryWithSrdItems`
- `collectV2ReviewActionChips` → `v2ReviewChipsByRollDbId` → `handleV2ReviewChip` → `applyV2BannerMutations`
- `runV2TokenMoveHooks` + `applyV2LifecycleMutations` on token drag end
- `V2_REVIEW_ACTION_PHASE1_DEDUPE` (in bridge) — **empty after Phase E**; optional filter for tests / future use. Ranger duplicate UI avoided by gating Phase 1 Hold Them Off / Focus reroll in `DiceRoller` when the V2 sheet flag is on.

These do **not** remove Phase 1 imports; they run in parallel when the declarative sheet flag is on.

---

## Explicit gaps (from inventory)

1. **Dual stacks:** Ancestry banner reactions + V2 review chips both consume banner surface; Ranger Hold Them Off / Focus reroll dedupe is addressed (Phase E); ancestry overlap remains.
2. **`applyV2BannerMutations` `skipped`:** Unknown mutation types fall through `default` → skipped (see `table-ops.js`). Phase B maps engine mutations that need `postBannerRerollDie` / `postBannerAddDamage` / patches.
3. **Selection chips:** `handleV2ReviewChip` early-returns for `multiSelect` / `isSelect` — parity blocked until UX or engine simplification (Phase 3 handoff).
4. **Abilities coverage:** Many SRD abilities still absent from `features-v2` ([tracker](v2-migration-tracker.md)); V2-only table may need **block** or **logged hybrid** until coverage improves (product decision in parent plan).

---

## Maintenance

Update this matrix when `GMTableView.jsx` gains or loses Phase 1 call sites. Link from [`docs/v2-migration-tracker.md`](v2-migration-tracker.md) § V2 UI integration backlog.
