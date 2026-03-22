# V2 UI integration — Phase 3 handoff

Phase 2 is implemented: **`src/client/lib/v2-action-loop-bridge.js`** builds `gameState`, hydrates `rolls` from banner payloads, runs **`createActionLoop`** → **`reviewAction`**, and **`collectV2ReviewActionChips`** feeds the **V2 review** strip on **`ResultBanner`** (when the V1/V2 declarative sheet toggle is on — same flag as Phase 1). GM clicks run **`activateV2ReviewChip`** + **`applyV2BannerMutations`** (`src/client/lib/table-ops.js`) and batch **`update-elements`** table ops. **`force: true`** on `collectV2ReviewActionChips` is for unit tests only.

**Dedupe:** `V2_REVIEW_ACTION_PHASE1_DEDUPE` hides **Hold Them Off** and **Ranger's Focus** chips here because Phase 1 banner UI already covers them.

---

## Phase 3 goals (weapon / armor tag phases)

Per the V2 Game Table integration plan (Phase 3 — Weapon and armor property phases):

1. **Intent + review for tags** — For the active weapon/armor on the roll, collect chips for **`intent`**, **`reviewAction`**, **`reviewOutcome`** as needed; align with Phase 1 tag automation and retire duplicate logic only after parity.

2. **Damage pipeline** — Ensure **`damageType`**, armor commitment (`useArmorByTargetId`), and target ids match engine / unit tests when hydrating **`gameState`** for property hooks.

3. **Mutations that still skip the router** — `rerollDie`, `addRollStatic`, `addDamageRoll`, etc. (see `applyV2BannerMutations` **`skipped`**) need explicit mapping to **`postBannerRerollDie`**, **`postBannerAddDamage`**, or banner data patches — or a dedicated mutation router test matrix.

4. **Selection chips** — UI for **`multiSelect`**, **`isSelect`**, and **`selectTargets`** (V2 review buttons show “Requires selection (Phase 3)” while disabled).

---

## Code pointers

| Topic | Location |
|--------|-----------|
| Phase 2 bridge | `src/client/lib/v2-action-loop-bridge.js` |
| Banner mutation router | `applyV2BannerMutations` in `src/client/lib/table-ops.js` |
| Banner UI | `ResultBanner` in `src/client/components/DiceRoller.jsx` |
| Wiring | `GMTableView.jsx` — `v2ReviewChipsByRollDbId`, `handleV2ReviewChip` |
| Tests | `test/unit/v2-action-loop-bridge.test.js`, `test/unit/table-ops.test.js` (`applyV2BannerMutations`) |

---

## Optional follow-ups

- Pass **`tableFeatureState`** from persisted `table_state` when the app loads root **`featureState`** (Phase 0).
- Expand **`V2_REVIEW_ACTION_PHASE1_DEDUPE`** as more Phase 1 banner paths gain parity with V2 chips.
