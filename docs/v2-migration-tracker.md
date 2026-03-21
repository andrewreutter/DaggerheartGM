# V2 Feature System Migration Tracker

This file is the single source of truth for tracking implementation progress of all Daggerheart SRD features in the V2 engine (`src/features-v2/`). Multiple agents read and write this file.

## Status Summary

| Collection | Total | Validated | Validating | Done | In Progress | Unclaimed | Needs Fix | Fixing | Blocked | Skipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ancestries (features) | 36 | 19 | 0 | 1 | 1 | 0 | 5 | 0 | 10 | 0 |
| Communities (features) | 9 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 | 0 |
| Weapon Properties | 50 | 0 | 0 | 0 | 0 | 50 | 0 | 0 | 0 | 0 |
| Armor Properties | 21 | 0 | 0 | 0 | 0 | 21 | 0 | 0 | 0 | 0 |
| Classes (features) | 24 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 |
| Subclasses (features) | 74 | 0 | 0 | 0 | 0 | 74 | 0 | 0 | 0 | 0 |
| Abilities | 189 | 0 | 0 | 0 | 0 | 189 | 0 | 0 | 0 | 0 |
| Beastforms | 24 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 0 | 0 |
| Items | 60 | 0 | 0 | 0 | 0 | 60 | 0 | 0 | 0 | 0 |
| Consumables | 60 | 0 | 0 | 0 | 0 | 60 | 0 | 0 | 0 | 0 |
| **TOTAL** | **547** | **19** | **0** | **1** | **1** | **511** | **5** | **0** | **10** | **0** |

---

## Feature Checklists

Columns: **Feature Name** | **Source File** | **Status** | **Agent** | **Impl Notes** | **Val Notes** | **Fix Notes**

Status values: `Unclaimed` | `In Progress` | `Done` | `Validating` | `Validated` | `Needs Fix` | `Fixing` | `Blocked` | `Skipped`

---

### Ancestries (36 features across 18 ancestries)

> Each ancestry has 2 features. Implement in `src/features-v2/ancestries/<AncestryName>.js`.


| Feature Name        | Source File            | Status      | Agent   | Impl Notes                                                                                                                                                                                                                                                                                      | Val Notes                                                                                                                                                                                                                                                                                                                                      | Fix Notes                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purposeful Design   | ancestries/Clank.js    | Blocked     | fix-pd1 |                                                                                                                                                                                                                                                                                                 | SRD: "+1 bonus to [chosen Experience]" is never applied — the `create` chip has no `onUse` and nothing persists the experience selection or the +1 bonus to the character.                                                                                                                                                                     | V2 API gap: (1) `passiveStatMods` has no `experiences` key; (2) `create` chip has no documented mechanism to receive the player's selection in `onUse`; (3) `table.action` has no `experience` field so an `onIntent` hook cannot gate on the chosen experience. Needs engine extensions. |
| Efficient           | ancestries/Clank.js    | Blocked     | fix-eff |                                                                                                                                                                                                                                                                                                 | SRD: "when you take a short rest, you can choose a long rest move instead of a short rest move" — feature is purely narrative (`{ name, description }`); needs an `onRest` hook that adds a long-rest move slot to the short-rest options.                                                                                                     |                                                                                                                                                                                                                                                                                           |
| Scales              | ancestries/Drakona.js  | Reviewed    | val-B2  |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Fixed: Converted to chip-gates-hook pattern (removed manual onUse toggle logic, added hooks.onReviewOutcome). Tests updated to use activateChip/makeChipState.                                                                                                                                   |
| Elemental Breath    | ancestries/Drakona.js  | Blocked     | fix-eb  |                                                                                                                                                                                                                                                                                                 | SRD: "against a target **or group of targets**" — virtual weapon needs multi-target support; single-target virtual weapon is insufficient.                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                           |
| Thick Skin          | ancestries/Dwarf.js    | Reviewed    | val-B3  |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Back-applied chip-gates-hook pattern (removed manual onUse toggle logic, added hooks.onReviewOutcome). Tests updated to use activateChip/makeChipState.                                                                                                                                          |
| Increased Fortitude | ancestries/Dwarf.js    | Reviewed    | val-B1  |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Fixed: Uses gated hook pattern (hook automatically attached to toggle chip). Updated to use Math.ceil for damage halving (CONV-012).                                                                                                                                                      |
| Quick Reactions     | ancestries/Elf.js      | Reviewed    | val-B1  |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Fixed: `table.action?.isReaction` helper boolean per guide. Toggle-off calls `removeRollDie('Quick Reactions')` (was only adding advantage die).                                                                                                                                          |
| Celestial Trance    | ancestries/Elf.js      | Reviewed    | val-B1  | `passiveStatMods: { numShortRestSlots: 1, numLongRestSlots: 1 }` — declarative per CONV-011.                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Luckbender          | ancestries/Faerie.js   | Reviewed    | val-B2  |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                | Added `rangeFrom(otherActor)` to engine actor; uses it to check ally range. Fixed `== null` guards so `tokenX: 0` is a valid position. Added ally-in-range and ally-out-of-range tests.                                                                                                   |
| Wings               | ancestries/Faerie.js   | Reviewed    | val-B2  |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Caprine Leap        | ancestries/Faun.js     | Reviewed    | val-B1  | Purely narrative feature.                                                                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Kick                | ancestries/Faun.js     | Reviewed    | val-B2  | Two review chips (push target vs leap back); 1 Stress each; +2d6; `move` + `rangeFrom === 'veryClose'` (no narration).                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                | CONV-017 + knockback via `move(conditionFn)`; two named chips for either/or mover. User approved; Status unchanged until batch close-out.                                                                                                                                                 |
| Charge              | ancestries/Firbolg.js  | Blocked     | val-C1  | ReviewAction chip on successful Agility attack with melee range; costs 1 Stress, queues `addDamageRoll` (1d12 physical) targeting all melee-range adversaries. V2 API cannot track prior range (Far/Very Far).                                                                                  | SRD: "move from Far or Very Far range into Melee range" — not representable; chip gates only on successful Agility attack at melee range with targets, so it fires without the SRD movement prerequisite. Block until action context exposes prior range / movement path (same class as Reach). `Charge.test.js` passes.                       | Fixed: `type: 'attack'` (not `'trait'`); moved to `reviewAction`; uses `addDamageRoll` for separate AOE damage instead of `addDie` on the weapon roll; falls back to action targets when positions unknown.                                                                               |
| Unshakable          | ancestries/Firbolg.js  | Blocked     | impl-b1 | V2 API does not support automatic dice rolling in hooks. Requires onReviewOutcome hook that auto-rolls d6 when stress would be marked and cancels on 6.                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Fungril Network     | ancestries/Fungril.js  | Validated   | val-B3  | Card chip triggers action loop for Instinct Roll (DC 12).                                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Death Connection    | ancestries/Fungril.js  | Validated   | val-B3  | Card chip with 1 Stress cost; triggers action loop for memory extraction.                                                                                                                                                                                                                       |                                                                                                                                                                                                                                                                                                                                                | Tests: `onUse` + `applyMutations` assert `actionLoop` payload (CONV-008).                                                                                                                                                                                                                 |
| Shell               | ancestries/Galapa.js   | Blocked     | fix-sh1 | Passive stat mod placeholder; proficiency calculation requires engine support (expose proficiency/level in table.me or passiveStatMods context).                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                | Removed empty `passiveStatMods`; tests assert exact description and `passiveStatMods` undefined (CONV-008). V2 API gap: proficiency not exposed for threshold mods.                                                                                                                       |
| Retract             | ancestries/Galapa.js   | Blocked     | fix-sh1 | Card chip (toggle) with 1 Stress cost; onReviewAction hook applies physical damage resistance when retracted. Disadvantage and movement restriction require engine support.                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                | `onReviewOutcome` → `onReviewAction` + `when(isRetracted)`; halve with `Math.ceil` (CONV-012). SRD still blocked: disadvantage + can’t move. Tests: `isWhen` + halving.                                                                                                                          |
| Endurance           | ancestries/Giant.js    | Validated   | val-V2  | Passive stat mod: maxHP +1.                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Reach               | ancestries/Giant.js    | Blocked     | fix-re1 | Purely narrative; range modification (Melee → Very Close) requires engine support to intercept/modify weapon/feature ranges.                                                                                                                                                                    | SRD: "Treat any weapon, ability, spell, or other feature that has a Melee range as though it has a Very Close range instead" — this is a concrete mechanical effect; bare `{ name, description }` stub does not implement it. Should be marked Blocked (V2 API has no declarative property or hook to modify weapon/feature effective ranges). | Code was already a correct bare stub. Status corrected from Needs Fix → Blocked. V2 API has no range-modification hook.                                                                                                                                                                   |
| Surefooted          | ancestries/Goblin.js   | Needs Fix   | val-V3  | Purely narrative; ignoring disadvantage on Agility Rolls requires engine support.                                                                                                                                                                                                               | SRD: mechanical effect (ignore disadvantage on Agility Rolls) not implemented; bare stub. Recommended: Blocked (API gap).                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                           |
| Danger Sense        | ancestries/Goblin.js   | Needs Fix   | val-V3  | Review chip (rest frequency, 1 Stress) when adversary attacks me or ally within Very Close; forces reroll (requires engine support for actual reroll).                                                                                                                                          | SRD: adversary reroll not implemented (only narration added; should call table.rolls?.action?.reroll()); CONV-010: 'veryClose' is not a documented return value of rangeFrom() (guide lists 'melee', 'close', 'far'). Tests: `onUse` asserts `addNarration` mutation (CONV-008).                                                               |                                                                                                                                                                                                                                                                                           |
| Luckbringer         | ancestries/Halfling.js | Validated   | val-V3  | onSessionStart hook grants 1 Hope to all party members.                                                                                                                                                                                                                                         |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Internal Compass    | ancestries/Halfling.js | Validated   | val-B3  | Review chip when Hope Die = 1; calls hopeDie.reroll().                                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                                                                | Tests: `onUse` + `applyMutations` assert `rerollDie` payload (CONV-008).                                                                                                                                                                                                                  |
| High Stamina        | ancestries/Human.js    | Validated   | val-V3  | Passive stat mod: maxStress +1.                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Adaptability        | ancestries/Human.js    | Needs Fix   | val-B3  | Review chip on failed roll; costs 1 Stress, rerolls both dice. NOTE: SRD requires "when you fail a roll that utilized one of your Experiences" but V2 API does not expose experienceId, so chip appears on any failed roll.                                                                     | SRD: "that utilized one of your Experiences" clause not enforced — chip fires on any failed roll regardless of Experience usage. Mark as Blocked (V2 API does not expose whether an Experience was applied to the current roll).                                                                                                               |                                                                                                                                                                                                                                                                                           |
| Fearless            | ancestries/Infernis.js | Blocked     | val-B4  | Review chip on action roll with fearDie; costs 2 Stress, rerolls fear die. NOTE: SRD requires "When you roll with Fear" but V2 API cannot distinguish "rolling with Fear" vs "rolling with Hope", so chip appears on any roll with a fearDie. Changing Fear to Hope may require engine support. | SRD: "change it into a roll with Hope instead" — rerolling the fearDie does not override the result type; a rerolled fear die can still dominate, leaving a Fear result. Blocked: V2 API has no method to change roll result type from Fear to Hope.                                                                                           |                                                                                                                                                                                                                                                                                           |
| Dread Visage        | ancestries/Infernis.js | Validated   | val-B4  | Advantage trigger: "rolls to intimidate hostile creatures".                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Feline Instincts    | ancestries/Katari.js   | Validated   | val-B4  | Review chip on Agility roll; costs 2 Hope, rerolls Hope die.                                                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Retracting Claws    | ancestries/Katari.js   | Validated   | val-B4  | Virtual weapon (Agility, melee, d6); onResolve hook applies Vulnerable condition to target on successful attack.                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Sturdy              | ancestries/Orc.js      | Blocked     | val-B4  | onIntent hook adds disadvantage die when character has 1 HP and is targeted.                                                                                                                                                                                                                    | CONV-015: `addDie({ die: 'd6', value: -1 })` uses `value` as a negative multiplier, which is undocumented. No `addDisadvantageDie()` method exists. Blocked per CONV-015 until API exposes a disadvantage mechanism.                                                                                                                           |                                                                                                                                                                                                                                                                                           |
| Tusks               | ancestries/Orc.js      | Needs Fix   | val-B5  | Review chip on successful melee attack; costs 1 Hope, adds 1d6 damage.                                                                                                                                                                                                                          | CONV-014: First `when()` predicate uses `(table) => table.me?.isActing === true` instead of the built-in `isActing` helper from `when.js`. Shared predicates must be reused per CONV-014.                                                                                                                                                      | CONV-017: `addDie({ name: 'Tusks', die: 'd6' })` only (removed ambiguous `value: 1`). CONV-014 still open.                                                                                                                                                                                |
| Amphibious          | ancestries/Ribbet.js   | In Progress | impl-b3 |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Long Tongue         | ancestries/Ribbet.js   | Needs Fix   | val-B5  | Virtual weapon (Finesse, Close, d12); card chip costs 1 Stress.                                                                                                                                                                                                                                 | CONV-010: `chips` array inside a `virtualWeapons` entry is not a documented API pattern — the guide only documents `hooks` on virtual weapons. The Stress cost should be implemented via a documented mechanism (e.g. a top-level chip or an `onIntent` hook); if no documented mechanism exists, mark Blocked.                                |                                                                                                                                                                                                                                                                                           |
| Natural Climber     | ancestries/Simiah.js   | Validated   | val-B5  | Advantage trigger for Agility Rolls involving balancing and climbing.                                                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| Nimble              | ancestries/Simiah.js   | Reviewed    | impl-b3 |                                                                                                                                                                                                                                                                                                 |                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                           |


---

### Communities (9 features across 9 communities)

> Each community has 1 feature. Implement in `src/features-v2/communities/<CommunityName>.js`.


| Feature Name     | Source File                | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ---------------- | -------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Privilege        | communities/Highborne.js   | Unclaimed | —     |            |           |           |
| Well-Read        | communities/Loreborne.js   | Unclaimed | —     |            |           |           |
| Dedicated        | communities/Orderborne.js  | Unclaimed | —     |            |           |           |
| Steady           | communities/Ridgeborne.js  | Unclaimed | —     |            |           |           |
| Know the Tide    | communities/Seaborne.js    | Unclaimed | —     |            |           |           |
| Scoundrel        | communities/Slyborne.js    | Unclaimed | —     |            |           |           |
| Low-Light Living | communities/Underborne.js  | Unclaimed | —     |            |           |           |
| Nomadic Pack     | communities/Wanderborne.js | Unclaimed | —     |            |           |           |
| Lightfoot        | communities/Wildborne.js   | Unclaimed | —     |            |           |           |


---

### Weapon Properties (50 unique properties)

> Implement in `src/features-v2/weapon_properties/<PropertyName>.js`.
> These apply to characters via their equipped weapon's feature list.


| Feature Name    | Source File                         | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------- | ----------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Barrier         | weapon_properties/Barrier.js        | Unclaimed | —     |            |           |           |
| Bonded          | weapon_properties/Bonded.js         | Unclaimed | —     |            |           |           |
| Bouncing        | weapon_properties/Bouncing.js       | Unclaimed | —     |            |           |           |
| Brave           | weapon_properties/Brave.js          | Unclaimed | —     |            |           |           |
| Brutal          | weapon_properties/Brutal.js         | Unclaimed | —     |            |           |           |
| Burning         | weapon_properties/Burning.js        | Unclaimed | —     |            |           |           |
| Charged         | weapon_properties/Charged.js        | Unclaimed | —     |            |           |           |
| Concussive      | weapon_properties/Concussive.js     | Unclaimed | —     |            |           |           |
| Cumbersome      | weapon_properties/Cumbersome.js     | Unclaimed | —     |            |           |           |
| Deadly          | weapon_properties/Deadly.js         | Unclaimed | —     |            |           |           |
| Deflecting      | weapon_properties/Deflecting.js     | Unclaimed | —     |            |           |           |
| Destructive     | weapon_properties/Destructive.js    | Unclaimed | —     |            |           |           |
| Devastating     | weapon_properties/Devastating.js    | Unclaimed | —     |            |           |           |
| Double Duty     | weapon_properties/DoubleDuty.js     | Unclaimed | —     |            |           |           |
| Doubled Up      | weapon_properties/DoubledUp.js      | Unclaimed | —     |            |           |           |
| Dueling         | weapon_properties/Dueling.js        | Unclaimed | —     |            |           |           |
| Eruptive        | weapon_properties/Eruptive.js       | Unclaimed | —     |            |           |           |
| Grappling       | weapon_properties/Grappling.js      | Unclaimed | —     |            |           |           |
| Greedy          | weapon_properties/Greedy.js         | Unclaimed | —     |            |           |           |
| Healing         | weapon_properties/Healing.js        | Unclaimed | —     |            |           |           |
| Heavy           | weapon_properties/Heavy.js          | Unclaimed | —     |            |           |           |
| Hooked          | weapon_properties/Hooked.js         | Unclaimed | —     |            |           |           |
| Hot             | weapon_properties/Hot.js            | Unclaimed | —     |            |           |           |
| Invigorating    | weapon_properties/Invigorating.js   | Unclaimed | —     |            |           |           |
| Lifestealing    | weapon_properties/Lifestealing.js   | Unclaimed | —     |            |           |           |
| Locked On       | weapon_properties/LockedOn.js       | Unclaimed | —     |            |           |           |
| Long            | weapon_properties/Long.js           | Unclaimed | —     |            |           |           |
| Lucky           | weapon_properties/Lucky.js          | Unclaimed | —     |            |           |           |
| Massive         | weapon_properties/Massive.js        | Unclaimed | —     |            |           |           |
| Otherworldly    | weapon_properties/Otherworldly.js   | Unclaimed | —     |            |           |           |
| Painful         | weapon_properties/Painful.js        | Unclaimed | —     |            |           |           |
| Paired          | weapon_properties/Paired.js         | Unclaimed | —     |            |           |           |
| Parry           | weapon_properties/Parry.js          | Unclaimed | —     |            |           |           |
| Persuasive      | weapon_properties/Persuasive.js     | Unclaimed | —     |            |           |           |
| Pompous         | weapon_properties/Pompous.js        | Unclaimed | —     |            |           |           |
| Powerful        | weapon_properties/Powerful.js       | Unclaimed | —     |            |           |           |
| Protective      | weapon_properties/Protective.js     | Unclaimed | —     |            |           |           |
| Quick           | weapon_properties/Quick.js          | Unclaimed | —     |            |           |           |
| Reliable        | weapon_properties/Reliable.js       | Unclaimed | —     |            |           |           |
| Reloading       | weapon_properties/Reloading.js      | Unclaimed | —     |            |           |           |
| Retractable     | weapon_properties/Retractable.js    | Unclaimed | —     |            |           |           |
| Returning       | weapon_properties/Returning.js      | Unclaimed | —     |            |           |           |
| Scary           | weapon_properties/Scary.js          | Unclaimed | —     |            |           |           |
| Self-Correcting | weapon_properties/SelfCorrecting.js | Unclaimed | —     |            |           |           |
| Serrated        | weapon_properties/Serrated.js       | Unclaimed | —     |            |           |           |
| Sharpwing       | weapon_properties/Sharpwing.js      | Unclaimed | —     |            |           |           |
| Sheltering      | weapon_properties/Sheltering.js     | Unclaimed | —     |            |           |           |
| Startling       | weapon_properties/Startling.js      | Unclaimed | —     |            |           |           |
| Timebending     | weapon_properties/Timebending.js    | Unclaimed | —     |            |           |           |
| Versatile       | weapon_properties/Versatile.js      | Unclaimed | —     |            |           |           |


---

### Armor Properties (21 unique properties)

> Implement in `src/features-v2/armor_properties/<PropertyName>.js`.


| Feature Name | Source File                      | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| ------------ | -------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Burning      | armor_properties/Burning.js      | Unclaimed | —     |            |           |           |
| Channeling   | armor_properties/Channeling.js   | Unclaimed | —     |            |           |           |
| Difficult    | armor_properties/Difficult.js    | Unclaimed | —     |            |           |           |
| Flexible     | armor_properties/Flexible.js     | Unclaimed | —     |            |           |           |
| Fortified    | armor_properties/Fortified.js    | Unclaimed | —     |            |           |           |
| Gilded       | armor_properties/Gilded.js       | Unclaimed | —     |            |           |           |
| Heavy        | armor_properties/Heavy.js        | Unclaimed | —     |            |           |           |
| Hopeful      | armor_properties/Hopeful.js      | Unclaimed | —     |            |           |           |
| Impenetrable | armor_properties/Impenetrable.js | Unclaimed | —     |            |           |           |
| Magic        | armor_properties/Magic.js        | Unclaimed | —     |            |           |           |
| Painful      | armor_properties/Painful.js      | Unclaimed | —     |            |           |           |
| Physical     | armor_properties/Physical.js     | Unclaimed | —     |            |           |           |
| Quiet        | armor_properties/Quiet.js        | Unclaimed | —     |            |           |           |
| Reinforced   | armor_properties/Reinforced.js   | Unclaimed | —     |            |           |           |
| Resilient    | armor_properties/Resilient.js    | Unclaimed | —     |            |           |           |
| Sharp        | armor_properties/Sharp.js        | Unclaimed | —     |            |           |           |
| Shifting     | armor_properties/Shifting.js     | Unclaimed | —     |            |           |           |
| Timeslowing  | armor_properties/Timeslowing.js  | Unclaimed | —     |            |           |           |
| Truthseeking | armor_properties/Truthseeking.js | Unclaimed | —     |            |           |           |
| Very Heavy   | armor_properties/VeryHeavy.js    | Unclaimed | —     |            |           |           |
| Warded       | armor_properties/Warded.js       | Unclaimed | —     |            |           |           |


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

Features that cannot be fully implemented with the current V2 engine API. Agents should add rows here rather than marking features as `Blocked` without a reason.


| Feature Name               | SRD Quote                                                                                               | Why Blocked                                                                                                                                                                                                                                                                  | Resolution                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purposeful Design          | "choose one of your Experiences that best aligns with this purpose and gain a permanent +1 bonus to it" | (1) `passiveStatMods` has no `experiences` key; (2) `create` chip has no documented mechanism to receive the player's selection in `onUse`; (3) `table.action` has no `experience` field so an `onIntent` hook cannot check which experience is being invoked.               | Extend engine: add `experiences` to `passiveStatMods`, document how create-chip selections flow into `onUse`, and expose `table.action.experienceId` so hooks can gate on it.                                                      |
| Elemental Breath (Drakona) | "against a target or group of targets"                                                                  | The `virtualWeapons` declarative key has no `multiTarget` property. There is no documented V2 mutation for adding targets to a running action, so a chip-based workaround is also unavailable. The single-target virtual weapon is the maximum the API supports.             | Add `multiTarget: true` to the `virtualWeapons` and weapon-object schemas; document it in the authoring guide under Appendix A (`virtualWeapons`). The engine should enable multi-target selection in the UI when the flag is set. |
| Unshakable (Firbolg)       | "When you would mark a Stress, roll a d6. On a result of 6, don't mark it."                             | V2 API does not support automatic dice rolling in hooks. This feature requires an `onReviewOutcome` hook that automatically rolls a d6 when stress would be marked and cancels the stress marking if the result is 6. The API has no mechanism for automatic dice rolling in hooks. | Add automatic dice rolling support to hooks (e.g., `table.rollDie('d6')` that returns a promise or synchronous result) and document it in the authoring guide under Section 4 (Hooks).                                             |


|| Efficient (Clank) & Celestial Trance (Elf) | "you can choose a long rest move instead of a short rest move" / "gain an additional Short Rest slot and Long Rest slot" | Two separate gaps: (1) `applyDeclarativeFeatures` in `feature-loader.js` only accumulates keys that exist in the hardcoded `stats` object — `numLongMovesInShortRest`, `numShortRestSlots`, and `numLongRestSlots` are silently dropped. (2) `getRestMovesForCharacter` in `src/client/lib/rest-moves.js` reads from the v1 `ancestryMap` / `onRest` hooks, not the v2 character's computed stats — so even if the engine collected these values, nothing would consume them. | (1) Add `numShortRestSlots`, `numLongRestSlots`, and `numLongMovesInShortRest` to the `stats` object in `applyDeclarativeFeatures` and include them in the returned result. (2) Update `getRestMovesForCharacter` (or its caller) to also read v2-computed rest-slot stats from the character's resolved feature data, in addition to the existing v1 `onRest` hook pass. Document all three keys in Appendix A (`passiveStatMods`) of the authoring guide (they are already listed but the engine does not honour them). |

---

*Last updated: 2026-03-20 — Kick → `Done` (CONV-017/018, move+rangeFrom, user approved). Prior: fixit batch (addDie, QuickReactions, Charge Val Notes).*