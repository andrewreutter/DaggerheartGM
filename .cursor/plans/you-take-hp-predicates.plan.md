---
name: you-take-hp-predicates
overview: Add youTake* predicates to when.js, document CONV-039, add tests, and migrate listed features.
todos:
  - id: impl-when-you-take
    content: Implement youTake* + helper + module docblock in when.js
    status: completed
  - id: tests-when-you-take
    content: Add when.test.js cases for youTake* (me-targeted effects)
    status: completed
  - id: docs-conv-039
    content: Add CONV-039 in v2-code-conventions.md for youTake* vs isTargeted
    status: completed
  - id: migrate-features
    content: Migrate features per matrix below (same PR or follow-up as noted)
    status: completed
isProject: false
---

# Plan: `youTake*` predicates + feature migrations

## Goal

Add `**youTakeMinorDamage**`, `**youTakeMajorDamage**`, and `**youTakeSevereDamage**` in `[src/features-v2/engine/when.js](src/features-v2/engine/when.js)` for **incoming** pending `{ stat: 'currentHP' }` on `**table.me`**, using the same tier classification as `**isMinorPendingHpLossEffect` / `isMajorPendingHpLossEffect` / `isSeverePendingHpLossEffect`**. Use `**.some()**` over `action.effects` so any matching line to me qualifies (aligned with `[GetBackUp.js](src/features-v2/abilities/Blade/GetBackUp.js)` `hasSevereHpToMe`).

## API shape (implementation)

- `**effectTargetsMe(e, table)**` — `e.stat === 'currentHP'`, positive `amount`, `effectTargetInstanceId(e) === table.me?.instanceId` (reuse `**effectTargetInstanceId**` in `when.js`).
- `**youTakeSevereDamage` / `youTakeMajorDamage` / `youTakeMinorDamage**` — `effects.some((e) => effectTargetsMe(e, table) && is*PendingHpLossEffect(e))`.

Optional: `**pendingHpLossToMeEffects(table)**` — only if a consumer needs the full list.

## Semantics / docs

- Extend `**when.js**` module docblock (“Predicate implications”): `**youTake***` do not assert `**isTargeted**`; compose `**when(isTargeted, youTakeSevereDamage, …)**` when the fiction is “on a hit against you.”
- Add **CONV-039** in `[docs/v2-code-conventions.md](docs/v2-code-conventions.md)` (pairing `**youTake*`** with `**isTargeted`**, complements CONV-027 for `**youDeal***`).

## Tests

- Extend `[test/unit/features-v2/engine/when.test.js](test/unit/features-v2/engine/when.test.js)`: me-targeted vs other-target effects; tier tags + amount-only cases (parallel to existing `**youDeal***` tests).

---

## Which features use which predicates

### `youDealSevereDamage` (outgoing — actor is `table.me`, primary target)


| Feature                                   | File                                                                           | Notes                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Devastating Strikes** (Terrible Lizard) | `[beastforms/TerribleLizard.js](src/features-v2/beastforms/TerribleLizard.js)` | **Already uses** `youDealSevereDamage` via `severeHpToAdversary` — no change beyond any doc tweaks.                                                                                                |
| **Ruthless Predator**                     | `[subclasses/Wayfinder.js](src/features-v2/subclasses/Wayfinder.js)`           | **Migrate:** replace inline severe loop in `onReviewOutcome` with `youDealSevereDamage` + `(table) => table.action?.target?.isAdversary` (keep `isActing` + `type === 'attack'` if still desired). |


### `youDealMajorDamage` / `youDealMinorDamage`


| Status                 | Notes                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| **No current feature** | None found that gate on outgoing Major/Minor to primary target only; leave predicates available for future SRD. |


### `isSeverePendingHpLossEffect` (shared tier helper — not a table predicate)


| Feature    | File                                                                         | Notes                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deadly** | `[weapon_properties/Deadly.js](src/features-v2/weapon_properties/Deadly.js)` | **Migrate:** replace `e.amount >= 3` check with `**isSeverePendingHpLossEffect(e)`** (+ target id) so tier tags match **Terrible Lizard / Wayfinder** behavior. |


---

### `youTakeSevereDamage` (incoming — `currentHP` to `table.me`)


| Feature                                   | File                                                                                     | Notes                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Get Back Up**                           | `[abilities/Blade/GetBackUp.js](src/features-v2/abilities/Blade/GetBackUp.js)`           | **Migrate:** chip `when(isTargeted, hasSevereHpToMe, …)` → `**when(isTargeted, youTakeSevereDamage, …)`**; remove duplicate `**isSevereIncomingHpEffect`** if fully subsumed. |
| **Scales**                                | `[ancestries/Drakona.js](src/features-v2/ancestries/Drakona.js)`                         | **Migrate:** chip guard + hook lookup align with `**isSeverePendingHpLossEffect`** / `**youTakeSevereDamage`** (today uses `amount >= 3` only on chip).                       |
| **Elemental Incarnation** (channel clear) | `[subclasses/WardenOfTheElements.js](src/features-v2/subclasses/WardenOfTheElements.js)` | **Migrate:** `**severeHpLossOnMe`** → `**youTakeSevereDamage`** (adds `amount >= 3` when tier fields absent; today tier strings only).                                        |
| **Eclipse** (spell end condition)         | `[abilities/Midnight/Eclipse.js](src/features-v2/abilities/Midnight/Eclipse.js)`         | **Migrate:** `**severeHpLossOnEclipseCaster`** → `**youTakeSevereDamage`** for consistent severe detection.                                                                   |


### `youTakeMinorDamage`


| Feature          | File                                                                           | Notes                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Thick Skin**   | `[ancestries/Dwarf.js](src/features-v2/ancestries/Dwarf.js)`                   | **Migrate:** chip `find` predicate → `**youTakeMinorDamage`** (keep hook body).                                                                                                                         |
| **On the Brink** | `[abilities/Bone/OnTheBrink.js](src/features-v2/abilities/Bone/OnTheBrink.js)` | **Migrate:** add `**youTakeMinorDamage`** as third predicate after `**isTargeted`** + `**isOnTheBrink**`; replace manual `amount === 1` find condition for gating (hook may still find effect to zero). |


### `youTakeMajorDamage`


| Feature                                               | File                                                                       | Notes                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hush** (SRD end condition: “you take Major damage”) | `[abilities/Midnight/Hush.js](src/features-v2/abilities/Midnight/Hush.js)` | **No engine hook today** — text only. **If/when** a `reviewOutcome` (or state) hook clears Silenced on Major damage to the caster, use `**youTakeMajorDamage`** (+ `**isActing`** / `**isTargeted**` as appropriate). Listed here so authors know the predicate exists. |


---

## Features intentionally **not** migrated (generic HP or non-tier)

These match **any** incoming `currentHP` to me (or sum marks), not Minor/Major/Severe tier:

- `[SplendorTouched.js](src/features-v2/abilities/Splendor/SplendorTouched.js)`, `[GraceTouched.js](src/features-v2/abilities/Grace/GraceTouched.js)`, `[ShieldAura.js](src/features-v2/abilities/Splendor/ShieldAura.js)`, `[NeverUpstaged.js](src/features-v2/abilities/Grace/NeverUpstaged.js)`, `[Ranger.js](src/features-v2/classes/Ranger.js)` Focus stress-on-damage, `[PrimalOrigin.js](src/features-v2/subclasses/PrimalOrigin.js)` (partial), etc. — keep custom `**stat === 'currentHP'`** logic unless a future SRD change needs tier scoping.

---

## Non-goals

- Do not change `**hasDamage`** / `**hasPhysicalDamage**` (`type: 'damage'` effects).
- Do not add `**youTake**` for `**currentStress**` (e.g. Firbolg) in this pass.

