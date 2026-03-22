# V2 UI integration — Phase D handoff (Game Table dispatch)

**Update (Phase D elimination):** The legacy **`src/features/`** tree and **`phase1-game-table-registry.js`** are **removed**. Canonical wrappers live only in **`src/client/lib/table-entity-roll.js`**. **`src/client/lib/game-table-mechanics.js`** is a **V2-only** facade over merged `activeFeatures` (`runCharacterHook`, tag resolvers; no Phase 1 registry).

## What landed

| Area | Change |
|------|--------|
| **Canonical wrappers** | `src/client/lib/table-entity-roll.js` — `wrapEntity`, `wrapRoll`, `wrapBanner`. |
| **Facade** | `src/client/lib/game-table-mechanics.js` — re-exports wrappers + `runCharacterHook` + resolvers that read **only** `activeFeatures` rows (V2 / character-calc). |
| **origin-lifecycle** | `wrapEntity` from `table-entity-roll.js` only. |

## Follow-up

Earlier revisions of this handoff described Phase 1 registry fallbacks; those import paths are gone. See **`docs/v2-v1-cutover.md`** for the parity matrix and **`docs/v2-migration-tracker.md`** for the V2 UI integration backlog.

## Regression

- `npm run test:unit` — includes `test/unit/game-table-mechanics.test.js`.
