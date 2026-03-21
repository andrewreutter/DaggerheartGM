# Feature System Cheat Sheet

**Context convention:** Each hook receives a **context object** made of **named subdocuments**. Subdocuments with the same name have the **same shape** everywhere (e.g. `roll` is always the wrapped roll; `character` is always the wrapped entity). **feature** is always the **feature descriptor object** (the object that defined the hook — name, description, hooks). Section 3 lists which subdocuments each hook receives; Section 4 defines each subdocument’s shape once.

---

## 1. The feature object

A feature is an object with:

- `**name`** — string; identifies the feature in registries and UI.
- `**description`** — optional string; flavor/rule text (often from SRD).
- **Hooks** — functions the system calls at specific times (see Section 3). Keys like `onBanner`, `onCharacterRender`, `modifyPreThresholdDamage`, etc.
- **Declarations** — declarative options the system reads without calling you (see Section 2). Keys like `passiveStatMods`, `cardChips`, `automated`, `armorReduction`, etc.

You implement a feature by defining the right hooks and declarations for the behavior you want. The same descriptor shape is used regardless of where the feature lives.

### Registries and attachment

Features live in one of **four registries**: **origin** (ancestry + community merged), **class**, **weapon**, **armor**. The registry is determined by **which barrel file** you add the feature to (`ancestries/`, `communities/`, `weapons/`, `armor/`, `classes/`). It controls:

- **How the feature is attached to the character** — Origin and class features come from character build (SRD resolution); weapon and armor features come from equipped items. Character-calc merges registry descriptors into a flat **activeFeatures** array.
- **Which invocation paths see it** — Many hooks run over **activeFeatures** (all types together). Some paths also call **runHook(registry, names, ...)** with a specific registry and set of feature names (e.g. roll tags for weapons).

There is no behavioral branching on “source type.” `**source`** and `**sourceType`** on descriptors are for UI only (badges, toggle keys). Dispatch does not check them.

---

## 2. Menu of declarations

Declarative options the system reads from the feature descriptor. Only include those you use.


| Declaration                 | Purpose                                                                                                                                                                                                                                                                                                                         | Registry note                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **passiveStatMods**         | Stat modifiers (e.g. `{ maxHp: 1 }`, `{ evasion: 1 }`, `{ traits: { agility: 1 } }`, `{ rollModifiers: [{ trait, bonus, label }] }`, `{ majorThreshold: 1 }`, `{ severeThreshold: 1 }`). Applied at character computation; no banner tag. Threshold mods feed effectiveThresholds (damage pipeline).                            | Origin, class, weapon, armor (weapon/armor via computeWeaponModifiers / computeArmorModifiers). |
| **chips**                   | **Unified chip array** for all chip placements. Each chip must have `placement: 'card'                                                                                                                                                                                                                                          | 'preroll'                                                                                       |
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


Chip descriptor fields (label, hopeCost, stressCost, isVisible, getDisabledMessage, onChipAck, onChipReject, onBannerAck, toggleKey, render, renderWhenOff, activate, isActive, resetsOn, damageModifierWhenActive) are documented in Section 4 (banner) and Section 3 (onBanner / onChipAck). All chips use the unified context shape: `{ roll, character, feature, characters, system, banner? }` (properties not applicable to the current placement are undefined).

**V2 chip properties (chip-system.js):**
- `selectTargets` *(function)*: `(table) => Actor[]`. Returns valid combat target actors for a target picker UI. Selected instance IDs stored in chip state as `selectedTargetIds` (array). Read via `chip.get('selectedTargetIds')` in `onUse`.
- `multiSelect` *(boolean)*: When `true` (with `selectTargets`), player can select multiple targets. Default single-select.

---

## 3. Menu of hooks

Each hook: **name**, **when it runs**, **Context: list of subdocument names** with Section 4 reference. Pipeline hooks receive `(value, context)`; all others receive a single context object (or context as the only parameter).

### Banner and chips

- **onBanner** — When building banner reactions for a roll (GMTableView); weapon onBanner also when syncing rolls for narration. **Context:** `banner` (4.1), `character` (4.2), `characters` (4.9), `feature` (4.11).
- **onChipAck** / **onChipReject** — User clicks Ack/Reject on a banner chip. **Context:** `roll` (4.3), `character` (4.2), `banner` (4.1 stub: addNarration, addDamage, setTreatAsMissForTarget), `feature` (4.11), `featureState` (4.6), `characterRaw`, `characters` (4.9).
- **onBannerAck** (chip) — When GM acknowledges the whole banner (chip ran; legacy acknowledge). **Context:** `roll` (4.3), `character` (4.2), `feature` (4.11), `featureState` (4.6), `characterRaw`, `postRoll`, `system` (4.8).
- **onBannerAck** (weapon) — When GM acknowledges; per tag per target. **Context:** `roll` (4.3), `target` (4.2).

### Character computation

- **onCharacterEdit** — Ancestry barrel only, immediately after feature is registered. **Context:** `char` (builder; addExperienceBonus(amount)).

### Pre-roll

- **chips** (declarative, `placement: 'preroll'`) — Pre-roll chips are declared on the feature as **chips** with `placement: 'preroll'`. Each chip may define **isVisible** and **onUse** (see Section 4). Chips are collected by the runner from the descriptor; no **onAct** hook. Legacy `canvasChips` array is still supported.
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

Object passed to **onBanner** and (at ack time) into **onChipAck** / **onChipReject**. When the reaction came from onBanner, it is the same object from closure.

**Methods:**  

- `addChip(descriptor)` — register a chip (ancestry/community reactions).  
- `addNarration(text, style?)` — add narration line; optional style e.g. `'automated'`.  
- `addAutomatedNarration(text)` — same as addNarration(text, 'automated').  
- `addDamage(expr)` — add extra damage; cancels current banner and creates new one with augmented roll.  
- `setTreatAsMissForTarget(instanceId)` — selected target takes no HP/Stress from this roll (e.g. Faerie Wings).

**Internal / ack-time:** chips, _narrations, _rollRef, _featureName, _extraDamage, _narration. Chip descriptor shape: label, hopeCost, stressCost, isVisible(roll, character), getDisabledMessage(roll, character, featureState?), onChipAck(context), onChipReject(context), onBannerAck(context), toggleKey, render(roll, character), renderWhenOff, activate, isActive, resetsOn, damageModifierWhenActive (hopeCost?, stressCost?, dmgType?, apply(total)=>number). Banner object at ack has **feature** (4.11), **featureState** (4.6).

### 4.2 entity (character / target / char)

Returned by **wrapEntity(el, updateActiveElement, options?)** from `entity.js`. Every hook that receives a “character” or “target” gets this wrapper.

**Identity:** instanceId, id (alias), name, class, maxStress, maxHp, maxHope, maxArmor.  
**Snapshot getters:** currentStress, currentHp, hope, currentArmor (reflect in-call mutations).  
**Mutators:** markStress(n), clearStress(n), markHp(n), clearHp(n), markArmor(n), clearArmor(n), spendHope(n), gainHope(n), setFlag(key, value), setFeatureUsed(featureKey, cycle), addCondition(name), addResistance(type, source), removeResistance(type, source), addModifier(modifier), addDisadvantage(source), removeDisadvantage(source), disableMove(source), enableMove(source).  
**Helper:** hasStress(n) — true when at least n stress boxes are empty.  
**Optional (when caller passes options):** **postTraitRoll(traitKey, options?)** — post a trait roll (Hope/Fear + trait); **postAction(customLabel?)** — post an action banner. When options are omitted, these are no-ops.

### 4.3 roll

Returned by **wrapRoll(roll, displayStore?, characterInstanceId?)** from `roll.js`. `wrapBanner` is an alias. The **pre-roll** roll (before the roll is sent) is a separate wrapper built in the view with the same semantic methods.

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

Pre-roll chips are populated from **descriptor.chips** with `placement: 'preroll'` (or legacy `descriptor.canvasChips`). The runner injects `_featureName`, `_featureKey` (when `resetsOn` is set), and a default **isVisible** ("my roll and not yet used") when omitted.

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

Array of wrapped entities (4.2) — all current party characters on the table. Passed to **onSessionStart** and, where easily available (table/game view), to most other hooks that run in that context: **onBanner**, **onChipAck** / **onChipReject**, **onRoll**, **onTargeted**, **onMarkStress** / **onMarkHP** / **onMarkArmor**, **modifyPreThresholdDamage** / **modifyHpLoss** (via damagePipelineCtx), **onAfterMarkArmor**, **onLastArmorSlot**, **onBeforeDamageApplied**, **onDamageReceived**, **onHpDealt**, **onFeatureActivated**, **onRollComplete**, **cardChips.onToggle**.

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

**Map-based (feature name → descriptor):**  

- **runHook(featureMap, tagNames, hookName, context)** — Fire-and-forget; calls feature[hookName](context) for each feature in tagNames. Injects **feature** (descriptor) into context.  
- **runPipelineHook(featureMap, tagNames, hookName, initialValue, context)** — Each feature gets (currentValue, context) with **feature** (descriptor) in context; returns new value. Sorted by priority (default 50; lower first).  
- **runAsyncPipelineHook(...)** — Async variant.

**Array-based (activeFeatures):**  

- **runCharacterHook(activeFeatures, hookName, context)** — Fire-and-forget over flat list. Injects **source**: feature.source and **feature** (descriptor).  
- **runCharacterPipelineHook(activeFeatures, hookName, initialValue, context)** — Pipeline over activeFeatures; (value, context) with **source** and **feature** (descriptor) per participant.  
- **runCharacterAsyncPipelineHook(...)** — Async pipeline over activeFeatures; same context shape.

---

## 6. Registries and imports

- **Origin:** originFeatures from `src/features/registry.js` (merge of ancestry + community). Single lookup for banner reactions, chips, character computation.
- **Weapons:** weaponFeatures from `src/features/registry.js`.
- **Armor:** armorFeatures from `src/features/registry.js`.
- **Classes:** classFeatures, classFeatureNameToClass from `src/features/registry.js`.
- **Entity/roll:** wrapEntity, wrapRoll from `src/features/entity.js`, `src/features/roll.js`.
- **Lifecycle:** runBeforeMarkStress, runBeforeMarkHP, runBeforeMarkArmor from `src/client/lib/origin-lifecycle.js`.
- **Hooks:** runHook, runPipelineHook, runAsyncPipelineHook, runCharacterHook, runCharacterPipelineHook, runCharacterAsyncPipelineHook from `src/features/hooks.js`.

---

## 7. Quick reference: hook → context subdocuments


| Hook                     | Context subdocuments (Section 4)                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| onBanner                 | banner (4.1), character (4.2), characters (4.9), system (4.8), feature (4.11)                                                                    |
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
| onBanner                 | •              | •               | •                |            |                    | •            |                         | •            |            |             |
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

- **Style:** Prefer arrow functions for one-line hook or chip fields. Use method shorthand for multi-statement bodies. Exception: write onBanner(banner) { ... } in method shorthand for readability.
- **Do not duplicate feature names.** The system injects the current feature name. Never pass _featureName, featureKey, or the feature name as a string literal inside chip descriptors, isVisible, or similar; use the injected key or resetsOn usage tracking instead.
- **Imitate existing features.** Before adding a new one, find a similar feature in the codebase and copy its structure (e.g. Fearless for fear→hope, Thick Skin for target chips, Retracting Claws for virtual weapons, Galapa Retract or Fungril for card chips).
- **Where to add a feature:** Ancestry → `src/features/ancestries/<AncestryName>.js` + ancestryModules in ancestries/index.js. Community → `src/features/communities/<CommunityName>.js` + communityModules in communities/index.js. Weapon → `src/features/weapons/<FeatureName>.js` + builderDict in weapons/index.js. Armor → `src/features/armor/<FeatureName>.js` + builderDict in armor/index.js. Class → `src/features/classes/<ClassName>.js` + merge in classes/index.js. One file per ancestry; one file per community.
- **Descriptions from the SRD.** Use the SRD text for ancestry/community descriptions and for each feature. Bold resource costs with **...** to match existing conventions.

