# Action Log: Rename and action-only display

## Overview

Rename the Dice Log to "Action Log" (component, file, state, and UI copy), add dedicated rendering for action-only banner entries, and keep the existing Dices icon. Update documentation accordingly.

## 1. Component and file rename

- **Rename file:** [src/client/components/DiceLog.jsx](src/client/components/DiceLog.jsx) → `ActionLog.jsx`.
- **Component:** Export `ActionLog` instead of `DiceLog`; update the component name and JSDoc to refer to "Action Log".
- **Import:** In [src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx), change `import { DiceLog } from './DiceLog.jsx'` to `import { ActionLog } from './ActionLog.jsx'` and use `<ActionLog rolls={actionLog} />` (see state rename below).

## 2. State rename

- **app.jsx:** Rename `diceLog` → `actionLog`, `setDiceLog` → `setActionLog` (state declaration and all usages, including the `roll-history` handler and props passed to GMTableView).
- **GMTableView.jsx:** Rename props `diceLog` → `actionLog`, `setDiceLog` → `setActionLog` in the destructuring and everywhere they’re used (e.g. `setDiceLog(prev => ...)` → `setActionLog(prev => ...)`, and the prop to the log component).

## 3. UI copy and icon in ActionLog

**File: [src/client/components/ActionLog.jsx](src/client/components/ActionLog.jsx)** (after rename)

- Overlay header: "Dice Log" → "Action Log".
- Footer bar label: "Dice Log" → "Action Log".
- Count: "X roll(s)" → "X entries".
- Empty state: "No rolls yet this session" → "No actions yet this session".
- **Keep the existing `Dices` icon** in both the overlay header and the footer bar (no icon change).

## 4. Display for action-only entries

**File: [src/client/components/ActionLog.jsx](src/client/components/ActionLog.jsx)**

- **Entry rendering:** In the component that renders each item (currently `RollEntry`), detect `roll._action === true`. For those entries:
  - Show a single line: `rollUser` (or `characterName`) + ": " + `actionName` (e.g. "GM: Short rest", "Alaric: Startling") in the same card style (`bg-slate-800/60`, time on the right).
  - Optionally show truncated `actionText` as muted helper text.
- **Footer bar preview:** When the latest entry is an action (`latestRoll._action` or no `total` but has `actionName`), show `latestRoll.rollUser` and `latestRoll.actionName` instead of `latestRoll.total` (e.g. "GM: Short rest").

Roll entries keep current Hope/Fear/damage rendering via `CompoundRoll` when `subItems` exist.

## 5. Documentation

- **[.cursor/rules/project.mdc](.cursor/rules/project.mdc):** Replace "Dice Log" / "DiceLog" with "Action Log" / "ActionLog" in the component list, Game Table layout, and Built-In Dice System. Note that the log shows both rolls and action notifications.
- **[README.md](README.md):** Update directory tree (DiceLog.jsx → ActionLog.jsx and description). Update Game Table and dice/log paragraphs to "Action Log" and "entries" where appropriate.
- **[src/db.js](src/db.js):** In `getRecentDiceRolls` docstring, change "DiceLog" to "Action Log".
- **[server.js](server.js):** In comments referring to the DiceLog strip, change to "Action Log strip".

## 6. Testing

- Manual: Add a dice roll and an action (e.g. Startling or Session start); open the Action Log and confirm roll entries show Hope/Fear/damage and action entries show "Who: Action name". Collapsed bar shows the latest entry correctly for both types.
