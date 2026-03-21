# V2 Feature System Migration Tracker

This file is the single source of truth for tracking implementation progress of all Daggerheart SRD features in the V2 engine (`src/features-v2/`). Multiple agents read and write this file.

## Status Summary

| Collection | Total | Validated | Reviewed | Validating | Done | In Progress | Unclaimed | Needs Fix | Fixing | Blocked | Skipped |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Ancestries (features) | 36 | 2 | 32 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| Communities (features) | 9 | 4 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Weapon Properties | 50 | 10 | 2 | 0 | 15 | 0 | 19 | 0 | 1 | 2 | 0 |
| Armor Properties | 21 | 5 | 0 | 0 | 4 | 0 | 11 | 0 | 0 | 1 | 0 |
| Classes (features) | 24 | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 |
| Subclasses (features) | 74 | 0 | 0 | 0 | 0 | 0 | 74 | 0 | 0 | 0 | 0 |
| Abilities | 189 | 0 | 0 | 0 | 0 | 0 | 189 | 0 | 0 | 0 | 0 |
| Beastforms | 24 | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 |
| Items | 60 | 0 | 0 | 0 | 0 | 0 | 60 | 0 | 0 | 0 | 0 |
| Consumables | 60 | 0 | 0 | 0 | 0 | 0 | 60 | 0 | 0 | 0 | 0 |
| **TOTAL** | **547** | **21** | **39** | **0** | **20** | **0** | **461** | **0** | **1** | **3** | **0** |

---

## Feature Checklists

Columns: **Feature Name** | **Source File** | **Status** | **Agent** | **Impl Notes** | **Val Notes** | **Fix Notes**

Status values: `Unclaimed` | `In Progress` | `Done` | `Validating` | `Validated` | `Reviewed` | `Needs Fix` | `Fixing` | `Blocked` | `Skipped`

> **Blocked rollup**: A feature row remains `Blocked` while **any** pending row in the active **Blocked / API Extension Requests** table (below) lists that feature. Completed resolutions are **appended** to [`docs/v2-blocked-resolutions-done.md`](v2-blocked-resolutions-done.md) and removed from the active table. When no active row lists the feature, the Unblocking Agent promotes it to `Done` in the main tracker (the agent implemented the feature as part of the resolution).

---

### Ancestries (36 features across 18 ancestries)

> Each ancestry has 2 features. Implement in `src/features-v2/ancestries/<AncestryName>.js`.


| Feature Name        | Source File            | Status    | Agent            | Impl Notes                                                                                                                                                                                                                                                                                      | Val Notes                                                                                                                                                                                                                                                                                                                                      | Fix Notes                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ---------------------- | --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purposeful Design   | ancestries/Clank.js    | Validated | fix-pd1          |                                                                                                                                                                                                                                                                                                 | SRD: "+1 bonus to [chosen Experience]" is never applied — the `create` chip has no `onUse` and nothing persists the experience selection or the +1 bonus to the character.                                                                                                                                                                     | Strategy (a): Engine extended with `isSelect` chip capability, `table.me.experiences`, and `addExperienceBonus` mutation. `create` chip uses `isSelect` to populate from character's experiences at runtime; `onUse` queues `addExperienceBonus` for the chosen id. CONV-021 added.                                                         |
| Efficient           | ancestries/Clank.js    | Reviewed  | fix-rest-slot    |                                                                                                                                                                                                                                                                                                 | SRD: "when you take a short rest, you can choose a long rest move instead of a short rest move" — feature is purely narrative (`{ name, description }`); needs an `onRest` hook that adds a long-rest move slot to the short-rest options.                                                                                                     | Strategy (a): `passiveStatMods.numLongMovesInShortRest` accumulated in `applyDeclarativeFeatures`; `getRestMovesForCharacter` applies V2 registry mods and merges long-rest moves into short-rest options (same as former v1 `onRest`). v1 Clank `Efficient.onRest` removed. Tests: `feature-loader.test.js`, `rest-moves-v2.test.js`.      |
| Scales              | ancestries/Drakona.js  | Reviewed  | val-B2           |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Fixed: Converted to chip-gates-hook pattern (removed manual onUse toggle logic, added hooks.onReviewOutcome). Tests updated to use activateChip/makeChipState.                                                                                                                                                                              |
| Elemental Breath    | ancestries/Drakona.js  | Reviewed  | fix-eb           |                                                                                                                                                                                                                                                                                                 | SRD: "against a target **or group of targets**" — virtual weapon needs multi-target support; single-target virtual weapon is insufficient.                                                                                                                                                                                                     | Added `multiTarget: true` to the virtual weapon. Authoring guide updated with `multiTarget` docs under `virtualWeapons`.                                                                                                                                                                                                                    |
| Thick Skin          | ancestries/Dwarf.js    | Reviewed  | val-B3           |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Back-applied chip-gates-hook pattern (removed manual onUse toggle logic, added hooks.onReviewOutcome). Tests updated to use activateChip/makeChipState.                                                                                                                                                                                     |
| Increased Fortitude | ancestries/Dwarf.js    | Reviewed  | val-B1           |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Fixed: Uses gated hook pattern (hook automatically attached to toggle chip). Updated to use Math.ceil for damage halving (CONV-012).                                                                                                                                                                                                        |
| Quick Reactions     | ancestries/Elf.js      | Reviewed  | val-B1           |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Fixed: `table.action?.isReaction` helper boolean per guide. Toggle-off calls `removeRollDie('Quick Reactions')` (was only adding advantage die).                                                                                                                                                                                            |
| Celestial Trance    | ancestries/Elf.js      | Reviewed  | val-B1           | `passiveStatMods: { numShortRestSlots: 1, numLongRestSlots: 1 }` — declarative per CONV-011.                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                                                                | Same engine fix as Efficient: extra slots applied in `getRestMovesForCharacter` via V2 registry; v1 Elf `Celestial Trance.onRest` removed to avoid double counting.                                                                                                                                                                         |
| Luckbender          | ancestries/Faerie.js   | Reviewed  | fix-luckbender   |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Added `rangeFrom(otherActor)` to engine actor; uses it to check ally range. Fixed `== null` guards so `tokenX: 0` is a valid position. Added ally-in-range and ally-out-of-range tests.                                                                                                                                                     |
| Wings               | ancestries/Faerie.js   | Reviewed  | val-V6           |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Per CONV-020: attacks against characters are always adversary→character in Daggerheart; `isTargeted` is sufficient. No adversary check needed. CONV-020 added to conventions.                                                                                                                                                               |
| Caprine Leap        | ancestries/Faun.js     | Reviewed  | val-B1           | Purely narrative feature.                                                                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Kick                | ancestries/Faun.js     | Reviewed  | val-V6           | Two review chips (push target vs leap back); 1 Stress each; +2d6; `move` + `rangeFrom === 'veryClose'` (no narration).                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                | CONV-017 + knockback via `move(conditionFn)`; two named chips for either/or mover. Fixed: removed `t.action.target != null &&` null guard from leap-back conditionFn (CONV-018).                                                                                                                                                            |
| Charge              | ancestries/Firbolg.js  | Reviewed  | unblock-lastpos1 | ReviewAction chip on successful Agility trait roll; costs 1 Stress, queues `addDamageRoll` (1d12 physical) targeting all melee-range adversaries. Gates on `table.me.lastPosition?.rangeFrom(a)` being `'far'` or `'veryFar'` for at least one melee adversary.                                                                                  | SRD: "move from Far or Very Far range into Melee range" — not representable; chip gates only on successful Agility attack at melee range with targets, so it fires without the SRD movement prerequisite. Block until action context exposes prior range / movement path (same class as Reach). `Charge.test.js` passes.                       | Fixed: `type: 'attack'` (not `'trait'`); moved to `reviewAction`; uses `addDamageRoll` for separate AOE damage instead of `addDie` on the weapon roll; falls back to action targets when positions unknown.                                                                                                                                 |
| Unshakable          | ancestries/Firbolg.js  | Reviewed  | fix-unsh         | V2 API does not support automatic dice rolling in hooks. Requires onReviewOutcome hook that auto-rolls d6 when stress would be marked and cancels on 6.                                                                                                                                         |                                                                                                                                                                                                                                                                                                                                                | Added `table.rollDie(notation)` to the engine (synchronous, queues mutation, RNG injectable via `gameState._rng`). Unshakable now uses `hooks.onReviewOutcome` to find a pending stress effect targeting the owner, roll d6, and cancel the stress on a 6. Documented in §4.6 and §C.7 of the authoring guide. Blocked table entry removed. |
| Death Connection    | ancestries/Fungril.js  | Reviewed  | val-B3           | Card chip with 1 Stress cost; triggers action loop for memory extraction.                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                                                                                                                | Tests: `onUse` + `applyMutations` assert `actionLoop` payload (CONV-008).                                                                                                                                                                                                                                                                   |
| Shell               | ancestries/Galapa.js   | Reviewed  | unblock-prof1    | `passiveStatMods: { majorThreshold: (t) => t.me?.proficiency ?? 1, severeThreshold: (t) => t.me?.proficiency ?? 1 }`. Requires `table.me.proficiency` (now exposed) and function-value support in `passiveStatMods` (now implemented).                                                          |                                                                                                                                                                                                                                                                                                                                                | Added `proficiency` to `buildActor`; extended `applyDeclarativeFeatures` to invoke function values with `table`. Shell now fully implemented. Tests updated (4 tests).                                                                                                                                                                      |
| Retract             | ancestries/Galapa.js   | Reviewed  | fix-sh1          | Card chip (toggle) with 1 Stress cost; onReviewAction halves physical damage; onIntent adds disadvantage die; toggle calls restrictMovement/allowMovement. Fully implemented.                                                                                                                   |                                                                                                                                                                                                                                                                                                                                                | `onReviewOutcome` → `onReviewAction` + `when(isRetracted)`; halve with `Math.ceil` (CONV-012). All blocked rows Done; promoted to Reviewed. Tests: toggle restrict/allow + disadvantage + halving.                                                                                                                                          |
| Endurance           | ancestries/Giant.js    | Reviewed  | val-V2           | Passive stat mod: maxHP +1.                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Reach               | ancestries/Giant.js    | Reviewed  | unblock-range        | Purely narrative; range modification (Melee → Very Close) requires engine support to intercept/modify weapon/feature ranges.                                                                                                                                                                    | SRD: "Treat any weapon, ability, spell, or other feature that has a Melee range as though it has a Very Close range instead" — this is a concrete mechanical effect; bare `{ name, description }` stub does not implement it. Should be marked Blocked (V2 API has no declarative property or hook to modify weapon/feature effective ranges). | Code was already a correct bare stub. Status corrected from Needs Fix → Blocked. V2 API has no range-modification hook.                                                                                                                                                                                                                     |
| Surefooted          | ancestries/Goblin.js   | Reviewed  | unblock-surefooted | Purely narrative; ignoring disadvantage on Agility Rolls requires engine support.                                                                                                                                                                                                               | SRD: mechanical effect (ignore disadvantage on Agility Rolls) not implemented; bare stub. Recommended: Blocked (API gap).                                                                                                                                                                                                                      | Code was already a correct bare stub. Status corrected from Needs Fix → Blocked. V2 API has no method to remove or ignore disadvantage on rolls.                                                                                                                                                                                            |
| Danger Sense        | ancestries/Goblin.js   | Validated  | val-DS1           | Review chip (rest frequency, 1 Stress) when adversary attacks me or ally within Very Close; forces reroll (requires engine support for actual reroll).                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                | Fixed: ally range check expanded from `=== 'veryClose'` to `=== 'melee'                                                                                                                                                                                                                                                                     |
| Luckbringer         | ancestries/Halfling.js | Reviewed  | val-V3           | onSessionStart hook grants 1 Hope to all party members.                                                                                                                                                                                                                                         |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Internal Compass    | ancestries/Halfling.js | Reviewed  | val-B3           | Review chip when Hope Die = 1; calls hopeDie.reroll().                                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                | Tests: `onUse` + `applyMutations` assert `rerollDie` payload (CONV-008).                                                                                                                                                                                                                                                                    |
| High Stamina        | ancestries/Human.js    | Reviewed  | val-V3           | Passive stat mod: maxStress +1.                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Adaptability        | ancestries/Human.js    | Reviewed  | fix-adaptability | Review chip on failed roll; costs 1 Stress, rerolls both dice. NOTE: SRD requires "when you fail a roll that utilized one of your Experiences" but V2 API does not expose experienceId, so chip appears on any failed roll. Accepted best-effort — API gap documented here.                     | SRD: "that utilized one of your Experiences" — V2 API does not expose which experience was used per roll; cannot gate chip on experience usage. Blocked.                                                                                                                                                                                       | Strategy (a): gated chip by cross-referencing `table.me.experiences` names against `table.rolls.action.statics` entries; chip now only fires on failed rolls where the player used an experience (experience usage adds a `+2` static with the experience name). No remaining SRD gap.                                                      |
| Fearless            | ancestries/Infernis.js | Reviewed  | fix-fearless     | Review chip on action roll with fearDie; costs 2 Stress, rerolls fear die. NOTE: SRD requires "When you roll with Fear" but V2 API cannot distinguish "rolling with Fear" vs "rolling with Hope", so chip appears on any roll with a fearDie. Changing Fear to Hope may require engine support. | SRD: "change it into a roll with Hope instead" — rerolling the fearDie does not override the result type; a rerolled fear die can still dominate, leaving a Fear result. Blocked: V2 API has no method to change roll result type from Fear to Hope.                                                                                           | Strategy (a): Added `roll.setOutcome(outcome)` to action roll object in table.js; queues `setRollOutcome` mutation. `onUse` now calls `setOutcome('hope')` instead of `fearDie.reroll()`. Accepted limitation: chip appears on any roll with a fearDie (V2 API cannot inspect current result type at chip-display time).                    |
| Dread Visage        | ancestries/Infernis.js | Reviewed  | val-B4           | Advantage trigger: "rolls to intimidate hostile creatures".                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Feline Instincts    | ancestries/Katari.js   | Reviewed  | val-B4           | Review chip on Agility roll; costs 2 Hope, rerolls Hope die.                                                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Retracting Claws    | ancestries/Katari.js   | Reviewed  | val-V7           | Virtual weapon (Agility, melee, no damage); onResolve hook applies Vulnerable condition to target on successful attack.                                                                                                                                                                         |                                                                                                                                                                                                                                                                                                                                                | Removed invented `damage: 'd6'` — SRD describes no damage, only Vulnerable on success.                                                                                                                                                                                                                                                      |
| Sturdy              | ancestries/Orc.js      | Reviewed  | fix-sturdy       | onIntent hook adds disadvantage die when character has 1 HP and is targeted.                                                                                                                                                                                                                    | CONV-015: `addDie({ die: 'd6', value: -1 })` uses `value` as a negative multiplier, which is undocumented. No `addDisadvantageDie()` method exists. Blocked per CONV-015 until API exposes a disadvantage mechanism.                                                                                                                           |                                                                                                                                                                                                                                                                                                                                             |
| Tusks               | ancestries/Orc.js      | Reviewed  | val-V7           | Review chip on successful melee attack; costs 1 Hope, adds 1d6 damage.                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                | CONV-017: `addDie({ name: 'Tusks', die: 'd6' })`. Placement corrected reviewOutcome → reviewAction (CONV-019). CONV-014: replaced inline `(table) => table.me?.isActing === true` with shared `isActing` helper; added `isActing` to import.                                                                                                |
| Amphibious          | ancestries/Ribbet.js   | Reviewed  | impl-b3          |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Long Tongue         | ancestries/Ribbet.js   | Reviewed  | fix-lt1          | Virtual weapon (Finesse, Close, d12); card chip costs 1 Stress.                                                                                                                                                                                                                                 | CONV-010: `chips` array inside a `virtualWeapons` entry is not a documented API pattern — the guide only documents `hooks` on virtual weapons. The Stress cost should be implemented via a documented mechanism (e.g. a top-level chip or an `onIntent` hook); if no documented mechanism exists, mark Blocked.                                | Strategy (a): documented `stressCost` (and peer cost properties) directly on virtual weapon objects. `LongTongue.virtualWeapons[0].stressCost = 1` — no `chips` array needed. CONV-022 added. Authoring guide updated.                                                                                                                      |
| Natural Climber     | ancestries/Simiah.js   | Reviewed  | val-V7           | Advantage trigger for Agility Rolls involving balancing and climbing.                                                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |
| Nimble              | ancestries/Simiah.js   | Reviewed  | impl-b3          |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                             |


---

### Communities (9 features across 9 communities)

> Each community has 1 feature. Implement in `src/features-v2/communities/<CommunityName>.js`.


| Feature Name     | Source File                | Status    | Agent      | Impl Notes                                                                                                                                                              | Val Notes                                                                                                                                                                                                                                                                                                   | Fix Notes |
| ---------------- | -------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Privilege        | communities/Highborne.js   | Reviewed  | val-V8     | Advantage trigger; purely declarative.                                                                                                                                  |                                                                                                                                                                                                                                                                                                             |           |
| Well-Read        | communities/Loreborne.js   | Reviewed  | val-V8     | Advantage trigger; purely declarative.                                                                                                                                  |                                                                                                                                                                                                                                                                                                             |           |
| Dedicated        | communities/Orderborne.js  | Reviewed  | unblock-dedicated | V2 API cannot change the Hope Die to a d20.                                                                                                                             |                                                                                                                                                                                                                                                                                                             |           |
| Steady           | communities/Ridgeborne.js  | Reviewed  | val-V8     | Advantage trigger; purely declarative.                                                                                                                                  |                                                                                                                                                                                                                                                                                                             |           |
| Know the Tide    | communities/Seaborne.js    | Reviewed  | unblock-level1   | Token mechanic: onResolve adds token on Fear (capped at `table.me.level` via `Math.min`), intent chip spends all tokens for +N static, onSessionStart clears. | SRD: "you can spend any number of these tokens" — chip spends ALL tokens unconditionally; partial spending not supported (could use `isSelect`). Level cap enforced using `table.me.level` (resolution Done). |           |
| Scoundrel        | communities/Slyborne.js    | Reviewed  | val-1      | Advantage trigger (narrative).                                                                                                                                          |                                                                                                                                                                                                                                                                                                             |           |
| Low-Light Living | communities/Underborne.js  | Reviewed  | val-1      | Advantage trigger; lighting is table/GM judgment (narrative).                                                                                                           |                                                                                                                                                                                                                                                                                                             |           |
| Nomadic Pack     | communities/Wanderborne.js | Validated | val-1      | `create` chip adds pack; `card` chip 1 Hope + session + broadcast.                                                                                                      |                                                                                                                                                                                                                                                                                                             |           |
| Lightfoot        | communities/Wildborne.js   | Validated | val-1      | Advantage trigger (narrative).                                                                                                                                          |                                                                                                                                                                                                                                                                                                             |           |


---

### Weapon Properties (50 unique properties)

> Implement in `src/features-v2/weapon_properties/<PropertyName>.js`.
> These apply to characters via their equipped weapon's feature list.


| Feature Name    | Source File                         | Status    | Agent    | Impl Notes                                                                                                                                                                         | Val Notes                                                                                                                                                                                                                             | Fix Notes |
| --------------- | ----------------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Barrier         | weapon_properties/Barrier.js        | Reviewed  | unblock-barrier1| `loadCharacterFeatures` drops per-weapon `feature.text` when a `weapon_properties` impl exists; Barrier’s +Armor varies by weapon (Tower Shield lines). Needs tier or merged text. |                                                                                                                                                                                                                                       |           |
| Bonded          | weapon_properties/Bonded.js         | Reviewed  | unblock-level1   | SRD: level-based damage bonus — `table.me.level` is documented in guide §C.2 (distinct from `proficiency`). Implement with `addStatic` / damage pipeline using `table.me.level` when the V2 weapon property file exists. |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Bouncing        | weapon_properties/Bouncing.js       | Blocked   | impl-A1  | SRD: "Mark 1 or more Stress to hit that many targets in range of the attack." — requires (1) variable/runtime stress cost (not a fixed `stressCost` number) and (2) a way to select additional combat targets from within a chip. Neither is supported by the V2 API. |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Brave           | weapon_properties/Brave.js          | Validated | val-2    |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Brutal          | weapon_properties/Brutal.js         | Done | val-w1  | Automatic hook (onReviewAction): checks single-die damage rolls for max face; uses table.rollDie() for extra roll; adds result to damage effect. Only simple dN notation triggers (multi-die expressions like 2d6 cannot be decomposed). |                                                                                                                                                                                    | Back-applied CONV-026: scoped dmgEffect.find() to action target. |           |
| Burning         | weapon_properties/Burning.js        | Done | val-w1  | Automatic hook (onResolve): counts damage dice showing value 6; marks that many Stress on the action target. |                                                                                                                                                                                    | Back-applied: added type === 'attack' guard. |           |
| Charged         | weapon_properties/Charged.js        | Validated | val-w1  | Intent toggle chip (stressCost: 1, temporaryStatMods: { proficiency: 1 }); chip only shown when acting on an attack. | | Added `(table) => table.action?.type === 'attack'` to the `when()` condition. Negative test added (chip absent on trait rolls). | 
| Concussive      | weapon_properties/Concussive.js     | Validated | fix-wp-1    |                                                                                                                                                                                    |                                                                                                                                                                                                                                       | Added `type === 'attack'` guard to when() condition. |
| Cumbersome      | weapon_properties/Cumbersome.js     | Validated | val-2    |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Deadly          | weapon_properties/Deadly.js         | Done | val-2    | onReviewOutcome: adds +1 HP to target effects with amount >= 3; scoped to `e.target?.instanceId === table.action?.target?.instanceId` | | Back-applied: added type === 'attack' guard. fix-deadly |
| Deflecting      | weapon_properties/Deflecting.js     | Done      | unblock-armorscore | `temporaryStatMods` supports function values; reviewAction toggle chip with `armorCost: 1` and `temporaryStatMods: { evasion: (table) => table.me?.armor ?? 0 }`. "Available Armor Score" = `table.me.armor` (unmarked slots). |                                                                                                                                                                                                                                       |           |
| Destructive     | weapon_properties/Destructive.js    | Validated | val-2    |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Devastating     | weapon_properties/Devastating.js    | Validated  | val-wp1 | Intent toggle + stress; `onUse` snapshots damage dice, replaces with d20, restores on toggle off.                                                                                                                                                 |                                                                                                                                                                                                                                       |           |
| Double Duty     | weapon_properties/DoubleDuty.js     | Validated  | val-wp1 | `passiveStatMods.armorScore: 1`; `onIntent` +1 damage static in melee attacks.                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Doubled Up      | weapon_properties/DoubledUp.js      | Blocked   | impl-wp-1 | SRD: second target in Melee — needs additional target selection from a chip (same class as Bouncing).                                                                                                                                            |                                                                                                                                                                                                                                       |           |
| Dueling         | weapon_properties/Dueling.js        | Validated  | fix-k7qm | `onIntent`: advantage when exactly two actors (attacker + target) are within Close range of the target.                                                                                                                                        |  |           |
| Eruptive        | weapon_properties/Eruptive.js       | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Grappling       | weapon_properties/Grappling.js      | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Greedy          | weapon_properties/Greedy.js         | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Healing         | weapon_properties/Healing.js        | Done | impl-w-auto-1 | onRest hook: auto-clears 1 HP from weapon owner on any rest (short or long) |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Heavy           | weapon_properties/Heavy.js          | Validated | val-wp-simple-1 | passive stat mod: -1 Evasion |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Hooked          | weapon_properties/Hooked.js         | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Hot             | weapon_properties/Hot.js            | Done | impl-w-auto-1 | Purely narrative — no mechanical effect |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Invigorating    | weapon_properties/Invigorating.js   | Done | impl-w2  | onResolve: when isActing + isSuccess, rolls d4; on 4 clears 1 Stress from attacker |                                                                                                                                                                                                                                       |           |
| Lifestealing    | weapon_properties/Lifestealing.js   | Done | impl-w-auto-1 | onResolve: when isActing + isSuccess, rolls d6; on 6 clears 1 HP from attacker (auto-selects HP over Stress; post-resolve player choice not yet supported by V2 API) |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Locked On       | weapon_properties/LockedOn.js       | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Long            | weapon_properties/Long.js           | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Lucky           | weapon_properties/Lucky.js          | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Massive         | weapon_properties/Massive.js        | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Otherworldly    | weapon_properties/Otherworldly.js   | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Painful         | weapon_properties/Painful.js        | Done | impl-w2  | onResolve: when isActing + isSuccess, marks 1 Stress on attacker |                                                                                                                                                                                                                                       |           |
| Paired          | weapon_properties/Paired.js         | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Parry           | weapon_properties/Parry.js          | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Persuasive      | weapon_properties/Persuasive.js     | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Pompous         | weapon_properties/Pompous.js        | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Powerful        | weapon_properties/Powerful.js       | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Protective      | weapon_properties/Protective.js     | Validated | val-wp-simple-1 | passive stat mod: +1 Armor Score |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Quick           | weapon_properties/Quick.js          | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Reliable        | weapon_properties/Reliable.js       | Validated | val-wp-simple-1 | onIntent: +1 static to action roll on attacks only (type === 'attack') | | fix-bq9r |
| Reloading       | weapon_properties/Reloading.js      | Done | impl-w2  | onResolve: when isActing, rolls d6; on 1 marks 1 Stress on attacker (fires regardless of success/failure) |                                                                                                                                                                                                                                       |           |
| Retractable     | weapon_properties/Retractable.js    | Done | impl-w-auto-1 | Purely narrative — no mechanical effect |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Returning       | weapon_properties/Returning.js      | Done | impl-w-auto-1 | Purely narrative — no mechanical effect |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Scary           | weapon_properties/Scary.js          | Done | fix-wp-1 | onResolve: target marks 1 Stress on successful attack |  | Added `type === 'attack'` guard; moved inline `if` to `when()` predicates (CONV-001). |
| Self-Correcting | weapon_properties/SelfCorrecting.js | Done | impl-w2  | onReviewAction: when isActing, for each damage die showing 1 adds 5 to damage effect (1 becomes 6) |                                                                                                                                                                                                                                       |           |
| Serrated        | weapon_properties/Serrated.js       | Done | impl-w2  | onReviewAction: when isActing, for each damage die showing 1 adds 7 to damage effect (1 becomes 8) |                                                                                                                                                                                                                                       |           |
| Sharpwing       | weapon_properties/Sharpwing.js      | Validated | fix-sw9k | onIntent: adds Agility (table.me.stats.agility) as static bonus to damage roll when acting; skips when agility=0 | CONV-010: `table.me.stats.agility` is not documented in the Feature Authoring Guide §C.2 Actor API. The guide does not list `stats` or any equivalent trait-access property. The fix should either document `table.me.stats` in the guide (mapping to `element.traits`) or define a canonical documented API for reading trait scores at runtime. | Renamed `stats` → `traits` in engine actor builder; updated feature to use `table.me?.traits?.agility`; documented `table.me.traits` in §C.2 of Feature Authoring Guide. |
| Sheltering      | weapon_properties/Sheltering.js     | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Startling       | weapon_properties/Startling.js      | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Timebending     | weapon_properties/Timebending.js    | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |
| Versatile       | weapon_properties/Versatile.js      | Unclaimed | —        |                                                                                                                                                                                    |                                                                                                                                                                                                                                       |           |


---

### Armor Properties (21 unique properties)

> Implement in `src/features-v2/armor_properties/<PropertyName>.js`.


| Feature Name | Source File                      | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------ | -------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Burning      | armor_properties/Burning.js      | Done | impl-ap2 | onResolve hook: when targeted by melee attack, actor marks 1 Stress |           |           |
| Channeling   | armor_properties/Channeling.js   | Done | impl-ap2 | onIntent hook: when acting with spellcast, addStatic +1 to action roll |           |           |
| Difficult    | armor_properties/Difficult.js    | Validated | val-ap1 | passiveStatMods: -1 to all 6 traits + evasion |           |           |
| Flexible     | armor_properties/Flexible.js     | Validated | val-ap1 | passiveStatMods: evasion +1 |           |           |
| Fortified    | armor_properties/Fortified.js    | Unclaimed | —     |            |           |           |
| Gilded       | armor_properties/Gilded.js       | Validated | val-ap1 | passiveStatMods: presence +1 |           |           |
| Heavy        | armor_properties/Heavy.js        | Validated | val-ap1 | passiveStatMods: evasion -1 |           |           |
| Hopeful      | armor_properties/Hopeful.js      | Unclaimed | —     |            |           |           |
| Impenetrable | armor_properties/Impenetrable.js | Unclaimed | —     |            |           |           |
| Magic        | armor_properties/Magic.js        | Unclaimed | —     |            |           |           |
| Painful      | armor_properties/Painful.js      | Unclaimed | —     |            |           |           |
| Physical     | armor_properties/Physical.js     | Unclaimed | —     |            |           |           |
| Quiet        | armor_properties/Quiet.js        | Done | impl-ap2 | chip at intent: +2 to rolls made to move silently |           |           |
| Reinforced   | armor_properties/Reinforced.js   | Unclaimed | —     |            |           |           |
| Resilient    | armor_properties/Resilient.js    | Unclaimed | —     |            |           |           |
| Sharp        | armor_properties/Sharp.js        | Unclaimed | —     |            |           |           |
| Shifting     | armor_properties/Shifting.js     | Unclaimed | —     |            |           |           |
| Timeslowing  | armor_properties/Timeslowing.js  | Unclaimed | —     |            |           |           |
| Truthseeking | armor_properties/Truthseeking.js | Done | impl-ap2 | purely narrative — no mechanical effect to automate |           |           |
| Very Heavy   | armor_properties/VeryHeavy.js    | Validated | val-ap1 | passiveStatMods: evasion -2, agility -1 |           |           |
| Warded       | armor_properties/Warded.js       | Blocked | impl-ap2 | Needs armorScore on actor API — see Blocked table |           |           |


---

### Classes (24 features across 9 classes)

> Implement in `src/features-v2/classes/<ClassName>.js`. Each file exports all features for that class.


| Feature Name          | Source File         | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------------- | ------------------- | --------- | ----- | ---------- | --------- | --------- |
| Make a Scene (Hope)   | classes/Bard.js     | Unclaimed | —     |            |           |           |
| Rally                 | classes/Bard.js     | Unclaimed | —     |            |           |           |
| Evolution (Hope)      | classes/Druid.js    | Unclaimed | —     |            |           |           |
| Beastform             | classes/Druid.js    | Unclaimed | —     |            |           |           |
| Wildtouch             | classes/Druid.js    | Unclaimed | —     |            |           |           |
| Frontline Tank (Hope) | classes/Guardian.js | Unclaimed | —     |            |           |           |
| Unstoppable           | classes/Guardian.js | Unclaimed | —     |            |           |           |
| Hold Them Off (Hope)  | classes/Ranger.js   | Unclaimed | —     |            |           |           |
| Ranger's Focus        | classes/Ranger.js   | Unclaimed | —     |            |           |           |
| Rogue's Dodge (Hope)  | classes/Rogue.js    | Unclaimed | —     |            |           |           |
| Cloaked               | classes/Rogue.js    | Unclaimed | —     |            |           |           |
| Sneak Attack          | classes/Rogue.js    | Unclaimed | —     |            |           |           |
| Life Support (Hope)   | classes/Seraph.js   | Unclaimed | —     |            |           |           |
| Prayer Dice           | classes/Seraph.js   | Unclaimed | —     |            |           |           |
| Volatile Magic (Hope) | classes/Sorcerer.js | Unclaimed | —     |            |           |           |
| Arcane Sense          | classes/Sorcerer.js | Unclaimed | —     |            |           |           |
| Minor Illusion        | classes/Sorcerer.js | Unclaimed | —     |            |           |           |
| Channel Raw Power     | classes/Sorcerer.js | Unclaimed | —     |            |           |           |
| No Mercy (Hope)       | classes/Warrior.js  | Unclaimed | —     |            |           |           |
| Attack of Opportunity | classes/Warrior.js  | Unclaimed | —     |            |           |           |
| Combat Training       | classes/Warrior.js  | Unclaimed | —     |            |           |           |
| Not This Time (Hope)  | classes/Wizard.js   | Unclaimed | —     |            |           |           |
| Prestidigitation      | classes/Wizard.js   | Unclaimed | —     |            |           |           |
| Strange Patterns      | classes/Wizard.js   | Unclaimed | —     |            |           |           |


---

### Subclasses (74 features across 18 subclasses)

> Implement in `src/features-v2/subclasses/<SubclassName>.js`.


| Feature Name          | Source File                       | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------------- | --------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Gifted Performer      | subclasses/Troubadour.js          | Unclaimed | —     |            |           |           |
| Maestro               | subclasses/Troubadour.js          | Unclaimed | —     |            |           |           |
| Virtuoso              | subclasses/Troubadour.js          | Unclaimed | —     |            |           |           |
| Rousing Speech        | subclasses/Wordsmith.js           | Unclaimed | —     |            |           |           |
| Heart of a Poet       | subclasses/Wordsmith.js           | Unclaimed | —     |            |           |           |
| Eloquent              | subclasses/Wordsmith.js           | Unclaimed | —     |            |           |           |
| Epic Poetry           | subclasses/Wordsmith.js           | Unclaimed | —     |            |           |           |
| Elemental Incarnation | subclasses/WardenOfTheElements.js | Unclaimed | —     |            |           |           |
| Elemental Aura        | subclasses/WardenOfTheElements.js | Unclaimed | —     |            |           |           |
| Elemental Dominion    | subclasses/WardenOfTheElements.js | Unclaimed | —     |            |           |           |
| Clarity of Nature     | subclasses/WardenOfRenewal.js     | Unclaimed | —     |            |           |           |
| Regeneration          | subclasses/WardenOfRenewal.js     | Unclaimed | —     |            |           |           |
| Regenerative Reach    | subclasses/WardenOfRenewal.js     | Unclaimed | —     |            |           |           |
| Warden's Protection   | subclasses/WardenOfRenewal.js     | Unclaimed | —     |            |           |           |
| Defender              | subclasses/WardenOfRenewal.js     | Unclaimed | —     |            |           |           |
| Unwavering            | subclasses/Stalwart.js            | Unclaimed | —     |            |           |           |
| Iron Will             | subclasses/Stalwart.js            | Unclaimed | —     |            |           |           |
| Unrelenting           | subclasses/Stalwart.js            | Unclaimed | —     |            |           |           |
| Partners-in-Arms      | subclasses/Stalwart.js            | Unclaimed | —     |            |           |           |
| Undaunted             | subclasses/Stalwart.js            | Unclaimed | —     |            |           |           |
| Loyal Protector       | subclasses/Stalwart.js            | Unclaimed | —     |            |           |           |
| At Ease               | subclasses/Vengeance.js           | Unclaimed | —     |            |           |           |
| Revenge               | subclasses/Vengeance.js           | Unclaimed | —     |            |           |           |
| Act of Reprisal       | subclasses/Vengeance.js           | Unclaimed | —     |            |           |           |
| Nemesis               | subclasses/Vengeance.js           | Unclaimed | —     |            |           |           |
| Companion             | subclasses/Beastbound.js          | Unclaimed | —     |            |           |           |
| Expert Training       | subclasses/Beastbound.js          | Unclaimed | —     |            |           |           |
| Battle-Bonded         | subclasses/Beastbound.js          | Unclaimed | —     |            |           |           |
| Advanced Training     | subclasses/Beastbound.js          | Unclaimed | —     |            |           |           |
| Loyal Friend          | subclasses/Beastbound.js          | Unclaimed | —     |            |           |           |
| Ruthless Predator     | subclasses/Wayfinder.js           | Unclaimed | —     |            |           |           |
| Path Forward          | subclasses/Wayfinder.js           | Unclaimed | —     |            |           |           |
| Elusive Predator      | subclasses/Wayfinder.js           | Unclaimed | —     |            |           |           |
| Apex Predator         | subclasses/Wayfinder.js           | Unclaimed | —     |            |           |           |
| Shadow Stepper        | subclasses/Nightwalker.js         | Unclaimed | —     |            |           |           |
| Dark Cloud            | subclasses/Nightwalker.js         | Unclaimed | —     |            |           |           |
| Adrenaline            | subclasses/Nightwalker.js         | Unclaimed | —     |            |           |           |
| Fleeting Shadow       | subclasses/Nightwalker.js         | Unclaimed | —     |            |           |           |
| Vanishing Act         | subclasses/Nightwalker.js         | Unclaimed | —     |            |           |           |
| Well-Connected        | subclasses/Syndicate.js           | Unclaimed | —     |            |           |           |
| Contacts Everywhere   | subclasses/Syndicate.js           | Unclaimed | —     |            |           |           |
| Reliable Backup       | subclasses/Syndicate.js           | Unclaimed | —     |            |           |           |
| Spirit Weapon         | subclasses/DivineWielder.js       | Unclaimed | —     |            |           |           |
| Sparing Touch         | subclasses/DivineWielder.js       | Unclaimed | —     |            |           |           |
| Devout                | subclasses/DivineWielder.js       | Unclaimed | —     |            |           |           |
| Sacred Resonance      | subclasses/DivineWielder.js       | Unclaimed | —     |            |           |           |
| Wings of Light        | subclasses/WingedSentinel.js      | Unclaimed | —     |            |           |           |
| Ethereal Visage       | subclasses/WingedSentinel.js      | Unclaimed | —     |            |           |           |
| Ascendant             | subclasses/WingedSentinel.js      | Unclaimed | —     |            |           |           |
| Power of the Gods     | subclasses/WingedSentinel.js      | Unclaimed | —     |            |           |           |
| Elementalist          | subclasses/ElementalOrigin.js     | Unclaimed | —     |            |           |           |
| Natural Evasion       | subclasses/ElementalOrigin.js     | Unclaimed | —     |            |           |           |
| Transcendence         | subclasses/ElementalOrigin.js     | Unclaimed | —     |            |           |           |
| Manipulate Magic      | subclasses/PrimalOrigin.js        | Unclaimed | —     |            |           |           |
| Enchanted Aid         | subclasses/PrimalOrigin.js        | Unclaimed | —     |            |           |           |
| Arcane Charge         | subclasses/PrimalOrigin.js        | Unclaimed | —     |            |           |           |
| Courage               | subclasses/CallOfTheBrave.js      | Unclaimed | —     |            |           |           |
| Battle Ritual         | subclasses/CallOfTheBrave.js      | Unclaimed | —     |            |           |           |
| Rise to the Challenge | subclasses/CallOfTheBrave.js      | Unclaimed | —     |            |           |           |
| Camaraderie           | subclasses/CallOfTheBrave.js      | Unclaimed | —     |            |           |           |
| Slayer                | subclasses/CallOfTheSlayer.js     | Unclaimed | —     |            |           |           |
| Weapon Specialist     | subclasses/CallOfTheSlayer.js     | Unclaimed | —     |            |           |           |
| Martial Preparation   | subclasses/CallOfTheSlayer.js     | Unclaimed | —     |            |           |           |
| Prepared              | subclasses/SchoolOfKnowledge.js   | Unclaimed | —     |            |           |           |
| Adept                 | subclasses/SchoolOfKnowledge.js   | Unclaimed | —     |            |           |           |
| Accomplished          | subclasses/SchoolOfKnowledge.js   | Unclaimed | —     |            |           |           |
| Perfect Recall        | subclasses/SchoolOfKnowledge.js   | Unclaimed | —     |            |           |           |
| Brilliant             | subclasses/SchoolOfKnowledge.js   | Unclaimed | —     |            |           |           |
| Honed Expertise       | subclasses/SchoolOfKnowledge.js   | Unclaimed | —     |            |           |           |
| Battlemage            | subclasses/SchoolOfWar.js         | Unclaimed | —     |            |           |           |
| Face Your Fear        | subclasses/SchoolOfWar.js         | Unclaimed | —     |            |           |           |
| Conjure Shield        | subclasses/SchoolOfWar.js         | Unclaimed | —     |            |           |           |
| Fueled by Fear        | subclasses/SchoolOfWar.js         | Unclaimed | —     |            |           |           |
| Thrive in Chaos       | subclasses/SchoolOfWar.js         | Unclaimed | —     |            |           |           |
| Have No Fear          | subclasses/SchoolOfWar.js         | Unclaimed | —     |            |           |           |


---

### Abilities (189 abilities across 9 domains)

> Implement in `src/features-v2/abilities/<Domain>/<AbilityName>.js`.

#### Domain: Arcana (21)


| Feature Name       | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------------ | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Rune Ward          | abilities/Arcana/RuneWard.js          | Unclaimed | —     |            |           |           |
| Unleash Chaos      | abilities/Arcana/UnleashChaos.js      | Unclaimed | —     |            |           |           |
| Wall Walk          | abilities/Arcana/WallWalk.js          | Unclaimed | —     |            |           |           |
| Cinder Grasp       | abilities/Arcana/CinderGrasp.js       | Unclaimed | —     |            |           |           |
| Floating Eye       | abilities/Arcana/FloatingEye.js       | Unclaimed | —     |            |           |           |
| Counterspell       | abilities/Arcana/Counterspell.js      | Unclaimed | —     |            |           |           |
| Flight             | abilities/Arcana/Flight.js            | Unclaimed | —     |            |           |           |
| Blink Out          | abilities/Arcana/BlinkOut.js          | Unclaimed | —     |            |           |           |
| Preservation Blast | abilities/Arcana/PreservationBlast.js | Unclaimed | —     |            |           |           |
| Chain Lightning    | abilities/Arcana/ChainLightning.js    | Unclaimed | —     |            |           |           |
| Premonition        | abilities/Arcana/Premonition.js       | Unclaimed | —     |            |           |           |
| Rift Walker        | abilities/Arcana/RiftWalker.js        | Unclaimed | —     |            |           |           |
| Telekinesis        | abilities/Arcana/Telekinesis.js       | Unclaimed | —     |            |           |           |
| Arcana-Touched     | abilities/Arcana/ArcanaTouched.js     | Unclaimed | —     |            |           |           |
| Cloaking Blast     | abilities/Arcana/CloakingBlast.js     | Unclaimed | —     |            |           |           |
| Arcane Reflection  | abilities/Arcana/ArcaneReflection.js  | Unclaimed | —     |            |           |           |
| Confusing Aura     | abilities/Arcana/ConfusingAura.js     | Unclaimed | —     |            |           |           |
| Earthquake         | abilities/Arcana/Earthquake.js        | Unclaimed | —     |            |           |           |
| Sensory Projection | abilities/Arcana/SensoryProjection.js | Unclaimed | —     |            |           |           |
| Adjust Reality     | abilities/Arcana/AdjustReality.js     | Unclaimed | —     |            |           |           |
| Falling Sky        | abilities/Arcana/FallingSky.js        | Unclaimed | —     |            |           |           |


#### Domain: Blade (21)


| Feature Name      | Source File                         | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ----------------- | ----------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Get Back Up       | abilities/Blade/GetBackUp.js        | Unclaimed | —     |            |           |           |
| Not Good Enough   | abilities/Blade/NotGoodEnough.js    | Unclaimed | —     |            |           |           |
| Whirlwind         | abilities/Blade/Whirlwind.js        | Unclaimed | —     |            |           |           |
| A Soldier's Bond  | abilities/Blade/ASoldiersBond.js    | Unclaimed | —     |            |           |           |
| Reckless          | abilities/Blade/Reckless.js         | Unclaimed | —     |            |           |           |
| Scramble          | abilities/Blade/Scramble.js         | Unclaimed | —     |            |           |           |
| Versatile Fighter | abilities/Blade/VersatileFighter.js | Unclaimed | —     |            |           |           |
| Deadly Focus      | abilities/Blade/DeadlyFocus.js      | Unclaimed | —     |            |           |           |
| Fortified Armor   | abilities/Blade/FortifiedArmor.js   | Unclaimed | —     |            |           |           |
| Champion's Edge   | abilities/Blade/ChampionsEdge.js    | Unclaimed | —     |            |           |           |
| Vitality          | abilities/Blade/Vitality.js         | Unclaimed | —     |            |           |           |
| Battle-Hardened   | abilities/Blade/BattleHardened.js   | Unclaimed | —     |            |           |           |
| Rage Up           | abilities/Blade/RageUp.js           | Unclaimed | —     |            |           |           |
| Blade-Touched     | abilities/Blade/BladeTouched.js     | Unclaimed | —     |            |           |           |
| Glancing Blow     | abilities/Blade/GlancingBlow.js     | Unclaimed | —     |            |           |           |
| Battle Cry        | abilities/Blade/BattleCry.js        | Unclaimed | —     |            |           |           |
| Frenzy            | abilities/Blade/Frenzy.js           | Unclaimed | —     |            |           |           |
| Gore and Glory    | abilities/Blade/GoreAndGlory.js     | Unclaimed | —     |            |           |           |
| Reaper's Strike   | abilities/Blade/ReapersStrike.js    | Unclaimed | —     |            |           |           |
| Battle Monster    | abilities/Blade/BattleMonster.js    | Unclaimed | —     |            |           |           |
| Onslaught         | abilities/Blade/Onslaught.js        | Unclaimed | —     |            |           |           |


#### Domain: Bone (21)


| Feature Name       | Source File                         | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------------ | ----------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Deft Maneuvers     | abilities/Bone/DeftManeuvers.js     | Unclaimed | —     |            |           |           |
| I See It Coming    | abilities/Bone/ISeeItComing.js      | Unclaimed | —     |            |           |           |
| Untouchable        | abilities/Bone/Untouchable.js       | Unclaimed | —     |            |           |           |
| Ferocity           | abilities/Bone/Ferocity.js          | Unclaimed | —     |            |           |           |
| Strategic Approach | abilities/Bone/StrategicApproach.js | Unclaimed | —     |            |           |           |
| Brace              | abilities/Bone/Brace.js             | Unclaimed | —     |            |           |           |
| Tactician          | abilities/Bone/Tactician.js         | Unclaimed | —     |            |           |           |
| Boost              | abilities/Bone/Boost.js             | Unclaimed | —     |            |           |           |
| Redirect           | abilities/Bone/Redirect.js          | Unclaimed | —     |            |           |           |
| Know Thy Enemy     | abilities/Bone/KnowThyEnemy.js      | Unclaimed | —     |            |           |           |
| Signature Move     | abilities/Bone/SignatureMove.js     | Unclaimed | —     |            |           |           |
| Rapid Riposte      | abilities/Bone/RapidRiposte.js      | Unclaimed | —     |            |           |           |
| Recovery           | abilities/Bone/Recovery.js          | Unclaimed | —     |            |           |           |
| Bone-Touched       | abilities/Bone/BoneTouched.js       | Unclaimed | —     |            |           |           |
| Cruel Precision    | abilities/Bone/CruelPrecision.js    | Unclaimed | —     |            |           |           |
| Breaking Blow      | abilities/Bone/BreakingBlow.js      | Unclaimed | —     |            |           |           |
| Wrangle            | abilities/Bone/Wrangle.js           | Unclaimed | —     |            |           |           |
| On the Brink       | abilities/Bone/OnTheBrink.js        | Unclaimed | —     |            |           |           |
| Splintering Strike | abilities/Bone/SplinteringStrike.js | Unclaimed | —     |            |           |           |
| Deathrun           | abilities/Bone/Deathrun.js          | Unclaimed | —     |            |           |           |
| Swift Step         | abilities/Bone/SwiftStep.js         | Unclaimed | —     |            |           |           |


#### Domain: Codex (21)


| Feature Name         | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------------------- | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Book of Ava          | abilities/Codex/BookOfAva.js          | Unclaimed | —     |            |           |           |
| Book of Illiat       | abilities/Codex/BookOfIlliat.js       | Unclaimed | —     |            |           |           |
| Book of Tyfar        | abilities/Codex/BookOfTyfar.js        | Unclaimed | —     |            |           |           |
| Book of Sitil        | abilities/Codex/BookOfSitil.js        | Unclaimed | —     |            |           |           |
| Book of Vagras       | abilities/Codex/BookOfVagras.js       | Unclaimed | —     |            |           |           |
| Book of Korvax       | abilities/Codex/BookOfKorvax.js       | Unclaimed | —     |            |           |           |
| Book of Norai        | abilities/Codex/BookOfNorai.js        | Unclaimed | —     |            |           |           |
| Book of Exota        | abilities/Codex/BookOfExota.js        | Unclaimed | —     |            |           |           |
| Book of Grynn        | abilities/Codex/BookOfGrynn.js        | Unclaimed | —     |            |           |           |
| Manifest Wall        | abilities/Codex/ManifestWall.js       | Unclaimed | —     |            |           |           |
| Teleport             | abilities/Codex/Teleport.js           | Unclaimed | —     |            |           |           |
| Banish               | abilities/Codex/Banish.js             | Unclaimed | —     |            |           |           |
| Sigil of Retribution | abilities/Codex/SigilOfRetribution.js | Unclaimed | —     |            |           |           |
| Book of Homet        | abilities/Codex/BookOfHomet.js        | Unclaimed | —     |            |           |           |
| Codex-Touched        | abilities/Codex/CodexTouched.js       | Unclaimed | —     |            |           |           |
| Book of Vyola        | abilities/Codex/BookOfVyola.js        | Unclaimed | —     |            |           |           |
| Safe Haven           | abilities/Codex/SafeHaven.js          | Unclaimed | —     |            |           |           |
| Book of Ronin        | abilities/Codex/BookOfRonin.js        | Unclaimed | —     |            |           |           |
| Disintegration Wave  | abilities/Codex/DisintegrationWave.js | Unclaimed | —     |            |           |           |
| Book of Yarrow       | abilities/Codex/BookOfYarrow.js       | Unclaimed | —     |            |           |           |
| Transcendent Union   | abilities/Codex/TranscendentUnion.js  | Unclaimed | —     |            |           |           |


#### Domain: Grace (21)


| Feature Name        | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------------- | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Deft Deceiver       | abilities/Grace/DeftDeceiver.js       | Unclaimed | —     |            |           |           |
| Enrapture           | abilities/Grace/Enrapture.js          | Unclaimed | —     |            |           |           |
| Inspirational Words | abilities/Grace/InspirationalWords.js | Unclaimed | —     |            |           |           |
| Tell No Lies        | abilities/Grace/TellNoLies.js         | Unclaimed | —     |            |           |           |
| Troublemaker        | abilities/Grace/Troublemaker.js       | Unclaimed | —     |            |           |           |
| Hypnotic Shimmer    | abilities/Grace/HypnoticShimmer.js    | Unclaimed | —     |            |           |           |
| Invisibility        | abilities/Grace/Invisibility.js       | Unclaimed | —     |            |           |           |
| Soothing Speech     | abilities/Grace/SoothingSpeech.js     | Unclaimed | —     |            |           |           |
| Through Your Eyes   | abilities/Grace/ThroughYourEyes.js    | Unclaimed | —     |            |           |           |
| Thought Delver      | abilities/Grace/ThoughtDelver.js      | Unclaimed | —     |            |           |           |
| Words of Discord    | abilities/Grace/WordsOfDiscord.js     | Unclaimed | —     |            |           |           |
| Never Upstaged      | abilities/Grace/NeverUpstaged.js      | Unclaimed | —     |            |           |           |
| Share the Burden    | abilities/Grace/ShareTheBurden.js     | Unclaimed | —     |            |           |           |
| Endless Charisma    | abilities/Grace/EndlessCharisma.js    | Unclaimed | —     |            |           |           |
| Grace-Touched       | abilities/Grace/GraceTouched.js       | Unclaimed | —     |            |           |           |
| Astral Projection   | abilities/Grace/AstralProjection.js   | Unclaimed | —     |            |           |           |
| Mass Enrapture      | abilities/Grace/MassEnrapture.js      | Unclaimed | —     |            |           |           |
| Copycat             | abilities/Grace/Copycat.js            | Unclaimed | —     |            |           |           |
| Master of the Craft | abilities/Grace/MasterOfTheCraft.js   | Unclaimed | —     |            |           |           |
| Encore              | abilities/Grace/Encore.js             | Unclaimed | —     |            |           |           |
| Notorious           | abilities/Grace/Notorious.js          | Unclaimed | —     |            |           |           |


#### Domain: Midnight (21)


| Feature Name        | Source File                            | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------------- | -------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Pick and Pull       | abilities/Midnight/PickAndPull.js      | Unclaimed | —     |            |           |           |
| Rain of Blades      | abilities/Midnight/RainOfBlades.js     | Unclaimed | —     |            |           |           |
| Uncanny Disguise    | abilities/Midnight/UncannyDisguise.js  | Unclaimed | —     |            |           |           |
| Midnight Spirit     | abilities/Midnight/MidnightSpirit.js   | Unclaimed | —     |            |           |           |
| Shadowbind          | abilities/Midnight/Shadowbind.js       | Unclaimed | —     |            |           |           |
| Chokehold           | abilities/Midnight/Chokehold.js        | Unclaimed | —     |            |           |           |
| Veil of Night       | abilities/Midnight/VeilOfNight.js      | Unclaimed | —     |            |           |           |
| Stealth Expertise   | abilities/Midnight/StealthExpertise.js | Unclaimed | —     |            |           |           |
| Glyph of Nightfall  | abilities/Midnight/GlyphOfNightfall.js | Unclaimed | —     |            |           |           |
| Hush                | abilities/Midnight/Hush.js             | Unclaimed | —     |            |           |           |
| Phantom Retreat     | abilities/Midnight/PhantomRetreat.js   | Unclaimed | —     |            |           |           |
| Dark Whispers       | abilities/Midnight/DarkWhispers.js     | Unclaimed | —     |            |           |           |
| Mass Disguise       | abilities/Midnight/MassDisguise.js     | Unclaimed | —     |            |           |           |
| Midnight-Touched    | abilities/Midnight/MidnightTouched.js  | Unclaimed | —     |            |           |           |
| Vanishing Dodge     | abilities/Midnight/VanishingDodge.js   | Unclaimed | —     |            |           |           |
| Shadowhunter        | abilities/Midnight/Shadowhunter.js     | Unclaimed | —     |            |           |           |
| Spellcharge         | abilities/Midnight/Spellcharge.js      | Unclaimed | —     |            |           |           |
| Night Terror        | abilities/Midnight/NightTerror.js      | Unclaimed | —     |            |           |           |
| Twilight Toll       | abilities/Midnight/TwilightToll.js     | Unclaimed | —     |            |           |           |
| Eclipse             | abilities/Midnight/Eclipse.js          | Unclaimed | —     |            |           |           |
| Specter of the Dark | abilities/Midnight/SpecterOfTheDark.js | Unclaimed | —     |            |           |           |


#### Domain: Sage (21)


| Feature Name         | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------------------- | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Gifted Tracker       | abilities/Sage/GiftedTracker.js       | Unclaimed | —     |            |           |           |
| Nature's Tongue      | abilities/Sage/NaturesTongue.js       | Unclaimed | —     |            |           |           |
| Vicious Entangle     | abilities/Sage/ViciousEntangle.js     | Unclaimed | —     |            |           |           |
| Conjure Swarm        | abilities/Sage/ConjureSwarm.js        | Unclaimed | —     |            |           |           |
| Natural Familiar     | abilities/Sage/NaturalFamiliar.js     | Unclaimed | —     |            |           |           |
| Corrosive Projectile | abilities/Sage/CorrosiveProjectile.js | Unclaimed | —     |            |           |           |
| Towering Stalk       | abilities/Sage/ToweringStalk.js       | Unclaimed | —     |            |           |           |
| Death Grip           | abilities/Sage/DeathGrip.js           | Unclaimed | —     |            |           |           |
| Healing Field        | abilities/Sage/HealingField.js        | Unclaimed | —     |            |           |           |
| Thorn Skin           | abilities/Sage/ThornSkin.js           | Unclaimed | —     |            |           |           |
| Wild Fortress        | abilities/Sage/WildFortress.js        | Unclaimed | —     |            |           |           |
| Conjured Steeds      | abilities/Sage/ConjuredSteeds.js      | Unclaimed | —     |            |           |           |
| Forager              | abilities/Sage/Forager.js             | Unclaimed | —     |            |           |           |
| Sage-Touched         | abilities/Sage/SageTouched.js         | Unclaimed | —     |            |           |           |
| Wild Surge           | abilities/Sage/WildSurge.js           | Unclaimed | —     |            |           |           |
| Forest Sprites       | abilities/Sage/ForestSprites.js       | Unclaimed | —     |            |           |           |
| Rejuvenation Barrier | abilities/Sage/RejuvenationBarrier.js | Unclaimed | —     |            |           |           |
| Fane of the Wilds    | abilities/Sage/FaneOfTheWilds.js      | Unclaimed | —     |            |           |           |
| Plant Dominion       | abilities/Sage/PlantDominion.js       | Unclaimed | —     |            |           |           |
| Force of Nature      | abilities/Sage/ForceOfNature.js       | Unclaimed | —     |            |           |           |
| Tempest              | abilities/Sage/Tempest.js             | Unclaimed | —     |            |           |           |


#### Domain: Splendor (21)


| Feature Name       | Source File                            | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------------ | -------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Bolt Beacon        | abilities/Splendor/BoltBeacon.js       | Unclaimed | —     |            |           |           |
| Mending Touch      | abilities/Splendor/MendingTouch.js     | Unclaimed | —     |            |           |           |
| Reassurance        | abilities/Splendor/Reassurance.js      | Unclaimed | —     |            |           |           |
| Final Words        | abilities/Splendor/FinalWords.js       | Unclaimed | —     |            |           |           |
| Healing Hands      | abilities/Splendor/HealingHands.js     | Unclaimed | —     |            |           |           |
| Second Wind        | abilities/Splendor/SecondWind.js       | Unclaimed | —     |            |           |           |
| Voice of Reason    | abilities/Splendor/VoiceOfReason.js    | Unclaimed | —     |            |           |           |
| Divination         | abilities/Splendor/Divination.js       | Unclaimed | —     |            |           |           |
| Life Ward          | abilities/Splendor/LifeWard.js         | Unclaimed | —     |            |           |           |
| Shape Material     | abilities/Splendor/ShapeMaterial.js    | Unclaimed | —     |            |           |           |
| Smite              | abilities/Splendor/Smite.js            | Unclaimed | —     |            |           |           |
| Restoration        | abilities/Splendor/Restoration.js      | Unclaimed | —     |            |           |           |
| Zone of Protection | abilities/Splendor/ZoneOfProtection.js | Unclaimed | —     |            |           |           |
| Healing Strike     | abilities/Splendor/HealingStrike.js    | Unclaimed | —     |            |           |           |
| Splendor-Touched   | abilities/Splendor/SplendorTouched.js  | Unclaimed | —     |            |           |           |
| Shield Aura        | abilities/Splendor/ShieldAura.js       | Unclaimed | —     |            |           |           |
| Stunning Sunlight  | abilities/Splendor/StunningSunlight.js | Unclaimed | —     |            |           |           |
| Overwhelming Aura  | abilities/Splendor/OverwhelmingAura.js | Unclaimed | —     |            |           |           |
| Salvation Beam     | abilities/Splendor/SalvationBeam.js    | Unclaimed | —     |            |           |           |
| Invigoration       | abilities/Splendor/Invigoration.js     | Unclaimed | —     |            |           |           |
| Resurrection       | abilities/Splendor/Resurrection.js     | Unclaimed | —     |            |           |           |


#### Domain: Valor (21)


| Feature Name         | Source File                            | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------------------- | -------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Bare Bones           | abilities/Valor/BareBones.js           | Unclaimed | —     |            |           |           |
| Forceful Push        | abilities/Valor/ForcefulPush.js        | Unclaimed | —     |            |           |           |
| I Am Your Shield     | abilities/Valor/IAmYourShield.js       | Unclaimed | —     |            |           |           |
| Body Basher          | abilities/Valor/BodyBasher.js          | Unclaimed | —     |            |           |           |
| Bold Presence        | abilities/Valor/BoldPresence.js        | Unclaimed | —     |            |           |           |
| Critical Inspiration | abilities/Valor/CriticalInspiration.js | Unclaimed | —     |            |           |           |
| Lean on Me           | abilities/Valor/LeanOnMe.js            | Unclaimed | —     |            |           |           |
| Goad Them on         | abilities/Valor/GoadThemOn.js          | Unclaimed | —     |            |           |           |
| Support Tank         | abilities/Valor/SupportTank.js         | Unclaimed | —     |            |           |           |
| Armorer              | abilities/Valor/Armorer.js             | Unclaimed | —     |            |           |           |
| Rousing Strike       | abilities/Valor/RousingStrike.js       | Unclaimed | —     |            |           |           |
| Inevitable           | abilities/Valor/Inevitable.js          | Unclaimed | —     |            |           |           |
| Rise Up              | abilities/Valor/RiseUp.js              | Unclaimed | —     |            |           |           |
| Shrug It Off         | abilities/Valor/ShrugItOff.js          | Unclaimed | —     |            |           |           |
| Valor-Touched        | abilities/Valor/ValorTouched.js        | Unclaimed | —     |            |           |           |
| Full Surge           | abilities/Valor/FullSurge.js           | Unclaimed | —     |            |           |           |
| Ground Pound         | abilities/Valor/GroundPound.js         | Unclaimed | —     |            |           |           |
| Hold the Line        | abilities/Valor/HoldTheLine.js         | Unclaimed | —     |            |           |           |
| Lead by Example      | abilities/Valor/LeadByExample.js       | Unclaimed | —     |            |           |           |
| Unbreakable          | abilities/Valor/Unbreakable.js         | Unclaimed | —     |            |           |           |
| Unyielding Armor     | abilities/Valor/UnyieldingArmor.js     | Unclaimed | —     |            |           |           |


---

### Beastforms (24)

> Implement in `src/features-v2/beastforms/<BeastformName>.js`.


| Feature Name         | Source File                      | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------------------- | -------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Agile Scout          | beastforms/AgileScout.js         | Unclaimed | —     |            |           |           |
| Household Friend     | beastforms/HouseholdFriend.js    | Unclaimed | —     |            |           |           |
| Nimble Grazer        | beastforms/NimbleGrazer.js       | Unclaimed | —     |            |           |           |
| Pack Predator        | beastforms/PackPredator.js       | Unclaimed | —     |            |           |           |
| Aquatic Scout        | beastforms/AquaticScout.js       | Unclaimed | —     |            |           |           |
| Stalking Arachnid    | beastforms/StalkingArachnid.js   | Unclaimed | —     |            |           |           |
| Armored Sentry       | beastforms/ArmoredSentry.js      | Unclaimed | —     |            |           |           |
| Powerful Beast       | beastforms/PowerfulBeast.js      | Unclaimed | —     |            |           |           |
| Mighty Strider       | beastforms/MightyStrider.js      | Unclaimed | —     |            |           |           |
| Striking Serpent     | beastforms/StrikingSerpent.js    | Unclaimed | —     |            |           |           |
| Pouncing Predator    | beastforms/PouncingPredator.js   | Unclaimed | —     |            |           |           |
| Winged Beast         | beastforms/WingedBeast.js        | Unclaimed | —     |            |           |           |
| Great Predator       | beastforms/GreatPredator.js      | Unclaimed | —     |            |           |           |
| Mighty Lizard        | beastforms/MightyLizard.js       | Unclaimed | —     |            |           |           |
| Great Winged Beast   | beastforms/GreatWingedBeast.js   | Unclaimed | —     |            |           |           |
| Aquatic Predator     | beastforms/AquaticPredator.js    | Unclaimed | —     |            |           |           |
| Legendary Beast      | beastforms/LegendaryBeast.js     | Unclaimed | —     |            |           |           |
| Legendary Hybrid     | beastforms/LegendaryHybrid.js    | Unclaimed | —     |            |           |           |
| Massive Behemoth     | beastforms/MassiveBehemoth.js    | Unclaimed | —     |            |           |           |
| Terrible Lizard      | beastforms/TerribleLizard.js     | Unclaimed | —     |            |           |           |
| Mythic Aerial Hunter | beastforms/MythicAerialHunter.js | Unclaimed | —     |            |           |           |
| Epic Aquatic Beast   | beastforms/EpicAquaticBeast.js   | Unclaimed | —     |            |           |           |
| Mythic Beast         | beastforms/MythicBeast.js        | Unclaimed | —     |            |           |           |
| Mythic Hybrid        | beastforms/MythicHybrid.js       | Unclaimed | —     |            |           |           |


---

### Items (60)

> Implement in `src/features-v2/items/<ItemName>.js`.


| Feature Name                | Source File                       | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------------------- | --------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Premium Bedroll             | items/PremiumBedroll.js           | Unclaimed | —     |            |           |           |
| Piper Whistle               | items/PiperWhistle.js             | Unclaimed | —     |            |           |           |
| Charging Quiver             | items/ChargingQuiver.js           | Unclaimed | —     |            |           |           |
| Alistair's Torch            | items/AlistairsTorch.js           | Unclaimed | —     |            |           |           |
| Speaking Orbs               | items/SpeakingOrbs.js             | Unclaimed | —     |            |           |           |
| Manacles                    | items/Manacles.js                 | Unclaimed | —     |            |           |           |
| Arcane Cloak                | items/ArcaneCloak.js              | Unclaimed | —     |            |           |           |
| Woven Net                   | items/WovenNet.js                 | Unclaimed | —     |            |           |           |
| Fire Jar                    | items/FireJar.js                  | Unclaimed | —     |            |           |           |
| Suspended Rod               | items/SuspendedRod.js             | Unclaimed | —     |            |           |           |
| Glamour Stone               | items/GlamourStone.js             | Unclaimed | —     |            |           |           |
| Empty Chest                 | items/EmptyChest.js               | Unclaimed | —     |            |           |           |
| Companion Case              | items/CompanionCase.js            | Unclaimed | —     |            |           |           |
| Piercing Arrows             | items/PiercingArrows.js           | Unclaimed | —     |            |           |           |
| Valorstone                  | items/Valorstone.js               | Unclaimed | —     |            |           |           |
| Skeleton Key                | items/SkeletonKey.js              | Unclaimed | —     |            |           |           |
| Arcane Prism                | items/ArcanePrism.js              | Unclaimed | —     |            |           |           |
| Minor Stamina Potion Recipe | items/MinorStaminaPotionRecipe.js | Unclaimed | —     |            |           |           |
| Minor Health Potion Recipe  | items/MinorHealthPotionRecipe.js  | Unclaimed | —     |            |           |           |
| Homing Compasses            | items/HomingCompasses.js          | Unclaimed | —     |            |           |           |
| Corrector Sprite            | items/CorrectorSprite.js          | Unclaimed | —     |            |           |           |
| Gecko Gloves                | items/GeckoGloves.js              | Unclaimed | —     |            |           |           |
| Lorekeeper                  | items/Lorekeeper.js               | Unclaimed | —     |            |           |           |
| Vial of Darksmoke Recipe    | items/VialOfDarksmokeRecipe.js    | Unclaimed | —     |            |           |           |
| Bloodstone                  | items/Bloodstone.js               | Unclaimed | —     |            |           |           |
| Greatstone                  | items/Greatstone.js               | Unclaimed | —     |            |           |           |
| Glider                      | items/Glider.js                   | Unclaimed | —     |            |           |           |
| Ring of Silence             | items/RingOfSilence.js            | Unclaimed | —     |            |           |           |
| Calming Pendant             | items/CalmingPendant.js           | Unclaimed | —     |            |           |           |
| Dual Flask                  | items/DualFlask.js                | Unclaimed | —     |            |           |           |
| Bag of Ficklesand           | items/BagOfFicklesand.js          | Unclaimed | —     |            |           |           |
| Ring of Resistance          | items/RingOfResistance.js         | Unclaimed | —     |            |           |           |
| Phoenix Feather             | items/PhoenixFeather.js           | Unclaimed | —     |            |           |           |
| Box of Many Goods           | items/BoxOfManyGoods.js           | Unclaimed | —     |            |           |           |
| Airblade Charm              | items/AirbladeCharm.js            | Unclaimed | —     |            |           |           |
| Portal Seed                 | items/PortalSeed.js               | Unclaimed | —     |            |           |           |
| Paragon's Chain             | items/ParagonsChain.js            | Unclaimed | —     |            |           |           |
| Elusive Amulet              | items/ElusiveAmulet.js            | Unclaimed | —     |            |           |           |
| Hopekeeper Locket           | items/HopekeeperLocket.js         | Unclaimed | —     |            |           |           |
| Infinite Bag                | items/InfiniteBag.js              | Unclaimed | —     |            |           |           |
| Stride Relic                | items/StrideRelic.js              | Unclaimed | —     |            |           |           |
| Bolster Relic               | items/BolsterRelic.js             | Unclaimed | —     |            |           |           |
| Control Relic               | items/ControlRelic.js             | Unclaimed | —     |            |           |           |
| Attune Relic                | items/AttuneRelic.js              | Unclaimed | —     |            |           |           |
| Charm Relic                 | items/CharmRelic.js               | Unclaimed | —     |            |           |           |
| Enlighten Relic             | items/EnlightenRelic.js           | Unclaimed | —     |            |           |           |
| Honing Relic                | items/HoningRelic.js              | Unclaimed | —     |            |           |           |
| Flickerfly Pendant          | items/FlickerflyPendant.js        | Unclaimed | —     |            |           |           |
| Lakestrider Boots           | items/LakestriderBoots.js         | Unclaimed | —     |            |           |           |
| Clay Companion              | items/ClayCompanion.js            | Unclaimed | —     |            |           |           |
| Mythic Dust Recipe          | items/MythicDustRecipe.js         | Unclaimed | —     |            |           |           |
| Shard of Memory             | items/ShardOfMemory.js            | Unclaimed | —     |            |           |           |
| Gem of Alacrity             | items/GemOfAlacrity.js            | Unclaimed | —     |            |           |           |
| Gem of Might                | items/GemOfMight.js               | Unclaimed | —     |            |           |           |
| Gem of Precision            | items/GemOfPrecision.js           | Unclaimed | —     |            |           |           |
| Gem of Insight              | items/GemOfInsight.js             | Unclaimed | —     |            |           |           |
| Gem of Audacity             | items/GemOfAudacity.js            | Unclaimed | —     |            |           |           |
| Gem of Sagacity             | items/GemOfSagacity.js            | Unclaimed | —     |            |           |           |
| Ring of Unbreakable Resolve | items/RingOfUnbreakableResolve.js | Unclaimed | —     |            |           |           |
| Belt of Unity               | items/BeltOfUnity.js              | Unclaimed | —     |            |           |           |


---

### Consumables (60)

> Implement in `src/features-v2/consumables/<ConsumableName>.js`.


| Feature Name                | Source File                              | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------------------- | ---------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Stride Potion               | consumables/StridePotion.js              | Unclaimed | —     |            |           |           |
| Bolster Potion              | consumables/BolsterPotion.js             | Unclaimed | —     |            |           |           |
| Control Potion              | consumables/ControlPotion.js             | Unclaimed | —     |            |           |           |
| Attune Potion               | consumables/AttunePotion.js              | Unclaimed | —     |            |           |           |
| Charm Potion                | consumables/CharmPotion.js               | Unclaimed | —     |            |           |           |
| Enlighten Potion            | consumables/EnlightenPotion.js           | Unclaimed | —     |            |           |           |
| Minor Health Potion         | consumables/MinorHealthPotion.js         | Unclaimed | —     |            |           |           |
| Minor Stamina Potion        | consumables/MinorStaminaPotion.js        | Unclaimed | —     |            |           |           |
| Grindletooth Venom          | consumables/GrindletoothVenom.js         | Unclaimed | —     |            |           |           |
| Varik Leaves                | consumables/VarikLeaves.js               | Unclaimed | —     |            |           |           |
| Vial of Moondrip            | consumables/VialOfMoondrip.js            | Unclaimed | —     |            |           |           |
| Unstable Arcane Shard       | consumables/UnstableArcaneShard.js       | Unclaimed | —     |            |           |           |
| Potion of Stability         | consumables/PotionOfStability.js         | Unclaimed | —     |            |           |           |
| Improved Grindletooth Venom | consumables/ImprovedGrindletoothVenom.js | Unclaimed | —     |            |           |           |
| Morphing Clay               | consumables/MorphingClay.js              | Unclaimed | —     |            |           |           |
| Vial of Darksmoke           | consumables/VialOfDarksmoke.js           | Unclaimed | —     |            |           |           |
| Jumping Root                | consumables/JumpingRoot.js               | Unclaimed | —     |            |           |           |
| Snap Powder                 | consumables/SnapPowder.js                | Unclaimed | —     |            |           |           |
| Health Potion               | consumables/HealthPotion.js              | Unclaimed | —     |            |           |           |
| Stamina Potion              | consumables/StaminaPotion.js             | Unclaimed | —     |            |           |           |
| Armor Stitcher              | consumables/ArmorStitcher.js             | Unclaimed | —     |            |           |           |
| Gill Salve                  | consumables/GillSalve.js                 | Unclaimed | —     |            |           |           |
| Replication Parchment       | consumables/ReplicationParchment.js      | Unclaimed | —     |            |           |           |
| Improved Arcane Shard       | consumables/ImprovedArcaneShard.js       | Unclaimed | —     |            |           |           |
| Major Stride Potion         | consumables/MajorStridePotion.js         | Unclaimed | —     |            |           |           |
| Major Bolster Potion        | consumables/MajorBolsterPotion.js        | Unclaimed | —     |            |           |           |
| Major Control Potion        | consumables/MajorControlPotion.js        | Unclaimed | —     |            |           |           |
| Major Attune Potion         | consumables/MajorAttunePotion.js         | Unclaimed | —     |            |           |           |
| Major Charm Potion          | consumables/MajorCharmPotion.js          | Unclaimed | —     |            |           |           |
| Major Enlighten Potion      | consumables/MajorEnlightenPotion.js      | Unclaimed | —     |            |           |           |
| Blood of the Yorgi          | consumables/BloodOfTheYorgi.js           | Unclaimed | —     |            |           |           |
| Homet's Secret Potion       | consumables/HometsSecretPotion.js        | Unclaimed | —     |            |           |           |
| Redthorn Saliva             | consumables/RedthornSaliva.js            | Unclaimed | —     |            |           |           |
| Channelstone                | consumables/Channelstone.js              | Unclaimed | —     |            |           |           |
| Mythic Dust                 | consumables/MythicDust.js                | Unclaimed | —     |            |           |           |
| Acidpaste                   | consumables/Acidpaste.js                 | Unclaimed | —     |            |           |           |
| Hopehold Flare              | consumables/HopeholdFlare.js             | Unclaimed | —     |            |           |           |
| Major Arcane Shard          | consumables/MajorArcaneShard.js          | Unclaimed | —     |            |           |           |
| Featherbone                 | consumables/Featherbone.js               | Unclaimed | —     |            |           |           |
| Circle of the Void          | consumables/CircleOfTheVoid.js           | Unclaimed | —     |            |           |           |
| Sun Tree Sap                | consumables/SunTreeSap.js                | Unclaimed | —     |            |           |           |
| Dripfang Poison             | consumables/DripfangPoison.js            | Unclaimed | —     |            |           |           |
| Major Health Potion         | consumables/MajorHealthPotion.js         | Unclaimed | —     |            |           |           |
| Major Stamina Potion        | consumables/MajorStaminaPotion.js        | Unclaimed | —     |            |           |           |
| Ogre Musk                   | consumables/OgreMusk.js                  | Unclaimed | —     |            |           |           |
| Wingsprout                  | consumables/Wingsprout.js                | Unclaimed | —     |            |           |           |
| Jar of Lost Voices          | consumables/JarOfLostVoices.js           | Unclaimed | —     |            |           |           |
| Dragonbloom Tea             | consumables/DragonbloomTea.js            | Unclaimed | —     |            |           |           |
| Bridge Seed                 | consumables/BridgeSeed.js                | Unclaimed | —     |            |           |           |
| Sleeping Sap                | consumables/SleepingSap.js               | Unclaimed | —     |            |           |           |
| Feast of Xuria              | consumables/FeastOfXuria.js              | Unclaimed | —     |            |           |           |
| Bonding Honey               | consumables/BondingHoney.js              | Unclaimed | —     |            |           |           |
| Shrinking Potion            | consumables/ShrinkingPotion.js           | Unclaimed | —     |            |           |           |
| Growing Potion              | consumables/GrowingPotion.js             | Unclaimed | —     |            |           |           |
| Knowledge Stone             | consumables/KnowledgeStone.js            | Unclaimed | —     |            |           |           |
| Sweet Moss                  | consumables/SweetMoss.js                 | Unclaimed | —     |            |           |           |
| Blinding Orb                | consumables/BlindingOrb.js               | Unclaimed | —     |            |           |           |
| Death Tea                   | consumables/DeathTea.js                  | Unclaimed | —     |            |           |           |
| Mirror of Marigold          | consumables/MirrorOfMarigold.js          | Unclaimed | —     |            |           |           |
| Stardrop                    | consumables/Stardrop.js                  | Unclaimed | —     |            |           |           |


---

## Complex Feature Backlog

Features that are purely narrative, require complex interactive UI, or involve spawning temporary entities. These can often be solved with `table.me.actionLoop()` or `table.top.broadcast()`, but are tracked here to ensure they are fully supported by the VTT UI.


| Feature Name | Category  | Notes                                                          |
| ------------ | --------- | -------------------------------------------------------------- |
| Ask the GM   | Narrative | Features that say "Ask the GM a question" or "Learn a secret"  |
| Illusions    | Spawning  | Features that create illusions or temporary objects on the map |
| Summons      | Spawning  | Features that summon creatures or companions                   |
| Environment  | VTT       | Features that permanently alter the terrain or map             |


---

## Blocked / API Extension Requests

Features that cannot be fully implemented with the current V2 engine API.

**Active queue only** — rows with `Status: Open` or `In Progress`. When a resolution is **Done**, it is **appended** to [`docs/v2-blocked-resolutions-done.md`](v2-blocked-resolutions-done.md) and removed from here (see that file for agent maintenance rules).

**Table key is Resolution** — the engine change or API extension needed to unblock one or more features. If multiple features need the same resolution, they share one row. If one feature needs multiple resolutions, it appears in multiple rows.

A feature's main tracker row remains `Blocked` while **any active row below** lists that feature. When no active row lists the feature, the Unblocking Agent promotes the feature to `Done` in the main tracker (the agent implemented the feature as part of the resolution).

To work on a resolution: see `docs/agent-prompts/unblocking-agent.md`.


| Resolution                                                                     | Features                       | SRD Requirement                                                                                                         | Status      | Agent              | Notes                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-chip target selection for multi-target chips                                | Bouncing (weapon), Doubled Up (weapon) | Bouncing: "Mark 1 or more Stress to hit that many targets…"; Doubled Up: "deal damage to another target within Melee range" | Open        |                    | No mechanism to select additional combat targets from within a chip's `onUse`. Need a `selectTarget` chip property (analogous to `isSelect`) or a `targets` array populated before `onUse` runs. Variable `stressCost` (gap 1) is resolved — `stressCost: (table) => number` now supported. |
| Add `armorScore` to V2 actor API                                               | Warded (armor property)                | "You reduce incoming magic damage by your Armor Score before applying it to your damage thresholds."                        | Open        |                    | `buildActor` in `engine/table.js` maps `element.currentArmor` → `armor` and `element.maxArmor` → `maxArmor` but does not expose `element.armorScore` (the static damage-reduction score from the equipped armor item). A hook cannot read this value. Fix: add `armorScore: element.armorScore ?? 0` to the actor object in `buildActor`. |


---

*Last updated: 2026-03-21 (impl-w-auto-1) — Implemented Healing, Hot, Lifestealing, Retractable, Returning weapon properties (onRest/onResolve auto hooks + narrative). All 706 tests passing.*