# SRD Implementation Burndown

Tracks implementation status of every element in the `daggerheart-srd` submodule.
See [Maintenance Instructions](#maintenance-instructions) at the bottom.

**Legend:** Done = fully automated where automation applies | Display = shown but not mechanically automated | Partial = some aspects automated | None = not in the UI

---

## Summary


| Collection                                | Count | Browsable | Selectable  | Features           | Overall     |
| ----------------------------------------- | ----- | --------- | ----------- | ------------------ | ----------- |
| [Adversaries](#adversaries-129)           | 129   | Done      | N/A (table) | Attacks rollable   | **Done**    |
| [Environments](#environments-19)          | 19    | Done      | N/A (table) | Display            | **Done**    |
| [Weapons](#weapons-186)                   | 186   | N/A       | Done        | 22/38 automated    | **Partial** |
| [Armor](#armor-34)                        | 34    | N/A       | Done        | 15/21 automated    | **Partial** |
| [Classes](#classes-9)                     | 9     | N/A       | Done        | 9/9 clickable (Phase 1) | **Partial** |
| [Subclasses](#subclasses-18)              | 18    | N/A       | Done        | 0/18 features auto | **Display** |
| [Ancestries](#ancestries-18)              | 18    | N/A       | Done        | 0/36 features auto | **Display** |
| [Communities](#communities-9)             | 9     | N/A       | Done        | 0/9 features auto  | **Display** |
| [Abilities](#abilities--domain-cards-189) | 189   | N/A       | Done        | Display            | **Display** |
| [Domains](#domains-9)                     | 9     | N/A       | Indirect    | Filtering only     | **Partial** |
| [Beastforms](#beastforms-24)              | 24    | API only  | None        | None               | **None**    |
| [Items](#items-60)                        | 60    | API only  | None        | None               | **None**    |
| [Consumables](#consumables-60)            | 60    | API only  | None        | None               | **None**    |


**Totals:** 746 SRD elements. ~360 fully implemented (adversaries + environments + weapons + abilities as display + armor stat/roll/slot-triggered/damage-type-gated features), ~142 partially implemented, ~244 not in the UI.

---

## Adversaries (129)

**Status: Done.** All 129 SRD adversaries are browsable and searchable in the Library tab, filterable by tier/role/source. On the Game Table, adversary cards display all fields and their primary attacks and action-type features are clickable for dice rolls. HP/Stress tracks are interactive. Scaled-up display is supported for lower-tier adversaries.

No per-element tracking needed — all adversaries share the same rendering and automation pipeline.

---

## Environments (19)

**Status: Done.** All 19 SRD environments are browsable and searchable in the Library tab. Potential adversaries are parsed into linked references. Features and impulses are displayed. On the Game Table, environment cards show all fields.

No per-element tracking needed.

---

## Weapons (186)

**Status: Partial.** All 186 weapons (125 primary + 61 secondary) are selectable in the character builder. Weapon stats (damage, range, trait, burden) are fully computed. Weapon features are the differentiator — 38 unique features exist across all weapons. See the sub-list below.

The weapons themselves are all implemented for selection and display. The automation gap is in their **features**.

### Weapon Features (38 unique)

#### Passive Stat Modifiers — All Done

Handled by `computeWeaponModifiers` in `character-calc.js`. No per-attack effect — applied at character build time.


| Feature     | Effect                                          | Status                 |
| ----------- | ----------------------------------------------- | ---------------------- |
| Cumbersome  | -1 Finesse                                      | **Done**               |
| Heavy       | -1 Evasion                                      | **Done**               |
| Massive     | -1 Evasion; +1 extra damage die kept highest    | **Done** (stat + dice) |
| Brave       | -1 Evasion; +3 Severe threshold                 | **Done**               |
| Protective  | +Armor Score                                    | **Done**               |
| Barrier     | +Armor Score; -1 Evasion                        | **Done**               |
| Double Duty | +1 Armor Score; +1 primary damage in Melee      | **Done**               |
| Paired      | Bonus to primary damage (virtual combined card) | **Done**               |
| Destructive | -1 Agility; nearby Stress on hit                | **Done**               |


#### Roll Modifiers — All Done

Applied during `buildWeaponRollText` in `CharacterHoverCard`.


| Feature   | Effect             | Status   |
| --------- | ------------------ | -------- |
| Reliable  | +1 to attack roll  | **Done** |
| Sharpwing | +Agility to damage | **Done** |
| Bonded    | +level to damage   | **Done** |


#### Dice-System Extensions — All Done

Rewrite damage notation in `buildWeaponRollText`.


| Feature         | Notation                 | Status   |
| --------------- | ------------------------ | -------- |
| Powerful        | `dX` → `2dXkh`           | **Done** |
| Brutal          | `dX` → `dX!` (exploding) | **Done** |
| Self-Correcting | `dX` → `dXm6` (min 6)    | **Done** |
| Serrated        | `dX` → `dXm8` (min 8)    | **Done** |


#### Post-Roll Effects — All Done

Applied in `handleApplyDamage` / banner dismiss in `GMTableView`.


| Feature      | Effect                      | Status   |
| ------------ | --------------------------- | -------- |
| Scary        | +1 target Stress            | **Done** |
| Painful      | +1 attacker Stress          | **Done** |
| Deadly       | +1 HP on Severe             | **Done** |
| Burning      | d6=6 → target marks Stress  | **Done** |
| Reloading    | d6=1 → must reload          | **Done** |
| Invigorating | d4=4 → clear 1 Stress       | **Done** |
| Lifestealing | d6=6 → clear 1 HP or Stress | **Done** |


#### Interactive UI — All Done


| Feature     | Behavior                                 | Status   |
| ----------- | ---------------------------------------- | -------- |
| Devastating | Toggle → d20 damage die; 1 Stress        | **Done** |
| Pompous     | Blocks roll when Presence > 0            | **Done** |
| Quick       | Extra target after damage; 1 Stress      | **Done** |
| Doubled Up  | Secondary damage to another Melee target | **Done** |
| Lucky       | Reroll on Fear; 1 Stress                 | **Done** |
| Bouncing    | Looping multi-target; 1 Stress each      | **Done** |


#### Virtual Alternate Cards — All Done


| Feature      | Behavior                        | Status   |
| ------------ | ------------------------------- | -------- |
| Versatile    | Amber card with alternate stats | **Done** |
| Otherworldly | Physical + Magical variants     | **Done** |
| Charged      | +1 die; disabled at max Stress  | **Done** |


#### Action / Defensive — All Done


| Feature   | Behavior                                   | Status   |
| --------- | ------------------------------------------ | -------- |
| Startling | Action notification card; 1 Stress         | **Done** |
| Parry     | Defensive dice cancel matching attack dice | **Done** |


#### Display Only — No Automation Needed

These are informational for the GM. Shown as tags in the result banner.


| Feature     | Description                    | Status      |
| ----------- | ------------------------------ | ----------- |
| Returning   | Weapon returns after throw     | **Display** |
| Hooked      | Pull target into Melee         | **Display** |
| Eruptive    | Half damage to nearby on Melee | **Display** |
| Persuasive  | +2 Presence for 1 Stress       | **Display** |
| Dueling     | Advantage vs isolated target   | **Display** |
| Retractable | Blade can be hidden            | **Display** |
| Timebending | Choose target after roll       | **Display** |
| Healing     | Clear 1 HP in downtime         | **Display** |
| Hot         | Cuts through material          | **Display** |
| Greedy      | +1 proficiency for gold        | **Display** |
| Concussive  | Knock to Far for 1 Hope        | **Display** |
| Long        | Target all in a line           | **Display** |
| Grappling   | Restrain/pull for 1 Hope       | **Display** |
| Sheltering  | Armor shared with allies       | **Display** |
| Locked On   | Next attack auto-succeeds      | **Display** |
| Deflecting  | Mark Armor for Evasion bonus   | **Display** |


**Weapon features score: 22 fully automated + 16 display-only = 38/38 accounted for.**

---

## Armor (34)

**Status: Partial.** All 34 armor pieces are selectable in the character builder. Base stats (score, thresholds, max armor) are computed by `resolveArmor`. Armor features are parsed by `computeArmorModifiers` in `character-calc.js` — stat modifiers and roll modifiers are automated. Armor-slot-triggered features (Phase 2) are automated via the damage banner's armor button. Damage-type-gated features (Phase 3) are automated: `dmg.type` flows from `ResultBanner` through `handleApplyDamage` to `applyDamageToTarget`. Map-aware and complex features require later phases.

### Armor Features (21 unique)

#### Stat Modifiers — All Done

Handled by `computeArmorModifiers` in `character-calc.js`. Applied at character build time before weapon modifiers.

| Feature    | Armors              | Effect                     | Status   |
| ---------- | ------------------- | -------------------------- | -------- |
| *(none)*   | Leather (T1-T4)     | No feature                 | **Done** |
| Flexible   | Gambeson (T1-T4)    | +1 Evasion                 | **Done** |
| Heavy      | Chainmail (T1-T4)   | -1 Evasion                 | **Done** |
| Very Heavy | Full Plate (T1-T4)  | -2 Evasion; -1 Agility     | **Done** |
| Gilded     | Bellamoi Fine (T3)  | +1 Presence                | **Done** |
| Difficult  | Savior Chainmail (T4) | -1 all traits and Evasion | **Done** |

#### Roll Modifiers — All Done

Toggleable chips in the Experiences section. Bonus included in the next roll without spending Hope.

| Feature    | Armors              | Effect             | Status   |
| ---------- | ------------------- | ------------------ | -------- |
| Channeling | Channeling Armor (T4) | +1 Spellcast Rolls | **Done** |
| Quiet      | Tyris Soft (T2)     | +2 stealth rolls   | **Done** |

#### Display Only — Done

| Feature      | Armors              | Effect                 | Status      |
| ------------ | ------------------- | ---------------------- | ----------- |
| Truthseeking | Veritas Opal (T4)   | Glows when creature lies | **Display** |

#### Armor-Slot-Triggered — Done (Phase 2)

Triggered when the GM clicks the cyan armor button (shield icon) next to a character target in the damage banner. `applyDamageToTarget` in `GMTableView.jsx` reads `armorOpts.feature` to apply the feature effect alongside the slot mark.

| Feature    | Armors                      | Effect                                                        | Status   |
| ---------- | --------------------------- | ------------------------------------------------------------- | -------- |
| Fortified  | Full Fortified (T4)         | Armor Slot reduces severity by two (−2 HP instead of −1)      | **Done** |
| Painful    | Runes of Fortification (T3) | Auto-mark 1 Stress on target when armor slot is marked        | **Done** |
| Resilient  | Harrowbone (T2)             | On last slot: roll d6 — a 6 saves the slot (severity still reduces) | **Done** |
| Reinforced | IronTree Breastplate (T2)   | +2 to both thresholds when last slot marked; clears on restore | **Done** |

#### Damage-Type Gated — Done (Phase 3)

`dmg.type` (`'phy'`/`'mag'`) is extracted from the roll's post tag in `parseDiceSub` and flows through `onApplyDamage` → `handleApplyDamage` → `applyDamageToTarget`. `armorScore` is added to character targets in `damageTargets`.

| Feature  | Armors               | Effect                             | Status   |
| -------- | -------------------- | ---------------------------------- | -------- |
| Warded   | Elundrian Chain (T2) | Reduce magic damage by Armor Score before threshold check | **Done** |
| Physical | Bladefare (T3)       | Armor button hidden for magic damage | **Done** |
| Magic    | Monett's Cloak (T3)  | Armor button hidden for physical damage | **Done** |

#### Map-Aware — Pending (Phase 4)

| Feature | Armors              | Effect                        | Status   |
| ------- | ------------------- | ----------------------------- | -------- |
| Sharp   | Spiked Plate (T3)   | +d4 Melee damage              | **None** |
| Burning | Emberwoven (T4)     | Melee attacker marks Stress   | **None** |

#### Complex Unique — Pending (Phase 5)

| Feature     | Armors                  | Effect                           | Status   |
| ----------- | ----------------------- | -------------------------------- | -------- |
| Timeslowing | Dunamis Silkchain (T4)  | Mark Armor Slot → +d4 Evasion    | **None** |
| Shifting    | Runetan Floating (T2)   | Mark Armor Slot → disadvantage   | **None** |

#### Flagged for Future

| Feature      | Armors           | Effect                               | Status   |
| ------------ | ---------------- | ------------------------------------ | -------- |
| Hopeful      | Rosewild (T2)    | Mark Armor Slot instead of Hope      | **None** |
| Impenetrable | Dragonscale (T3) | Mark Stress instead of last HP (1/rest) | **None** |


**Armor features score: 12 automated (5 stat + 2 roll + 4 slot-triggered + 1 display) / 21 total. Phases 3–5 cover the remaining 9.**

---

## Classes (9)

**Status: Partial.** All 9 classes are selectable in the character builder. Base stats (HP, evasion, domains) are computed. All class features are now **clickable** via the Phase 1 feature interaction system (Use/Announce buttons, sub-feature cards, cost badges). Resource costs (Hope/Stress/Armor) are applied on banner dismiss. Session/Short Rest/Long Rest buttons refresh feature usage and active modifiers. See the [Clickable Character Features plan](../.cursor/plans/clickable_character_features_6686c77f.plan.md) for the full feature rundown and Phase 2 roadmap.

**Phase 1 — All features clickable** as of this implementation:
- `parseFeatureAction` parser detects Hope cost, Stress cost, Armor ops, dice, Spellcast DC, frequency, and target type from description text
- `FeatureChip` shows Use/Announce/passive-badge UI based on feature type
- `SubFeatureCard` renders multi-option features (Channel Raw Power, Attack of Opportunity)
- `handleFeatureUse` in CharacterHoverCard builds roll text or action notification
- Resource costs applied via `applyFeatureResources` on banner dismiss
- Feature usage (once/session, once/rest) tracked in `featureUsage` element field
- Active modifiers (Rally Die, Prayer Die, Sneak Attack, etc.) tracked in `activeModifiers` element field
- Session/Short Rest/Long Rest buttons in Encounter panel header clear matching `featureUsage` and `activeModifiers`
- Not This Time (Wizard) button appears on adversary ResultBanners when Wizard has 3+ Hope

| Class        | Class Features                                  | Hope Feature                                         | Feature Status                                                    |
| ------------ | ----------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **Bard**     | Rally                                           | Make a Scene (3 Hope: Distract target -2 Difficulty) | **Partial** — clickable; Rally adds modifier chips; Make a Scene deducts Hope |
| **Druid**    | Beastform, Wildtouch                            | Evolution (3 Hope: free Beastform + trait boost)     | **Partial** — Wildtouch announce; Beastform announce (full mechanics deferred); Evolution deducts Hope |
| **Guardian** | Unstoppable                                     | Frontline Tank (3 Hope: clear 2 Armor Slots)         | **Partial** — Unstoppable announce (once/long rest); Frontline Tank deducts Hope + clears Armor |
| **Ranger**   | Ranger's Focus                                  | Hold Them Off (3 Hope: attack 2 extra targets)       | **Partial** — Ranger's Focus rolls dice; Hold Them Off deducts Hope |
| **Rogue**    | Cloaked, Sneak Attack                           | Rogue's Dodge (3 Hope: +2 Evasion)                   | **Partial** — all clickable; Sneak Attack chip in modifier bin; Rogue's Dodge adds modifier chip |
| **Seraph**   | Prayer Dice                                     | Life Support (3 Hope: clear 1 HP on ally)            | **Partial** — Prayer Dice rolls d4s; Life Support deducts Hope |
| **Sorcerer** | Arcane Sense, Minor Illusion, Channel Raw Power | Volatile Magic (3 Hope: reroll damage dice)          | **Partial** — Arcane Sense announce; Minor Illusion rolls Spellcast; Channel Raw Power sub-features; Volatile Magic deducts Hope |
| **Warrior**  | Attack of Opportunity, Combat Training          | No Mercy (3 Hope: +1 attack until rest)              | **Partial** — Attack of Opportunity sub-features; Combat Training passive badge; No Mercy adds modifier chip |
| **Wizard**   | Prestidigitation, Strange Patterns              | Not This Time (3 Hope: force adversary reroll)       | **Partial** — all clickable; Not This Time button on adversary ResultBanners |


**Phase 2 (Close all gaps to 5/5):** See `.cursor/plans/clickable_character_features_6686c77f.plan.md`.

---

## Subclasses (18)

**Status: Display.** All 18 subclasses are selectable. Spellcast trait is stored. Features are shown grouped by tier (Foundation / Specialization / Mastery) but none are automated.


| Subclass                   | Class    | Key Features                                                                              | Status                                   |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Troubadour**             | Bard     | Gifted Performer, Virtuoso, Maestro                                                       | Display                                  |
| **Wordsmith**              | Bard     | Rousing Speech, Heart of a Poet, Epic Poetry, Eloquent                                    | Display                                  |
| **Warden of the Elements** | Druid    | Elemental Incarnation, Elemental Dominion, Elemental Aura                                 | Display                                  |
| **Warden of Renewal**      | Druid    | Clarity of Nature, Regeneration, Defender, Regenerative Reach, Warden's Protection        | Display                                  |
| **Stalwart**               | Guardian | Unwavering, Iron Will, Undaunted, Loyal Protector, Unrelenting, Partners-in-Arms          | Display                                  |
| **Vengeance**              | Guardian | At Ease, Revenge, Nemesis, Act of Reprisal                                                | Display                                  |
| **Beastbound**             | Ranger   | Companion, Advanced Training, Loyal Friend, Expert Training, Battle-Bonded                | Display — Companion is a subsystem       |
| **Wayfinder**              | Ranger   | Ruthless Predator, Path Forward, Apex Predator, Elusive Predator                          | Display                                  |
| **Nightwalker**            | Rogue    | Shadow Stepper, Fleeting Shadow, Vanishing Act, Dark Cloud, Adrenaline                    | Display                                  |
| **Syndicate**              | Rogue    | Well-Connected, Reliable Backup, Contacts Everywhere                                      | Display                                  |
| **Divine Wielder**         | Seraph   | Spirit Weapon, Sparing Touch, Sacred Resonance, Devout                                    | Display                                  |
| **Winged Sentinel**        | Seraph   | Wings of Light, Ascendant, Power of the Gods, Ethereal Visage                             | Display                                  |
| **Elemental Origin**       | Sorcerer | Elementalist, Transcendence, Natural Evasion                                              | Display — Natural Evasion could automate |
| **Primal Origin**          | Sorcerer | Manipulate Magic, Arcane Charge, Enchanted Aid                                            | Display                                  |
| **Call of the Brave**      | Warrior  | Courage, Battle Ritual, Camaraderie, Rise to the Challenge                                | Display                                  |
| **Call of the Slayer**     | Warrior  | Slayer, Martial Preparation, Weapon Specialist                                            | Display                                  |
| **School of Knowledge**    | Wizard   | Prepared, Adept, Brilliant, Honed Expertise, Accomplished, Perfect Recall                 | Display                                  |
| **School of War**          | Wizard   | Battlemage, Face Your Fear, Thrive in Chaos, Have No Fear, Conjure Shield, Fueled by Fear | Display                                  |


**Note:** Most subclass features are narrative or situational. Automation candidates are features with clear stat modifications or dice effects (Natural Evasion, Adrenaline, Weapon Specialist, etc.).

---

## Ancestries (18)

**Status: Display.** All 18 ancestries are selectable in the character builder (single ancestry only — multi-ancestry supported in data model but not in form UI). Features are displayed on the character sheet but none are automated.


| Ancestry     | Feature 1         | Feature 2           | Status  |
| ------------ | ----------------- | ------------------- | ------- |
| **Clank**    | Purposeful Design | Efficient           | Display |
| **Drakona**  | Scales            | Elemental Breath    | Display |
| **Dwarf**    | Thick Skin        | Increased Fortitude | Display |
| **Elf**      | Quick Reactions   | Celestial Trance    | Display |
| **Faerie**   | Luckbender        | Wings               | Display |
| **Faun**     | Caprine Leap      | Kick                | Display |
| **Firbolg**  | Charge            | Unshakable          | Display |
| **Fungril**  | Fungril Network   | Death Connection    | Display |
| **Galapa**   | Shell             | Retract             | Display |
| **Giant**    | Endurance         | Reach               | Display |
| **Goblin**   | Surefooted        | Danger Sense        | Display |
| **Halfling** | Luckbringer       | Internal Compass    | Display |
| **Human**    | High Stamina      | Adaptability        | Display |
| **Infernis** | Fearless          | Dread Visage        | Display |
| **Katari**   | Feline Instincts  | Retracting Claws    | Display |
| **Orc**      | Sturdy            | Tusks               | Display |
| **Ribbet**   | Amphibious        | Long Tongue         | Display |
| **Simiah**   | Natural Climber   | Nimble              | Display |


**Note:** Most ancestry features are narrative. A few have mechanical implications (Thick Skin could modify damage thresholds, Quick Reactions could modify initiative) but Daggerheart doesn't have granular stat modifications for most of these — they're GM-adjudicated.

---

## Communities (9)

**Status: Display.** All 9 communities are selectable. Features are displayed but not automated.


| Community       | Feature          | Status  |
| --------------- | ---------------- | ------- |
| **Highborne**   | Privilege        | Display |
| **Loreborne**   | Well-Read        | Display |
| **Orderborne**  | Dedicated        | Display |
| **Ridgeborne**  | Steady           | Display |
| **Seaborne**    | Know the Tide    | Display |
| **Slyborne**    | Scoundrel        | Display |
| **Underborne**  | Low-Light Living | Display |
| **Wanderborne** | Nomadic Pack     | Display |
| **Wildborne**   | Lightfoot        | Display |


**Note:** Community features are entirely narrative/situational. No stat modifications to automate. "Display" is the correct final state for these.

---

## Abilities / Domain Cards (189)

**Status: Display.** All 189 abilities across 9 domains are selectable as domain cards in the character builder. They are displayed on the character sheet and hover card with name, domain, level, type, and description. No individual ability effects are automated (e.g., spending Hope to activate a spell).

9 domains × 21 abilities each:


| Domain   | Abilities | Status  |
| -------- | --------- | ------- |
| Arcana   | 21        | Display |
| Blade    | 21        | Display |
| Bone     | 21        | Display |
| Codex    | 21        | Display |
| Grace    | 21        | Display |
| Midnight | 21        | Display |
| Sage     | 21        | Display |
| Splendor | 21        | Display |
| Valor    | 21        | Display |


**Note:** Ability automation would be a massive undertaking (189 unique effects). Most are situational spells/actions for the GM to adjudicate. A few have clear dice effects that could be integrated into the roll system.

---

## Domains (9)

**Status: Partial.** Domain names are used for filtering abilities in the character builder (class → domains → available abilities). The `domains` collection is fetched by `useCharacterSrdData` but `domainsById` is built and never used. Domain metadata (flavor text, card descriptions) is not displayed.

---

## Beastforms (24)

**Status: None.** The SRD parser normalizes beastforms and they are served via `GET /api/srd/beastforms`, but they are not used anywhere in the client. The Druid class feature "Beastform" is displayed as text only.

To implement: add beastform selection to the Druid character builder, track beastform state on the Game Table (transformed vs normal), apply beastform stats (evasion, damage, features) when transformed.


| Tier | Beastforms                                                                                               | Status |
| ---- | -------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Agile Scout, Household Friend, Nimble Grazer, Pack Predator, Aquatic Scout, Stalking Arachnid            | None   |
| 2    | Armored Sentry, Powerful Beast, Mighty Strider, Striking Serpent, Pouncing Predator, Winged Beast        | None   |
| 3    | Great Predator, Mighty Lizard, Great Winged Beast, Aquatic Predator, Legendary Beast, Legendary Hybrid   | None   |
| 4    | Massive Behemoth, Terrible Lizard, Mythic Aerial Hunter, Epic Aquatic Beast, Mythic Beast, Mythic Hybrid | None   |


---

## Items (60)

**Status: None.** The SRD parser normalizes items and they are served via `GET /api/srd/items`, but they are not used in the client. Character inventory is free-text (from Daggerstack sync or manual entry). There is no SRD item picker, no item effect automation.

To implement: add an item picker to the character builder or inventory UI, display item effects, potentially automate items with stat modifications (Relics give +1 to traits, Gems change weapon traits, etc.).

---

## Consumables (60)

**Status: None.** The SRD parser normalizes consumables and they are served via `GET /api/srd/consumables`, but they are not used in the client. No consumable picker, no effect automation.

To implement: add a consumable tracker to the character sheet or Game Table, integrate consumable effects with the dice system (potions that roll healing, combat consumables that deal damage, etc.).

---

## Priority Recommendations

### Quick Wins (stat modifiers — reuse existing `computeWeaponModifiers` pattern)

1. ~~**Armor stat/roll features**: Flexible/Heavy/Very Heavy/Difficult/Gilded/Channeling/Quiet~~ — **Done** via `computeArmorModifiers`
2. **Warrior Combat Training**: +1 to chosen trait (add a pick to the character builder)

### Medium Effort (new UI, reuse existing systems)

1. **Items as SRD picker**: Add item selection to character inventory (display + Relic stat mods)
2. **Consumables tracker**: Add consumable slots with dice-roll integration for potions
3. **Hope Feature automation**: "Use Hope Feature" button that spends 3 Hope and applies the effect
4. **Multi-ancestry in form UI**: Data model supports it, form only shows first ancestry

### Large Effort (new subsystems)

1. **Beastforms**: Full Druid beastform subsystem (selection, state tracking, stat swap)
2. **Prayer Dice**: Seraph prayer dice pool mechanic
3. **Ability automation**: Per-ability effects (189 abilities — could be incremental)

---

## Maintenance Instructions

This document must be kept current as SRD features are implemented. Follow these rules:

1. **When completing a feature**: Update the relevant row's Status column from `None`/`Display` to `Done`/`Partial`. Update the Summary table counts.
2. **When planning work**: Consult this document to identify the next highest-impact items. Update the Priority Recommendations section if priorities shift.
3. **When SRD content changes**: If the `daggerheart-srd` submodule is updated with new elements, add them to the appropriate section and mark their status.
4. **Counts**: Keep the Summary table counts accurate. The "Features" column should reflect the ratio of automated features.

