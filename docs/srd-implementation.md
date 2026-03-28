# SRD Implementation Burndown

Tracks implementation status of every element in the `daggerheart-srd` submodule.
See [Maintenance Instructions](#maintenance-instructions) at the bottom.

**Legend:** Done = fully automated where automation applies | Display = shown but not mechanically automated | Partial = some aspects automated | None = not in the UI

---

## Summary


| Collection                                | Count | Browsable | Selectable  | Features                                                         | Overall     |
| ----------------------------------------- | ----- | --------- | ----------- | ---------------------------------------------------------------- | ----------- |
| [Adversaries](#adversaries-129)           | 129   | Done      | N/A (table) | Attacks rollable                                                 | **Done**    |
| [Environments](#environments-19)          | 19    | Done      | N/A (table) | Display                                                          | **Done**    |
| [Weapons](#weapons-186)                   | 186   | N/A       | Done        | 25/38 automated; 38/38 in V2 `weapon_properties` registry         | **Partial** |
| [Armor](#armor-34)                        | 34    | N/A       | Done        | 18/21 automated; 21/21 in V2 `armor_properties` registry        | **Partial** |
| [Classes](#classes-9)                     | 9     | N/A       | Done        | 9/9 clickable; 7/9 Phase 2 hooks                                 | **Partial** |
| [Subclasses](#subclasses-18)              | 18    | N/A       | Done        | V2 modules for several subclasses (e.g. Troubadour, Warden of the Elements, Beastbound); many still partial | **Partial** |
| [Ancestries](#ancestries-18)              | 18    | N/A       | Done        | 18 ancestries automated; 2 features display-only by design       | **Done**    |
| [Communities](#communities-9)             | 9     | N/A       | Done        | 9/9 features automated                                           | **Done**    |
| [Abilities](#abilities--domain-cards-189) | 189   | N/A       | Done        | V2 engine: Arcana Tier 1–2 in `features-v2/abilities/Arcana/` (see tracker); UI still display-first | **Partial** |
| [Domains](#domains-9)                     | 9     | N/A       | Indirect    | Filtering only                                                   | **Partial** |
| [Beastforms](#beastforms-24)              | 24    | API only  | Done        | 24/24 V2 per-form modules + active-form `loadCharacterFeatures` merge | **Partial** |
| [Items](#items-60)                        | 60    | API only  | None        | 60/60 V2 `items/` registry; effects vary (many narrative)        | **Partial** |
| [Consumables](#consumables-60)            | 60    | API only  | Indirect    | V2 registry + inventory merge; **Potion of Stability** Rest banner + rest slots (most others narrative) | **Partial** |


**Totals:** 746 SRD elements. ~360 fully implemented (adversaries + environments + weapons + abilities as display + armor stat/roll/slot-triggered/damage-type-gated features), ~143 partially implemented, ~243 not in the UI.

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

Handled by `computeWeaponModifiers` in `character-calc.js` via merged V2 weapon property descriptors (`passiveStatMods` only — no parsing). No per-attack effect — applied at character build time.


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
| Devastating | Toggle → d20 damage die; 1 Stress; VTT **intent** chip + `computeWeaponRenderHints` (hide duplicate card toggle) | **Done** |
| Charged     | VTT **intent**: +1 Proficiency (`Charged [+1]` before damage), 1 Stress; `hideChargedVariantCard` (variant card is extra-die legacy path) | **Done** |
| Persuasive  | +2 Presence for 1 Stress; VTT **intent** on trait pre-roll when weapon has tag (`addRollBonus`) | **Done** |
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


| Feature   | Behavior                                   | Status                                                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startling | Action notification card; 1 Stress         | **Done**                                                                                                                                                                                                                                                                                                        |
| Parry     | Defensive dice cancel matching attack dice | **Done** — Parry roll uses a silent server roll (no second banner); reduced damage is applied to the same banner. |


#### Phase 5 — Optional display-to-automation (Done)

| Feature    | Effect                                   | Status   |
| ---------- | ---------------------------------------- | -------- |
| Concussive | On success: toggle "Spend 1 Hope → knock target to Far"; token moved to 50 ft | **Done** |
| Locked On  | On hit, set lock on target; next primary attack vs same target shows "Locked On: auto-succeeds" badge; lock cleared on ack | **Done** |

#### Display Only — No Automation Needed

These are informational for the GM. Shown as tags in the result banner.


| Feature     | Description                    | Status      |
| ----------- | ------------------------------ | ----------- |
| Returning   | Weapon returns after throw     | **Display** |
| Hooked      | Pull target into Melee         | **Display** |
| Eruptive    | Half damage to nearby on Melee | **Display** |
| Dueling     | Advantage vs isolated target   | **Display** |
| Retractable | Blade can be hidden            | **Display** |
| Timebending | Choose target after roll       | **Display** |
| Healing     | Clear 1 HP in downtime         | **Display** |
| Hot         | Cuts through material          | **Display** |
| Greedy      | +1 proficiency for gold        | **Display** |
| Long        | Target all in a line           | **Display** |
| Grappling   | Restrain/pull for 1 Hope       | **Display** |
| Sheltering  | Armor shared with allies       | **Display** |
| Deflecting  | Mark Armor for Evasion bonus   | **Display** |


**Weapon features score: 27 fully automated + 12 display-only (all have V2 descriptors) = 39/39 accounted for.**

---

## Armor (34)

**Status: Partial.** All 34 armor pieces are selectable in the character builder. Base stats (score, thresholds, max armor) are computed by `resolveArmor`. Armor features are read from merged V2 armor property descriptors (`passiveStatMods` only — no parsing) in `computeArmorModifiers`; stat and roll modifiers are automated. Armor-slot-triggered features (Phase 2) are automated via the damage banner's armor button. Damage-type-gated features (Phase 3) are automated: `dmg.type` flows from `ResultBanner` through `handleApplyDamage` to `applyDamageToTarget`. Map-aware and complex features require later phases.

### Armor Features (21 unique)

#### Stat Modifiers — All Done

Handled by `computeArmorModifiers` in `character-calc.js` via merged V2 armor property descriptors (`passiveStatMods` only). Applied at character build time before weapon modifiers.


| Feature    | Armors                | Effect                    | Status   |
| ---------- | --------------------- | ------------------------- | -------- |
| *(none)*   | Leather (T1-T4)       | No feature                | **Done** |
| Flexible   | Gambeson (T1-T4)      | +1 Evasion                | **Done** |
| Heavy      | Chainmail (T1-T4)     | -1 Evasion                | **Done** |
| Very Heavy | Full Plate (T1-T4)    | -2 Evasion; -1 Agility    | **Done** |
| Gilded     | Bellamoi Fine (T3)    | +1 Presence               | **Done** |
| Difficult  | Savior Chainmail (T4) | -1 all traits and Evasion | **Done** |


#### Roll Modifiers — All Done

Toggleable chips in the Experiences section. Bonus included in the next roll without spending Hope.


| Feature    | Armors                | Effect             | Status   |
| ---------- | --------------------- | ------------------ | -------- |
| Channeling | Channeling Armor (T4) | +1 Spellcast Rolls | **Done** |
| Quiet      | Tyris Soft (T2)       | +2 stealth rolls   | **Done** |


#### Display Only — Done


| Feature      | Armors            | Effect                   | Status      |
| ------------ | ----------------- | ------------------------ | ----------- |
| Truthseeking | Veritas Opal (T4) | Glows when creature lies | **Display** |


#### Armor-Slot-Triggered — Done (Phase 2 + Phase 3)

Triggered when the GM clicks the cyan armor button (shield icon) next to a character target in the damage banner. `applyDamageToTarget` in `GMTableView.jsx` reads `armorOpts.feature` to apply the feature effect alongside the slot mark. Phase 3 adds slot-effect and substitution hooks (Timeslowing, Shifting, Hopeful, Impenetrable).


| Feature     | Armors                      | Effect                                                              | Status   |
| ----------- | --------------------------- | ------------------------------------------------------------------- | -------- |
| Fortified   | Full Fortified (T4)         | Armor Slot reduces severity by two (−2 HP instead of −1)            | **Done** |
| Painful     | Runes of Fortification (T3) | Auto-mark 1 Stress on target when armor slot is marked              | **Done** |
| Resilient   | Harrowbone (T2)             | On last slot: roll d6 — a 6 saves the slot (severity still reduces) | **Done** |
| Reinforced  | IronTree Breastplate (T2)   | +2 to both thresholds when last slot marked; clears on restore     | **Done** |
| Timeslowing | Dunamis Silkchain (T4)      | Mark Armor Slot → +1d4 Evasion until rest (silent roll, activeModifier) | **Done** |
| Shifting    | Runetan Floating (T2)      | Mark Armor Slot → disadvantage until rest; cleared on rest         | **Done** |
| Hopeful     | Rosewild (T2)               | When spending Hope (chip/feature), option to mark Armor Slot instead (banner toggle) | **Done** |
| Impenetrable | Dragonscale (T3)            | When damage would reduce to 0 HP: option to mark Stress instead (1/rest, banner toggle) | **Done** |


#### Damage-Type Gated — Done (Phase 3)

`dmg.type` (`'phy'`/`'mag'`) is extracted from the roll's post tag in `parseDiceSub` and flows through `onApplyDamage` → `handleApplyDamage` → `applyDamageToTarget`. `armorScore` is added to character targets in `damageTargets`.


| Feature  | Armors               | Effect                                                    | Status   |
| -------- | -------------------- | --------------------------------------------------------- | -------- |
| Warded   | Elundrian Chain (T2) | Reduce magic damage by Armor Score before threshold check | **Done** |
| Physical | Bladefare (T3)       | Armor button hidden for magic damage                      | **Done** |
| Magic    | Monett's Cloak (T3)  | Armor button hidden for physical damage                   | **Done** |


#### Map-Aware — Pending (Phase 4)

Map-aware (Phase 4): when the target has Sharp/Burning and the attacker is in Melee (from map or roll metadata), retaliation runs after damage is applied.

| Feature | Armors            | Effect                      | Status   |
| ------- | ----------------- | --------------------------- | -------- |
| Sharp   | Spiked Plate (T3) | Attacker takes 1d4 damage   | **Done** |
| Burning | Emberwoven (T4)   | Melee attacker marks Stress | **Done** |


**Armor features score: 18 automated (5 stat + 2 roll + 8 slot-triggered/substitution + 2 map-aware + 1 display) / 21 total. All 21 have V2 descriptors.**

---

## Classes (9)

**Status: Partial.** All 9 classes are selectable in the character builder. Base stats (HP, evasion, domains) are computed. All class features are now **clickable** via the Phase 1 feature interaction system (Use buttons, sub-feature cards, cost badges). Resource costs (Hope/Stress/Armor) are applied on banner dismiss. Session/Short Rest/Long Rest buttons refresh feature usage and active modifiers. See the [Clickable Character Features plan](../.cursor/plans/clickable_character_features_6686c77f.plan.md) for the full feature rundown and Phase 2 roadmap.

**Phase 1 — All features clickable** as of this implementation:

- Feature **action** metadata for the sheet / hover card is derived from merged V2 `activeFeatures` (`deriveFeatureActionFromV2Row` / `enrichHoverActionMeta`: `card`-placement chips, spellcast lines, target hints; ad-hoc hover rolls use V2 `clientHoverUseRoll` on registry rows)
- `FeatureChip` shows Use/passive-badge UI based on feature type
- `SubFeatureCard` renders multi-option features (Channel Raw Power, Attack of Opportunity)
- `handleFeatureUse` in CharacterHoverCard builds roll text or action notification
- Resource costs applied via `applyFeatureResources` on banner dismiss
- Feature usage (once/session, once/rest) tracked in `featureUsage` element field
- Active modifiers (Rally Die, Prayer Die, Sneak Attack, etc.) tracked in `activeModifiers` element field
- Session/Short Rest/Long Rest buttons in Encounter panel header clear matching `featureUsage` and `activeModifiers`
- Not This Time (Wizard) button appears on adversary ResultBanners when Wizard has 3+ Hope


| Class        | Class Features                                  | Hope Feature                                         | Feature Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bard**     | Rally                                           | Make a Scene (3 Hope: Distract target -2 Difficulty) | **Partial** — **Phase 1 UI:** modifier chips, banner toggles for add to roll/damage, clear Stress flow as shipped. **V2 engine (`features-v2`):** **Rally** — session grant `partyDice` + per-PC Rally Die modifiers; spend chips for action/damage/clear Stress; **`showOnOtherSheets`** for ally sheets (`collectChipsForOtherCharacterSheets`). Resolution **bard-rally-session** archived **Done** (`v2-blocked-resolutions-done.md`). **VTT:** wire `crossSheetChips` + session-end clear — `docs/v2-game-table-cutover-remaining.md` (session vs scene) / tracker Tech Debt. Make a Scene: `difficultyMod` on target + adversary badge (Phase 1).                                                                                                                                                                                                                                                                                                       |
| **Druid**    | Beastform, Wildtouch                            | Evolution (3 Hope: free Beastform + trait boost)     | **Done** — Beastform: tier-filtered selector, Use (1 Stress/once-per-rest), Drop Out, auto-drop on last HP or Fragile; in-beastform: attack roll (Hope+Fear+Trait+proficiency), mutually-exclusive advantage chips (+d6), weapons disabled, domain cards disabled, trait/evasion bonuses shown. Evolution (hope ability): 3 Hope, same activeBeastform state + shared selector. Wildtouch: announce only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Guardian** | Unstoppable                                     | Frontline Tank (3 Hope: clear 2 Armor Slots)         | **Partial** — **Legacy:** Unstoppable die + threshold reduction via IoC. **V2 engine (`features-v2`):** `Unstoppable` — long-rest activation, die face/max in feature state, `onReviewAction` (incoming physical −1 threshold / outgoing +die), `onResolve` (ratchet die; drop when value exceeds max), `onSceneEnd` + `onStateChange` (strip Restrained/Vulnerable). Engine: `table.action.reduceIncomingPhysicalSeverityBySteps`, `dispatchSceneEndHooks` → `hooks.onSceneEnd`. Frontline Tank: Hope 3 + clear armor (both stacks).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Ranger**   | Ranger's Focus                                  | Hold Them Off (3 Hope: attack 2 extra targets)       | **Done** — Ranger's Focus: "Use on next attack" toggle; weapon attack with toggle adds 1 Hope cost and title suffix; on damage apply target gets "Focused by X" (badge with clear); `onFeatureActivated` sets `focusTargetId`; `onHpDealt` marks Stress on Ranger when they deal HP to focus target. Focused-by effects: when Ranger deals damage to Focus target, target marks 1 Stress (banner note "Target will mark 1 Stress (Focused)"); on Fear result vs Focus target, GM/Ranger can end Focus to reroll Duality dice (request flow for player). Hold Them Off: banner shows "Spend 3 Hope to select two more targets" toggle (visible to GM and initiating player); toggle state stored on roll (`_holdThemOffActive`) and synced via banners subscription; when on, target selector allows multi-select up to 3 targets; damage/effects applied to all selected on Acknowledge; 3 Hope deducted when 2–3 targets selected. |
| **Rogue**    | Cloaked, Sneak Attack                           | Rogue's Dodge (3 Hope: +2 Evasion)                   | **Partial** — **Cloaked:** V2 card chip adds the Cloaked condition (SRD Hidden→Cloaked swap, stationary concealment, and clearing on attack/move/LOS are GM/table). **Sneak Attack:** V2 `reviewAction` chip on the roll banner when the attack succeeds and you are Cloaked or an ally is in Melee of the target (add tier d6); hit/miss uses the same defense math as the banner (`effectiveEvasion` for PCs). Rogue's Dodge: `onDamageReceived` auto-clears modifier chip when Rogue takes HP damage                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Seraph**   | Prayer Dice                                     | Life Support (3 Hope: clear 1 HP on ally)            | **Partial** — **Legacy (Phase 1 UI):** per-dice chips, roll/damage banner integration, Hope/damage flows as described in the app. **V2 engine (`features-v2`):** **Prayer Dice** — `onSessionStart` rolls d4s per `spellcastTrait`/`traits`; `table.me.prayerDice` pool + `reviewAction` spend chips (Prayer Die — Action / — Damage, reduce damage via `reducePendingDamageForTarget`, gain Hope); Far-range predicates for aiding allies. Host sets `spellcastTrait`; `clearPrayerDicePool` at session end. **Life Support:** V2 card chip + `selectTargets` (see `Seraph.test.js`).                                                                                                                                                                                                                                                                                                                                                                 |
| **Sorcerer** | Arcane Sense, Minor Illusion, Channel Raw Power | Volatile Magic (3 Hope: reroll damage dice)          | **Partial** — **Legacy:** Channel Raw Power uses `requiresInputForFeature` + `onFeatureActivated` for Hope or +2×level damage. **V2 engine (`features-v2`):** Arcane Sense narrative-only; Minor Illusion → `actionLoop` DC 10; Volatile Magic → Hope 3 `reviewAction` + `rerollAllDice` when pending magic damage is on `action.effects`; **Channel Raw Power** — long-rest `isSelect` over `table.me.domainLoadout`, `moveDomainCardToVault`, spell-damage bonus via `onReviewAction` (resolution **channel-raw-power-domain** archived **Done**; live loadout/vault wiring — `docs/v2-game-table-cutover-remaining.md`).                                                                                                                                                                                                                                                                                                                                              |
| **Warrior**  | Attack of Opportunity, Combat Training          | No Mercy (3 Hope: +1 attack until rest)              | **Partial** — Attack of Opportunity sub-features; Combat Training passive badge; No Mercy adds modifier chip                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Wizard**   | Prestidigitation, Strange Patterns              | Not This Time (3 Hope: force adversary reroll)       | **Partial** — all clickable; Not This Time button on adversary ResultBanners                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |


**Phase 2 complete.** All class hooks (Bard, Guardian, Ranger, Rogue, Seraph, Sorcerer) implemented via the IoC class feature system. See `.cursor/plans/clickable_character_features_6686c77f.plan.md` for Phase 3 roadmap.

---

## Subclasses (18)

**Status: Mixed.** All 18 subclasses are selectable. Spellcast trait is stored. Features are shown grouped by tier (Foundation / Specialization / Mastery). V2 engine coverage is growing (e.g. Troubadour Gifted Performer); most subclass features remain display-only on the Game Table until migrated.


| Subclass                   | Class    | Key Features                                                                              | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Troubadour**             | Bard     | Gifted Performer, Virtuoso, Maestro                                                       | Partial — **Gifted Performer** + **Virtuoso** + **Maestro:** V2 (`Troubadour.test.js`). **Maestro:** Rally sets ally-pending `maestroRallyChoices`; cross-sheet Hope/Stress choice (`Bard.js`, `Troubadour.js`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Wordsmith**              | Bard     | Rousing Speech, Heart of a Poet, Epic Poetry, Eloquent                                    | **Done (V2)** — `Wordsmith.js`, `Wordsmith.test.js`. **Epic Poetry:** Rally **d10** via **`rallyDieSizeForBard`** (`Bard.js`); **Help an Ally** optional **d10** advantage on **`tagTeam`** when the Wordsmith is the helper (`tagTeamPartnerInstanceId`).                                                                                                                                                                                                                                                                                                                                                               |
| **Warden of the Elements** | Druid    | Elemental Incarnation, Elemental Dominion, Elemental Aura                                 | **Done** (V2) — `src/features-v2/subclasses/WardenOfTheElements.js` + tests; registry `srd-sub-warden-of-the-elements`. Shared `featureState.WardenOfTheElements` for channel, aura (once/rest), and mastery (tier ≥ 4). Severe clear when host tags HP effects with `damageTier`/`thresholdTier === 'severe'`. Earth aura ally Strength: +1 on ally **Strength** trait rolls in Close + GM `actionLoop` reminder. Phase 1 Game Table banner notices may still apply until full V2 UI integration. |
| **Warden of Renewal**      | Druid    | Clarity of Nature, Regeneration, Defender, Regenerative Reach, Warden's Protection        | Partial — **Regeneration** / **Regenerative Reach** / **Clarity of Nature** / **Warden's Protection** / **Defender:** V2 (`WardenOfRenewal.js`, `WardenOfRenewal.test.js`). **Defender** requires `inBeastform` + ally in Close with ≥2 pending HP; `reviewAction` Stress 1 to reduce ally's pending HP by 1. Game Table wiring backlog per V2 tracker where noted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Stalwart**               | Guardian | Unwavering, Iron Will, Undaunted, Loyal Protector, Unrelenting, Partners-in-Arms          | Partial — V2: **Unwavering**, **Unrelenting**, **Undaunted** use `passiveStatMods` on major/severe thresholds (`Stalwart.js`). **Iron Will**, **Partners-in-Arms**, **Loyal Protector** not yet implemented.                                                                                                                                                                                                                                                          |
| **Vengeance**              | Guardian | At Ease, Revenge, Nemesis, Act of Reprisal                                                | Partial — V2: **At Ease** (+1 max Stress), **Revenge** (`reviewAction` chip), **Act of Reprisal** (`onReviewOutcome` + attack static). **Nemesis** Blocked (swap Hope/Fear — see GitHub `v2-migration` Issues, resolution **vengeance-nemesis-swap-dice**; `docs/v2-migration-tracker-snapshot.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Beastbound**             | Ranger   | Companion, Advanced Training, Loyal Friend, Expert Training, Battle-Bonded                | **Partial** — **Phase 1 UI:** Companion Name/Species, stress, hover companion card. **V2 engine (`features-v2`):** `Beastbound.js` + registry `srd-sub-beastbound` — Companion / Expert Training / Advanced Training / Loyal Friend as narrative; **Battle-Bonded** `onIntent` +2 Evasion vs adversary **Melee** attacks (companion shares ranger token when no companion token on snapshot). Tests: `Beastbound.test.js`.                                                                                                                                                                                                                                 |
| **Wayfinder**              | Ranger   | Ruthless Predator, Path Forward, Apex Predator, Elusive Predator                          | Done — V2: **Ruthless Predator**, **Path Forward**, **Elusive Predator**, **Apex Predator** (`src/features-v2/subclasses/Wayfinder.js`, `Wayfinder.test.js`). Path Forward is narrative-only; travel/path sense is GM/table.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Nightwalker**            | Rogue    | Shadow Stepper, Fleeting Shadow, Vanishing Act, Dark Cloud, Adrenaline                    | Partial — V2: **Shadow Stepper**, **Dark Cloud**, **Vanishing Act**, **Adrenaline**, **Fleeting Shadow** (`src/features-v2/subclasses/Nightwalker.js`, `Nightwalker.test.js`). Cloud placement and LOS remain GM-facing; **Vanishing Act** clears when Fear dominates a duality roll or on rest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Syndicate**              | Rogue    | Well-Connected, Reliable Backup, Contacts Everywhere                                      | Display                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Divine Wielder**         | Seraph   | Spirit Weapon, Sparing Touch, Sacred Resonance, Devout                                    | Display                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Winged Sentinel**        | Seraph   | Wings of Light, Ascendant, Power of the Gods, Ethereal Visage                             | Done (V2) — `src/features-v2/subclasses/WingedSentinel.js`, `WingedSentinel.test.js`. Flight toggle + carry Stress + extra damage (`reviewAction` Hope); **Ethereal Visage** Presence advantage while flying + optional GM Fear spend (`reviewOutcome`); **Ascendant** +4 severe threshold; **Power of the Gods** `onSessionStart` + d12 upgrade. Legacy banner UX for d8/Hope may remain until full V2 Game Table cutover.                                                                                                                                            |
| **Elemental Origin**       | Sorcerer | Elementalist, Transcendence, Natural Evasion                                              | Done (V2) — `src/features-v2/subclasses/ElementalOrigin.js`; **Transcendence** +1 Proficiency is automated as +1 to damage rolls while active (full Proficiency scope remains host/VTT).                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Primal Origin**          | Sorcerer | Manipulate Magic, Arcane Charge, Enchanted Aid                                            | Display                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Call of the Brave**      | Warrior  | Courage, Battle Ritual, Camaraderie, Rise to the Challenge                                | Partial — V2: Courage / Battle Ritual validated; **Rise to the Challenge** automated; **Camaraderie** Display (narrative text only) pending full Tag Team automation — see Tech Debt in GitHub `v2-migration` Issues / `docs/v2-migration-tracker-snapshot.md`; `src/features-v2/subclasses/CallOfTheBrave.js`.                                                                                                                                                                                                                              |
| **Call of the Slayer**     | Warrior  | Slayer, Martial Preparation, Weapon Specialist                                            | Display                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **School of Knowledge**    | Wizard   | Prepared, Adept, Brilliant, Honed Expertise, Accomplished, Perfect Recall                 | **Partial (V2)** — `src/features-v2/subclasses/SchoolOfKnowledge.js`, `SchoolOfKnowledge.test.js`, registry `srd-sub-school-of-knowledge`. **Prepared** / **Accomplished** / **Brilliant:** extra domain cards (builder/loadout; narrative). **Adept** intent + `onReviewAction`; **Honed Expertise** d6 refund Hope; **Perfect Recall** once/rest `card` + `actionLoop` (recall pipeline GM).                                                                                                                                                                                                  |
| **School of War**          | Wizard   | Battlemage, Face Your Fear, Thrive in Chaos, Have No Fear, Conjure Shield, Fueled by Fear | **Partial (V2)** — `src/features-v2/subclasses/SchoolOfWar.js`, `SchoolOfWar.test.js`, registry `srd-sub-school-of-war`. **Battlemage** +1 max HP; **Conjure Shield** +Prof Evasion when Hope ≥ 2; **Face Your Fear** Fear-dominant success adds `1d10`–`3d10` by tier; **Thrive in Chaos** `reviewAction`; **Fueled by Fear** / **Have No Fear** scaling merged into Face Your Fear hook.                                                                                                                                                                                                  |


**Note:** Most subclass features are narrative or situational. Automation candidates are features with clear stat modifications or dice effects (Natural Evasion, Adrenaline, Weapon Specialist, etc.).

---

## Ancestries (18)

**Status: Done.** All 18 ancestries are selectable in the character builder (single ancestry only — multi-ancestry supported in data model but not in form UI). Features are displayed on the character sheet; all 18 ancestries are implemented in **`src/features-v2/ancestries/`** (V2 engine + merged **`activeFeatures`**) with one or both features automated except two intentionally display-only features (Caprine Leap, Amphibious). Ancestry banner reactions may declare optional `hopeCost` and `stressCost`; the system gates isEnabled on resources and applies costs before calling acknowledge. Origin lifecycle hooks `onMarkStress`, `onMarkHP`, and `onMarkArmor` run before marking (e.g. Firbolg Unshakable).


| Ancestry     | Feature 1         | Feature 2           | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Clank**    | Purposeful Design | Efficient           | **Done** — Purposeful Design: character form dropdown for which experience gets +1; roll path applies +1 when that experience is selected; incomplete until chosen. Efficient: `onRest(rest)` adds long rest moves to short rest list via `src/features-v2/ancestries/Clank.js` and `getRestMovesForCharacter` in rest-moves.js.                                                                                                                                                                    |
| **Drakona**  | Scales            | Elemental Breath    | **Done** — Scales: target chip on Severe damage (mark 1 Stress to mark 1 fewer HP). Elemental Breath: virtual weapon (Instinct, Very Close, d8 magic + Proficiency) via `src/features-v2/ancestries/Drakona.js`; roll builder adds proficiency and magic tag for Warded etc.; multi-target (target or group within Very Close) via `multiTarget: true`.                                                                                                                                             |
| **Dwarf**    | Thick Skin        | Increased Fortitude | **Done** — Thick Skin: target chip on Minor damage (mark 2 Stress instead of 1 HP). Increased Fortitude: target chip on physical damage (spend 3 Hope to halve damage). Both via `src/features-v2/ancestries/Dwarf.js` and target-chip pipeline in GMTableView/DiceRoller.                                                                                                                                                                                                                          |
| **Elf**      | Quick Reactions   | Celestial Trance    | **Done** — Quick Reactions: `onAct(canvas, roll, char, options)` adds a chip for reaction rolls (1 Stress for advantage); player-only pre-roll banner with Proceed then sends roll with `roll.addAdvantageDie('Quick Reactions')`. Celestial Trance: `onRest(rest)` calls `rest.addShortMoveSlot()` and `rest.addLongMoveSlot()`; RestBanner shows per-character slot count (default 2).                                                                                                         |
| **Faerie**   | Luckbender        | Wings               | **Done** — Luckbender: banner chip, 3 Hope, once/session, `roll.reroll('Duality')`. Wings: banner chip when selected target is this character and flying (`faerieWingsFlying`), 1 Stress, `ctx.setTreatAsMissForTarget`. Flying toggle on feature card. Via `src/features-v2/ancestries/Faerie.js`.                                                                                                                                                                                                 |
| **Faun**     | Caprine Leap      | Kick                | **Done** — Caprine Leap: narrative only (Display final). Kick: chip Ack on successful Melee attack adds +2d6 to **current** attack (mark 1 Stress), optional map positioning with non-mover token lock until Ack; banner replaced with augmented roll                                                                                                                                                                                                                                                                                     |
| **Firbolg**  | Charge            | Unshakable          | **Done** — Charge: pre-roll canvas chip "I moved this turn" for Agility rolls; when selected, adds advantage d6 (onAct). Unshakable: `onMarkStress` rolls d6; on 6 the stress is not marked (origin-lifecycle in `src/client/lib/origin-lifecycle.js`).                                                                                                                                                                                                                                          |
| **Fungril**  | Fungril Network   | Death Connection    | **Done** — Fungril Network: display (narrative). Death Connection: `onCard(card)` adds a chip (label, stressCost: 1, onUse: context.postAction); chip shows on feature card; click posts action banner; GM ack applies 1 Stress. Both in `src/features-v2/ancestries/Fungril.js`.                                                                                                                                                                                                                   |
| **Galapa**   | Shell             | Retract             | **Done** — Shell: `addThresholdBonus(ctx.proficiency ?? 1)` in `onCharacterRender`; effectiveThresholds applies ancestryThresholdBonus. Retract: onCard toggle chip with `toggleKey: 'retractedActive'`; entity methods addResistance('physical'), addDisadvantage, disableMove (source `'Galapa - Retract'`); physical damage halved in applyDamageToTarget, disadvantage via insertDisadvantageD6 in handlePlayerOwnRoll, canDrag false in BattleMap. Via `src/features-v2/ancestries/Galapa.js`. |
| **Giant**    | Endurance         | Reach               | **Done** — Endurance: +1 HP slot via V2 ancestry `passiveStatMods`. Reach: Melee weapons display and roll as Very Close; carries through to map range bands (10'). Both automated via `src/features-v2/ancestries/`                                                                                                                                                                                                                                                                               |
| **Goblin**   | Surefooted        | Danger Sense        | **Done** — Danger Sense: banner chip when adversary attack targets this character or an ally within Very Close (`roll.target.rangeFromMe`), 1 Stress, once/rest, `roll.fullReroll()`. Surefooted: Agility rolls skip disadvantage from `addDisadvantage` (e.g. Galapa Retract) in handlePlayerOwnRoll. Via `src/features-v2/ancestries/Goblin.js`.                                                                                                                                                  |
| **Halfling** | Luckbringer       | Internal Compass    | **Done** — Luckbringer: `onSessionStart` grants 1 Hope to each party character (called from handleSessionCycle). Internal Compass: banner chip when Hope die shows 1, spend 1 Hope to reroll Hope die. Via `src/features-v2/ancestries/Halfling.js`.                                                                                                                                                                                                                                                |
| **Human**    | High Stamina      | Adaptability        | **Done** — High Stamina: `addStatMod('maxStress', 1)` in `onCharacterRender`. Adaptability: onBanner chip when roll failed and used an experience (Fear or failed difficulty); mark 1 Stress to full reroll via `roll.fullReroll()` and shared `performFullReroll` (Lucky uses same helper). Via `src/features-v2/ancestries/Human.js`.                                                                                                                                                             |
| **Infernis** | Fearless          | Dread Visage        | **Done** — All automated via `src/features-v2/ancestries/` hooks. Fearless: `onBannerRender` calls `roll.setHope()` for pre-ack banner color; on Acknowledge, stress applied via character, hope via `grantHopeToAttacker` return. Dread Visage: advantage condition parsed from description text.                                                                                                                                                                                                    |
| **Katari**   | Feline Instincts  | Retracting Claws    | **Done** — All automated via `src/features-v2/ancestries/` hooks. Feline Instincts: banner reaction for Hope die reroll (2 Hope cost, player request flow). Retracting Claws: virtual weapon via `onCharacterRender` / `addVirtualWeapon`; on Acknowledge applies Vulnerable via `onAcknowledge`.                                                                                                                                                                                                     |
| **Orc**      | Sturdy            | Tusks               | **Done** — Sturdy: onTargeted when 1 HP subtracts 1d6 from adversary attack before roll. Tusks: chip on successful Melee attack (spend 1 Hope for +1d6 damage) via `src/features-v2/ancestries/Orc.js`.                                                                                                                                                                                                                                                                                             |
| **Ribbet**   | Amphibious        | Long Tongue         | **Done** — Long Tongue: virtual weapon (Finesse, Close, d12 physical, +Proficiency) with `onAcknowledge({ target, self })` → `self.markStress(1)`. Amphibious: display only. Via `src/features-v2/ancestries/Ribbet.js`.                                                                                                                                                                                                                                                                            |
| **Simiah**   | Natural Climber   | Nimble              | **Done** — Natural Climber: `addAdvantageTrigger('balancing and climbing')`. Nimble: `addStatMod('evasion', 1)`. Both via `src/features-v2/ancestries/Simiah.js`.                                                                                                                                                                                                                                                                                                                                   |




### Display-only origin features (ancestries + communities)

All ancestries and communities are implemented in `src/features-v2/ancestries/` and `src/features-v2/communities/`. The following features are **intentionally** display-only (no hooks): they are purely narrative or environmental and do not require dice, resources, or state changes in the app.


| Origin     | Feature      | Description (summary)                                            | Should be display-only?                                |
| ---------- | ------------ | ---------------------------------------------------------------- | ------------------------------------------------------ |
| **Faun**   | Caprine Leap | Leap within Close range as normal movement (vault, jump, scale). | **Yes** — movement/narrative; no dice or resource.     |
| **Ribbet** | Amphibious   | Breathe air and water; move through water without penalty.       | **Yes** — environmental; no roll or state to automate. |


There are **no** community features that are display-only; all nine community features have hooks (advantage triggers, onAct/onBanner/onCard/onSessionStart).

---

## Communities (9)

**Status: Done.** All 9 communities are selectable. Community features use the same V2 modules as ancestries (`src/features-v2/communities/`); ancestry and community descriptors are merged into **`activeFeatures`** (badge by `sourceType`: ancestry = amber, community = emerald). All 9 features are automated.


| Community       | Feature          | Status                                                                                               |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Highborne**   | Privilege        | **Done** — advantage on consort/negotiate/leverage (addAdvantageTrigger)                             |
| **Loreborne**   | Well-Read        | **Done** — advantage on history/culture/politics (addAdvantageTrigger)                               |
| **Orderborne**  | Dedicated        | **Done** — onAct chip, once/rest; roll text rewritten to Hope [d20] (Dedicated)                      |
| **Ridgeborne**  | Steady           | **Done** — advantage on cliffs/harsh env/survival (addAdvantageTrigger)                              |
| **Seaborne**    | Know the Tide    | **Done** — onBanner (place token on Fear), onAct (spend token for +1), onSessionStart (clear tokens) |
| **Slyborne**    | Scoundrel        | **Done** — advantage on criminals/detect lies/hide (addAdvantageTrigger)                             |
| **Underborne**  | Low-Light Living | **Done** — advantage on hide/investigate/perceive (addAdvantageTrigger)                              |
| **Wanderborne** | Nomadic Pack     | **Done** — onCard chip, once/session spend 1 Hope (action notification + featureUsage)               |
| **Wildborne**   | Lightfoot        | **Done** — advantage on move without being heard (addAdvantageTrigger)                               |


---

## Abilities / Domain Cards (189)

**Status: Partial (UI Display + V2 migration).** All 189 abilities across 9 domains are selectable as domain cards in the character builder. They are displayed on the character sheet and hover card with name, domain, level, type, and description. **V2 feature modules** (`src/features-v2/abilities/`, registry `abilityIds`) implement engine-side chips/hooks for migrated cards; see GitHub `v2-migration` Issues and `docs/v2-migration-tracker-snapshot.md` for Done vs Unclaimed. The live Game Table banner flow for most spells remains GM-adjudicated until wired end-to-end.

9 domains × 21 abilities each:


| Domain   | Abilities | Status  |
| -------- | --------- | ------- |
| Arcana   | 21        | Partial — Tier 1 + Tier 2 Arcana spells in V2 `abilities/Arcana/` (see GitHub `v2-migration` Issues / `docs/v2-migration-tracker-snapshot.md`) |
| Blade    | 21        | Display |
| Bone     | 21        | Partial — Tier 1 Untouchable, Ferocity, Strategic Approach, Brace, Tactician, **Deft Maneuvers**, **I See It Coming** in V2 `abilities/Bone/` (see GitHub `v2-migration` Issues / `docs/v2-migration-tracker-snapshot.md`). Game Table: Deft Maneuvers card + `onRoll` weapon bonus; **I See It Coming** uses V2 review chips + `featureState` `pendingEvasionBonus` (see `PENDING_EVASION_BONUS_STATE_KEY` in `src/game-constants.js`) |
| Codex    | 21        | Display |
| Grace    | 21        | Display |
| Midnight | 21        | Partial — Tier 1 domain cards in V2 `abilities/Midnight/` (see GitHub `v2-migration` Issues / `docs/v2-migration-tracker-snapshot.md` for Done vs Unclaimed) |
| Sage     | 21        | Partial — Tier 1 Sage cards in V2 `abilities/Sage/` (see GitHub `v2-migration` Issues / `docs/v2-migration-tracker-snapshot.md`) |
| Splendor | 21        | Partial — Tier 1 Splendor cards in V2 `abilities/Splendor/` (see GitHub `v2-migration` Issues / `docs/v2-migration-tracker-snapshot.md` for Done vs Unclaimed) |
| Valor    | 21        | Display |


**Note:** Ability automation would be a massive undertaking (189 unique effects). Most are situational spells/actions for the GM to adjudicate. A few have clear dice effects that could be integrated into the roll system.

---

## Domains (9)

**Status: Partial.** Domain names are used for filtering abilities in the character builder (class → domains → available abilities). The `domains` collection is fetched by `useCharacterSrdData` but `domainsById` is built and never used. Domain metadata (flavor text, card descriptions) is not displayed.

---

## Beastforms (24)

**Status: Partial.** All 24 beastforms are served via `GET /api/srd/beastforms` and loaded by `useCharacterSrdData`. When a Druid character has the Beastform class feature or Evolution hope ability, the Game Table hover card shows a tier-filtered selector, a Transform/Drop Out button, and full in-beastform UI (attack rolls with Hope+Fear+Trait, mutually-exclusive advantage chips, trait/evasion bonus display, weapons disabled, domain cards disabled). Auto-drop triggers on last HP or Fragile damage. State is persisted via `activeBeastform` and `selectedBeastformAdvantage` in `CHARACTER_RUNTIME_KEYS`.

Not yet implemented: beastform stats in the Library browser (display-only), character builder integration (selecting a beastform from the builder is unimplemented).

**V2 engine:** All 24 beastforms have per-form modules under `src/features-v2/beastforms/` (merged onto `registry.beastforms` in `beastforms/index.js`); sub-features are appended by `loadCharacterFeatures` while that beastform is active. Druid transform state is stored only under **`featureState['classes:srd-cls-druid']`** (shared **`activeBeastform`** / **`evolutionTraitKey`**), with denormalized **`element.activeBeastform`** cleared by **`table-ops`** when the scoped bag is cleared.

| Tier | Beastforms                                                                                               | Status |
| ---- | -------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Agile Scout, Household Friend, Nimble Grazer, Pack Predator, Aquatic Scout, Stalking Arachnid            | Partial |
| 2    | Armored Sentry, Powerful Beast, Mighty Strider, Striking Serpent, Pouncing Predator, Winged Beast        | Partial |
| 3    | Great Predator, Mighty Lizard, Great Winged Beast, Aquatic Predator, Legendary Beast, Legendary Hybrid   | Partial |
| 4    | Massive Behemoth, Terrible Lizard, Mythic Aerial Hunter, Epic Aquatic Beast, Mythic Beast, Mythic Hybrid | Partial |


---

## Items (60)

**Status: Partial.** Items are served via `GET /api/srd/items`. Character inventory entries can reference SRD item ids; `loadCharacterFeatures` merges V2 item descriptors from `src/features-v2/items/` (all 60 registered). There is no dedicated SRD item picker in the character builder UI yet; automation is per-item (e.g. Gems attach to weapons, Relics grant traits). **Belt of Unity** — once per session, spend 5 Hope to lead a three-PC Tag Team Roll: `BeltOfUnity.js` wires Hope, session frequency, and an `actionLoop` table notice (Tag Team resolution remains at the table).

To implement: add an item picker to the character builder or inventory UI, display item effects consistently, and extend per-item automation where the rules allow.

---

## Consumables (60)

**Status: Partial.** Consumables are normalized in the SRD and merged from `src/features-v2/consumables/` when the character’s **inventory** lists the item name (see `loadCharacterFeatures`). There is no dedicated Library picker for consumables; automation is per-item. **Potion of Stability** — `placement: 'rest'` chip on the Short/Long Rest banner, `onUse` removes the potion and grants extra downtime slots for that rest via CONV-011 `passiveStatMods` (`docs/v2-code-conventions.md` CONV-011). Most other consumables remain narrative or unimplemented in V2.

To implement: extend per-consumable automation (combat potions, healing rolls, etc.) and optional inventory UX beyond name-based merge.

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

