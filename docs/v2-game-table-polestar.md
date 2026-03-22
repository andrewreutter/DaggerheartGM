# V2 Game Table — polestar plan

**Canonical north-star for finishing the V1 → V2 Game Table cutover.** Other docs stay authoritative for detail; **start here** when deciding what to build next or how to measure “done.”

| Doc | Role |
|-----|------|
| This file | **Goals, phases, exit criteria, and order of operations** |
| [`v2-v1-cutover.md`](v2-v1-cutover.md) | **Parity matrix** — behavior → Phase 1 vs V2 direction (update rows as call sites disappear) |
| [`v2-migration-tracker.md`](v2-migration-tracker.md) | **SRD feature coverage** in `src/features-v2/` (separate from table wiring) |
| [`v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md) | Bridge hardening history + deferred items |
| [`v2-ui-integration-phase3-handoff.md`](v2-ui-integration-phase3-handoff.md) | Review-action / banner UX |
| [`v2-ui-integration-phase4-handoff.md`](v2-ui-integration-phase4-handoff.md) | Cross-sheet / Rally |
| [`v2-ui-integration-phaseD-handoff.md`](v2-ui-integration-phaseD-handoff.md) | Facade + Phase D/E notes |
| [`feature-authoring-guide.md`](feature-authoring-guide.md) | Engine contracts for V2 features |

---

## 1. North-star definition (exit criteria)

The project is **done** with the Game Table cutover when **all** of the following are true:

1. **No Phase 1 package on the Game Table critical path**  
   With the V2 declarative sheet flag on (`isV2DeclarativeSheetEnabled` / live toggle / `?v2Sheet=1`), table code does **not** import or execute **`src/features/hooks.js`** or **`src/features/registry.js`** (directly or via `game-table-mechanics.js`).  
   *Exception (temporary):* pure re-exports in `src/features/entity.js` / `roll.js` that only forward to `table-entity-roll.js` are OK until those entry points are deleted or inlined.

2. **Mechanics come from V2 + bridges**  
   Rolls, damage, banners, chips, session/rest hooks, and virtual weapons are driven by `src/features-v2/` + `v2-action-loop-bridge.js` + `v2-cross-sheet-lifecycle.js` + `table-ops.js` apply helpers + `table-entity-roll.js` wrappers — not `runHook(weaponFeatures | ancestryFeatures, …)` or registry maps.

3. **Shared recompute aligns**  
   `character-calc.js` does not use Phase 1 `weaponFeatures` / `armorFeatures` / `classFeatures` / `originFeatures` as the **authoritative** path when the V2 sheet flag is on; V2 gear + declarative merge is the source of truth (Phase 1 may remain for flag-off or legacy Daggerstack paths until explicitly removed).

4. **Debt is closed or explicitly out-of-scope**  
   Items listed under **§5** here are either implemented or recorded in [`v2-migration-tracker.md`](v2-migration-tracker.md) **Tech Debt** / handoff docs with a **won’t-fix / later** reason (not silently drifting).

5. **Regression bar**  
   `npm run test:unit` green; **one** Playwright “golden path” scenario (V2 sheet on, roll → acknowledge → state change) green in CI or documented as blocked with issue id.

---

## 2. Product decision (prerequisite)

**Abilities and content gaps:** Many SRD rows are still **Unclaimed** in the tracker. Before claiming “V2-only table,” choose and document:

- **(A) Gate:** V2-only mode requires minimum ability/ancestry coverage **or**
- **(B) Hybrid:** allow logged fallbacks when `activeFeatures` lacks a row (hybrid must be **explicit** in UI/logs, not silent).

Record the choice in [`v2-migration-tracker.md`](v2-migration-tracker.md) (summary or V2 UI backlog) so implementers do not re-debate it.

---

## 3. Current state (snapshot)

- **Facade:** [`game-table-mechanics.js`](../src/client/lib/game-table-mechanics.js) centralizes Phase 1 imports and gates **registry fallbacks** with `shouldUsePhase1RegistryFallback()`. Table components import the facade, not `src/features/` paths — but **Phase 1 is still bundled and used** when the flag is off or where registry paths remain.
- **Cutover matrix:** [`v2-v1-cutover.md`](v2-v1-cutover.md) lists parallel stacks and remaining Phase 1 call sites.
- **Phase B (bridge):** Partition + server follow-ups largely landed; some items deferred (Rally on non-owner banners, session vs scene end) — see tracker § V2 UI integration backlog.

---

## 4. Recommended phase order (the rest of the way)

Work **roughly** in this order; later phases can overlap once contracts are stable.

### Phase F — Close known bridge gaps

**Goal:** Nothing important falls through `applyV2BannerMutations` as `skipped` without a test or a deliberate “unsupported” path.

- Audit `skipped` / `unsupported` in [`table-ops.js`](../src/client/lib/table-ops.js) + `handleV2ReviewChip` in `GMTableView.jsx`.
- Extend [`test/unit/table-ops.test.js`](../test/unit/table-ops.test.js) mutation matrix as new types appear.
- Resolve or defer: **Rally** merge on pending banners when actor ≠ Bard; **session vs scene end** for `partyDice` / `activeModifiers` (align with tracker Tech Debt + Phase 4 handoff).

**Exit:** Each engine mutation type from V2 chip activation either applies locally, routes to `postBannerAddDamage` / `postBannerRerollDie`, or is listed as unsupported with a unit test asserting the partition.

### Phase G — Session / ancestry / class surfaces off registry

**Goal:** `GMTableView` no longer needs `ancestryFeatures`, `classFeatures`, `virtualWeaponBehaviors` from Phase 1 for **session start**, **virtual weapon ack**, **onFeatureActivated**, **ancestry banner reactions** (or those paths are **one** thin adapter that calls V2-only APIs).

- Follow rows in [`v2-v1-cutover.md`](v2-v1-cutover.md) § parity matrix (#17–27, #29–30).
- Prefer V2 `hooks.onSessionStart`, declarative `featureState`, and banner chip collection over `runHook` on registry maps.

**Exit:** Matrix rows updated; no `runHook(registry, …)` for these behaviors when V2 flag on.

### Phase H — Weapon / armor tag pipeline (DiceRoller + HoverCard)

**Goal:** `DiceRoller` and `CharacterHoverCard` do not depend on `weaponFeatures` for mechanical tag automation, `rewriteDamage`, `bannerInteraction`, or `buildWeaponRollText` when V2 owns the sheet.

- See [`v2-ui-integration-phaseD-handoff.md`](v2-ui-integration-phaseD-handoff.md) § Phase E items 4–5.
- Unify with V2 weapon properties + `applyDeclarativeFeatures` / `activeFeatures` rows.
- Retire duplicate **Pompous** / name-based gating in `CharacterDisplay` when V2 supplies `isDisabled` / reasons (tracker backlog: `weaponRenderHints`).

**Exit:** `shouldUsePhase1RegistryFallback()` false ⇒ no Phase 1 weapon tag reads in those components.

### Phase I — `game-table-mechanics.js` deletion or hollowing

**Goal:** Remove `import … from '../../features/hooks.js'` and `'../../features/registry.js'` from the facade.

- Move any remaining helpers to `table-entity-roll.js`, `game-table-mechanics-v2.js`, or colocated modules that only import `src/features-v2/`.
- Delete re-exports of `weaponFeatures`, `armorFeatures`, etc., from the table bundle.

**Exit:** Grep `src/features/` under `src/client/lib/game-table-mechanics.js` → **no matches**.

### Phase J — `character-calc.js` V2-only path

**Goal:** With V2 flag on, passive mods and thresholds come from V2 registry + merge overlay; Phase 1 registry is not consulted for duplicates.

- Follow **Phase C** in the original V2-only plan (merge helper / single authority).

**Exit:** Conditional imports or branches: no `weaponFeatures[name]` for mechanical resolution when declarative V2 sheet enabled.

### Phase K — Documentation + cleanup

When architecture or imports change: update [`.cursor/rules/project.mdc`](../.cursor/rules/project.mdc), [`README.md`](../README.md), [`v2-v1-cutover.md`](v2-v1-cutover.md) import surface, and tracker backlog / Tech Debt rows per project rules.

### Phase L — Optional hardening

- **Playwright golden path** (V2 on): character roll → banner ack → SSE/table state assertion.
- **E2E** for deferred Rally / session-end once product locks behavior.

---

## 5. Linked debt (do not lose track)

These overlap the polestar but are **tracked in detail** elsewhere — pull into phases above when touching related code:

| Topic | Where |
|-------|--------|
| `substituteArmorForHope` / armor slot reduction generalization | Tracker § Tech Debt |
| `hooks.onSceneEnd` vs session end | Tracker § Tech Debt + Phase 4 handoff |
| Camaraderie / Tag Team table flows | Tracker § Tech Debt |
| Sorcerer `domainLoadout` / vault on live table | Tracker § Tech Debt |
| Pending damage helpers consistency | Tracker § Tech Debt |
| Beastform-aware framework consolidation | Tracker § Tech Debt + Druid work |

---

## 6. How to use this doc

1. **Starting a table-focused task:** Read **§4** for phase, **§1** for exit checks, **v2-v1-cutover.md** for the exact call site.
2. **Starting SRD coverage:** Use **v2-migration-tracker.md** and agent prompts — that work **feeds** Phase G–J but does not replace table wiring.
3. **Closing the program:** Re-run **§1** checklist; update **v2-v1-cutover.md** status column to “VTT done” or remove rows when Phase 1 references are gone.

---

*Last updated: 2026-03-22 — initial polestar (supersedes ad-hoc “V2-only plan” threads as the single entry point).*
