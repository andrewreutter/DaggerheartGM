# V2 Game Table — polestar plan

**Canonical north-star for finishing the V1 → V2 Game Table cutover.** Other docs stay authoritative for detail; **start here** when deciding what to build next or how to measure “done.”

| Doc | Role |
|-----|------|
| This file | **Goals, phases, exit criteria, and order of operations** |
| [`v2-v1-cutover.md`](v2-v1-cutover.md) | **Analysis + parity matrix** — VTT bridge vs V2 engine; [completion plan](../.cursor/plans/v2-game-table-cutover-completion.plan.md) |
| [`docs/v2-migration-tracker-snapshot.md`](v2-migration-tracker-snapshot.md) (GitHub `v2-migration` Issues) | **SRD feature coverage** in `src/features-v2/` (separate from table wiring) |
| [`v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md) | Bridge hardening history + deferred items |
| [`v2-ui-integration-phase3-handoff.md`](v2-ui-integration-phase3-handoff.md) | Review-action / banner UX |
| [`v2-ui-integration-phase4-handoff.md`](v2-ui-integration-phase4-handoff.md) | Cross-sheet / Rally |
| [`v2-ui-integration-phaseD-handoff.md`](v2-ui-integration-phaseD-handoff.md) | Facade + Phase D/E notes |
| [`feature-authoring-guide.md`](feature-authoring-guide.md) | Engine contracts for V2 features |

---

## 1. North-star definition (exit criteria)

The project is **done** with the Game Table cutover when **all** of the following are true:

1. **No legacy `src/features/` package**  
   The removed Phase 1 tree must **not** be reintroduced. Table and character code should import **`src/client/lib/table-entity-roll.js`**, **`src/client/lib/feature-hook-dispatch.js`**, and **`src/client/lib/game-table-mechanics.js`** (V2 **`activeFeatures`** facade), not deleted `hooks.js` / `registry.js` paths.

2. **Mechanics come from V2 + bridges**  
   Rolls, damage, banners, chips, session/rest hooks, and virtual weapons are driven by **`src/features-v2/`** + `v2-action-loop-bridge.js` + `v2-cross-sheet-lifecycle.js` + `table-ops.js` apply helpers + `table-entity-roll.js` wrappers.

3. **Shared recompute aligns**  
   `character-calc.js` merges SRD data with **`src/features-v2/registry.js`** and related descriptors; character elements expose merged **`activeFeatures`** for the Game Table.

4. **Debt is closed or explicitly out-of-scope**  
   Items listed under **§5** here are either implemented or recorded in [`docs/v2-migration-tracker-snapshot.md`](v2-migration-tracker-snapshot.md) (GitHub `v2-migration` Issues) **Tech Debt** / handoff docs with a **won’t-fix / later** reason (not silently drifting).

5. **Regression bar**  
   `npm run test:unit` green; **one** Playwright “golden path” scenario (V2 sheet on, roll → acknowledge → state change) green in CI or documented as blocked with issue id.

---

## 2. Product decision (prerequisite)

**Abilities and content gaps:** Many SRD rows are still **Unclaimed** in the tracker. Before claiming “V2-only table,” choose and document:

- **(A) Gate:** V2-only mode requires minimum ability/ancestry coverage **or**
- **(B) Hybrid:** allow logged fallbacks when `activeFeatures` lacks a row (hybrid must be **explicit** in UI/logs, not silent).

Record the choice in [`docs/v2-migration-tracker-snapshot.md`](v2-migration-tracker-snapshot.md) (GitHub `v2-migration` Issues) (summary or V2 UI backlog) so implementers do not re-debate it.

---

## 3. Current state (snapshot)

- **Facade:** [`game-table-mechanics.js`](../src/client/lib/game-table-mechanics.js) re-exports **`wrapEntity` / `wrapRoll` / `wrapBanner`** from **`table-entity-roll.js`** and **`runCharacterHook`** from **`feature-hook-dispatch.js`**, and implements resolvers that read **only** merged **`activeFeatures`** (weapon/armor tags, Parry, etc.). Table components import the facade, not feature registry maps.
- **Declarative sheet overlay:** `src/client/lib/v2-declarative-sheet.js` (`mergeV2DeclarativeSheetOverlay` — always on).
- **Cutover matrix:** [`v2-v1-cutover.md`](v2-v1-cutover.md) lists parallel stacks and remaining UX gaps.
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

### Phase G — Session / ancestry / class surfaces

**Goal:** Session start, virtual weapon ack, `onFeatureActivated`, and ancestry banner reactions are fully driven by V2 **`activeFeatures`** + engine hooks (or one thin adapter), without duplicate name-based UI.

- Follow rows in [`v2-v1-cutover.md`](v2-v1-cutover.md) § parity matrix (#17–27, #29–30).
- Prefer V2 `hooks.onSessionStart`, declarative `featureState`, and banner chip collection.

### Phase H — Weapon / armor tag pipeline (DiceRoller + HoverCard)

**Goal:** `DiceRoller` and `CharacterHoverCard` rely on **`activeFeatures`** + `game-table-mechanics.js` for mechanical tag automation, `rewriteDamage`, `bannerInteraction`, and `buildWeaponRollText` integration.

- See [`v2-ui-integration-phaseD-handoff.md`](v2-ui-integration-phaseD-handoff.md) § Phase E items 4–5.
- Unify with V2 weapon properties + `applyDeclarativeFeatures` / `activeFeatures` rows.
- Retire duplicate **Pompous** / name-based gating in `CharacterDisplay` when V2 supplies `isDisabled` / reasons (tracker backlog: `weaponRenderHints`).

### Phase I — Facade hardening (optional)

**Goal:** Keep `game-table-mechanics.js` as a thin surface: wrappers + resolvers over **`activeFeatures`** only; no dead imports.

**Exit:** Grep under `src/client/lib/game-table-mechanics.js` for **`src/features/`** → **no matches** (already true after Phase E).

### Phase J — `character-calc.js` single authority

**Goal:** Passive mods and thresholds come from V2 registry + merge overlay; no duplicate mechanical resolution paths.

**Exit:** Weapon/armor features resolve through merged descriptors, not parallel legacy maps.

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
2. **Starting SRD coverage:** Use **docs/v2-migration-tracker-snapshot.md** and agent prompts — that work **feeds** Phase G–J but does not replace table wiring.
3. **Closing the program:** Re-run **§1** checklist; update **v2-v1-cutover.md** status column to “VTT done” or remove rows when obsolete.

---

*Last updated: 2026-03-22 — Phase E doc sweep: removed references to deleted `src/features/`; current imports are `table-entity-roll.js`, `feature-hook-dispatch.js`, `game-table-mechanics.js`, `src/features-v2/`.*
