# V2 UI integration — Phase 4 handoff

**Phase 3 is implemented:** `src/client/lib/v2-action-loop-bridge.js` hydrates **`damageType`**, **`useArmorByTargetId`**, and **synthetic `action.effects`** (damage + `currentHP` steps); **`collectV2ReviewActionChips`** gathers **`intent`**, **`reviewAction`**, and **`reviewOutcome`** chips (tagged **`_v2Phase`**) via **`collectPhaseChipsOnly`** in `src/features-v2/engine/action-loop.js` (no duplicate phase hooks). **`ResultBanner`** (`DiceRoller.jsx`) shows **V2 intent / V2 review / V2 outcome** groups; **`selectTargets`** chips can fire using the **primary damage target**; **`handleV2ReviewChip`** accepts **`selectOpts`**.

**Still open from Phase 3 (not Phase 4):** banner mutations that queue **`rerollDie`**, **`addRollStatic`**, **`addDamageRoll`**, etc. remain in **`applyV2BannerMutations`**’s **`skipped`** list until mapped to **`postBannerRerollDie`** / **`postBannerAddDamage`** (or equivalent). **`multiSelect`** / **`isSelect`** V2 chips remain disabled in the banner with an explicit hint.

---

## Phase 4 goals (cross-table + lifecycle)

Per the V2 Game Table integration plan (**Phase 4 — Cross-table and lifecycle**) and **`docs/v2-migration-tracker.md`** (V2 UI integration backlog):

1. **`collectChipsForOtherCharacterSheets` → `crossSheetChips`**  
   Wire **`CharacterExperiences`** (`CharacterDisplay.jsx`) **`crossSheetChips`** from the engine: build a minimal **`baseGameState`** ( **`activeElements`**, merged **`featureState`**, optional **`table_state.featureState`** for shared bags like Rally **`partyDice`** ), call **`collectChipsForOtherCharacterSheets(viewerInstanceId, partyCharacters, registry, phase, baseGameState, usageStore)`** (`src/features-v2/engine/chip-system.js`), **`phase`** typically **`'card'`** for spend rows. On click: **`activateChip`** + **`applyV2BannerMutations`** / **`postTableOp`** so **`partyDice`**, Hope/Stress, and **`activeModifiers`** round-trip.

2. **Rally on the live table**  
   Engine + tests treat V2 Rally as canonical (`classes/Bard.js`, **`showOnOtherSheets`**, **`reviewAction`** spend paths). Phase 4 completes **VTT** wiring: (a) ally sheets show Rally-related chips under **Modifiers**; (b) optional: merge **`showOnOtherSheets`** **`reviewAction`** chips into **pending banners** when the **actor** is not the Bard so allies see **Spend Rally Die** where the rules expect it.

3. **`dispatchTokenMoveHooks`**  
   After a token drag in **`BattleMap.jsx`**, with **`tokenX`/`tokenY`** updated, set **`_previousPositions[moverId]`** to **pre-drag** coordinates on the snapshot passed into **`dispatchTokenMoveHooks(gameState, flatV2Features, { moverInstanceId })`** (`action-loop.js`), then apply returned mutations. See **CONV-032** / **CONV-033** and the Feature Authoring Guide.

4. **Session / scene end — Rally + modifiers**  
   On GM **Start Session** / **End session** (or a dedicated signal), clear **`featureState`** / table-level state so **Rally `partyDice`** and session-scoped **`activeModifiers`** (e.g. Rally die tokens) do not persist incorrectly. Tracker tech-debt row: align with **`dispatchSceneEndHooks`** vs **`sessionEnd`** — confirm product intent before hard-wiring **`hooks.onSceneEnd`**.

**Related backlog (can parallelize or defer):** **Camaraderie** / Tag Team live table; **Druid beastform** full V2 parity on table; **domain loadout** for Sorcerer — see tracker **Complex Feature** / **Tech Debt** rows.

---

## Code pointers

| Topic | Location |
|--------|-----------|
| Cross-sheet collection | `collectChipsForOtherCharacterSheets` in `src/features-v2/engine/chip-system.js` |
| Token move hooks | `dispatchTokenMoveHooks` in `src/features-v2/engine/action-loop.js` |
| Scene end hooks | `dispatchSceneEndHooks` in `src/features-v2/engine/action-loop.js` |
| Modifiers row UI | `CharacterExperiences` + `crossSheetChips` in `src/client/components/CharacterDisplay.jsx` |
| Hover / table sheet | `CharacterHoverCard.jsx`, `GMTableView.jsx` |
| Map drag | `BattleMap.jsx` — token pointer end / position commit |
| Session cycle | `GMTableView.jsx` — `handleSessionCycle`, Short/Long Rest (Rally clear may mirror **session** boundary) |
| Table ops / V2 keys | `src/client/lib/table-ops.js` — `CHARACTER_RUNTIME_KEYS`, `TABLE_STATE_V2_ROOT_KEYS`, `applyV2BannerMutations` |
| Bridge (reuse patterns) | `src/client/lib/v2-action-loop-bridge.js`, `buildV2RegistryWithSrdItems` in `v2-declarative-sheet.js` |

---

## Suggested implementation order

1. **Persistence for shared Rally state** — Ensure **`table_state.featureState`** (or per-character merge) is loaded into **`baseGameState`** when collecting cross-sheet chips; align with Phase 0 docs.
2. **`crossSheetChips` wiring** — Thin adapter in **`GMTableView`** or a small **`src/client/lib/v2-*.js`** module; avoid duplicating feature logic inside JSX.
3. **Session-end / Start Session** — One table op or hook batch that clears engine-documented session bags; verify with a Bard who had **`partyDice`** and Rally modifiers.
4. **`dispatchTokenMoveHooks`** — After **`crossSheet`**, or in parallel if different owners; requires **`_previousPositions`** discipline on drag-end.

---

## What to verify in the UI

### A. Phase 3 regression (ship confidence — do any time)

The declarative sheet overlay (`mergeV2DeclarativeSheetOverlay` in `v2-declarative-sheet.js`) is always applied when recomputing characters.

| Check | What to do | Pass criteria |
|--------|------------|----------------|
| V2 banner groups | GM rolls an **attack with damage**; pick a target | Banner shows **V2 intent** / **V2 review** / **V2 outcome** sections when chips exist (may be empty for some builds). |
| Damage + armor | Toggle **Use armor** on a character target if applicable | No console errors; chip costs still apply via **`applyV2BannerMutations`** where supported. |
| **`selectTargets`** | Use a character/weapon combo that exposes a **`selectTargets`** V2 chip | Primary **damage target** selected → chip enabled; click applies **`selectedTargetIds`** (watch network / state). |
| Dedupe | Ranger with **Hold Them Off** / **Ranger’s Focus** | Those features stay **out** of V2 strips (**`V2_REVIEW_ACTION_PHASE1_DEDUPE`**) — Phase 1 banner still owns them. |

### B. Phase 4 acceptance (after implementation)

| Area | What to do | Pass criteria |
|--------|------------|----------------|
| **Cross-sheet chips** | Party with a **Bard** (Rally) + at least one other PC; V2 sheet on; open **non-Bard** character hover/sheet | **Modifiers** row shows chips sourced from **`showOnOtherSheets`** (e.g. Rally spend) where the engine collects them; clicking applies mutations / Hope / **`partyDice`** and state updates for all clients (SSE). |
| **Rally persistence** | Spend / gain Rally dice, refresh or reconnect | Shared **`partyDice`** / **`featureState`** matches engine expectations (no stale infinite dice). |
| **Session boundary** | **Start Session** (or end-of-session path once wired) | Rally **`partyDice`** and session **`activeModifiers`** tied to Rally clear or reset per SRD/session rules. |
| **Token move hooks** | Drag a token that triggers a **`onTokenMove`** feature (when one exists on your test character) | **`_previousPositions`** behavior is correct (e.g. **Attack of Opportunity**-style predicates); mutations apply if any. |

### C. Not Phase 4 (don’t block on these for Phase 4 sign-off)

- Full **Phase 1 removal** for Rally / weapon tags — **strangler** until parity is proven.
- **Browser Playwright** for V2 — optional; unit tests cover engine + bridge math.

---

## Optional follow-ups

- Link this doc from **`docs/v2-migration-tracker.md`** V2 UI integration section when Phase 4 is **Done**.
- **`docs/v2-ui-integration-phase3-handoff.md`** — mark Phase 3 selection-chip follow-ups if **`multiSelect`** / **`isSelect`** banner UI lands later.
