---
name: V2 Game Table cutover completion
overview: Phased plan to finish moving GMTableView/DiceRoller from imperative wrapper+hook dispatch toward engine-driven action loops—each phase closes with explicit updates to docs/v2-v1-cutover.md.
todos:
  - id: phase-6-banner
    content: "Phase A: Phase 6 banner pipeline cleanup + update docs/v2-v1-cutover.md (§2–§4 per phase contract below)"
    status: completed
  - id: ancestry-v2-convergence
    content: "Phase B: Ancestry/review convergence + update docs/v2-v1-cutover.md (§2–§4 per phase contract)"
    status: completed
  - id: damage-pipeline-hydration
    content: "Phase C: Damage pipeline hydration slices + update docs/v2-v1-cutover.md (§2–§4 per phase contract)"
    status: completed
  - id: weapon-intent-chips
    content: "Phase D: Unified phased banner (intent panel at top) + Devastating VTT integration + weaponRenderHints; update docs/v2-v1-cutover.md (§2–§4 per phase contract)"
    status: completed
  - id: hook-inventory-reduction
    content: "Phase E: runCharacterHook inventory closure + add §3.1 hook table in docs/v2-v1-cutover.md"
    status: completed
  - id: tracker-tech-debt
    content: "Phase F: Tracker tech-debt milestones + update docs/v2-v1-cutover.md (§3–§4 per milestone) — 3/4 milestones delivered (domain loadout remaining)"
    status: in_progress
isProject: true
---

# V2 Game Table cutover — completion plan

**Analysis of record:** `[docs/v2-v1-cutover.md](../../docs/v2-v1-cutover.md)`

**Constraints:** Framework code stays feature-agnostic (`[.cursor/rules/v2-framework-boundaries.mdc](../../.cursor/rules/v2-framework-boundaries.mdc)`). Per-feature behavior stays in `src/features-v2/`.

---

## Preconditions (already true)

- Legacy `**src/features/`** removed; `**game-table-mechanics.js`** resolves only from `**activeFeatures`**.
- Phase **2–4** UI integration and Phase **B/E** bridge work are **done** (see `[docs/v2-v1-cutover.md](../../docs/v2-v1-cutover.md)` § V2 UI integration backlog).
- **Selection chips** on V2 review banners: `**isSelect` / `multiSelect` / `selectTargets`** wired with Apply — not blocked.

---

## Documentation contract (mandatory every phase)

**Closing any phase is incomplete without updating** `[docs/v2-v1-cutover.md](../../docs/v2-v1-cutover.md)`.


| Section                              | When to change it                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **§2 Current architecture snapshot** | Dated facts, key files, flags (e.g. `ancestryBannerReactions` vs V2 strip), line counts if a major surface moved.                           |
| **§3 Parity matrix**                 | **Status** (`Hybrid` vs **Engine-first** for covered slices), **Current mechanism**, **Cutover target** when behavior or call sites change. |
| **§4 Explicit gaps**                 | Add/remove/reword when dual-banner, mutation-router, or tech-debt themes shift.                                                             |
| **§3.1 Hook dispatch inventory**     | Required by end of **Phase E** (see that phase). Earlier phases may add stub rows if hooks are removed early.                               |
| **§5 Maintenance**                   | Optional one-line “last updated” or phase label; at minimum keep the cross-reference to this plan accurate.                                 |


Use the **per-phase checklist** under each phase below; do not skip it.

---

## Phase A — Banner pipeline hygiene (immediate)

**Goal:** Remove dead legacy branches and align banner chip contracts before larger refactors.

**Execute the existing checklist:** `[.cursor/plans/phase-6-banner-pipeline-cleanup.plan.md](phase-6-banner-pipeline-cleanup.plan.md)`

- Strip unused `**feature.onBanner`** / `**bannerAction`** paths in `ancestryBannerReactions` once verified unused in `features-v2/`.
- Banner chips: `**chip.isVisible(chipContext)`** only (single arity).
- Remove `**acknowledge` / `cancel`** aliases on chips; use `**onBannerAck` / `onBannerReject`** only.
- `**getBannerNarration`:** weapon lines from `**automated` + `description`** (and `buildWeaponTagBannerNarrationParts`), not `f.onBanner`.
- Add regression test for automated weapon narration merge.

**Exit (code):** Fewer branches in `GMTableView.jsx` (banner / ack / narration areas); docs from Phase 6 plan (feature-cheatsheet, etc.) as listed there.

`**docs/v2-v1-cutover.md` updates (Phase A):**

- **§2:** Record removal of dead `onBanner` / `bannerAction` paths; single-arity banner `isVisible`; no chip `acknowledge`/`cancel` fallbacks; weapon banner narration source = `automated` + `buildWeaponTagBannerNarrationParts`.
- **§3:** Row **#11** (ancestry banner reactions) — tighten **Current mechanism** and note reduced imperative surface; row **#9** if narration/tag display path changed.
- **§4:** Bullet **Dual banner surfaces** — narrow wording if Phase A shrinks ancestry-only paths.

---

## Phase B — Ancestry / review convergence

**Goal:** One mental model for “things on the pending roll banner.”

1. Inventory `**ancestryBannerReactions`** entries that still rely on imperative `**onBanner` / `isVisible`** patterns vs V2 `**placement: 'banner'`** chips (e.g. Bone **I See It Coming**).
2. For each, ensure an equivalent **engine chip** + **visibility** path; then **delete** parallel GMTableView-only reaction construction.
3. Re-verify `**setBannerReactionsFallback`** / `DiceRoller` contract after shape changes.

**Exit (code):** `ancestryBannerReactions` either minimal (thin adapter) or merged into V2 collection pass; duplicate controls absent.

`**docs/v2-v1-cutover.md` updates (Phase B):**

- **§2:** Describe post-convergence relationship: `ancestryBannerReactions` vs `collectV2ReviewActionChips` (adapter only vs merged collection).
- **§3:** Row **#11** — update **Status** / **Current mechanism**; any rows affected by `DiceRoller` / fallback contract.
- **§4:** **Dual banner surfaces** — update or close out if the gap is materially smaller.

**Status (delivered):** Legacy `**ancestryBannerReactions`** and `**setBannerReactionsFallback`** wiring are **removed** from the client; there is no parallel GMTableView→`DiceRoller` reaction list. Interactive pending-roll UI is `**collectV2ReviewActionChips`** only. Bone **I See It Coming** uses V2 `**reviewAction`** chips (`src/features-v2/abilities/Bone/ISeeItComing.js`). `**docs/v2-v1-cutover.md`** §2 / §4 reflect the converged model.

---

## Phase C — Damage pipeline / `applyDamageToTarget`

**Goal:** Reduce ad hoc `GMTableView` branches (elemental channels, ranger focus, etc.) by driving **one** hydrated `gameState` per damage resolution.

**Incremental strategy (avoid big-bang):**

1. Document current call graph: `handleApplyDamage` → `applyDamageToTarget` → hooks / armor / Parry.
2. For **one** vertical slice (e.g. pure physical weapon damage), build `table` from `buildTableSnapshot`, run `**reviewAction` / `reviewOutcome`** hooks from engine, apply `**applyV2LifecycleMutations`** where applicable; keep server rolls in `api.js`.
3. Expand slice by slice; add `**test/unit`** fixtures per slice.
4. Track remaining `**runCharacterHook(..., 'onDamageReceived'|'onHpDealt')`** — migrate or justify.

**Exit (code):** Slices covered by tests; remaining hooks documented.

`**docs/v2-v1-cutover.md` updates (Phase C):**

- **§2:** Short note on damage path (which slices use hydrated `gameState` + engine phases); link to test files if helpful.
- **§3:** Rows **#2, #3, #4, #6, #7, #8** — for each **completed vertical slice**, set **Status** toward **Engine-first** (or add a footnote under the matrix listing slice names still **Hybrid**).
- **§4:** Only if Parry, armor, or mutation logging behavior changes materially.

---

## Phase D — Weapon tag intent + display

**Goal:** Match tracker **“Weapon property chips”** row: intent-phase controls for weapon tags where the engine already defines chips. **First vertical slice:** **Devastating** (intent placement, attack-scoped).

### UX lock — single phased banner (replaces “two surfaces” mental model)

**Intent:** One **continuous** dice/banner surface that **includes** what the old **pre-roll intent panel** did, at the **top**, instead of a separate `preRollBanner` overlay vs `DiceRoller` strip as two stops.

- **Phase A (top, always relevant when initiating):** Intent choices — experiences, advantage toggles, V2 **intent** chips (e.g. Devastating), difficulty (when shown), serialized player→GM intent, etc. Same **content** as today’s intent panel; **placement** is inside the unified component.
- **Phase B+ (below, when appropriate):** After the roll exists, **reviewAction** / **reviewOutcome** chips, target/armor controls, ack, etc. — the action **fills in** downward as phases apply (no duplicate intent row on the pending banner: intent stays in the upper section; post-roll strip remains review phases + read-only “used intent” lines as today).

**Implementation note:** This is a **refactor of presentation** (merge `preRollBanner` + `DiceRoller` / `ResultBanner` into one shell with sections), not a second copy of logic. GM vs player and mobile constraints still apply (touch targets, scroll, `postPlayerIntent` parity).

### Engine vs VTT — what “expand per weapon module” means (and does not)

**Does *not* mean:** Writing new SRD behavior in `src/features-v2/weapon_properties/` or extending the core engine for each tag. **Weapon property modules and `collectChips` are already the source of truth**; Devastating and other intent chips are already defined there.

**Does mean:** **VTT integration** — for each weapon property that exposes `**placements: ['intent']`**, verify and wire **end-to-end**:

1. **Synthetic pre-roll `gameState`** (attack + weapon + placeholder damage) matches what that chip’s `onUse` / `when()` expect.
2. **Mutations map** to the client roll (`postRoll` text/meta) and resource updates.
3. **Tests** for that tag’s bridge edge cases if something differs (e.g. toggle vs one-shot, stress timing).

So **“expand” = broaden integration coverage + fix mismatches**, not greenfield feature authoring. If a module already works in engine tests only, Phase D is when it becomes **true on the table** (or we document a **Blocked** gap).

1. `**CharacterDisplay` / weapon cards:** consume `**weaponRenderHints`** / `**isDisabled`** from merge; remove name-based gates where `**onRender`** supplies hints (`[docs/v2-v1-cutover.md](../../docs/v2-v1-cutover.md)` backlog).

**Exit (code):** “Click weapon → see intent chip(s) in the **unified banner (top)** → roll includes chosen effect”; Devastating slice complete; **integration checklist** for remaining intent weapon tags (no parallel feature-code track).

`**docs/v2-v1-cutover.md` updates (Phase D):**

- **§3:** Rows **#8, #9** — intent chips, `rewriteDamage` / roll-tag flow, **Status** when intent UI lands.
- **§2:** Single phased banner shell + which sections map to engine phases (intent vs review).

---

## Phase E — `runCharacterHook` inventory closure

**Goal:** End state is either **(a)** hook removed in favor of engine dispatch, or **(b)** documented exception.


| Hook name                        | Primary files                   | Action                                                   |
| -------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `onRoll`                         | GMTableView (preroll / proceed) | Align with `runV2IntentPhaseForTraitRoll` / intent chips |
| `onRollComplete`                 | GMTableView, weapon tags        | Post-resolve engine or banner mutation                   |
| `onDamageReceived` / `onHpDealt` | GMTableView                     | `onReviewOutcome` / resolve                              |
| `rewriteDamage`                  | CharacterHoverCard              | Declarative or `reviewAction`                            |


**Exit (code):** Each site migrated or intentionally retained.

`**docs/v2-v1-cutover.md` updates (Phase E):**

- **§3.1 Hook dispatch inventory** (new subsection after the parity matrix table): table with columns **Hook**, **Location**, **Disposition** (`removed` / `engine` / `exception: …`). Must cover `onRoll`, `onRollComplete`, `onDamageReceived`, `onHpDealt`, `rewriteDamage` at minimum.
- **§3:** Matrix rows **#7, #8, #10** — align **Status** / **Current mechanism** with §3.1.
- **§2:** If `wrapEntity` / `runCharacterHook` call volume drops sharply, note approximate direction (optional grep summary).

---

## Phase F — Tracker Tech Debt (prioritized product passes)

Pull from `[docs/v2-v1-cutover.md](../../docs/v2-v1-cutover.md)` **Tech Debt** and **V2 UI integration backlog**:

- **Rally (Phase F — delivered):** `crossSheetChips` + `collectV2ReviewActionChips` viewer/actor union for `showOnOtherSheets` `reviewAction` on ally banners; Start/End Session clears per-character and root `table_state.featureState.Rally`. Remaining: scene vs session lifecycle (tracker Tech Debt). Docs: `docs/v2-v1-cutover.md` §3/#15.
- **Beastform / Druid (Phase F — delivered):** VTT parity (Fragile, advantage chip, voluntary drop) per backlog row.
- **Rest banner (Phase F — delivered):** new declarative `**placement: 'rest'`** on the Rest banner (per character); **Potion of Stability** uses a rest chip → `**onUse`** → **CONV-011 `passiveStatMods`** (`numShortRestSlots` / `numLongRestSlots`); merged slot-count plumbing for banner UI. Plan: `[.cursor/plans/rest-banner-phase-f.plan.md](rest-banner-phase-f.plan.md)`.
- **Domain loadout / Channel Raw Power (Phase F — remaining):** persisted `**domainLoadout`** on table characters.

Each item is its own milestone with separate QA.

`**docs/v2-v1-cutover.md` updates (Phase F):**

- **§3:** Rows **#14, #15** (and new rows if you add them for Rally/rest/domain/beastform) — **Status** / **Current mechanism** after each closed milestone.
- **§4:** **Tech debt** bullets — align with tracker when items close (Rally clear, rest UI, domain loadout, Beastform VTT).

---

## Non-goals (unless explicitly reopened)

- Reintroducing `**src/features/`** or a global name → descriptor import map.
- Replacing `**wrapEntity`** everywhere in one PR — **incremental** migration only.
- Duplicating SRD feature names in `**engine/`** or `**v2-action-loop-bridge.js`** ([CONV-029](../../docs/v2-code-conventions.md)).

---

## Verification

- `**npm run test:unit`** after each phase; add tests for every behavior moved off imperative paths.
- Manual: GM + player + preview-as-player for banner and chip flows (`app.jsx` effective player props).
- `**docs/v2-v1-cutover.md`:** §2–§4 (and §3.1 after Phase E) updated per **Documentation contract** for that phase.

