# V2 UI integration — Phase B handoff (bridge hardening + banner parity)

**Prerequisite:** Phase A inventory is in [`docs/v2-v1-cutover.md`](v2-v1-cutover.md) (GMTableView.jsx ↔ Phase 1 ↔ V2 mapping).

**Phase B scope** matches the parent plan **“Finish open bridge debt (integration hardening)”** and the **Phase 3 / 4 handoff** items that are not yet closed.

---

## 0. UI symptoms & verification (mandatory for every milestone)

**Purpose:** Anyone opening the Game Table after a change should know whether **visible** behavior is expected to differ, and how to sanity-check without guessing.

### What to record when you finish a batch of work

1. **Should the user see a change in the UI?** Answer explicitly: **Yes** (with a short list of what/where) or **No** (normal browsing unchanged).
2. **If No:** Say so plainly — e.g. documentation-only, refactors with no route/component change, or internal-only fixes.
3. **If Yes:** List **symptoms** (new buttons, labels, banner text, console warnings, disabled states) and **how to trigger** them (V2 sheet flag, specific class, specific roll flow).
4. **Regression risk:** If the change fixes a crash or silent failure, note the **before** symptom (e.g. console error, stuck banner) vs **after** (flow completes).
5. **DB character exhibitability (always required when Yes or when the change is Game Table–visible):** State explicitly whether a **character persisted in our DB** (normal `PUT /api/data/characters` / Library row, then placed on the Game Table so server resolution merges library base + `CHARACTER_RUNTIME_KEYS`) can exhibit the behavior. Include **Yes** or **No**, and why:
   - **Yes:** What the stored character must contain (e.g. `class` / `classId`, `subclass` / `subclassId`, level, weapons, feature lists) and what the GM/player must do on the table (flags like V2 declarative sheet, roll type, targets on map if range matters). If only some builds show it, say which.
   - **No:** Say so (e.g. only covered by unit tests with `force: true`, requires content not yet in `features-v2`, or requires adversaries/tokens/layout not present in a minimal library character). Do not imply every table character will see the UI if they will not.

### Pass-the-baton rule

When you add or update **any** V2 UI integration handoff doc after this one (e.g. Phase C cutover, Phase D table runtime), **copy this entire section (“## 0. UI symptoms & verification”)** into that doc and fill it in for **your** batch. The next agent must do the same so the chain stays consistent.

### Phase A baseline (inventory + registry import fix)

For the work that produced this Phase B handoff alongside [`docs/v2-v1-cutover.md`](v2-v1-cutover.md):

- **Default:** You should **not** see new UI, layout changes, or different copy from that work alone — it was mostly documentation and tracker/README/project updates.
- **Exception:** `GMTableView.jsx` now **imports `virtualWeaponBehaviors`** correctly. That only affects **virtual weapon** ack flows (`_featureNeedsTarget`, select target then GM acknowledges) — e.g. **Retracting Claws**-style behavior. **Before:** that path could throw a runtime error (`ReferenceError`) when the code ran. **After:** the same flow should complete without that error. If you never use that flow, you will notice nothing.

### Phase B delivery (bridge hardening + V2 review pickers)

- **Yes — visible when V2 declarative sheet is on** (`?v2Sheet=1` / user toggle): V2 review chips that need **`isSelect` / `selectTargets` / `multiSelect`** show a **card-style row** with options (dropdown or checkboxes) and/or target buttons and an **Apply** button instead of a permanently disabled “Requires option pick” line. Chips with no picker still use a single violet button.
- **Trigger:** Pending attack banner with damage, subclass/weapon V2 **`reviewAction`** chips that expose those fields (e.g. multi-target damage add-ons once dedupe allows them).
- **Regression risk:** **Before:** `console.warn` on every activation that queued `addDamageRoll` or Hope/Fear reroll; extra damage / rerolls did not hit the server. **After:** those mutations call **`postBannerAddDamage`** / **`postBannerRerollDie`**; GM may see **replacement banners** (chained `_rollDbId`) when multiple extra damage lines are queued. Unsupported dice rerolls (`gmDie`, `damageDie`) still warn.
- **DB character exhibitability:** **Partial.** Any **stored Library character** that the app resolves with V2 (`loadCharacterFeatures` + registry) can drive **simple** V2 review chips (single violet **Apply** / no sub-picker) on a **weapon attack with damage** once they are on the table, **if** their class/subclass/weapon path yields a matching `reviewAction` chip for that roll (see `collectV2ReviewActionChips` — requires `_attackerInstanceId`, damage sub-items, and SRD-backed features). **Picker** UI (`isSelect` / `selectTargets` / `multiSelect`) only appears when a collected chip actually defines those callbacks; many migrated subclasses use them (e.g. Ranger **Hold Them Off** has `multiSelect` + `selectTargets`, Warrior **Attack of Opportunity** outcome has `multiSelect` + `isSelect`), but **Hold Them Off / Ranger’s Focus** are often **hidden on the V2 banner** while `V2_REVIEW_ACTION_PHASE1_DEDUPE` still dedupes against Phase 1 (`v2-action-loop-bridge.js`), so a **typical DB Ranger** may **not** see the new picker for those features until dedupe is removed or Phase 1 duplicates are off. A character must still have the usual library fields (`class`, `subclass`, weapons on the sheet, etc.); purely empty or incomplete rows will not load the right V2 chips. **Conclusion:** exhibitability is **build- and dedupe-dependent**; do not assume every stored character shows the picker—verify against a specific class/subclass + V2 flag + attack flow.

---

## 1. Objectives

1. **Reduce `skipped` mutations** from `applyV2BannerMutations` (`src/client/lib/table-ops.js`) by routing engine mutations that need server dice or banner replacement to the existing APIs (`postBannerRerollDie`, `postBannerAddDamage`, banner PATCH endpoints, etc.).
2. **Unblock or simplify V2 review chips** that currently no-op in `handleV2ReviewChip` (`GMTableView.jsx`): `multiSelect`, `isSelect` (function), and `selectTargets` without a prior selection — align with `ResultBanner` UX or engine constraints.
3. **Optional parity:** Merge **`showOnOtherSheets` / Rally** review chips into the banner path when the actor is not the Bard (tracker + [`docs/v2-ui-integration-phase4-handoff.md`](v2-ui-integration-phase4-handoff.md)).
4. **Lifecycle alignment:** Session vs scene end for Rally `partyDice` / `activeModifiers` — tie to GM session cycle or a dedicated op; coordinate with `dispatchSceneEndHooks` vs `hooks.onSessionStart` / table clears (see **Tech Debt** in [`docs/v2-migration-tracker.md`](v2-migration-tracker.md) and Phase 4 handoff).
5. **Shrink `V2_REVIEW_ACTION_PHASE1_DEDUPE`** (`v2-action-loop-bridge.js`) only after Phase 1 duplicate UI is off for those features (e.g. Hold Them Off, Ranger’s Focus).

---

## 2. Code pointers

| Topic | Location |
|--------|-----------|
| Banner mutation router | `applyV2BannerMutations`, `applyV2LifecycleMutations` — `src/client/lib/table-ops.js` |
| V2 chip activation | `activateV2ReviewChip`, `collectV2ReviewActionChips` — `src/client/lib/v2-action-loop-bridge.js` |
| GM wiring | `handleV2ReviewChip`, `v2ReviewChipsByRollDbId` — `src/client/components/GMTableView.jsx` |
| Banner UI (selection / disabled) | `ResultBanner` — `src/client/components/DiceRoller.jsx` |
| Dedupe set | `V2_REVIEW_ACTION_PHASE1_DEDUPE` — `src/client/lib/v2-action-loop-bridge.js` |
| Tests (extend) | `test/unit/table-ops.test.js`, `test/unit/v2-action-loop-bridge.test.js` |

---

## 3. Suggested task order

1. **Instrument `skipped`** — Log or unit-test a **mutation matrix**: for each `type` the engine can emit, assert either applied row updates or explicit server follow-up (no silent `default` skip unless documented).
2. **Map `rerollDie` / `addDamageRoll` / `addRollStatic`** (and any other skipped types) to banner API flows used by Phase 1 chip paths (`handleChipResolve` already calls `postBannerAddDamage` / `postBannerRerollDie`).
3. **Selection UX** — `DiceRoller.jsx`: replace “Phase 3” placeholder disables with real target selection or reduce chips to `selectOpts` populated from banner state (see Phase 3 handoff §4).
4. **`tableFeatureState` audit** — Confirm `app.jsx` + SSE hydration matches Phase 0 docs if any gap remains for root `featureState` vs character `featureState`.
5. **Rally cross-sheet** — If required for parity: merge `collectChipsForOtherCharacterSheets` into pending banner construction for non-owner actors (`GMTableView` / `DiceRoller`); else document deferral in tracker.
6. **Documentation** — Update tracker backlog rows + Tech Debt when items close; touch `.cursor/rules/project.mdc` / `README.md` only if API or flags change.

---

## 4. Exit criteria (Phase B done)

- [ ] No unexplained `console.warn('[V2] Banner mutations not applied…')` for **golden-path** subclass features (pick 2–3 covered subclasses in tests).
- [ ] `applyV2BannerMutations` tests cover **each** mutation `type` the engine can emit — either applied or explicitly routed to a server-side follow-up.
- [ ] At least one of: **multi-select / select-targets** V2 chips works end-to-end on the Game Table, or **engine + docs** state that those chips are GM-only / simplified for VTT.
- [ ] Tracker: Phase B row under **V2 UI integration backlog** marked done or deferred with reason + link.

---

## 5. Out of scope for Phase B (defer to Phase C–D)

- Removing Phase 1 imports from `GMTableView.jsx` (Phase D).
- `character-calc.js` authoritative V2-only recompute (Phase C).
- Full abilities coverage in `features-v2` (ongoing migration).
