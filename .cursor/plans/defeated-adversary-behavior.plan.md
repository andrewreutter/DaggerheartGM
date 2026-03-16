---
name: ""
overview: ""
todos: []
isProject: false
---

# Defeated adversary behavior

## Definition of "defeated"

An adversary **instance** is defeated when it has an HP track and all boxes are marked:

- `(hp_max ?? 0) > 0` and `(currentHp ?? hp_max ?? 0) <= 0`

Use a single helper so the rule lives in one place. Add it in [src/client/lib/helpers.js](src/client/lib/helpers.js) (alongside `formatTargetSummary` and other target/element helpers) and reuse it everywhere:

```js
export function isAdversaryDefeated(element) {
  const maxHp = element.hp_max ?? 0;
  const currentHp = element.currentHp ?? element.hp_max ?? 0;
  return maxHp > 0 && currentHp <= 0;
}
```

For instances in consolidated groups, pass an object that has `hp_max` from the base and `currentHp` from the instance (e.g. `{ ...baseElement, currentHp: inst.currentHp }` or equivalent).

---

## 1. Encounter panel: Defeated as modifier chip (GM and player)

**File:** [src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx)

Represent defeated state as a **modifier chip** in the same style as the existing "Vulnerable" and "Focused by" chips (small rounded badge with distinct color), not as a name prefix.

- **GM Encounter panel (adversary-group cards, ~2457–2625)**  
  - For each **instance row** (where HP/Stress tracks and Vulnerable/Focused by chips are shown): if that instance is defeated (`isAdversaryDefeated` using `displayEl.hp_max` and `inst.currentHp`), render a **"Defeated"** modifier chip in that row — same placement pattern as Vulnerable/Focused by (e.g. after or before those chips).  
  - Use a distinct but consistent style (e.g. muted/slate or grey chip so it’s clearly different from Vulnerable amber and Focus emerald). Read-only; no clear button (defeated state is derived from HP).  
  - Group header stays the normal adversary name (no [DEFEATED] prefix).
- **Player Encounter panel (damaged groups, ~2634–2736)**  
  - For each damaged instance in the list, if that instance is defeated, show the same **"Defeated"** modifier chip next to the instance’s HP/Stress/Vulnerable/Focused by display so players see at a glance which adversaries are defeated.

Chip styling can follow the existing pattern in GMTableView (e.g. `text-[10px] font-medium px-1.5 py-0.5 rounded bg-... border ...`) with a neutral/muted palette for "Defeated".

---

## 2. Target lists: exclude defeated adversaries

**File:** [src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx)

- `**damageTargets` useMemo** (~1388–1426): when building targets from `consolidatedElements`, for `adversary-group` items only push entries for instances where `!isAdversaryDefeated(...)` (using base `hp_max` and instance `currentHp`). Defeated adversaries then never appear in:
  - Damage banner target selector chips
  - `getTargetsForRoll` / `getValidTargets` (they filter from `damageTargets`)

No changes in [src/client/lib/map-range.js](src/client/lib/map-range.js) or in `getTargetsForRoll`/`getValidTargets` beyond this.

---

## 3. Battle map: defeated token color black

**File:** [src/client/components/BattleMap.jsx](src/client/components/BattleMap.jsx)

- **TokenCircle** (~238–318): for `elementType === 'adversary'`, compute defeated as `(element.hp_max ?? 0) > 0 && (element.currentHp ?? element.hp_max ?? 0) <= 0` (or import `isAdversaryDefeated` from `helpers.js`).  
  - If defeated, set token background to black (e.g. `bg-black` or `bg-slate-900`).  
  - Keep the existing dot ring (HP/Stress); only the fill color changes.

---

## 4. GM Moves: exclude adversary types with no living instances

**File:** [src/client/components/GMTableView.jsx](src/client/components/GMTableView.jsx)

- `**consolidatedMenu` useMemo** (~1455–1530+): build a set of adversary **ids** that have at least one **non-defeated** instance (e.g. for each `el` in `activeElements` with `elementType === 'adversary'`, if `!isAdversaryDefeated(el)` then add `el.id`).  
  - When processing an element with `elementType === 'adversary'`, if its `id` is not in that set, skip it (do not add that adversary’s attack, features, or role move to the menu).  
  - Result: an adversary type disappears from GM Moves only when every instance of that type is defeated.

---

## 5. Documentation

- **[.cursor/rules/project.mdc](.cursor/rules/project.mdc)**: In the GMTableView / Encounter panel bullet, add a short note that adversaries with all HP marked are shown with a Defeated modifier chip, excluded from target lists and GM Moves, and have black tokens.  
- **README / docs/srd-implementation.md**: No change required unless you want a one-line UX note.

---

## Summary


| Area              | Change                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **helpers.js**    | Add `isAdversaryDefeated(element)`.                                                                                                                       |
| **GMTableView**   | Encounter panel (GM + player): show a **"Defeated" modifier chip** in each defeated instance row (same pattern as Vulnerable/Focused by); no name prefix. |
| **GMTableView**   | `damageTargets`: omit adversary instances for which `isAdversaryDefeated` is true.                                                                        |
| **GMTableView**   | `consolidatedMenu`: only include adversary ids that have at least one non-defeated instance.                                                              |
| **BattleMap.jsx** | TokenCircle: use black (or dark) background for adversary tokens when defeated.                                                                           |
| **project.mdc**   | Brief note on defeated adversary behavior (chip, target exclusion, GM Moves, token).                                                                      |


No new API or DB fields; all state is derived from existing `currentHp` / `hp_max` on elements.