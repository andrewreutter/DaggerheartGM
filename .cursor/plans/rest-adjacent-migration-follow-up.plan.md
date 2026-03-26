---
name: Rest-adjacent migration follow-up
overview: "Execute through **Tier 2**: (1) fix **`runV2RestHooksForTable`** so acknowledge uses **`shortRest` vs `longRest`** matching the rest banner; tests. (2) Audit SRD-tagged consumables/items for rest-adjacent copy vs chip placement; migrate **Sweet Moss** to **`placement: 'rest'`** with **`when(isRestAction)`** retained; docs touchpoints."
todos:
  - id: tier1-rest-hook-action-type
    content: "Parameterize runV2RestHooksForTable(restDuration); GMTableView runRestCycleClear passes short vs long; regression tests (e.g. long-rest-only onRest)"
    status: completed
  - id: tier2-audit
    content: "Audit src/features-v2/consumables (+ items with rest copy) — table of during-rest vs automatic vs placement; note migrate/no-migrate; short appendix in docs or plan-linked summary"
    status: completed
  - id: tier2-sweet-moss
    content: "Sweet Moss — placements ['rest'] (drop ['intent']), verify collectV2RestPlacementChipsForCharacter + activateV2RestPlacementChip; unit tests; CONV/feature guide if needed"
    status: completed
isProject: true
---

# Rest-adjacent follow-up — Tier 1 + Tier 2 (execution scope)

User request: **do everything through Tier 2** — implement correctness (Tier 1), complete audit + Sweet Moss migration (Tier 2). Tier 3 items from the original analysis remain explicitly out of scope (no blanket consumable migrations beyond audit conclusions).

---

## Tier 1 — `runV2RestHooksForTable` rest kind (correctness)

**Problem:** [`runV2RestHooksForTable`](src/client/lib/v2-action-loop-bridge.js) synthesizes `gameState.action.type` as **`shortRest` always**, while Long Rest acknowledge in [`GMTableView.jsx`](src/client/components/GMTableView.jsx) `runRestCycleClear` should drive **`longRest`** for registry code that gates on `table.action?.type === 'longRest'` (e.g. [`InspirationalWords.js`](src/features-v2/abilities/Grace/InspirationalWords.js), multiple subclasses/Splendor hooks).

**Work:**

1. Add a parameter, e.g. `restDuration: 'short' | 'long'` (or `actionType: 'shortRest' | 'longRest'`), default `'short'` for backward compatibility in tests.
2. Set `gameState.action.type` and `actionConfig.type` to `shortRest` or `longRest` accordingly (mirror [`buildRestBannerTableForCharacter`](src/client/lib/v2-action-loop-bridge.js) ~603).
3. [`GMTableView.jsx`](src/client/components/GMTableView.jsx): when calling `runV2RestHooksForTable`, pass **`long`** when the acknowledged rest banner is Long Rest (`roll._restDuration === 'long'`), else **`short`**.
4. **Tests:** Bridge unit test(s) proving long-rest ack path uses `longRest`; optional feature-level test that a `longRest`-only `onRest` body runs (fixture or InspirationalWords-style stub).

**Design note:** Start with **one pass per acknowledge** (`short` vs `long` matching the banner). If a regression test shows a mechanic needs both semantics on long rest, document and add a second pass (out of scope unless Tier 1 tests require it).

---

## Tier 2 — Audit + Sweet Moss

### 2a. Audit (deliverable: written table)

Scan at least:

- [`src/features-v2/consumables/*.js`](src/features-v2/consumables/) — any “during a rest / at rest / next rest” language vs current **`placements`**, **`onRest`**, **`when(isRestAction)`** usage.
- [`src/features-v2/items/`](src/features-v2/items/) — e.g. Premium Bedroll, Fire Jar (narrative-only).

For each row: **category** (explicit during-rest choice / automatic on acknowledge / buff expiry / narrative-only), **current mechanism**, **migrate to `rest`?** (yes/no + one-line reason). **No additional** `placement: 'rest'` migrations in this milestone unless the audit flags a trivial follow-up the implementer chooses to batch with Sweet Moss (default: **only Sweet Moss**).

Output: short appendix — acceptable locations: subsection in [`docs/v2-v1-cutover.md`](docs/v2-v1-cutover.md) matrix notes, or a small `docs/rest-adjacent-audit.md` (only if you want a standalone file; otherwise inline in PR + cutover row).

### 2b. Sweet Moss — migrate to `placement: 'rest'`

**Current:** [`SweetMoss.js`](src/features-v2/consumables/SweetMoss.js) — `when(isRestAction, { placements: ['intent'], ... })` — `isRestAction` already restricts to short/long rest, but the chip is collected on the **intent** phase, not the Rest banner.

**Target:** `placements: ['rest']` only (remove `'intent'`). Behavior stays the same: `onUse` rolls d10 and clears HP or Stress; **verify** `collectV2RestPlacementChipsForCharacter` includes `when()`-wrapped chips and [`activateV2RestPlacementChip`](src/client/lib/v2-action-loop-bridge.js) / [`GMTableView`](src/client/components/GMTableView.jsx) `handleRestBannerV2Chip` apply mutations correctly.

**Tests:** Update or add consumable unit test under `test/unit/features-v2/consumables/` if present; ensure rest placement collection test covers Sweet Moss visibility when inventory has moss.

**Docs:** [`docs/v2-code-conventions.md`](docs/v2-code-conventions.md) — one sentence if needed (intent vs rest placement for consumables); [`docs/feature-authoring-guide.md`](docs/feature-authoring-guide.md) — optional example cross-link.

---

## Out of scope (Tier 3+)

- Migrating Major potions, Death Tea, Premium Bedroll, or other automatic `onRest` mechanics to **`placement: 'rest'`**.
- Replacing the `onRest` hook system wholesale.

---

## Verification

- `npm run test:unit` — bridge + Sweet Moss + any new InspirationalWords/long-rest regression.
- Manual: Long Rest acknowledge refreshes Inspirational Words tokens (or equivalent long-rest-only `onRest` effect visible in state).
