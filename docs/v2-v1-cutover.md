# V1 → V2 Game Table cutover — analysis

**Purpose:** Single place to understand what “V2” means in this repo, what is **not** coming back, what the **VTT still does imperatively**, and where to look next. Update this file when `GMTableView.jsx` / bridge code gains or loses major call patterns.

**Related:** [`docs/v2-game-table-polestar.md`](v2-game-table-polestar.md); [`docs/v2-migration-tracker-snapshot.md`](v2-migration-tracker-snapshot.md) (GitHub Issue status); bridge hardening [`docs/v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md).

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

## 2. Current architecture snapshot (2026-03, Phase E hook inventory)

| Layer | Role | Key files |
|-------|------|-----------|
| **Engine** | Phases, chips, mutations, tests | `src/features-v2/engine/`, `table.js`, `chip-system.js` |
| **Bridge** | Banner → `gameState`, review chips, partition mutations | `src/client/lib/v2-action-loop-bridge.js`, `v2-cross-sheet-lifecycle.js` |
| **Table ops** | Apply V2 mutations to elements | `src/client/lib/table-ops.js` (`applyV2BannerMutations`, `partitionV2BannerChipMutations`, …) |
| **GM shell** | Imperative damage, rolls, V2 review chip wiring, session start | [`src/client/components/GMTableView.jsx`](../src/client/components/GMTableView.jsx) (~6.5k lines) — still the **largest** hybrid surface |
| **Wrappers** | Mutable entity/roll helpers for hooks that expect objects with `.markStress()`, `.reroll()`, … | `table-entity-roll.js` |

**Phase A+ (2026-03):** The separate **`ancestryBannerReactions`** / declarative **`placement: 'banner'`** GMTableView→`DiceRoller` surface is **removed**; interactive pending-roll UI is the V2 **`collectV2ReviewActionChips`** strip only. **`displayOverridesByRollId`** remains for display tweaks (e.g. Fearless hope color). Pending-roll narration lines for weapon tags come from **`automated: true`** + **`description`** via **`buildRollBaseBannerNarrationParts`** in [`game-table-mechanics.js`](../src/client/lib/game-table-mechanics.js). Infernis **Fearless** is a V2 **`reviewAction`** chip.

**`DiceRoller.jsx`:** Phase 1 Ranger banner tools are **off** (`usePhase1RangerBannerTools = false`); V2 review chips own Hold Them Off / Focus-style flows. `V2_REVIEW_ACTION_PHASE1_DEDUPE` is an **empty** set (tracker / prior integration milestone); kept for tests / future dedupe.

**Phase E (completion plan):** `runCharacterHook` inventory is **closed** — each listed hook is either covered by an engine path where applicable or explicitly **retained** as a documented extension/bridge (see **§3.1**). **Call volume (grep):** nine `runCharacterHook` invocations in [`GMTableView.jsx`](../src/client/components/GMTableView.jsx) plus one in [`weapon-roll-text.js`](../src/client/lib/weapon-roll-text.js); facade export unchanged in [`game-table-mechanics.js`](../src/client/lib/game-table-mechanics.js). **Regression:** [`test/unit/feature-hook-dispatch.test.js`](../test/unit/feature-hook-dispatch.test.js).

**Phase B (done per tracker):** `handleV2ReviewChip` chains server banner follow-ups (`postBannerAddDamage`, `postBannerRerollDie`, action-roll patches). **`resolveV2ReviewChipPicker`** + **`V2ReviewChipRow`** implement **`isSelect` / `multiSelect` / `selectTargets`** with Apply — the old cutover note “early-return blocked” is **obsolete**.

**Phase C (2026-03):** When the GM applies attack damage to a **character or adversary** (`type` / `elementType` from the damage target chip), `applyDamageToTarget` (in `GMTableView.jsx`) calls **`runV2DamageApplyReviewOutcomePhase`** in `v2-action-loop-bridge.js` **after** final `hpLoss` is known (post-armor pipeline, including Impenetrable) and **before** `runBeforeMarkHP` / `markHp`. It builds the same hydrated banner `gameState` as chip collection (`buildV2BannerGameState`), replaces **`action.effects`** with **`buildV2DamageCommitEffects`** (final damage total + HP loss lines), runs **`createActionLoop(...).runPhase('reviewOutcome')`** for registry rows with **`runOnVttDamageApplyReviewOutcome: true`**, then **`readV2DamageCommitHpLossFromEffects`** reads the post-hook **`{ stat: 'currentHP' }`** line so hooks can mutate HP loss in place (e.g. Warden **Elemental Dominion** Earth: d6-per-HP cleared). When **`adjustedHpLoss`** is a number, `applyDamageToTarget` applies that value to **`markHp`** and beastform fragile checks (optional **`rng`** on the bridge sets **`gameState._rng`** for unit tests). Registry consumers: **Elemental Incarnation** (severe hit clears channel on a struck PC; fire aura stress when the Warden deals HP to a struck adversary) and **Elemental Dominion** (Earth). Mutations apply via **`applyV2LifecycleMutations`** with **`setFeatureStateOwnerId` = struck character** when the victim is a PC, else **`undefined`** (adversary victims: no `setFeatureState` owner). **Unchanged in this slice:** `modifyPreThresholdDamage` / `modifyHpLoss` / `runCharacterHook` / Parry / armor slot hooks remain on the existing imperative path. **Tests:** `test/unit/v2-action-loop-bridge.test.js` (`buildV2DamageCommitEffects`, **`readV2DamageCommitHpLossFromEffects`**, Warden severe → channel clear, Earth Dominion → **`adjustedHpLoss`**).

**Damage apply call graph (GM):** `handleApplyDamage` (Parry, armor / Resilient, `damageModifiers`) → `applyDamageToTarget` (`modifyPreThresholdDamage` → resistance → `computeHpLoss` → `modifyHpLoss` → armor reduction / `hpLossReduction` / Impenetrable) → **`runV2DamageApplyReviewOutcomePhase`** (`adjustedHpLoss` read-back) → `runBeforeMarkHP` → `markHp` → armor slot / `onAfterMarkArmor` → beastform drop → `onDamageReceived` (`runCharacterHook`) → return. Post-ack: `handleApplyDamage` continues (Burning, Sharp, Ranger, Locked On, `onHpDealt`, `runV2DamageAckReviewActionHooks`).

**Start Session:** Clears session trackers, per-character Rally `featureState` (`partyDice` / Maestro), and **root** `table_state.featureState.Rally` when present (same keys as End Session), then runs **`hooks.onSessionStart`** from merged **`activeFeatures`** via **`buildTableSnapshot`** + **`applyMutations`** + **`applyV2LifecycleMutations`** (see `runSessionStartClear` in `GMTableView.jsx`).

**Phase D (2026-03):** Pre-roll **weapon attack** **intent** is a **single inline strip** above the dice/map column (not a full-screen portal). **`collectV2WeaponIntentChips`** (`v2-action-loop-bridge.js`) builds a synthetic skeleton via **`buildV2PreRollWeaponAttackRollSkeleton`**, hydrates **`buildV2BannerGameState`**, and runs **`collectPhaseChipsOnly(..., 'intent')`**. Intent chips are marked **`_v2IntentChip`**; **`handlePreRollProceed`** applies Hope/Stress, sets **`pending.meta`** (e.g. Devastating), rewrites roll text through **`src/client/lib/weapon-roll-text.js`** (**`applyDevastatingDamageRewriteToRollText`**), and appends **`_v2IntentUsedLog`**. **Devastating** implements **`computeWeaponRenderHints`** → **`hideDevastatingCardToggle`** so **`CharacterDisplay`** does not show a second toggle when the intent strip owns Devastating. **Player parity:** **`postPlayerIntent`** includes serializable V2 intent metadata when applicable.

**Phase F (2026-03, Rally milestone):** **`collectV2ReviewActionChips`** unions player **`viewerCharacterInstanceId`** with the roll’s PC **`actorInstanceId`** for cross-sheet **`showOnOtherSheets`** **`reviewAction`** chips (ally banners, preview-as-player). **Start Session** clears root **`table_state.featureState.Rally`** in addition to per-character bags, **`mergeV2TableFeatureState`** for **`onSessionStart`** uses the cleared root snapshot. Tests: **`test/unit/v2-action-loop-bridge.test.js`**. See matrix **§3 row #15** and **Tech Debt** in this doc for scene vs session follow-up.

**Beastform VTT damage exit (2026-03):** **`applyDamageToTarget`** uses merged overlay **`activeFeatures`** for declarative **`fragile.dropBeastformOnMajorOrGreaterDamage`**, with **`legacyBeastformFeaturesLookFragile`** fallback on SRD **`activeBeastform.features`**. Exit applies **`buildClearBeastformStateMutations`** + **`applyV2LifecycleMutations`** (same scoped **`setFeatureState`** as the Drop chip; **`table-ops`** clears legacy **`activeBeastform`** / **`selectedBeastformAdvantage`**). Tests: **`test/unit/beastform-vtt-drop.test.js`**.

---

## 3. Parity matrix — behavior → status → direction

Statuses: **Hybrid** = VTT still uses wrappers / `runCharacterHook` / local `GMTableView` logic; **Engine** = rules live in `features-v2` + tests; **Cutover target** = drive behavior from hydrated `table` + chips only.

| # | Behavior / area | Current mechanism | Status | Cutover target |
|---|-----------------|-------------------|--------|----------------|
| 1 | **`wrappedPartyCharacters`** | `wrapEntity` per character for hooks | Hybrid | Eventually optional if hooks consume `table.actors` only |
| 2 | **Damage pipeline `applyDamageToTarget`** | `wrapEntity`/`wrapRoll`, `modifyPreThresholdDamage`, `modifyHpLoss`, ad hoc ranger/focus/Burning/Sharp/Locked On; **Phase C:** `runV2DamageApplyReviewOutcomePhase` (opt-in `reviewOutcome` at commit) | Hybrid | Extend hydrated outcome + optional effects read-back; narrow ad hoc blocks |
| 3 | **Pre-threshold damage** | `activeFeatures` + armor name descriptor on element | Hybrid | Same stage, engine-driven effects |
| 4 | **HP loss after thresholds** | `modifyHpLoss` on weapon rows | Hybrid | Engine `reviewOutcome` mutations (or commit-time effects sync) |
| 5 | **Armor slot reduction** | Declarative + armor feature hooks | Hybrid | Fully via `useArmor` / `table.action` + chips |
| 6 | **Parry** | `resolveParryWeaponFeature` + async `postRollSilent` | Hybrid | Keep async server roll; narrow wrapper use |
| 7 | **`onDamageReceived` / `onHpDealt`** | **`runCharacterHook`** after HP commit / after damage apply; **no** merged rows implement these functions today; victim commit automation uses **`runV2DamageApplyReviewOutcomePhase`** where registered | Hybrid | New mechanics should prefer **`reviewOutcome`** / ack-phase engine hooks; keep **`runCharacterHook`** only when a descriptor hook is required (§3.1) |
| 8 | **Weapon `onRollComplete`** | **`runCharacterHook`** on weapon-tag rows (banner ack path, two call sites); **no** merged rows implement **`onRollComplete`** today | Hybrid | Same as §3.1 — extension point or future post-ack automation |
| 9 | **Weapon tags** | `rewriteDamage`, `buildRollBaseBannerNarrationParts` / `buildWeaponTagBannerNarrationParts`, roll tags | Hybrid | Phase D **slice:** Devastating pre-roll intent + `weapon-roll-text.js`; other tags unchanged |
| 10 | **Pre-roll `onRoll`** | **`runCharacterHook`** + optional ancestry/community rows via **`resolveOriginFeatureDescriptor`**; **`runV2IntentPhaseForTraitRoll`** applies trait intent **mutations** only when the fast path runs (no mandatory intent canvas) | Hybrid | Weapon/domain parity: eventual hydrated **`action.type === 'attack'`** intent phase could subsume Bone **Deft Maneuvers** `onRoll`; until then **exception** in §3.1 |
| 11 | **Roll-meta banner UI (review / display)** | **Intent:** inline strip in `GMTableView` above map/dice; **review:** V2 **`collectV2ReviewActionChips`** in `DiceRoller` + `displayOverridesByRollId`; pending evasion vs attacks uses `sumPendingEvasionBonusFromFeatureState` + `PENDING_EVASION_BONUS_STATE_KEY` | Hybrid | Fewer wrapper-only display paths |
| 12 | **Virtual weapon ack** | `resolveVirtualWeaponBehavior` + `wrapEntity`/`wrapRoll` | Hybrid | Same resolver; reduce wrapper surface |
| 13 | **Class feature activation** | `onFeatureActivated` + batch updates | Hybrid | Engine `activateChip` / table mutations |
| 14 | **Rest moves** | **`getRestMovesForCharacter`** with merged **`_v2RestSlotStats`** (CONV-011); **`placement: 'rest'`** chips via **`collectV2RestPlacementChipsForCharacter`** / **`activateV2RestPlacementChip`** (`v2-action-loop-bridge.js`); Rest banner UI in **`DiceRoller`**; **`runV2RestHooksForTable`** with **`restDuration`** (`short`/`long`) matches ack’d rest so **`hooks.onRest`** sees **`shortRest`** vs **`longRest`**; engine **`setFeatureState`** may carry **`payload.instanceId`**; **`wrapEntity`** in ack | Hybrid | See [`docs/rest-adjacent-audit.md`](rest-adjacent-audit.md) for consumable/item rest patterns |
| 15 | **Cross-sheet Rally / Beastform** | **Rally:** `collectV2ReviewActionChips` merges `showOnOtherSheets` **`reviewAction`** for assigned players using **viewer id + PC `actorInstanceId`** when they differ; card **`crossSheetChips`** unchanged (`CharacterHoverCard` / `postV2CrossSheetChip`). **Start Session** clears root + per-character Rally bags. **Beastform:** damage-driven drop uses declarative **`Fragile`** (`dropBeastformOnMajorOrGreaterDamage`) + **`beastform-vtt-drop.js`** mutations matching the Drop chip; remaining backlog (e.g. engine `hooks.onStateChange` at 0 HP on client). | Hybrid | Optional `hooks.onSessionEnd`; engine 0-HP drop on client |

**Phase C slices (2026-03):** Rows **#2** and **#4** include commit-time **`reviewOutcome`** for opt-in registry rows plus **`adjustedHpLoss`** sync to `markHp` (Warden **Elemental Incarnation** / **Elemental Dominion** Earth). Rows **#3, #5, #6** remain **Hybrid** (pre-threshold / armor slot / Parry). Rows **#7–#8** — see **Phase E / §3.1** (dispatch retained; matrix text updated).

**Phase D slices (2026-03):** Rows **#8–#11** — first **weapon-attack intent** vertical slice (**Devastating**); post-roll **review** surface unchanged.

**Phase E (2026-03):** Hook dispatch inventory closed — §3.1 table below; rows **#7, #8, #10** aligned.

### 3.1 Hook dispatch inventory

`Disposition` uses **`engine`** when the V2 action loop / bridge owns the behavior today, **`exception`** when the **`runCharacterHook`** (or related) site is intentionally retained (bridge or empty extension point), and **`removed`** when the hook path was deleted.

| Hook | Location | Disposition |
|------|----------|-------------|
| **`onRoll`** | [`GMTableView.jsx`](../src/client/components/GMTableView.jsx) — before `postRoll` when the intent canvas is empty (`handlePlayerOwnRoll` path); again in **`handlePreRollProceed`** after optional difficulty/experience wiring | **exception:** VTT **`wrapRoll`** bridge. **Consumer:** Bone **Deft Maneuvers** (`src/features-v2/abilities/Bone/DeftManeuvers.js`) duplicates engine **`hooks.onIntent`** for table snapshots; weapon attacks still need this hook because **`runV2IntentPhaseForTraitRoll`** builds **`action.type === 'trait'`**, so domain **attack-scoped** intent (melee vs adversary) does not run there. Ancestry/community rows without merged `activeFeatures` use **`resolveOriginFeatureDescriptor`** + same hook. |
| **`onRollComplete`** | [`GMTableView.jsx`](../src/client/components/GMTableView.jsx) — weapon-tag filter inside **`handleBannerAcknowledge`** (action-roll branch and main dice branch) | **exception:** Dispatch retained; **no** `activeFeatures` row defines **`onRollComplete`** in `features-v2/` today — extension point for future post-ack weapon automation. |
| **`onDamageReceived`** | [`GMTableView.jsx`](../src/client/components/GMTableView.jsx) — end of **`applyDamageToTarget`** (PC, `hpLoss ≥ 1`) | **exception:** Dispatch retained; **no** consumers in repo. **Engine overlap:** victim-scoped damage commit uses **`runV2DamageApplyReviewOutcomePhase`** / **`reviewOutcome`** (Phase C). |
| **`onHpDealt`** | [`GMTableView.jsx`](../src/client/components/GMTableView.jsx) — **`handleApplyDamage`** after HP applied (`hpApplied ≥ 1`, attacker is PC) | **exception:** Dispatch retained; **no** merged hook implementations today. Ranger **Focus** stress-on-hit is **imperative** in **`handleApplyDamage`**, not this hook. |
| **`rewriteDamage`** | [`weapon-roll-text.js`](../src/client/lib/weapon-roll-text.js) — **`buildWeaponRollText`** (non-Devastating branch; mutates **`wrapRoll`** `damageStr`) | **exception:** Call retained; **no** V2 weapon module defines **`rewriteDamage`**. Roll construction uses **`prependRollParts` / `appendRollParts`**, intent text rewrites (**Devastating** / **Charged**), and engine phases elsewhere. |

**Related (not `runCharacterHook`):** React prop **`onRoll`** on **`CharacterHoverCard`** / **`ActionLog`** — callback into **`GMTableView`** to send rolls; not the descriptor hook.

---

## 4. Explicit gaps (unchanged themes)

1. **Phased roll UI:** **Pre-roll intent** (weapon attack) renders in **`GMTableView`** above the map/dice column; **post-roll review** remains the V2 **`collectV2ReviewActionChips`** strip in **`DiceRoller`** — two stacked surfaces, one flow (intent does not duplicate the review row).
2. **Banner surface:** V2 **`collectV2ReviewActionChips`** strip is the **only** interactive **post-roll** banner chip row (legacy **`ancestryBannerReactions`** removed).
3. **`applyV2BannerMutations` `default`:** Unknown mutation types are **skipped** and logged from `handleV2ReviewChip` when combined with `unsupported` from `partitionV2BannerChipMutations` — new engine mutation types need explicit handling in `table-ops.js` + tests.
4. **Content coverage:** Many abilities/items/consumables still **Unclaimed** in the tracker; the table can expose **hybrid** behavior until those modules exist.
5. **Tech debt (tracker):** Scene-level lifecycle vs **session** (Rally SRD timing), **rest banner** further content (declarative **`rest`** placement + CONV-011 plumbing are in place; Potion of Stability is the first consumer), domain loadout on table, Beastform/engine **0 HP** `onStateChange` on client (damage path covered), etc. — **product/engine** follow-ups. Rally **session** clears are covered by **Start Session** / **End Session** + root `featureState` merge (see `runSessionStartClear` / `runSessionEndClear`).
6. **Damage commit `reviewOutcome` (Phase C):** Only registry rows with **`runOnVttDamageApplyReviewOutcome: true`** participate; for a struck **PC**, `setFeatureStateOwnerId` is that character’s id; for a struck **adversary**, it is **`undefined`** (mutations must carry explicit `instanceId`s). HP actually marked uses **`adjustedHpLoss`** when hooks change the pending **`currentHP`** effect (e.g. Earth Dominion). Attacker-scoped `setFeatureState` from this path remains a known limitation (victim-scoped owner only).

---

## 5. Maintenance

- **Phase A complete:** banner pipeline cleanup per [phase-6-banner-pipeline-cleanup.plan.md](../.cursor/plans/phase-6-banner-pipeline-cleanup.plan.md) (merged into completion plan Phase A).
- **Phase B complete:** ancestry / review convergence (legacy ancestry banner reaction list removed; V2 **`collectV2ReviewActionChips`** only) per [completion plan Phase B](../.cursor/plans/v2-game-table-cutover-completion.plan.md) — see also [`docs/v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md).
- **Phase C complete:** damage commit bridge (`runV2DamageApplyReviewOutcomePhase`, `buildV2DamageCommitEffects`) per [completion plan Phase C](../.cursor/plans/v2-game-table-cutover-completion.plan.md).
- **Phase D complete:** weapon-attack **intent** strip + Devastating vertical slice (`collectV2WeaponIntentChips`, `weapon-roll-text.js`, `computeWeaponRenderHints` / `hideDevastatingCardToggle`) per [completion plan Phase D](../.cursor/plans/v2-game-table-cutover-completion.plan.md).
- **Phase E complete:** **`runCharacterHook`** inventory + **§3.1** table + matrix rows **#7, #8, #10** per [completion plan Phase E](../.cursor/plans/v2-game-table-cutover-completion.plan.md); tests in `test/unit/feature-hook-dispatch.test.js`.
- **Phase F (Rally milestone) complete:** **`collectV2ReviewActionChips`** viewer/actor union + session root/per-character Rally clears per [completion plan Phase F](../.cursor/plans/v2-game-table-cutover-completion.plan.md) — **§2** Phase F bullet, **§3** row **#15**, **§4** bullet 5.
- **Rest banner Phase F (rest plan):** **`placement: 'rest'`** + merged rest slot stats + Potion of Stability — see [rest-banner-phase-f.plan.md](../.cursor/plans/rest-banner-phase-f.plan.md); **§3** row **#14**, **`test/unit/rest-moves-v2.test.js`**, **`test/unit/features-v2/consumables/PotionOfStability.test.js`**, **`v2-action-loop-bridge.test.js`** (where rest helpers are covered).
- Each phase of the [completion plan](../.cursor/plans/v2-game-table-cutover-completion.plan.md) lists required edits to this file (**§2–§4**, and **§3.1** after Phase E).
- When deleting or migrating a **`runCharacterHook`** / **`wrapEntity`** call site, update the matrix row (and **§3.1** when present) and the completion plan if scope shifts.
- Keep **§1 Terminology** aligned with [`docs/feature-authoring-guide.md`](feature-authoring-guide.md) (authoring uses **`table`**, not wrappers).
