---
name: ""
overview: ""
todos: []
isProject: false
---

# Rest Move Definitions, Target-Ally, Roll-Dice, and onApply

## Overview

Extend short/long rest move definitions with optional `canTargetAlly`, `rollDice`, and `onApply` hooks; use a **parameter on existing roll endpoints** for silent rolls (no banner); extend rest selection state and UI for target-ally and dice moves; run onApply on acknowledge using entity wrappers.

---

## 1. Silent roll: parameter on existing endpoints

**Approach:** Use a request-body parameter on the **existing** roll endpoints instead of new routes.

- **Endpoints:** `POST /api/room/my/roll` and `POST /api/room/:gmUid/roll` (unchanged).
- **Parameter:** e.g. `_silent: true` in the request body.
- **Behavior when `_silent` is true:**
  - Server builds roll data exactly as today (same `buildRollData` / roll evaluation).
  - Server **does not** call `appendRollLog` (no DB write, no `notifyChange('banners')`).
  - Server returns the same JSON shape (e.g. `subItems`, `total`, etc.) so the client can read the single-die `value` (e.g. for `1d4`) from `subItems[0].result` or a derived `total`.
- **Client:** `postRoll(rollText, displayName, gmUid, { _silent: true })` (or a thin `postRollSilent(rollText, gmUid)` that passes `_silent: true` and returns the result). No new route, no new server handler beyond a conditional in the existing roll handler.

**Files:** [server.js](server.js) (in the existing `POST /api/room/my/roll` and `POST /api/room/:gmUid/roll` handlers), [src/client/lib/api.js](src/client/lib/api.js) (optional `postRollSilent` wrapper or document `_silent` in `postRoll`).

---

## 2. Wrapper capabilities per move

Below: for each rest move (or shared capability), what the **wrapper** must provide for `onApply(rest, roll, target, char)`. “Existing” = already on `wrapEntity` in [src/features/entity.js](src/features/entity.js); “New” = needs to be added.


| Move (or capability)   | Wrapper usage                                | Capability                                     | Status                                              |
| ---------------------- | -------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- |
| **Tend to Wounds**     | `target.clearHp(roll.value + char.tier)`     | `target.clearHp(n)`                            | Existing                                            |
|                        |                                              | `char.tier` (actor’s tier)                     | Existing (spread from resolved character `el.tier`) |
| **Clear Stress**       | `target.clearStress(roll.value + char.tier)` | `target.clearStress(n)`                        | Existing                                            |
|                        |                                              | `char.tier`                                    | Existing                                            |
| **Repair Armor**       | `target.clearArmor(roll.value + char.tier)`  | `target.clearArmor(n)`                         | Existing                                            |
|                        |                                              | `char.tier`                                    | Existing                                            |
| **Prepare**            | Hope gain (self or party)                    | `char.gainHope(n)`                             | Existing                                            |
| **Tend to All Wounds** | Clear all HP on target                       | `target.clearHp(n)` with large n (e.g. maxHp)  | Existing (clearHp caps at maxHp)                    |
| **Clear All Stress**   | Clear all stress                             | `target.clearStress(n)` with large n           | Existing                                            |
| **Repair All Armor**   | Clear all armor slots                        | `target.clearArmor(n)` with large n            | Existing                                            |
| **rest context**       | Future: roll dice during onApply             | `rest.roll(expr)` → `Promise<{ dice, value }>` | **New** (optional for first phase)                  |


**Summary:**

- **Entity (target / char):** All required methods and properties for the listed moves already exist: `clearHp`, `clearStress`, `clearArmor`, `gainHope`, and `tier` (from resolved character element spread onto the entity). **No new entity capabilities** are required for the initial move set.
- **Rest context:** `rest.roll(expr)` is **new** and optional for the first implementation; add it if we introduce a move that rolls at apply-time (e.g. via existing roll endpoint with `_silent: true`).

---

## 3. Move definition shape and registry

**File:** [src/client/lib/rest-moves.js](src/client/lib/rest-moves.js)

- Extend each move with optional:
  - `canTargetAlly: true` — move can be applied to another character.
  - `rollDice: '1d4'` — selecting this move triggers a silent roll (existing endpoint with `_silent: true`); result stored and passed to `onApply`.
  - `onApply(rest, roll, target, char)` — called on acknowledge. `rest` = context (e.g. `rest.roll(expr)` for future use); `roll` = `{ dice, value }` from stored result; `target` = wrapped entity receiving the effect; `char` = wrapped entity who chose the move.
- Add a move registry by id (e.g. `getRestMoveDefinition(id)`) so RestBanner and GMTableView can look up `canTargetAlly`, `rollDice`, and `onApply`.
- Implement onApply for moves that have mechanical effects (tend-to-wounds, clear-stress, repair-armor, prepare, and long-rest “all” moves as in the original plan), using only existing wrapper capabilities unless we add `rest.roll`.

---

## 4. State and table op extension

**Files:** [src/client/lib/table-ops.js](src/client/lib/table-ops.js), [test/unit/table-ops.test.js](test/unit/table-ops.test.js)

- Extend **restMovesSelections** per-slot: `move1TargetInstanceId` / `move2TargetInstanceId`, `move1RollResult` / `move2RollResult` (`{ dice, value }`).
- Extend **rest-move-select** op: optional `targetInstanceId`, optional `rollResult`. Merge into the same slot in `applyTableOp`.
- **allFilled:** Require that for any slot whose move has `rollDice`, the corresponding `moveNRollResult` is present.

---

## 5. RestBanner UI: canTargetAlly and rollDice

**File:** [src/client/components/DiceRoller.jsx](src/client/components/DiceRoller.jsx) (RestBanner)

- **canTargetAlly:** For moves with `canTargetAlly`, show under the main option a small line listing other characters; clicking a name selects the move with `targetInstanceId` set. Default target = self. Prefer a separate “Apply to: [Self] [Alice] [Bob]” row under the slot when the selected move has `canTargetAlly`.
- **rollDice:** On selecting a move with `rollDice`, call the existing roll API with `_silent: true`, show a spinner until resolved, then send rest-move-select with `moveId` and `rollResult`. Display value (e.g. “1d4 → 3”). If the slot has a stored roll result, players cannot change that slot; only the GM can.
- **Acknowledge:** Disabled until all slots filled and every slot with a move that has `rollDice` has a stored `rollResult`.

---

## 6. API and op for extended rest-move-select

- **POST /api/room/:gmUid/rest-move-select:** Accept optional `targetInstanceId` and `rollResult` in the body; pass through to `applyTableOp`.
- **postRestMoveSelect** in api.js: Accept and send optional `targetInstanceId` and `rollResult`.

---

## 7. Running onApply on acknowledge

**File:** [src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx)

- In **handleBannerAcknowledge**, in the rest-banner block: after `postBannerAck` and `onRestMoveClear`, iterate `restMovesSelections[roll._rollDbId]`; for each character and each slot, look up the move definition; if `onApply` exists, resolve target (targetInstanceId or self), wrap target and char with `wrapEntity`, build `roll` from stored `rollResult`, call `onApply(rest, roll, target, char)`. Use a minimal `rest` object; optionally implement `rest.roll(expr)` for future moves.

---

## 8. Documentation and tests

- Update [.cursor/rules/project.mdc](.cursor/rules/project.mdc): document `_silent` on roll endpoints, rest-move-select op extension (targetInstanceId, rollResult), and RestBanner behavior.
- Update [docs/srd-implementation.md](docs/srd-implementation.md) if rest moves are listed.
- Unit test: rest-move-select with targetInstanceId and rollResult in table-ops.test.js.

---

## Implementation order

1. **Silent roll:** Add `_silent` handling to existing roll handlers in server.js; optional `postRollSilent` or document `_silent` in api.js.
2. Move definitions and registry in rest-moves.js (canTargetAlly, rollDice, onApply; getRestMoveDefinition).
3. Table op and state shape (table-ops.js + tests); extend server and client for rest-move-select (targetInstanceId, rollResult).
4. RestBanner UI: target-ally row/chips, rollDice flow (spinner → store result → display, lock for players), allFilled including rollResult.
5. GMTableView: run onApply in handleBannerAcknowledge for rest banners.
6. Docs and any SRD/README updates.

