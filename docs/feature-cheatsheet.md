# Feature System Cheat Sheet

**Context convention:** Each hook receives a **context object** made of **named subdocuments**. Subdocuments with the same name have the **same shape** everywhere (e.g. `roll` is always the wrapped roll; `character` is always the wrapped entity). **feature** is always the **feature descriptor object** (the object that defined the hook — name, description, hooks). Section 3 lists which subdocuments each hook receives; Section 4 defines each subdocument’s shape once.

---

## 1. The feature object

A feature is an object with:

- `**name`** — string; identifies the feature in registries and UI.
- `**description`** — optional string; flavor/rule text (often from SRD).
- **Hooks** — functions the system calls at specific times (see Section 3). Keys like `onCharacterRender`, `modifyPreThresholdDamage`, etc. The shipped Game Table **does not** call a root **`onBanner`** hook; use **`chips`** with **`placement: 'banner'`** (and **`isVisible(chipContext)`**, **`onBannerAck`**, **`onBannerReject`**) instead — **no** legacy **`acknowledge`** / **`cancel`** aliases on those chip descriptors. Weapon banner narration uses **`automated: true`** plus **`description`** on the merged weapon row; pending-roll narrations merge via **`buildRollBaseBannerNarrationParts`** / **`buildWeaponTagBannerNarrationParts`** in **`game-table-mechanics.js`**.
- **Declarations** — declarative options the system reads without calling you (see Section 2). Keys like `passiveStatMods`, `cardChips`, `automated`, `armorReduction`, etc.

You implement a feature by defining the right hooks and declarations for the behavior you want. The same descriptor shape is used regardless of where the feature lives.

### Registries and attachment

SRD feature modules live under **`src/features-v2/`**, grouped by collection (`ancestries/`, `communities/`, `classes/`, `subclasses/`, `weapon_properties/`, `armor_properties/`, `abilities/`, `beastforms/`, …). **`src/features-v2/registry.js`** composes the full registry consumed by **`loadCharacterFeatures`** in the V2 engine. **`character-calc.js`** merges SRD rows with those descriptors and produces a flat **`activeFeatures`** array on each character for the Game Table and sheet.

- **How the feature is attached to the character** — Origin and class features come from character build (SRD resolution); weapon and armor properties come from equipped items. The merge pipeline attaches matching rows to **activeFeatures**.
- **Which invocation paths see it** — Hooks run over **activeFeatures** (all types together). Weapon **tag** names on a roll are matched to a row via helpers in **`game-table-mechanics.js`** (e.g. `resolveWeaponTagDescriptor`) that scan **activeFeatures** — not a separate tag registry import.

There is no behavioral branching on “source type.” `**source`** and `**sourceType`** on descriptors are for UI only (badges, toggle keys). Dispatch does not check them.

**Authoring reference:** `docs/feature-authoring-guide.md`, `docs/v2-code-conventions.md`.

---

## 2. Menu of declarations

Declarative options the system reads from the feature descriptor. Only include those you use.


| Declaration                 | Purpose                                                                                                                                                                                                                                                                                                                         | Registry note                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **passiveStatMods**         | Stat modifiers (e.g. `{ maxHp: 1 }`, `{ evasion: 1 }`, `{ traits: { agility: 1 } }`, `{ rollModifiers: [{ trait, bonus, label }] }`, `{ majorThreshold: 1 }`, `{ severeThreshold: 1 }`). Applied at character computation; no banner tag. Threshold mods feed effectiveThresholds (damage pipeline).                            | Origin, class, weapon, armor (weapon/armor via computeWeaponModifiers / computeArmorModifiers). |
| **chips**                   | **Unified chip array** for all chip placements. Each chip must have `placement: 'card'                                                                                                                                                                                                                                          | 'preroll'                                                                                       |
| **cards**                   | Declarative **sheet** and/or **editor** cards. Each entry: **`placement`**: `'sheet'` \| `'editor'` (legacy bare `when()`/object ⇒ sheet). Optional **`shape`**: `{ id, version, bind, anchors?, jsonSchema }` (file-local on the feature module — **not** a separate `shapes/` export). **`resolve`**: `when(...)` / object / `(table) => object`. **`collectSheetCards`** / **`collectSheetCardsForCharacter`** (sheet + `buildTableSnapshot`); **`collectEditorCards`** / **`collectEditorCardsForCharacter`** (editor + `buildEditorTableStub`). Resolved data carries **`shapeId`**; JSON Schema may use DH types **`trackedState`**, **`attack`** (see authoring guide). Roll actions beside a card use **`chips`** with **`placements: [shape]`** (same ref as **`cards[].shape`**); **`onUse`** may call **`table.sheet.actionRoll`** for VTT dice. Generic UI: `DeclarativeSchemaCard.jsx`. **`hideFromGuideFeatureList`** omits a registry-only row from guide ordering when merged. See `chip-system.js` (`normalizeCardEntry`, `buildCardsForFeature`). | Subclass (Beastbound companion).                                                         |
| **advantageTriggers**       | Array of strings (e.g. `['intimidate hostile creatures']`). One advantage chip per condition.                                                                                                                                                                                                                                   | Origin.                                                                                         |
| **experienceBonus**         | Number (e.g. `1`). Form requires one experience choice for +N in experienceBonusChoices[featureName].                                                                                                                                                                                                                           | Origin (ancestry only).                                                                         |
| **automated**               | If true, tag on roll banner shown as “(applied)” style.                                                                                                                                                                                                                                                                         | Weapon.                                                                                         |
| **showTag**                 | If true, feature is shown as a tag on the roll banner (opt-in).                                                                                                                                                                                                                                                                 | Weapon.                                                                                         |
| **skipTag**                 | If true, this feature is not shown as a tag (e.g. when another feature represents it).                                                                                                                                                                                                                                          | Weapon.                                                                                         |
| **tagText**                 | String or (ctx?) => string. Label for the tag on the roll banner.                                                                                                                                                                                                                                                               | Weapon.                                                                                         |
| **prependRollParts**        | string[]. Tokens prepended to weapon roll text (e.g. `['Reliable [1]']`).                                                                                                                                                                                                                                                       | Weapon.                                                                                         |
| **appendRollParts**         | string[]. Tokens appended to weapon roll text (e.g. `['Lifesteal [d6]']`).                                                                                                                                                                                                                                                      | Weapon.                                                                                         |
| **rewriteDamage**           | ({ roll, ...ctx }) => void. Mutates `roll.damageStr` to transform damage string. Reads `damageStr` from `roll.damageStr` in context.                                                                                                                                                                                            | Weapon.                                                                                         |
| **bannerStatus**            | () => { text?, style? }. Status text/style on banner.                                                                                                                                                                                                                                                                           | Weapon.                                                                                         |
| **bannerInteraction**       | Object: `{ type: 'target-picker', phase: 'post-apply', loop?, prompt?, skipLabel? }`. Post-apply target-picker (e.g. Quick, Bouncing).                                                                                                                                                                                          | Weapon.                                                                                         |
| **interactive**             | If true, tag gets interactive UI (e.g. Quick, Devastating).                                                                                                                                                                                                                                                                     | Weapon.                                                                                         |
| **armorReduction**          | Number. Slots cleared per “use armor” (default 1); e.g. Fortified = 2.                                                                                                                                                                                                                                                          | Armor.                                                                                          |
| **allowsArmorFor**          | `'phy'`                                                                                                                                                                                                                                                                                                                         | `'mag'`. “Use armor” only shown for that damage type.                                           |
| **hopeAbility**             | Descriptor for the class hope ability (name, description, etc.).                                                                                                                                                                                                                                                                | Class.                                                                                          |
| **forceActionNotification** | If true, feature use always posts an action notification for GM ack (e.g. Elemental Incarnation).                                                                                                                                                                                                                               | Class.                                                                                          |
| **requiresInput**           | Spec object for player input before dispatch (e.g. Sorcerer Channel Raw Power): `{ type, label, min?, max?, default? }`.                                                                                                                                                                                                        | Class.                                                                                          |
| **sessionStartOnce**        | If true, onSessionStart is called once with `feature: null`, `featureState: null` and `characters` (e.g. Halfling Luckbringer).                                                                                                                                                                                                 | Origin.                                                                                         |
| **virtualWeapon**           | Single virtual weapon object: `trait`, `range`, `damage`, `description`, optional `stressCost`, `hopeCost`, `onAcknowledge({ target, self, roll })`, `damageType`, `damageProficiency`, `multiTarget`, `multiTargetMax`. Character-calc merges into weapons; ancestry barrel registers onAcknowledge in virtualWeaponBehaviors. | Origin.                                                                                         |
| **virtualWeapons**          | Array of virtual weapon objects (same shape as virtualWeapon).                                                                                                                                                                                                                                                                  | Origin.                                                                                         |
| **weaponsFilter**           | `(weapons) => weapons`. Called with the current weapons list (after declarative virtualWeapons are merged); return value replaces the list (e.g. Giant Reach: Melee → Very Close).                                                                                                                                              | Origin, class.                                                                                  |
| **computeWeaponRenderHints** | `(table, character?, registry?) => { [weaponId]: { hideDevastatingCardToggle?, hideChargedVariantCard?, … } }`. Optional. Per-weapon UI hints merged into **`weaponRenderHints`** for **`CharacterDisplay`** (e.g. Devastating **`hideDevastatingCardToggle`**, Charged **`hideChargedVariantCard`** when the Game Table **intent** strip owns the control). | Weapon, items (e.g. Flickerfly Pendant).                                                        |


Chip descriptor fields (label, hopeCost, stressCost, isVisible, getDisabledMessage, onChipAck, onChipReject, onBannerAck, onBannerReject, toggleKey, render, renderWhenOff, activate, isActive, resetsOn, damageModifierWhenActive) are documented in Section 4 (banner) and Section 3 (onChipAck). **Banner**-placement chips use the unified context shape: `{ roll, character, feature, characters, system, banner }` (Section 4.15).

**V2 chip properties (chip-system.js):**
- `showOnOtherSheets` *(boolean)*: **Cross-sheet:** Opt-in for `collectChipsForOtherCharacterSheets` so a chip can be shown under **Modifiers** (`crossSheetChips`) with `table.me` = viewer — including when the viewer **owns** the feature (e.g. Bard **Rally** on the Bard's sheet) as well as on other PCs' sheets. See `chip-system.js` and `docs/feature-authoring-guide.md` B.2. **Banner / `collectV2ReviewActionChips`:** With a **viewer** (GM vs assigned player), `collectPhaseChipsOnly` includes owner-only chips (falsy `showOnOtherSheets`) only for the **GM** and the **feature owner’s** player; chips with `showOnOtherSheets: true` are omitted from that pass for non-owners and merged from cross-sheet collection. For **`viewer.role === 'player'`**, cross-sheet runs for the assigned PC **and** the pending roll’s PC **`actorInstanceId`** when it differs (preview-as-player vs ally actor). Omit `viewer` in tests for legacy unfiltered pass-1 behavior.
- `selectTargets` *(function)*: `(table) => Actor[]`. Returns valid combat target actors for a target picker UI. Selected instance IDs stored in chip state as `selectedTargetIds` (array). Read via `chip.get('selectedTargetIds')` in `onUse`.
- `multiSelect` *(boolean)*: When `true` (with `selectTargets`), player can select multiple targets. Default single-select.
- `persistToggle` *(boolean, optional)*: For **`isToggle`** chips, defaults **`true`** — the framework persists on/off under a deterministic key (`getV2ToggleStateKey` in `chip-system.js`) in `table.source` (subclass features) or `table.feature` (default). **Gated** review toggles (`_gatedHookFn` from the action loop) do **not** use this bag — they flip **`chipState` only** between activations. Set **`false`** for UI-only toggles that must not persist (e.g. one-shot review chips). **Do not** manually `table.source.set` / `table.feature.set` boolean toggle state for normal card toggles; use **`toggleIsOn(table, feature, chip)`** in predicates.
- `toggleScope` *(optional)*: `'source'` | `'feature'` — overrides automatic bag choice (subclass → source; otherwise feature).

**V2 declarative (armor properties, `applyDeclarativeFeatures`):**
- **`substituteArmorForHope`**: When `true` on a feature, the loader sets `substituteArmorForHope` on its return value; the client merges that onto the character element so `table.me.substituteArmorForHope` authorizes `spendHope(..., { armorInstead: true })`. The engine must not check SRD feature names (**CONV-029**).

**V2 Game Table snapshot (`table` in hooks / `passiveStatMods`):**
- **`table.me.companion`**: Read-only Beastbound companion payload on characters (same shape as `element.companion`). Used by declarative **`cards`** `when()` predicates — not feature-specific engine logic.
- **`table.source`**: Registry row the active feature was collected from (class, weapon, armor, …). **Prefer this** for tier, damage strings, and other registry fields. Shared option-level state: set **`sourceScopeKey`** on the registry row; details in `docs/feature-authoring-guide.md` §2.1 (**CONV-035**).
- **`table.action.useArmorByTargetId`**: `{ [instanceId]: boolean }` — per-target commitment to use armor for this hit (VTT/banner). **`useArmor`** on `{ type: 'damage' }` entries in `table.action.effects` mirrors the same for that effect’s target. See `docs/feature-authoring-guide.md` §C.3 (CONV-026).
- **`table.me.activeModifiers`** (read-only) and **`addActiveModifier(mod)`** / **`removeActiveModifier(id)`** — queue **`appendActiveModifier`** / **`removeActiveModifier`** mutations (same shape as Phase 1 **`element.activeModifiers`**). Host merges with **`applyV2ActiveModifierMutations`** in `src/client/lib/table-ops.js`.

---

## 3. Menu of hooks

Each hook: **name**, **when it runs**, **Context: list of subdocument names** with Section 4 reference. Pipeline hooks receive `(value, context)`; all others receive a single context object (or context as the only parameter).

### Banner and chips

- **chips (`placement: 'banner'`)** — Declared on the feature descriptor; GMTableView collects one **banner reaction** per chip (visibility via **`chip.isVisible(chipContext)`**, unified context 4.15 + **`banner`**). No root **`onBanner`** callback.
- **onChipAck** / **onChipReject** — User clicks Ack/Reject on a banner chip. **Context:** `roll` (4.3), `character` (4.2), `banner` (4.1 stub: addNarration, addDamage, setTreatAsMissForTarget), `feature` (4.11), `featureState` (4.6), `characterRaw`, `characters` (4.9).
- **onBannerAck** (chip) — When GM acknowledges the whole banner after the chip path ran. **Context:** `roll` (4.3), `character` (4.2), `feature` (4.11), `featureState` (4.6), `characterRaw`, `postRoll`, `system` (4.8). (**Do not** use a property named **`acknowledge`** — GMTableView only invokes **`onBannerAck**`.)
- **onBannerReject** (chip) — When GM cancels the banner (optional). (**Do not** use **`cancel`** — only **`onBannerReject`**.)
- **onBannerAck** (weapon) — When GM acknowledges; per tag per target. **Context:** `roll` (4.3), `target` (4.2), `system` (4.8).

### Character computation

- **onCharacterEdit** — Ancestry barrel only, immediately after feature is registered. **Context:** `char` (builder; addExperienceBonus(amount)).

### Pre-roll

- **chips** (declarative, `placement: 'preroll'`) — Pre-roll chips are declared on the feature as **chips** with `placement: 'preroll'`. Each chip may define **isVisible** and **onUse** (see Section 4). Chips are collected by the runner from the descriptor; no **onAct** hook.
- **chip.isVisible** (preroll) — When building the pre-roll banner; decides whether (and how many) chips to show. **Signature:** `(ctx) => boolean | number`. Return `true` for one chip, number N > 0 for N copies, or false/0 to hide. **Context:** unified chip context (4.15): `{ roll, character, feature, characters, system }`. Legacy signature `(roll, featureState, context?)` is still supported for backward compatibility.
- **chip.onUse** (preroll) — When the user has selected the chip and clicks Proceed, before the roll is sent. **Signature:** `(ctx) => void`. **Context:** unified chip context (4.15): `{ roll, character, feature, characters, system }`. Use `ctx.roll.addAdvantageDie(name)`, `ctx.roll.setFromText(text)`, `ctx.feature.get`/`set`, `ctx.system.postRoll`, etc.
- **onRoll** — After Proceed or when no banner; roll text finalized. **Context:** `roll` (4.3), `characters` (4.9), `feature` (4.11); hooks inject `source`.

### Rest and session

- **onRest** — When building rest move options (getRestMovesForCharacter). **Context:** `rest` (4.4), `feature` (4.11).
- **onSessionStart** — When GM clicks Start Session and acknowledges. **Context:** `characters` (4.9), `feature` (4.11 with get/set), `character` (4.2). When **sessionStartOnce: true**, called once with `feature: null` and `characters` = all party characters; otherwise called per character with `feature` = descriptor + get/set.

### Targeted (adversary targets character)

- **onTargeted** — When an adversary attack targets this character, before roll is posted. **Context:** `roll` (4.3, mutable pending), `character` (4.2), `characters` (4.9), `system` (4.8), `feature` (4.11).

### Before-mark lifecycle

- **onMarkStress** — Just before marking stress (origin-lifecycle). **Context:** `character` (4.2), `amount`, `markSource`, `source` (feature.source), `feature` (4.11), `rollDice`, `featureName`, `postAction`, `characters` (4.9), `system` (4.8) when in table context.
- **onMarkHP** — Just before marking HP. **Context:** `character` (4.2), `amount`, `markSource`, `source`, `feature` (4.11), `characters` (4.9), `system` (4.8) when in table context.
- **onMarkArmor** — Just before marking an armor slot. **Context:** `character` (4.2), `amount`, `markSource`, `source`, `feature` (4.11), `characters` (4.9), `system` (4.8) when in table context.

### Damage pipeline

- **modifyPreThresholdDamage** — In applyDamageToTarget, before threshold/HP. **Signature:** (context). **Context:** `damagePipelineCtx` (4.7), which includes `characters` (4.9), plus `feature` (4.11) per participant. Read the current damage from `roll.damageTotal` and return the new value; the pipeline updates `roll.damageTotal` with the result. `roll._initialDamageTotal` stores the original value before any modifications.
- **modifyHpLoss** — After threshold computation, before armor reduction. **Signature:** (context). **Context:** `damagePipelineCtx` (4.7), which includes `characters` (4.9), plus `feature` (4.11) per participant. Read the current HP loss from `roll.hpLoss` and return the new value; the pipeline updates `roll.hpLoss` with the result. `roll._initialHpLoss` stores the original value before any modifications.
- **onBeforeDamageApplied** — Before applying damage (e.g. Parry); async. **Signature:** (context). **Context:** `target` (4.2), `roll` (4.3), `feature` (4.11), `system` (4.8), `effectiveDmgTotal` (number), `characters` (4.9). Returns the new damage total (number).
- **onAfterMarkArmor** — After the system marks an armor slot. **Context:** `character` (4.2), `amount: 1`, `source` (feature name), optional `roll`, `postRollSilent`, `tagNames`, `dmgType`, `characters` (4.9), `feature` (4.11).
- **onLastArmorSlot** — When the last armor slot would be marked (e.g. Resilient). **Context:** `character` (4.2), `system` (4.8), `characters` (4.9), `feature` (4.11). **Return:** Promise<{ saveSlot: boolean }>.
- **onDamageReceived** — After HP applied to character target. **Context:** `character` (4.2), `dmgTotal`, `hpLoss`, `updateActiveElement`, `characters` (4.9), `feature` (4.11).
- **onHpDealt** — After attacker deals ≥1 HP to target. **Context:** `character` (4.2, attacker), `hpDealt`, `target` (4.2), `updateActiveElement`, `characters` (4.9), `feature` (4.11).

### Class and weapon dispatch

- **onFeatureActivated** — After _featureUse banner acknowledged (class dispatch). **Context:** `featureName`, `subFeatureName`, `inputValue`, `targetEl` (raw or null), `selfEl` (4.2), `updateActiveElement`, `roll` (4.3), `characters` (4.9), `feature` (4.11), `system` (4.8).
- **onRollComplete** — After roll is sent (weapon features). **Context:** `attacker`, `roll` (4.3), `characters` (4.9), `system` (4.8), `feature` (4.11).

### Card chips

- **cardChips.onUse** — Card chip “Use” clicked (getCardChipContext provided). **Context:** cardChipContext (4.10): `{ roll, character, feature }` plus `characters` (4.9), `system` (4.8) when in table context. `roll` is null on the feature card. `character` has postTraitRoll/postAction when in card context. `feature` has get/set (4.11).
- **cardChips.onToggle** — Card toggle chip acknowledged by GM. **Signature:** (context). **Context:** `character` (4.2), `chip` (4.14: `{ isActive }`), `feature` (4.11 with get/set), `characters` (4.9), `system` (4.8).

---

## 4. Context subdocuments

Same name = same shape across all hooks. Define each once here.

### 4.1 banner

Object built by GMTableView when a feature has **`chips`** with **`placement: 'banner'`**. Passed at ack time into **onChipAck** / **onChipReject**; also **`chipContext.banner`** for **`chip.isVisible(chipContext)`** on banner chips.

**Methods:**  

- `addChip(descriptor)` — register a chip (used while building the in-memory banner shell).  
- `addNarration(text, style?)` — add narration line; optional style e.g. `'automated'`.  
- `addAutomatedNarration(text)` — same as addNarration(text, 'automated').  
- `addDamage(expr)` — add extra damage; cancels current banner and creates new one with augmented roll.  
- `setTreatAsMissForTarget(instanceId)` — selected target takes no HP/Stress from this roll (e.g. Faerie Wings).

**Internal / ack-time:** chips, _narrations, _rollRef, _featureName, _extraDamage, _narration. Chip descriptor shape: label, hopeCost, stressCost, **isVisible(chipContext)** (unified context 4.15 + **banner**), getDisabledMessage(roll, character, featureState?), onChipAck(context), onChipReject(context), onBannerAck(context), onBannerReject?, toggleKey, render(roll, character), renderWhenOff, activate, isActive, resetsOn, damageModifierWhenActive (hopeCost?, stressCost?, dmgType?, apply(total)=>number). Banner object at ack has **feature** (4.11), **featureState** (4.6).

### 4.2 entity (character / target / char)

Returned by **wrapEntity(el, updateActiveElement, options?)** from **`src/client/lib/table-entity-roll.js`** (re-exported by **`game-table-mechanics.js`**). Every hook that receives a “character” or “target” gets this wrapper.

**Identity:** instanceId, id (alias), name, class, maxStress, maxHp, maxHope, maxArmor.  
**Snapshot getters:** currentStress, currentHp, hope, currentArmor (reflect in-call mutations).  
**Mutators:** markStress(n), clearStress(n), markHp(n), clearHp(n), markArmor(n), clearArmor(n), spendHope(n), gainHope(n), setFlag(key, value), setFeatureUsed(featureKey, cycle), addCondition(name), addResistance(type, source), removeResistance(type, source), addModifier(modifier), addDisadvantage(source), removeDisadvantage(source), disableMove(source), enableMove(source).  
**Helper:** hasStress(n) — true when at least n stress boxes are empty.  
**Optional (when caller passes options):** **postTraitRoll(traitKey, options?)** — post a trait roll (Hope/Fear + trait); **postAction(customLabel?)** — post an action banner. When options are omitted, these are no-ops.

### 4.3 roll

Returned by **wrapRoll(roll, displayStore?, characterInstanceId?)** from **`src/client/lib/table-entity-roll.js`**. **`wrapBanner`** is exported from the same module. The **pre-roll** roll (before the roll is sent) is a separate wrapper built in the view with the same semantic methods.

**Read-only / derived:** isWithFear, isWithHope, isReaction, isMine, hasDuality, hasDamage, isSuccess, isFailure, hasExperience, attackRange, trait (e.g. { name: 'Agility' }).  
**Sub-item getters:** attackRoll, damageRoll (wrapped sub-items with .values(), .hasValue(n) or null).  
**Objects:** attacker { id, name, isMe }, target { id, name, isMe, rangeFromMe }.  
**Helpers:** sub(pattern), isAttacker(character), isTarget(character), isSourceWeapon(source).  
**Mutators:** reroll('Hope'|'Fear'|'Duality'), fullReroll(), reduceHPLoss(n), setDamageTotal(n). With displayStore + _rollDbId: setWithHope(), setDominantForDisplay(dominant).  
**Pre-roll only:** setFromText(text), setDisplayName(name), setMeta(m); addAdvantageDie(name), addDisadvantage(name), addRollBonus(n), removeDisadvantage(); rollText, displayName, meta get/set; getFinalRollText().

### 4.4 rest

Passed to **onRest**. Built in getRestMovesForCharacter.

**Properties:** shortMoves, longMoves (mutable arrays), shortMoveSlots, longMoveSlots, shortSlotLabels, longSlotLabels.  
**Methods:** addShortMove(move), addLongMove(move), addShortMoveSlot(name?), addLongMoveSlot(name?). Move shape: { id, name, description, canTargetAlly?, rollDice?, onApply(rest, roll, target, char)? }.

### 4.5 canvas (pre-roll chips)

Pre-roll chips are populated from **descriptor.chips** with `placement: 'preroll'`. The runner injects `_featureName`, `_featureKey` (when `resetsOn` is set), and a default **isVisible** ("my roll and not yet used") when omitted.

**Pre-roll chip hooks (on each chip descriptor with `placement: 'preroll'`):**

- **isVisible(ctx)** — Optional. Called when building the pre-roll banner. Return `true` (one chip), number N > 0 (N copies), or false/0 (hide). **Context:** unified chip context (4.15): `{ roll, character, feature, characters, system }`. Legacy signature `(roll, featureState, context?)` is still supported for backward compatibility.
- **onUse(ctx)** — Optional. Called when the user selected the chip and clicked Proceed, before the roll is sent. **Context:** unified chip context (4.15): `{ roll, character, feature, characters, system }`. Use `ctx.roll.addAdvantageDie(name)`, `ctx.roll.setFromText(text)`, `ctx.feature.get`/`set`, `ctx.system.postRoll`, etc.

Roll mutators (before send): `roll.addAdvantageDie(name)`, `roll.addDisadvantage(name)`, `roll.removeDisadvantage()`, `roll.addRollBonus(n)`, `roll.setFromText(text)`; `roll.rollText`, `roll.meta` get/set.

### 4.6 featureState

Per-feature persistent state (get/set). **feature** (4.11) is always augmented with **get(key, default?)** and **set(key, value)** whenever it appears in context (backed by character._originFeatureState[featureName]). Use **context.feature.get** / **context.feature.set** in hooks; a separate **featureState** key is still passed on the banner object for backward compatibility.

### 4.7 damagePipelineCtx

Passed to **modifyPreThresholdDamage** and **modifyHpLoss**.

**Properties:** target (4.2), character (4.2), tagNames (Set), roll (4.3), dmgType ('phy'|'mag'|''), characters (4.9). The `roll.damageTotal` property is kept in sync with the damage pipeline accumulator (updated after each hook); `roll._initialDamageTotal` stores the original damage value before any modifications. The `roll.hpLoss` property is kept in sync with the HP loss pipeline accumulator (updated after each hook); `roll._initialHpLoss` stores the original HP loss value before any modifications.

### 4.8 system

When present, `context.system` is a subdocument supplied wherever the view can construct it (e.g. GM Table). It may be omitted in headless or other contexts. **onCharacterEdit** is the only hook that does not receive `system` (character editing can run in the Library without a table).

**Properties:**  

- **postRoll(rollText, displayName, rollMeta?)** — perform a server roll.  
- **postRollSilent(rollText, displayName)** — perform a server roll without creating a banner (e.g. Parry, Resilient).  
- **addActionBanner(notification)** — show an action banner in DiceRoller (e.g. Resilient d6 result).

### 4.9 characters

Array of wrapped entities (4.2) — all current party characters on the table. Passed to **onSessionStart** and, where easily available (table/game view), to most other hooks that run in that context: **onChipAck** / **onChipReject**, **onRoll**, **onTargeted**, **onMarkStress** / **onMarkHP** / **onMarkArmor**, **modifyPreThresholdDamage** / **modifyHpLoss** (via damagePipelineCtx), **onAfterMarkArmor**, **onLastArmorSlot**, **onBeforeDamageApplied**, **onDamageReceived**, **onHpDealt**, **onFeatureActivated**, **onRollComplete**, **cardChips.onToggle**.

### 4.11 feature (descriptor)

The **feature descriptor object** that defined the hook — the same object that was registered (name, description, hooks, declarations). Supplied in the context for **every** hook so handlers can read `feature.name`, `feature.description`, or other descriptor fields without closure. Same shape everywhere.

### 4.15 unified chip context

**Unified context for all chip types** (card, preroll, banner). All chip hooks (`isVisible`, `onUse`, `onToggle`, `onChipAck`, `onChipReject`) receive this context.

**Shape:** `{ roll, character, feature, characters?, system?, banner? }`. Properties not applicable to the current placement are undefined:

- **roll:** 4.3 (wrapped roll). Present for preroll and banner chips; `null` for card chips on the feature card.
- **character:** 4.2 (the character). Always present.
- **feature:** 4.11 with get/set. Always present.
- **characters:** 4.9 (all party characters). Present when in table context.
- **system:** 4.8 (postRoll, postRollSilent, addActionBanner). Present when in table context.
- **banner:** 4.1 (banner object with addChip, addNarration, etc.). Present only for banner chips.

For card chips in card context, `character` has `postTraitRoll(traitKey, options?)` and `postAction(customLabel?)`. For toggle chips, context also includes **chip** (4.14: `{ isActive }`).

### 4.14 chip (card toggle)

Passed in the **context** to **cardChips.onToggle** when the GM acknowledges the toggle (e.g. Galapa Retract).

**Properties:** **isActive** (boolean) — whether the chip has been toggled on (true) or off (false).

---

## 5. Hook dispatch

**Shipped client (merged `activeFeatures`):**

- **`runCharacterHook(activeFeatures, hookName, context)`** — Fire-and-forget over the flat list. Injects **`source`** (`feature.source`) and **`feature`** (descriptor). Implemented in **`src/client/lib/feature-hook-dispatch.js`** and re-exported by **`src/client/lib/game-table-mechanics.js`**.

**Historical (removed Phase 1 stack):** Map-based **`runHook` / `runPipelineHook`** over separate feature maps, and **`runCharacterPipelineHook`**, lived under the deleted **`src/features/`** tree. The Game Table no longer bundles those dispatchers; iterate **`activeFeatures`** in host code or use the V2 engine / **`game-table-mechanics.js`** resolvers for tag-scoped behavior.

---

## 6. Registries and imports

- **V2 registry:** `src/features-v2/registry.js` composes class, subclass, ancestry, community, weapon/armor property, ability, beastform, and other modules for **`loadCharacterFeatures`** / **`character-calc`**. Character elements carry merged **`activeFeatures`** (flat descriptor rows), not a separate Phase 1 registry import.
- **Entity/roll wrappers:** **`wrapEntity`**, **`wrapRoll`**, **`wrapBanner`** — `src/client/lib/table-entity-roll.js` (re-exported by **`game-table-mechanics.js`**).
- **Character hook dispatch:** **`runCharacterHook`** — `src/client/lib/feature-hook-dispatch.js` (re-exported by **`game-table-mechanics.js`**).
- **Weapon/armor tag resolution (no registry map import):** **`resolveWeaponTagDescriptor`**, **`resolveParryWeaponFeature`**, and related helpers in **`game-table-mechanics.js`** read **`activeFeatures`** on the character element.
- **Lifecycle:** `runBeforeMarkStress`, `runBeforeMarkHP`, `runBeforeMarkArmor` from `src/client/lib/origin-lifecycle.js` (iterate **`activeFeatures`**).

---

## 7. Quick reference: hook → context subdocuments


| Hook                     | Context subdocuments (Section 4)                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| chip.isVisible (banner)  | unified chip context (4.15): roll (4.3), character (4.2), feature (4.11), characters (4.9), system (4.8), banner (4.1)                          |
| chip.isVisible (preroll) | unified chip context (4.15): roll (4.3), character (4.2), feature (4.11), characters (4.9), system (4.8)                                         |
| chip.onUse (preroll)     | unified chip context (4.15): roll (4.3), character (4.2), feature (4.11), characters (4.9), system (4.8)                                         |
| onRoll                   | roll (4.3), characters (4.9), system (4.8), feature (4.11), source                                                                               |
| onRest                   | rest (4.4), feature (4.11)                                                                                                                       |
| onChipAck / onChipReject | roll (4.3), character (4.2), banner (4.1), feature (4.11), featureState (4.6), characterRaw, characters (4.9), system (4.8)                      |
| onBannerAck (chip)       | roll (4.3), character (4.2), feature (4.11), featureState (4.6), characterRaw, postRoll, system (4.8)                                            |
| onBannerAck (weapon)     | roll (4.3), target (4.2), system (4.8)                                                                                                           |
| onSessionStart           | characters (4.9), system (4.8), feature (4.11), featureState (4.6; null when sessionStartOnce)                                                   |
| onTargeted               | roll (4.3), character (4.2), characters (4.9), system (4.8), feature (4.11)                                                                      |
| onMarkStress             | character (4.2), amount, markSource, source, feature (4.11), rollDice, featureName, postAction, characters (4.9), system (4.8)                   |
| onMarkHP / onMarkArmor   | character (4.2), amount, markSource, source, feature (4.11), characters (4.9), system (4.8)                                                      |
| onFeatureActivated       | featureName, subFeatureName, inputValue, targetEl, selfEl (4.2), updateActiveElement, roll (4.3), characters (4.9), feature (4.11), system (4.8) |
| modifyPreThresholdDamage | damagePipelineCtx (4.7) with characters, system (4.8), feature (4.11) — reads from roll.damageTotal, returns new value                           |
| modifyHpLoss             | damagePipelineCtx (4.7) with characters, system (4.8), feature (4.11) — reads from roll.hpLoss, returns new value                                |
| onAfterMarkArmor         | character (4.2), amount, source, roll?, postRollSilent?, tagNames?, dmgType?, characters (4.9), feature (4.11), system (4.8)                     |
| onLastArmorSlot          | character (4.2), system (4.8), characters (4.9), feature (4.11)                                                                                  |
| onBeforeDamageApplied    | { target (4.2), roll (4.3), feature (4.11), system (4.8), effectiveDmgTotal (number), characters (4.9) } → returns new damage total (number)     |
| onDamageReceived         | character (4.2), dmgTotal, hpLoss, updateActiveElement, characters (4.9), system (4.8), feature (4.11)                                           |
| onHpDealt                | character (4.2), hpDealt, target (4.2), updateActiveElement, characters (4.9), system (4.8), feature (4.11)                                      |
| onRollComplete           | attacker, roll (4.3), characters (4.9), system (4.8), feature (4.11)                                                                             |
| chip.onUse (card)        | unified chip context (4.15): roll (4.3 or null), character (4.2), feature (4.11), characters (4.9), system (4.8) when in table context           |
| chip.onToggle (card)     | unified chip context (4.15) plus chip (4.14): roll (4.3 or null), character (4.2), chip (4.14), feature (4.11), characters (4.9), system (4.8)   |


### 7.1 Hook × context subdocument matrix

Rows = hooks; columns = context subdocuments (Section 4), ordered by how many hooks receive each (most → least). • = hook receives that subdoc in its context. “Character” covers any 4.2 entity (character, target, char, selfEl, attacker).

**Columns (most to least used):** feature (4.11), character (4.2), characters (4.9), roll (4.3), featureState (4.6), banner (4.1), damagePipelineCtx (4.7), system (4.8), rest (4.4), chip (4.14).


| Hook                     | feature (4.11) | character (4.2) | characters (4.9) | roll (4.3) | featureState (4.6) | banner (4.1) | damagePipelineCtx (4.7) | system (4.8) | rest (4.4) | chip (4.14) |
| ------------------------ | -------------- | --------------- | ---------------- | ---------- | ------------------ | ------------ | ----------------------- | ------------ | ---------- | ----------- |
| chip.isVisible (banner)  | •              | •               | •                | •          |                    | •            |                         | •            |            |             |
| onChipAck / onChipReject | •              | •               | •                | •          | •                  | •            |                         | •            |            |             |
| onBannerAck (chip)       | •              | •               | •                | •          | •                  | •            |                         | •            |            |             |
| onBannerAck (weapon)     | •              | •               |                  | •          |                    |              |                         | •            |            |             |
| onCharacterEdit          | •              | •               |                  |            |                    |              |                         |              |            |             |
| canvasChip.isVisible     | •              | •               | •                | •          | •                  |              |                         | •            |            |             |
| canvasChip.onUse         | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| onRoll                   | •              |                 | •                | •          |                    |              |                         | •            |            |             |
| onRest                   | •              |                 |                  |            |                    |              |                         |              | •          |             |
| onSessionStart           | •              |                 | •                |            | •                  |              |                         | •            |            |             |
| onTargeted               | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| onMarkStress             | •              | •               | •                |            |                    |              |                         | •            |            |             |
| onMarkHP                 | •              | •               | •                |            |                    |              |                         | •            |            |             |
| onMarkArmor              | •              | •               | •                |            |                    |              |                         | •            |            |             |
| modifyPreThresholdDamage | •              |                 | •                |            |                    |              | •                       | •            |            |             |
| modifyHpLoss             | •              |                 | •                |            |                    |              | •                       | •            |            |             |
| onBeforeDamageApplied    | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| onAfterMarkArmor         | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| onLastArmorSlot          | •              | •               | •                |            |                    |              |                         | •            |            |             |
| onDamageReceived         | •              | •               | •                |            |                    |              |                         | •            |            |             |
| onHpDealt                | •              | •               | •                |            |                    |              |                         | •            |            |             |
| onFeatureActivated       | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| onRollComplete           | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| chip.onUse (card)        | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| chip.onToggle (card)     | •              | •               | •                |            |                    |              |                         | •            |            | •           |
| chip.isVisible (preroll) | •              | •               | •                | •          |                    |              |                         | •            |            |             |
| chip.onUse (preroll)     | •              | •               | •                | •          |                    |              |                         | •            |            |             |


---

## 8. Conventions

- **Style:** Prefer arrow functions for one-line hook or chip fields. Use method shorthand for multi-statement bodies.
- **Do not duplicate feature names.** The system injects the current feature name. Never pass _featureName, featureKey, or the feature name as a string literal inside chip descriptors, isVisible, or similar; use the injected key or resetsOn usage tracking instead.
- **Imitate existing features.** Before adding a new one, find a similar feature in the codebase and copy its structure (e.g. Fearless for fear→hope, Thick Skin for target chips, Retracting Claws for virtual weapons, Galapa Retract or Fungril for card chips).
- **Where to add a feature:** Add or edit a module under **`src/features-v2/`** (e.g. `ancestries/`, `communities/`, `weapon_properties/`, `armor_properties/`, `classes/`, …) and wire it through the appropriate **`index.js`** + **`registry.js`**. Follow **`docs/feature-authoring-guide.md`** and **`docs/v2-code-conventions.md`** — do not reintroduce the removed **`src/features/`** tree as the implementation path.
- **Descriptions from the SRD.** Use the SRD text for ancestry/community descriptions and for each feature. Bold resource costs with **...** to match existing conventions.

