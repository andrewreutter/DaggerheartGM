---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan: Clank, Drakona, Dwarf, and Elf Ancestries

Implement the four ancestries using the same builder pattern as Faun, Giant, Infernis, and Katari. **Use the project’s SRD subrepo as the first and only source for ancestry text and structure** — do not look up SRD content on the web.

---

## 1. Data source (mandatory)

**First stop for all SRD content:** the `daggerheart-srd` submodule in this repo.

- **Ancestry names, description, and feature text:** read from:
  - `daggerheart-srd/ancestries/Clank.md`, `Drakona.md`, `Dwarf.md`, `Elf.md` (one file per ancestry), or
  - `daggerheart-srd/.build/03_json/ancestries.json` (if you need programmatic access).
- Copy feature **names** and **descriptions** verbatim from these files into the ancestry builder files. Do not rely on web search or external sites for SRD wording.
- If the subrepo is missing or a file is absent, run `git submodule update --init` and re-check before using any other source.

---

## 2. Reference: existing pattern

- Each ancestry lives in `src/features/ancestries/{AncestryName}.js`.
- Export a single object: `{ name, description, onCharacterBuild(char) }`.
- `char.addFeature(name, description, hooks?)` with optional hooks: `onCharacterRender(ctx)`, `onBanner(banner)`.
- Barrel: add the new builders to the `builders` array in `src/features/ancestries/index.js`.
- Character calc already prefers `ancestryMap[ancestryName]` over SRD JSON when present, so no change needed there for “first stop” — the new files are the source once added.

---

## 3. Ancestry-by-ancestry implementation

### 3.1 Clank

**Source:** `daggerheart-srd/ancestries/Clank.md`.


| Feature               | SRD summary (from subrepo)                                                                                       | System use                                      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purposeful Design** | At character creation, choose one Experience that aligns with your purpose; gain a permanent **+1 bonus** to it. | **New:** experience bonus at build/render time. | Experiences already have a `modifier` (or `score`). Need a way to mark one experience as “purposeful design” and add +1 when that experience is used (e.g. `purposefulDesignExperienceIndex` or apply +1 in roll math when that experience is selected). May require: (1) `onCharacterRender` to expose which experience gets +1 (e.g. store index or id on character), and (2) roll builder or result path to add +1 when that experience is selected for the roll. If the app currently uses experience only for “+2 and spend Hope,” clarify whether +1 stacks or replaces; SRD says “permanent +1 bonus” — treat as an extra +1 when that experience is chosen. |
| **Efficient**         | When you take a short rest, you can choose a **long rest move** instead of a short rest move.                    | **Rest UI / cycle.**                            | No existing “rest move picker” in the app. Session/Rest buttons refresh `featureUsage` and active modifiers by cycle type. Option A: Display only (no automation). Option B: Add a rest-time choice (e.g. “Use Efficient: count this as long rest for move choice”) that the GM or player can trigger — would require a small rest-flow extension. Plan for **Display** unless we add a generic “rest move” system.                                                                                                                                                                                                                                                 |


**New system surface (if automated):**

- **Purposeful Design:** (1) Character data: store which experience gets the +1 (e.g. `purposefulDesignExperienceIndex` in builder/form, or infer “first experience” at creation). (2) Roll path: when building roll or applying result, if the selected experience is the purposeful-design one, add +1 (e.g. in `CharacterHoverCard` trait/weapon roll meta or in server roll evaluation). (3) Optional: `onCharacterRender(ctx)` to attach `ctx.purposefulDesignExperienceIndex` or similar for a single source of truth.
- **Efficient:** Display only, or later: rest-cycle UI that lets the player choose “long rest move” when taking a short rest (out of scope for minimal implementation).

---

### 3.2 Drakona

**Source:** `daggerheart-srd/ancestries/Drakona.md`.


| Feature              | SRD summary (from subrepo)                                                                                                                                                 | System use                        | Notes                                                                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scales**           | When you would take **Severe** damage, you can **mark a Stress** to **mark 1 fewer Hit Points**.                                                                           | **Damage pipeline (pre-apply).**  | Same shape as Dwarf Thick Skin but for Severe (hpLoss ≥ 3). Need a **banner chip** (or damage-step hook) visible when the target is a character with Scales and computed `hpLoss >= 3`; on accept: mark 1 Stress, reduce hpLoss by 1, then apply.                                                                          |
| **Elemental Breath** | Choose an element (e.g. electricity, fire, ice). Use as **Instinct** weapon vs target or group within **Very Close** range; **d8** **magic** damage using **Proficiency**. | **Virtual weapon + damage type.** | Same pattern as Katari Retracting Claws: `onCharacterRender(ctx)` → `ctx.addVirtualWeapon({ trait: 'Instinct', range: 'Very Close', damage: 'd8', ... })`. Damage is magic (for Warded etc.); ensure roll or post tag carries `dmg.type: 'mag'`. No onAcknowledge state change unless we add “element chosen” for display. |


**New system surface:**

- **Scales:** `onBanner(banner)` chip: `isVisible(roll)` when target is character with Drakona ancestry and computed hpLoss ≥ 3; `stressCost: 1`; `acknowledge` (or `modifyHpLoss`-style hook) reduces hpLoss by 1 before `markHp`. Pipeline today: `computeHpLoss` → `modifyHpLoss` (weapon/class) → `applyDamageToTarget`. Either: (1) ancestry chip that runs at acknowledge and passes “reduce hpLoss by 1” into `applyDamageToTarget`, or (2) an ancestry `modifyHpLoss`-style hook that the damage path calls for the target (if we add ancestry to that pipeline).
- **Elemental Breath:** Virtual weapon via `addVirtualWeapon`; damage string `d8` with magic tag so `parseDiceSub` / damage path set `dmg.type = 'mag'`. Proficiency: use existing proficiency in roll (e.g. `+proficiency` in roll text or server-side); character-calc already has `proficiency`.

---

### 3.3 Dwarf

**Source:** `daggerheart-srd/ancestries/Dwarf.md`.


| Feature                 | SRD summary (from subrepo)                                                                | System use                       | Notes                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Thick Skin**          | When you take **Minor** damage, you can **mark 2 Stress** instead of marking a Hit Point. | **Damage pipeline (pre-apply).** | When target is a Dwarf and computed hpLoss === 1 (Minor), offer chip: “Mark 2 Stress instead of 1 HP.” On accept: do not call `markHp(1)`; call `markStress(2)`.                                                                                                                                                                 |
| **Increased Fortitude** | **Spend 3 Hope** to **halve** incoming **physical** damage.                               | **Banner chip (pre-apply).**     | When target is a character with Increased Fortitude and damage is physical, show chip “Spend 3 Hope to halve damage.” On accept: deduct 3 Hope from target, then run damage with `effectiveDmgTotal = floor(dmgTotal/2)` (or equivalent in threshold math). Hope deduction and halving must happen before `applyDamageToTarget`. |


**New system surface:**

- **Thick Skin:** Same pipeline as Scales: chip visible when target is Dwarf and hpLoss === 1; `stressCost: 2`; in acknowledge, skip HP mark and call `character.markStress(2)` (and do not call `markHp` for this damage instance).
- **Increased Fortitude:** Chip when target has the feature and `dmgType === 'phy'`; `hopeCost: 3`; acknowledge: deduct 3 Hope from target, then apply damage with a “halved” flag (e.g. pass `halveDamage: true` into `applyDamageToTarget` so `effectiveDmgTotal` or threshold comparison uses half value). May need `modifyPreThresholdDamage` or a dedicated “halve before threshold” step for characters.

---

### 3.4 Elf

**Source:** `daggerheart-srd/ancestries/Elf.md`.


| Feature              | SRD summary (from subrepo)                                                           | System use                  | Notes                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick Reactions**  | **Mark a Stress** to gain **advantage on a reaction roll**.                          | **Banner chip (reaction).** | Need a way to mark a roll as a “reaction” (e.g. roll meta `_isReaction: true`). Chip visible when `roll._isReaction` (or similar); `stressCost: 1`; on activate add advantage (e.g. add d6 like other advantage chips, or set a “dominant”/advantage flag). Reuse existing advantage/roll-modifier path if possible. |
| **Celestial Trance** | During a rest, you can drop into a trance to **choose an additional downtime move**. | **Rest UI.**                | No “downtime move” picker in app. **Display only** unless we add rest-move selection.                                                                                                                                                                                                                                |


**New system surface:**

- **Quick Reactions:** (1) Roll origin: some rolls must be markable as “reaction” (e.g. from a “Reaction” button or from a feature that says “reaction roll”). (2) `onBanner(banner)` chip: `isVisible(roll) => roll._isReaction`, `stressCost: 1`, acknowledge adds advantage (e.g. add d6 to roll or set advantage flag so server/UI treats as advantage). If the app has no reaction-roll entry point yet, add a minimal one (e.g. “Reaction” in dice roller or feature tag “reaction”) and set `_isReaction: true` in roll meta.
- **Celestial Trance:** Display only.

---

## 4. System features to add or reuse


| Capability                                                      | Used by                               | Current state                                                                  | Action                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Experience +1 (one chosen experience)                           | Clank Purposeful Design               | Experiences have modifier; roll path uses selected experience for +2 and Hope. | Store which experience gets +1 (form + runtime); add +1 in roll total when that experience is selected.               |
| Short/rest move choice (Efficient, Celestial Trance)            | Clank Efficient, Elf Celestial Trance | No rest-move UI.                                                               | Implement as **Display** only for this plan.                                                                          |
| Damage-step option: “Spend Stress to reduce HP taken” (Severe)  | Drakona Scales                        | No ancestry in damage pipeline.                                                | Banner chip or `modifyHpLoss`-style hook for target ancestry; chip: mark 1 Stress, reduce hpLoss by 1.                |
| Damage-step option: “Spend Stress instead of taking HP” (Minor) | Dwarf Thick Skin                      | Same as above.                                                                 | Banner chip: mark 2 Stress, skip 1 HP.                                                                                |
| “Spend Hope to halve physical damage” (pre-apply)               | Dwarf Increased Fortitude             | No pre-apply Hope-for-reduction chip.                                          | Banner chip before Apply: hopeCost 3, then apply damage with halved value (new flag or param in applyDamageToTarget). |
| Virtual weapon (Instinct, Very Close, d8 magic)                 | Drakona Elemental Breath              | Retracting Claws pattern; weapon features have magic tag.                      | `addVirtualWeapon`; ensure damage is tagged magic in roll/banner.                                                     |
| Reaction roll + “Spend Stress for advantage”                    | Elf Quick Reactions                   | Advantage chips exist; no “reaction” roll type.                                | Define `_isReaction` and a way to start a reaction roll; chip: stressCost 1, add advantage.                           |


---

## 5. Implementation order

1. **Data source:** Confirm `daggerheart-srd/ancestries/{Clank,Drakona,Dwarf,Elf}.md` (or `.build/03_json/ancestries.json`) and copy exact text into builders.
2. **Drakona:** Elemental Breath (virtual weapon) and Scales (banner chip for Severe → Stress for −1 HP). Establishes damage-reduction chip pattern.
3. **Dwarf:** Thick Skin (chip: Minor → 2 Stress instead of 1 HP) and Increased Fortitude (chip: 3 Hope to halve physical damage). May require `applyDamageToTarget` to accept a “halve damage” or “effective total” override for the target.
4. **Elf:** Quick Reactions (reaction roll + chip for 1 Stress for advantage); Celestial Trance = Display.
5. **Clank:** Purposeful Design (experience +1 wiring); Efficient = Display.
6. **Barrel:** Register all four in `src/features/ancestries/index.js`.
7. **Docs:** Update `docs/srd-implementation.md` ancestry table and summary counts; update `.cursor/rules/project.mdc` if you add new hooks or pipeline behavior.

---

## 6. Files to touch

- **New:** `src/features/ancestries/Clank.js`, `Drakona.js`, `Dwarf.js`, `Elf.js` (content from subrepo only).
- **Edit:** `src/features/ancestries/index.js` (add builders).
- **Edit (if needed):** `src/client/components/GMTableView.jsx` (damage path: ancestry chips, halve option, or `modifyHpLoss` for ancestry); `CharacterHoverCard.jsx` or roll builder if we add reaction roll or experience +1.
- **Edit:** `docs/srd-implementation.md` (ancestry table: Clank, Drakona, Dwarf, Elf status; summary counts).
- **Edit:** `.cursor/rules/project.mdc` (ancestry list and any new system behavior).

---

## 7. Summary: per-ancestry system usage


| Ancestry    | Features                          | System features used                                                                           |
| ----------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Clank**   | Purposeful Design, Efficient      | Experience bonus at roll time (new); rest = Display.                                           |
| **Drakona** | Scales, Elemental Breath          | Banner chip (Severe → 1 Stress for −1 HP); virtual weapon (Instinct, Very Close, d8 magic).    |
| **Dwarf**   | Thick Skin, Increased Fortitude   | Banner chip (Minor → 2 Stress instead of 1 HP); banner chip (3 Hope to halve physical damage). |
| **Elf**     | Quick Reactions, Celestial Trance | Banner chip (reaction roll: 1 Stress for advantage); rest = Display.                           |


All feature names and description text must come from `daggerheart-srd/ancestries/*.md` (or `ancestries.json`) in this repo — no web lookup for SRD content.