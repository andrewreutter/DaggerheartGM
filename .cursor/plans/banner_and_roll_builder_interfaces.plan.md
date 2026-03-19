---
name: Banner and Roll builder interfaces
overview: Add new Roll and Banner builder modules that define a clean, pre-roll configuration API and a single rollDice() entry point on Banner that coordinates rolling all rolls and decorating them with results. No integration with existing DiceRoller or server yet.
todos: []
isProject: false
---

# Plan: Roll and Banner builder interfaces (clean rearchitecture)

## Goal

Introduce two new abstractions:

- **Roll** — Configures a single logical roll (what to roll). Exposes `getDiceRequest()` and `applyResults(results)` so the Roll can be sent to a dice service and then updated with outcomes. Most rolling logic lives on Roll; Banner coordinates multiple rolls and animation order.
- **Banner** — Starts empty; you add Rolls (by name) and other content (narration, tags, target lists, chips, rest config). Exposes `banner.rollDice()` to run all rolls in sequence, trigger dice animation, and decorate each Roll with results. Rolls are keyed by name; duplicate names throw.

No wiring to existing [DiceRoller.jsx](src/client/components/DiceRoller.jsx), [GMTableView.jsx](src/client/components/GMTableView.jsx), or [server.js](server.js) roll endpoints in this change.

---

## Placement

- **Roll**: new file `src/client/lib/roll-builder.js`.
- **Banner**: new file `src/client/lib/banner-builder.js` — depends on Roll, holds named Rolls and content, implements `rollDice(options)` as coordinator.

Both are pure JS (no React).

---

## 1. Roll builder (`src/client/lib/roll-builder.js`)

**Internal state (config only until applied):**

- `parts`: array of `{ pre, expression }`. Order matches the eventual rollText / subItems order.
- Optional: `staticModifier`, `staticModLabel`, `damageType`, `damageModifiers`, `disadvantageRemoved`.
- No `total`, `dominant`, or per-part `result` until `applyResults()` is called.

**Configuration API (all pre-roll):**

- `roll.addDuality()` — append Hope 1d12 and Fear 1d12 parts.
- `roll.addDisadvantage(label, expression?)` — append one disadvantage part; expression defaults to `'1d6'`.
- `roll.addDie(label, expression)` — append `{ pre, expression }`.
- `roll.addBonus(n, label?)` — store static modifier.
- `roll.addAdvantageDie(expression?)` — append one part, default `'1d6'`.
- `roll.setStaticModFromRollText(n, label?)` — store for request and applyResults.
- `roll.addDamagePart(label, expression)` — append damage part(s); multiple for multi-damage.
- `roll.setDamageType(type)` — `'phy' | 'mag'`.
- `roll.addDamageModifier(label, valueOrExpression?)` — store modifier.
- `roll.addExtraDice(label, expression)` — Reload/Invigorate/Lifesteal.

**Request and results:**

- `roll.getDiceRequest()` — returns `{ parts: [{ pre, expression }, ...], staticModifier?, staticModLabel? }`.
- `roll.applyResults(results)` — `results`: `{ subItems, total, dominant? }`. Roll stores these on itself.

**Factory:** `createRoll()`.

**Exports:** `createRoll`, and optionally `requestToRollText(request)` for integration.

---

## 2. Banner builder (`src/client/lib/banner-builder.js`)

**Internal state:**

- `rolls`: Map or array of `{ name, roll }` so rolls are keyed by name. Order preserved for `rollDice()` iteration.
- `displayName`, `actionTitle`, `actionText`.
- `narrations`, `tags`, `targetList`, `chips`, `restConfig`, `controls`.

**Content API:**

- `banner.addRoll(name, roll)` — register a Roll under `name`. **Throws if `name` is already used.** Appends to ordered list so rollDice() runs in add order.
- `banner.getRoll(name)` — returns the Roll instance for `name`, or undefined if not found.
- `banner.setDisplayName(name)`.
- `banner.setActionTitle(title)`.
- `banner.setActionText(text)`.
- `banner.addNarration(text, style?)`.
- `banner.addTag(name, text, options?)`.
- `banner.setTargetList(kind, config)`.
- `banner.addChip(descriptor)`.
- `banner.setRestConfig(params)`.
- `banner.addControl(id, config)` (optional).

**Roll coordination:**

- `banner.rollDice(options)` — async. For each roll in add order: call `roll.getDiceRequest()`, call `options.diceService(request)`, await result, call `roll.applyResults(results)`; optionally `options.animateRoll(roll, request)` between rolls. Resolve when all rolls are done. Duplicate-name check is at add time, so rollDice just iterates the stored list.

**Factory:** `createBanner()`.

**Exports:** `createBanner`.

---

## 3. Data shapes (reference)

**Roll getDiceRequest():** `{ parts: [{ pre, expression }], staticModifier?, staticModLabel? }`

**Roll applyResults(results):** `{ subItems, total, dominant? }`

**Banner setTargetList(kind, config):** `kind`: `'apply-to' | 'rousing-speech' | 'life-support' | 'make-a-scene'`; `config`: `{ label, targets?, emptyMessage?, multiSelect?, maxSelection?, pickerLabel? }`

---

## 4. File summary

| File | Purpose |
|------|--------|
| [src/client/lib/roll-builder.js](src/client/lib/roll-builder.js) | Roll: config API, getDiceRequest(), applyResults(). |
| [src/client/lib/banner-builder.js](src/client/lib/banner-builder.js) | Banner: addRoll(name, roll) (throws on duplicate name), getRoll(name), content methods, rollDice(options). |

---

## 5. Out of scope

- No changes to [src/features/roll.js](src/features/roll.js), DiceRoller.jsx, GMTableView.jsx, or server.
- No conversion from getDiceRequest() to rollText in this task; optional helper `requestToRollText(request)` in roll-builder.js for later integration.
