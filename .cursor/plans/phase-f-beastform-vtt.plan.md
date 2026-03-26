---
name: Phase F Beastform VTT
overview: Close Phase F milestone "Beastform / Druid" by (1) exiting beastform via the same setFeatureState mutations as Druid clearBeastformState / table.source.set—not hand-merged featureState patches; (2) detecting Major+ drop via declarative metadata on the Fragile beastform sub-feature and merged activeFeatures—not SRD row helpers in GMTableView; then verifying advantage chips and docs.
todos:
  - id: fragile-declarative
    content: Add generic declarative field(s) on beastforms/shared/Fragile.js; document in feature-authoring if needed
    status: pending
  - id: fragile-detect
    content: "GMTableView (or thin helper): Major+ drop when merged activeFeatures includes a row with that flag (no name-matching in shell)"
    status: pending
  - id: exit-mutations
    content: "Reuse single mutation path for clearBeastformState: emit setFeatureState ops matching V2 drop chip; avoid bespoke buildBeastformExitElementUpdates"
    status: pending
  - id: wire-gmtableview
    content: Update applyDamageToTarget to use exit mutations + declarative Fragile signal; last-HP path same mutations
    status: pending
  - id: verify-v2-drop-chip
    content: Trace Drop out chip to confirm damage path matches same serialized mutations / table-ops merge
    status: pending
  - id: unit-tests
    content: Tests for Fragile flag on merged rows + mutation list / applyTableOp shape for exit
    status: pending
  - id: docs-v2-cutover
    content: "Update docs/v2-v1-cutover.md §2–§4 / §3 row #15 per Phase F contract"
    status: pending
isProject: true
---

# Phase F — Beastform / Druid VTT parity (revised)

## Scope (from [`.cursor/plans/v2-game-table-cutover-completion.plan.md`](v2-game-table-cutover-completion.plan.md))

- **Fragile** (Major+ damage forces drop when the form has Fragile)
- **Advantage chip** (`selectedBeastformAdvantage` / +d6 on beastform attack)
- **Voluntary drop** (V2 "Drop out of Beastform" card chip + damage-driven drops)

Tracker: [`docs/v2-v1-cutover.md`](../../docs/v2-v1-cutover.md) §3 row **#15**, §4 **Tech debt**.

---

## Design split (two concerns)

| Concern | Direction |
|--------|-----------|
| **Exit / clearing** | Use the **same canonical mutations** as [`clearBeastformState`](../../src/features-v2/classes/Druid.js) (`table.source.set('activeBeastform', null)`, `evolutionTraitKey` null). On the VTT those become **`setFeatureState`** payloads; [`table-ops.js`](../../src/client/lib/table-ops.js) already clears legacy `activeBeastform` + `selectedBeastformAdvantage` when scoped `activeBeastform` is nulled (~433–435). **Do not** hand-assemble a deep `featureState` merge in GMTableView—**centralize** serialization once (shared with the V2 drop chip path) or call the same apply pipeline the chip uses. |
| **When to exit on damage** | **Fragile** is **declarative** on the per-beastform sub-feature module ([`shared/Fragile.js`](../../src/features-v2/beastforms/shared/Fragile.js)), e.g. a **generic** flag (threshold / severity) that merged `activeFeatures` exposes when the form is active. The shell checks **that flag**, not SRD JSON lookups and not `'Fragile'` string matches in [`GMTableView.jsx`](../../src/client/components/GMTableView.jsx). |

---

## Current state (verified)

| Area | What exists | Gap |
|------|-------------|-----|
| **Fragile auto-drop** | [`GMTableView.jsx`](../../src/client/components/GMTableView.jsx) `applyDamageToTarget` (~875–890) uses `(bf.features \|\| []).some(... /fragile/i)` — **`bf` is often minimal** `{ beastformId }` without embedded `features` → Fragile never triggers. | Replace with **merged `activeFeatures`** + **declarative** Fragile metadata. |
| **Beastform exit** | Damage path uses `updateActiveElement({ activeBeastform: null, selectedBeastformAdvantage: null })` only. | **`featureState[SRD_CLASS_DRUID_SCOPE_KEY].activeBeastform`** can remain set → [`table.me.inBeastform`](../../src/features-v2/engine/table.js) still true. **Fix:** emit **`setFeatureState`** equivalent to `clearBeastformState`, not legacy-only keys. |
| **Advantage chip** | [`CharacterHoverCard.jsx`](../../src/client/components/CharacterHoverCard.jsx) / [`CharacterDisplay.jsx`](../../src/client/components/CharacterDisplay.jsx) | Re-verify clears after unified exit. |
| **Voluntary drop** | [`Druid.js`](../../src/features-v2/classes/Druid.js) drop chip → `clearBeastformState` | **Reference** for what damage exit must match. |

**Note:** [`Druid.js`](../../src/features-v2/classes/Druid.js) `hooks.onStateChange` (0 HP) is **not** invoked from client (`dispatchStateChangeHooks` absent under `src/client/`). VTT last-HP drop stays in GMTableView for this milestone unless you explicitly expand scope.

---

## Implementation plan

### 1) Declarative Fragile (per-feature module)

- Extend [`shared/Fragile.js`](../../src/features-v2/beastforms/shared/Fragile.js) with a **generic** capability (exact key name TBD: e.g. severity threshold or `dropBeastformOnMajorOrGreaterDamage`) — **authoring lives here**, not in `engine/` or `v2-action-loop-bridge.js`.
- Ensure merged rows from `applyDeclarativeFeatures` / `activeFeatures` surface that field for characters **in** a Fragile form (existing virtualSources tests in [`beastform-features.test.js`](../../test/unit/features-v2/beastforms/beastform-features.test.js) inform expectations).

### 2) Damage path: detect + exit (no SRD helpers, no hand-built `featureState` patch)

- In **`applyDamageToTarget`**: if `hpLossToApply >= 2` (Major+), determine whether the **victim** has the Fragile capability **via merged `activeFeatures`** (or one shared helper that only reads **declarative** fields, not feature names).
- **Exit:** apply the **same mutations** as the V2 "Drop out" chip / `clearBeastformState` (serialize `setFeatureState` for Druid scope + `evolutionTraitKey`; rely on [`table-ops`](../../src/client/lib/table-ops.js) to mirror legacy clears). **Option:** extract `serializeClearBeastformMutations(instanceId)` used by both chip activation and damage path, or invoke existing V2 lifecycle apply with **one** mutation batch.
- **Last HP:** same exit mutation batch (not only `{ activeBeastform: null }`).

### 3) Voluntary drop + advantage parity

- Trace [`runV2OwnedCardChipTableAction`](../../src/client/lib/v2-owned-card-chip-table.js) / [`activateV2OwnedCardChip`](../../src/client/lib/v2-cross-sheet-lifecycle.js) for the drop chip; **damage path must produce identical net state**.
- Confirm `selectedBeastformAdvantage` clears on all exits (table-ops merge already tied to scoped clear).

### 4) Tests

- **Unit:** Fragile module carries declarative flag; merged features include it when Agile Scout (or similar) is active.
- **Unit:** `applyTableOp` / mutation batch for exit clears **both** scoped `featureState` and legacy fields (align with existing `setFeatureState` tests if any).
- **Optional:** pure helper `shouldDropBeastformFromDamage({ currentHp, hpLoss, hasFragileFlag })` for trivial cases.

### 5) Documentation

- [`docs/v2-v1-cutover.md`](../../docs/v2-v1-cutover.md): §2, §3 row **#15**, §4 tech debt; optional [`docs/srd-implementation.md`](../../docs/srd-implementation.md) if status changes.

---

## Framework boundaries (CONV-029)

- **No** new `if (feature.name === 'Fragile')` in [`src/features-v2/engine/`](../../src/features-v2/engine/) or [`v2-action-loop-bridge.js`](../../src/client/lib/v2-action-loop-bridge.js).
- **Do** put behavior on [`shared/Fragile.js`](../../src/features-v2/beastforms/shared/Fragile.js) and **generic** checks in the VTT that read **declarative** fields from merged rows.

---

## Manual QA

- Transform → Drop out chip vs damage-driven drop: **identical** `inBeastform` / sheet state.
- Fragile form + Major+ damage → drop + notification.
- Last HP → drop; advantage cleared.
- GM + assigned player where applicable.
