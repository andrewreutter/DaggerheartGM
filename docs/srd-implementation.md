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
| [Classes](#classes-9)                     | 9     | N/A       | Done        | 9/9 clickable; 7/9 Phase 2 hooks | **Partial** |
| [Subclasses](#subclasses-18)              | 18    | N/A       | Done        | 1+ features partial (e.g. Wings of Light, Elemental Incarnation) | **Partial** |
| [Ancestries](#ancestries-18)              | 18    | N/A       | Done        | 3/36 features auto | **Partial** |
| [Communities](#communities-9)             | 9     | N/A       | Done        | 0/9 features auto  | **Display** |
| [Abilities](#abilities--domain-cards-189) | 189   | N/A       | Done        | Display            | **Display** |
| [Domains](#domains-9)                     | 9     | N/A       | Indirect    | Filtering only     | **Partial** |
| [Beastforms](#beastforms-24)              | 24    | API only  | Done        | Partial            | **Partial** |
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
| Parry     | Defensive dice cancel matching attack dice | **Broken** — original implementation relied on the old `handleDiceRollComplete`/`dice-ack` path, which was removed in the banner-queue refactor. Needs reimplementation as a linked child banner (`_parentBannerId`). See `parry-linked-banners` in `.cursor/plans/banner_queue_architecture_ac326660.plan.md`. |


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
| **Bard**     | Rally                                           | Make a Scene (3 Hope: Distract target -2 Difficulty) | **Partial** — clickable; Rally adds modifier chips (mode: clearStress); on attack/action banners, attacker with Rally Die sees "Add Rally Die to roll" and "Add Rally Die to damage" toggles (visible to both GM and player, state shared across windows); on Acknowledge with toggle active: original banner cancelled, modifier removed, copy banner created with die added and randomized; modifier chip "clr Stress" button: roll die, on Acknowledge clear stress equal to result. Make a Scene sets `difficultyMod` on target via ActionBanner target picker + `onFeatureActivated` hook; badge shown on adversary card |
| **Druid**    | Beastform, Wildtouch                            | Evolution (3 Hope: free Beastform + trait boost)     | **Done** — Beastform: tier-filtered selector, Use (1 Stress/once-per-rest), Drop Out, auto-drop on last HP or Fragile; in-beastform: attack roll (Hope+Fear+Trait+proficiency), mutually-exclusive advantage chips (+d6), weapons disabled, domain cards disabled, trait/evasion bonuses shown. Evolution (hope ability): 3 Hope, same activeBeastform state + shared selector. Wildtouch: announce only. |
| **Guardian** | Unstoppable                                     | Frontline Tank (3 Hope: clear 2 Armor Slots)         | **Partial** — Unstoppable die chip: `onHpDealt` ratchets d4→d6→d8→d10; `modifyPreThresholdDamage` reduces incoming damage by one tier while chip active; Frontline Tank deducts Hope + clears Armor |
| **Ranger**   | Ranger's Focus                                  | Hold Them Off (3 Hope: attack 2 extra targets)       | **Done** — Ranger's Focus: "Use on next attack" toggle; weapon attack with toggle adds 1 Hope cost and title suffix; on damage apply target gets "Focused by X" (badge with clear); `onFeatureActivated` sets `focusTargetId`; `onHpDealt` marks Stress on Ranger when they deal HP to focus target. Focused-by effects: when Ranger deals damage to Focus target, target marks 1 Stress (banner note "Target will mark 1 Stress (Focused)"); on Fear result vs Focus target, GM/Ranger can end Focus to reroll Duality dice (request flow for player). Hold Them Off: banner shows "Spend 3 Hope to select two more targets" toggle (visible to GM and initiating player); toggle state stored on roll (`_holdThemOffActive`) and synced via banners subscription; when on, target selector allows multi-select up to 3 targets; damage/effects applied to all selected on Acknowledge; 3 Hope deducted when 2–3 targets selected. |
| **Rogue**    | Cloaked, Sneak Attack                           | Rogue's Dodge (3 Hope: +2 Evasion)                   | **Partial** — Sneak Attack: `computeModifierEligibility` auto-enables chip when Cloaked or ally within Melee of adversary; Rogue's Dodge: `onDamageReceived` auto-clears modifier chip when Rogue takes HP damage |
| **Seraph**   | Prayer Dice                                     | Life Support (3 Hope: clear 1 HP on ally)            | **Partial** — Prayer Dice: one chip per d4 with `usageModes: ['gainHope']`. **+Hope**: clicking posts an ActionBanner; GM acks → Hope gained + die consumed. **+Roll**: teal prayer die buttons appear in every DH roll banner (Seraph/ally rolls); clicking adds die value to displayed total; die consumed on GM Acknowledge. **−Dmg**: teal prayer die toggle appears in damage banners whenever a character or ally is targeted; shows `− Prayer Die(N)` in damage line; die consumed on GM Acknowledge; player-visible section also shown. Life Support: action banner with chips for allies within Close range with ≥1 marked HP, single selection (GM or player may click); on GM Acknowledge target clears 1 HP and feature marked used |
| **Sorcerer** | Arcane Sense, Minor Illusion, Channel Raw Power | Volatile Magic (3 Hope: reroll damage dice)          | **Partial** — Channel Raw Power: `requiresInputForFeature` prompts for card level before dispatch; inline number input overlay in CharacterHoverCard; `onFeatureActivated` gains Hope or adds +2×level damage modifier; Volatile Magic deducts Hope |
| **Warrior**  | Attack of Opportunity, Combat Training          | No Mercy (3 Hope: +1 attack until rest)              | **Partial** — Attack of Opportunity sub-features; Combat Training passive badge; No Mercy adds modifier chip |
| **Wizard**   | Prestidigitation, Strange Patterns              | Not This Time (3 Hope: force adversary reroll)       | **Partial** — all clickable; Not This Time button on adversary ResultBanners |


**Phase 2 complete.** All class hooks (Bard, Guardian, Ranger, Rogue, Seraph, Sorcerer) implemented via the IoC class feature system. See `.cursor/plans/clickable_character_features_6686c77f.plan.md` for Phase 3 roadmap.

---

## Subclasses (18)

**Status: Display.** All 18 subclasses are selectable. Spellcast trait is stored. Features are shown grouped by tier (Foundation / Specialization / Mastery) but none are automated.


| Subclass                   | Class    | Key Features                                                                              | Status                                   |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Troubadour**             | Bard     | Gifted Performer, Virtuoso, Maestro                                                       | Display                                  |
| **Wordsmith**              | Bard     | Rousing Speech, Heart of a Poet, Epic Poetry, Eloquent                                    | Partial — Rousing Speech: action banner with in-range character chips (Far range), clears 2 Stress per target on GM Acknowledge, marks feature used; Heart of a Poet: "Spend 1 Hope → d4" button on non-attack action roll banners (GM executes, player can toggle intent); GM spends 1 Hope and rolls d4, result added to displayed total; Epic Poetry, Eloquent: Display |
| **Warden of the Elements** | Druid    | Elemental Incarnation, Elemental Dominion, Elemental Aura                                 | Partial — Elemental Incarnation: Done (Fire: 1d10 retaliation auto-posted when Melee adversary deals HP damage, banner notice shown before Ack; Earth: +Proficiency to thresholds with breakdown display; Water: Stress on Very Close adversaries from attacker's position when Melee damage dealt, banner notice lists targets before Ack; Air: d6 auto-appended to Agility rolls; state cleared on Severe damage or rest). Elemental Dominion, Elemental Aura: Display |
| **Warden of Renewal**      | Druid    | Clarity of Nature, Regeneration, Defender, Regenerative Reach, Warden's Protection        | Display                                  |
| **Stalwart**               | Guardian | Unwavering, Iron Will, Undaunted, Loyal Protector, Unrelenting, Partners-in-Arms          | Display                                  |
| **Vengeance**              | Guardian | At Ease, Revenge, Nemesis, Act of Reprisal                                                | Display                                  |
| **Beastbound**             | Ranger   | Companion, Advanced Training, Loyal Friend, Expert Training, Battle-Bonded                | Display + Library edit — Companion: Name/Species editable in form (between Class and Subclass); evasion/maxStress static; companion stress on table card; companion card stacked in Library, second card to right of hover on Game Table |
| **Wayfinder**              | Ranger   | Ruthless Predator, Path Forward, Apex Predator, Elusive Predator                          | Display                                  |
| **Nightwalker**            | Rogue    | Shadow Stepper, Fleeting Shadow, Vanishing Act, Dark Cloud, Adrenaline                    | Display                                  |
| **Syndicate**              | Rogue    | Well-Connected, Reliable Backup, Contacts Everywhere                                      | Display                                  |
| **Divine Wielder**         | Seraph   | Spirit Weapon, Sparing Touch, Sacred Resonance, Devout                                    | Display                                  |
| **Winged Sentinel**        | Seraph   | Wings of Light, Ascendant, Power of the Gods, Ethereal Visage                             | Partial — Wings of Light: persisted flying toggle; "Pick up and carry" action banner (marks 1 Stress on GM ack, disabled when stress maxed); "Spend a Hope to add a d8 to damage" toggle on character attack banners (shared state; GM click spends Hope and rolls d8; player toggle applied at ack). Other features: Display |
| **Elemental Origin**       | Sorcerer | Elementalist, Transcendence, Natural Evasion                                              | Display — Natural Evasion could automate |
| **Primal Origin**          | Sorcerer | Manipulate Magic, Arcane Charge, Enchanted Aid                                            | Display                                  |
| **Call of the Brave**      | Warrior  | Courage, Battle Ritual, Camaraderie, Rise to the Challenge                                | Display                                  |
| **Call of the Slayer**     | Warrior  | Slayer, Martial Preparation, Weapon Specialist                                            | Display                                  |
| **School of Knowledge**    | Wizard   | Prepared, Adept, Brilliant, Honed Expertise, Accomplished, Perfect Recall                 | Display                                  |
| **School of War**          | Wizard   | Battlemage, Face Your Fear, Thrive in Chaos, Have No Fear, Conjure Shield, Fueled by Fear | Display                                  |


**Note:** Most subclass features are narrative or situational. Automation candidates are features with clear stat modifications or dice effects (Natural Evasion, Adrenaline, Weapon Specialist, etc.).

---

## Ancestries (18)

**Status: Display.** All 18 ancestries are selectable in the character builder (single ancestry only — multi-ancestry supported in data model but not in form UI). Features are displayed on the character sheet but none are automated. Ancestry banner reactions may declare optional `hopeCost` and `stressCost`; the system gates isEnabled on resources and applies costs before calling acknowledge.


| Ancestry     | Feature 1         | Feature 2           | Status  |
| ------------ | ----------------- | ------------------- | ------- |
| **Clank**    | Purposeful Design | Efficient           | Display |
| **Drakona**  | Scales            | Elemental Breath    | Display |
| **Dwarf**    | Thick Skin        | Increased Fortitude | **Done** — Thick Skin: target chip on Minor damage (mark 2 Stress instead of 1 HP). Increased Fortitude: target chip on physical damage (spend 3 Hope to halve damage). Both via `src/features/ancestries/Dwarf.js` and target-chip pipeline in GMTableView/DiceRoller. |
| **Elf**      | Quick Reactions   | Celestial Trance    | Display |
| **Faerie**   | Luckbender        | Wings               | Display |
| **Faun**     | Caprine Leap      | Kick                | **Done** — Caprine Leap: narrative only (Display final). Kick: chip Ack on successful Melee attack adds +2d6 to **current** attack (mark 1 Stress), knockback narration; banner replaced with augmented roll |
| **Firbolg**  | Charge            | Unshakable          | Display |
| **Fungril**  | Fungril Network   | Death Connection    | Display |
| **Galapa**   | Shell             | Retract             | Display |
| **Giant**    | Endurance         | Reach               | **Done** — Endurance: +1 HP slot via ancestry IoC. Reach: Melee weapons display and roll as Very Close; carries through to map range bands (10'). Both automated via `src/features/ancestries/` |
| **Goblin**   | Surefooted        | Danger Sense        | Display |
| **Halfling** | Luckbringer       | Internal Compass    | Display |
| **Human**    | High Stamina      | Adaptability        | Display |
| **Infernis** | Fearless          | Dread Visage        | **Done** — All automated via `src/features/ancestries/` IoC. Fearless: `onBannerRender` calls `roll.setHope()` for pre-ack banner color; on Acknowledge, stress applied via character, hope via `grantHopeToAttacker` return. Dread Visage: advantage condition parsed from description text. |
| **Katari**   | Feline Instincts  | Retracting Claws    | **Done** — All automated via `src/features/ancestries/` IoC. Feline Instincts: banner reaction for Hope die reroll (2 Hope cost, player request flow). Retracting Claws: virtual weapon via `onCharacterRender` / `addVirtualWeapon`; on Acknowledge applies Vulnerable via `onAcknowledge`. |
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

**Status: Partial.** All 24 beastforms are served via `GET /api/srd/beastforms` and loaded by `useCharacterSrdData`. When a Druid character has the Beastform class feature or Evolution hope ability, the Game Table hover card shows a tier-filtered selector, a Transform/Drop Out button, and full in-beastform UI (attack rolls with Hope+Fear+Trait, mutually-exclusive advantage chips, trait/evasion bonus display, weapons disabled, domain cards disabled). Auto-drop triggers on last HP or Fragile damage. State is persisted via `activeBeastform` and `selectedBeastformAdvantage` in `CHARACTER_RUNTIME_KEYS`.

Not yet implemented: beastform stats in the Library browser (display-only), character builder integration (selecting a beastform from the builder is unimplemented).


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

1. **Beastforms in Library browser**: Show beastform stats in a browsable Library tab (currently API-only)
2. **Prayer Dice**: Seraph prayer dice pool mechanic
3. **Ability automation**: Per-ability effects (189 abilities — could be incremental)

---

## Maintenance Instructions

This document must be kept current as SRD features are implemented. Follow these rules:

1. **When completing a feature**: Update the relevant row's Status column from `None`/`Display` to `Done`/`Partial`. Update the Summary table counts.
2. **When planning work**: Consult this document to identify the next highest-impact items. Update the Priority Recommendations section if priorities shift.
3. **When SRD content changes**: If the `daggerheart-srd` submodule is updated with new elements, add them to the appropriate section and mark their status.
4. **Counts**: Keep the Summary table counts accurate. The "Features" column should reflect the ratio of automated features.

