# Feature System Cheat Sheet

Human-facing reference for programming **ancestries**, **communities**, **weapons**, and **armor** in the DaggerheartGM feature IoC system.

---

## 1. File shapes and registration

### Ancestries

- **Location:** `src/features/ancestries/<AncestryName>.js`
- **Export:** A single default object: `{ name, description, onCharacterBuild(char) }`
- **Registration:** In `ancestries/index.js`, add the import and append to the `builders` array.

```js
export default {
  name: 'Infernis',
  description: '...',
  onCharacterBuild(char) {
    char.addFeature('Fearless', '...', { onBanner(banner) { ... } });
    char.addFeature('Dread Visage', '...');  // no hooks = display-only
  },
};
```

**Builder API (inside `onCharacterBuild`):**

| Method | Args | Purpose |
|--------|------|--------|
| `char.addFeature(name, description, hooks?)` | `name`: string, `description`: string (markdown), `hooks`: optional object | Register one feature. All hook names below are valid keys. |
| `char.addExperienceBonus(amount)` | `amount`: number | Call from **inside** an `onCharacterEdit(char)` hook for the feature that grants the bonus. Registers that the ancestry requires one experience choice for +N; form shows dropdown, choice in `experienceBonusChoices[featureName]`. |

### Communities

- **Location:** `src/features/communities/<CommunityName>.js`
- **Export:** Same shape as ancestries: `{ name, description, onCharacterBuild(char) }`
- **Registration:** In `communities/index.js`. Descriptors get `sourceType: 'community'` and `source: builder.name`.

Communities use the same `char.addFeature(name, description, hooks?)` API. All ancestry hooks are supported except `onCharacterEdit` (ancestry-only for experience bonuses). `onRest` is run for both ancestry and community features when building rest moves.

### Weapons

- **Location:** `src/features/weapons/<FeatureName>.js`
- **Export:** Same builder shape as ancestries/communities: `{ name, description?, onCharacterBuild({ character, weapon }) }`. The barrel runs each builder at module load; descriptors get `sourceType: 'weapon'` and `source: name`. **Same addFeature as ancestries/communities** — call `character.addFeature(name, description, hooks)`. Weapon descriptors are registered in `weaponFeatures` only (no feature list), so they do **not** appear as character sheet feature cards; the same hooks (e.g. `prependRollParts`, `onDamageApplied`) are supported.
- **Registration:** In `weapons/index.js`, import and add to the `builders` array.

```js
export default {
  name: 'Reliable',
  automated: true,
  tagText: '+1 to attack roll (applied)',
  description: '...',
  prependRollParts() { return ['Reliable [1]']; },
  onCharacterBuild({ character, weapon }) {
    const { name, description, onCharacterBuild: _omit, ...hooks } = this;
    character.addFeature(name, description, hooks);
  },
};
```

**Builder API:** `character.addFeature(name, description, hooks?)` — same as ancestry/community. All hook/option properties (e.g. `automated`, `tagText`, `prependRollParts`, `onDamageApplied`) go in `hooks`.

### Armor

- **Location:** `src/features/armor/<FeatureName>.js`
- **Export:** Same builder shape: `{ name, description, onCharacterBuild({ character, armor }) }`. The barrel runs each builder at module load; descriptors get `sourceType: 'armor'` and `source: name`. **Same addFeature as ancestries/communities** — call `character.addFeature(name, description, hooks)`. Armor descriptors are registered in `armorFeatures` only (no feature list), so they do **not** appear as character sheet feature cards; the same hooks (e.g. `armorReduction`, `onAfterMarkArmor`) are supported.
- **Registration:** In `armor/index.js`, import and add to the `builders` array.

```js
export default {
  name: 'Fortified',
  description: '...',
  armorReduction: 2,
  onCharacterBuild({ character, armor }) {
    const { name, description, onCharacterBuild: _omit, ...hooks } = this;
    character.addFeature(name, description, hooks);
  },
};
```

**Builder API:** `character.addFeature(name, description, hooks?)` — same as ancestry/community. All hook/option properties (e.g. `armorReduction`, `onAfterMarkArmor`) go in `hooks`.

**Unified addFeature:** All four sources (ancestry, community, armor, weapon) use the same `character.addFeature(name, description, hooks)` from `src/features/add-feature.js`. The barrel creates the builder via `createFeatureBuilder(context)`; context controls `targetMap`, optional `featureList` (ancestry/community only — that’s why only they get feature cards), `sourceType`, `source`, and for ancestry `virtualWeaponBehaviors`, `ancestryEntry`, and `onAfterAdd` (runs `onCharacterEdit`). Armor and weapon use the same hooks (e.g. `onCharacterRender`, `onCard`) but do not push to a feature list.

---

## 2. Shared infrastructure

### Entity wrapper (`wrapEntity(el, updateActiveElement)`)

Returned by `entity.js`. Every hook that receives a “character” or “target” gets this wrapper. It spreads all source properties from the raw element and adds:

**Snapshot getters (reflect in-call mutations):**  
`currentStress`, `currentHp`, `hope`, `currentArmor`

**Identity:**  
`instanceId`, `id` (alias), `name`, `class`, `maxStress`, `maxHp`, `maxHope`, `maxArmor`

**Mutators:**

| Method | Effect |
|--------|--------|
| `markStress(n)` | Increase stress (cap at max). |
| `clearStress(n)` | Decrease stress (floor 0). |
| `markHp(n)` | Reduce HP (damage). |
| `clearHp(n)` | Restore HP. |
| `markArmor(n)` / `clearArmor(n)` | Mark/clear armor slots. |
| `spendHope(n)` / `gainHope(n)` | Hope. |
| `hasStress(n)` | True if at least n stress boxes are empty. |
| `setFlag(key, value)` | Persist arbitrary state on element. |
| `setFeatureUsed(featureKey, cycle)` | Mark feature used for `cycle` (`'session'` \| `'rest'` \| `'longRest'`). |
| `addCondition(name)` | Append to conditions string. |
| `addResistance(type, source)` / `removeResistance(type, source)` | e.g. `'physical'`, source e.g. `'Galapa - Retract'`. |
| `addModifier(modifier)` | Add/replace active modifier (e.g. Timeslowing +1d4 Evasion); `modifier.id` used for replace. |
| `addDisadvantage(source)` / `removeDisadvantage(source)` | Roll disadvantage source. |
| `disableMove(source)` / `enableMove(source)` | Prevent/allow token drag on battle map. |

### Roll wrapper (`wrapRoll(roll, displayStore?, characterInstanceId?)`)

Returned by `roll.js`. Used in banner chips and damage flow.

**Read-only / derived:**  
`isWithFear`, `isWithHope`, `isReaction`, `isMine`, `hasDuality`, `hasDamage`, `isSuccess`, `isFailure`, `hasExperience`, `attackRange`, `trait` (e.g. `{ name: 'Agility' }` when `_traitKey` set).

**Objects:**  
- `attacker`: `{ id, name, isMe }`  
- `target`: `{ id, name, isMe, rangeFromMe }` (when characterInstanceId passed, isMe reflects feature owner)

**Helpers:**  
- `sub(pattern)` — find sub-item by label (string → case-insensitive regex); returns `{ values(), hasValue(n), ...sub }` or null.

**Mutators (use in onChipAck etc.):**  
- `reroll('Hope'|'Fear'|'Duality')` — request replacement banner with that die rerolled.  
- `fullReroll()` — cancel and re-post same rollText.  
- `setWithHope()` — convert to Hope (skip fear, grant 1 hope); only when displayStore + `_rollDbId` provided.  
- `setDominantForDisplay(dominant)` — display-only; same requirement.  
- `reduceHPLoss(n)` — subtract n from HP loss applied on acknowledge.  
- `setDamageTotal(n)` — override damage total used for threshold/HP (e.g. halve damage).

---

## 3. Ancestry & community hooks

These hooks are available on descriptors passed to `char.addFeature(..., hooks)`.

### 3.1 `onCharacterRender(ctx)`

**When:** During character computation (`runAncestryRender` in character-calc).

**Context `ctx`:**

| Property / method | Type | Purpose |
|-------------------|------|--------|
| `ctx.weapons` | mutable array | Copy of character weapons; can mutate (e.g. change range). |
| `ctx.addStatMod(stat, value)` | function | Add stat modifier. `stat`: e.g. `'maxHp'`, `'maxStress'`, `'evasion'`. |
| `ctx.addThresholdBonus(value)` | function | Add flat bonus to major and severe thresholds (e.g. Galapa Shell). |
| `ctx.addVirtualWeapon(weapon)` | function | Add a virtual weapon card. |
| `ctx.addAdvantageTrigger(condition)` | function | Declare advantage chip condition text (e.g. “intimidate hostile creatures”). |
| `ctx._currentFeatureName` | string | Set by system; current feature name. |
| Other character fields | — | `charData` is spread onto `ctx` (e.g. traits, proficiency). |

**Virtual weapon object for `addVirtualWeapon`:**

| Key | Type | Purpose |
|-----|------|--------|
| `trait` | string | e.g. `'Instinct'`. |
| `range` | string | e.g. `'Very Close'`, `'Melee'`. |
| `damage` | string | e.g. `'d8'`. |
| `description` | string | Shown on card. |
| `stressCost` | number? | Applied to attacker on acknowledge. |
| `hopeCost` | number? | Applied to attacker on acknowledge. |
| `onAcknowledge({ target, self })` | function? | After costs; `target` = wrapped target, `self` = wrapped attacker when character. |
| `damageType` | string? | e.g. `'Mag'` for damage type tag. |
| `damageProficiency` | boolean? | Add +Proficiency to damage. |
| `multiTarget` | boolean? | Banner allows multi-target selection. |
| `multiTargetMax` | number? | Default 10. |

---

### 3.2 `onBanner(banner)`

**When:** When building banner reactions for a roll (GMTableView gathers origin features and calls this per feature). Weapon features with `onBanner` are also run when syncing rolls to the dice roller (so they can add narration via `banner.addNarration()`).

**Context:** `banner` — object with:
- `addChip(descriptor)` — register a chip (ancestry/community only).
- `addNarration(text, style?)` — add a narration line shown on the result banner (same as `ctx.addNarration` in onChipAck, but from onBanner so it appears without chip ack). Optional `style`: e.g. `'automated'` for green styling (effect is applied by the app). Use in ancestry/community or weapon features.

**Chip descriptor (only include fields you use):**

| Field | Type | Purpose |
|-------|------|--------|
| `label` | string | Tooltip text. |
| `hopeCost` / `stressCost` | number | Resource cost; system applies before `onChipAck`. |
| `isVisible(roll, character)` | function | When chip appears. Default behavior: `roll.isMine`. Can return a **number** N to add N copies (each toggleable). |
| `getDisabledMessage(roll, character, feature?)` | function? | When chip can be disabled for reasons other than cost. Return truthy string = disabled, tooltip. |
| `onChipAck(roll, character, ctx, feature)` | function? | On Accept. See “Chip ack context” below. |
| `onChipReject(roll, character, ctx, feature)` | function? | On Reject. |
| `toggleKey` | string? | Override auto state key `_toggle.<origin>.<feature>`. |
| `render(roll, character)` | function? | When toggled on (e.g. `roll.setWithHope()` for display). |
| `renderWhenOff(roll, character)` | function? | When toggled off. |
| `activate(roll, character, ctx)` | function? | Veto on toggle-on; return `{ cancel: true }` to abort. |
| `isActive(roll, character)` | function? | Custom active state. |
| `resetsOn` | `'rest'` \| `'session'` \| `'longRest'`? | System injects usage tracking and disables when used this cycle. |

**Chip ack context `ctx` (onChipAck / onChipReject):**

| Property / method | Purpose |
|-------------------|--------|
| `ctx.addDamage(expr)` | Add extra damage (e.g. `'2d6'`); cancels current banner and creates new one with augmented roll. |
| `ctx.addNarration(text)` | Add narration line (prefixed with feature name by system). |
| `ctx.setTreatAsMissForTarget(instanceId)` | Selected target takes no HP/Stress from this roll (e.g. Faerie Wings). |
| `ctx.characterRaw` | Raw element (no wrapper). |

**`character`** is the wrapped entity; **`feature`** is `{ get(key, default?), set(key, value) }` backed by `character._originFeatureState[featureName]`.

**Roll (in onChipAck):** Wrapped with `wrapRoll(roll, displayStore, characterInstanceId)` so `setWithHope()`, `reduceHPLoss(n)`, `setDamageTotal(n)`, `reroll(...)`, `fullReroll()` are available.

---

### 3.3 `onAct(ctx)`

**When:** When a **player** is about to send a roll (trait, weapon, feature, etc.). Not used for GM-initiated rolls.

**Context `ctx`:**

| Property | Type | Purpose |
|----------|------|--------|
| `ctx.canvas` | object | Call `canvas.addChip(descriptor)` to add pre-roll chips. If any chips added, client shows pre-roll banner with toggles and Proceed. |
| `ctx.roll` | object | Mutable roll wrapper. |
| `ctx.char` | object | Wrapped character entity. |
| `ctx.options` | object | `{ isReaction: boolean }`. |
| `ctx.getFeatureStateFor(name)` | function | Returns `{ get, set }` for that feature’s state on this character. |

**Pre-roll canvas chip descriptor:**

- `isVisible(r, feature)` — `r` = roll, `feature` = read-only state; return **number** N for N copies, or true/false.
- `onUse(roll, feature)` — called on Proceed for each selected chip; `roll` is mutable.
- Roll mutators (before send): `roll.addAdvantageDie(name)`, `roll.addDisadvantage(name)`, `roll.removeDisadvantage()`, `roll.addRollBonus(n)`; `roll.rollText`, `roll.meta` get/set.

**Do not** pass `_featureName` in the descriptor; the system injects the current feature name.

---

### 3.4 `onRoll(ctx)`

**When:** When roll text is finalized: once in the no-banner path, and on Proceed after pre-roll chips (and GM difficulty/advantage/disadvantage) are applied.

**Context:** `ctx = { roll }`. `roll` is the mutable roll wrapper (e.g. for `removeDisadvantage()`).

---

### 3.5 `onRest(rest)`

**When:** When building rest move options for a character (`getRestMovesForCharacter` in rest-moves.js). Runs for each ancestry and community feature that has `onRest`.

**Context `rest`:**

| Property / method | Type | Purpose |
|-------------------|------|--------|
| `rest.shortMoves` | array | Mutable copy of default short rest moves. |
| `rest.longMoves` | array | Mutable copy of default long rest moves. |
| `rest.addShortMove(move)` | function | Append one move to short list. |
| `rest.addLongMove(move)` | function | Append one move to long list. |
| `rest.addShortMoveSlot(name?)` | function | Add one extra short rest dropdown; optional `name` (e.g. `'Celestial Trance'`) for label. |
| `rest.addLongMoveSlot(name?)` | function | Same for long rest. |

Move shape: `{ id, name, description, canTargetAlly?, rollDice?, onApply(rest, roll, target, char)? }`.

---

### 3.6 `onCard(card)`

**When:** When building the feature card on the character sheet (and at barrel load for ancestry).

**Context:** `card` — object with `addChip(descriptor)`.

**Card chip descriptor:**

| Field | Purpose |
|-------|--------|
| `label` | Shown as banner action text and tooltip. |
| `hopeCost` / `stressCost` | Applied on GM ack. |
| `onUse(context)` | One-shot: `context` has `postAction(customLabel?)`, `postTraitRoll(traitKey, options?)`, `character`, `feature`. Call `postAction()` (or with label) to post the banner. |
| `onToggle(isActive, character)` | Toggle chip: called when GM acknowledges. Apply only game effects (resistance, disadvantage, move); do not call `postAction`. |

---

### 3.7 `onTargeted(roll, character)`

**When:** When an **adversary** attack targets this character: after GM selects target but **before** the roll is posted.

**Args:**  
- `roll`: Mutable pending roll. `roll.rollText` (get/set). `roll.addDisadvantage(featureName?)` — subtracts 1d6 from first damage expression; omit to use current feature name.  
- `character`: Wrapped entity (the target).

---

### 3.8 `onSessionStart(feature)` or `onSessionStart(feature, characters)`

**When:** When GM clicks “Start Session” and acknowledges the banner. Session-only state is cleared first.

**Overloads:**  
- **1 arg:** `onSessionStart(feature)`. Called **once per party character** that has this feature. `feature`: `{ get(key, default?), set(key, value) }` for that character’s feature state (e.g. clear tokens).  
- **2 args:** `onSessionStart(null, characters)`. Called **once**. `characters`: array of **wrapped** party character entities (e.g. Halfling Luckbringer: `characters.forEach(c => c.gainHope(1))`).

---

### 3.9 Lifecycle: `onMarkStress(ctx)`, `onMarkHP(ctx)`, `onMarkArmor(ctx)`

**When:** Just before the system would mark Stress, HP, or an armor slot on this character. Run from `origin-lifecycle.js`; collect feature names from ancestry + community + equipped weapon features + equipped armor feature.

**Context `ctx` (all three):**

| Property | Type | Purpose |
|----------|------|--------|
| `character` | wrapped entity | The character. |
| `amount` | number | Amount to mark. |
| `source` | string | Reason (e.g. `'chip'`, `'damage'`). |

**onMarkStress only:**

| Property | Type | Purpose |
|----------|------|--------|
| `rollDice(expr)` | async function | e.g. `'1d6'` → `Promise<{ value: number }>`. |
| `featureName` | string | Current feature name. |
| `postAction(actionText)` | function | Post action notification (character + feature name). |

**Return:**  
- `{ cancel: true }` — prevent the mark.  
- `{ reduceBy: n }` (0 < n ≤ amount) — cancel n of the amount (rest is marked).  
- `{}` or undefined — allow all.  
Can be sync or async.

---

### 3.10 `onCharacterEdit(char)`

**When:** By the ancestry barrel immediately after the feature is registered (only ancestries).

**Arg:** `char` — the builder object (same as in `onCharacterBuild`). Use to call `char.addExperienceBonus(amount)` for the feature you just added.

---

## 4. Weapon feature hooks and options

Weapon descriptors are keyed by `name`. Tags on the roll are matched to these names.

### 4.1 Roll construction

| Property | Signature / type | Purpose |
|----------|------------------|--------|
| `prependRollParts()` | `() => string[]` | Tokens prepended to roll text (e.g. `['Reliable [1]']`). |
| `appendRollParts()` | `() => string[]` | Appended to roll text. |
| `rewriteDamage(damageStr, ctx)` | `(string, ctx) => string` | Transform damage string. `ctx` may include `traits`, etc. |

### 4.2 Display and automation

| Property | Type | Purpose |
|----------|------|--------|
| `automated` | boolean | If true, tag shown as “(applied)” style. |
| `showTag` | boolean | If true, feature is shown as a tag on the roll banner (opt-in; default is not shown). |
| `tagText` | string or `(ctx?) => string` | Label for the tag (e.g. “+1 Stress (applied)”). |
| `description` | string | Flavor/rule text. |

### 4.3 Passive stat mods (no tag)

| Property | Type | Purpose |
|----------|------|--------|
| `passiveStatMods` | `{ traits?, evasion?, armorScore?, severeThreshold? }` | Applied by `computeWeaponModifiers`; no banner tag. Prefer **onCharacterRender** + `ctx.addStatMod(stat, value)` (and for traits `ctx.addStatMod('agility', -1)` etc.) so the descriptor is built the same way as ancestry. |

### 4.4 Damage pipeline

**modifyHpLoss(hpLoss, ctx)**  
- **When:** In `applyDamageToTarget`, after threshold computation, before armor reduction.  
- **Signature:** `(hpLoss, ctx) => number`  
- **Context `ctx`:** `{ target, character, tagNames, roll, dmgType }` (target/character wrapped, roll wrapped).

**onDamageApplied(ctx)**  
- **When:** After HP is applied in `applyDamageToTarget`.  
- **Context:** Same `ctx`. Use e.g. `target.markStress(1)`.

### 4.5 Before damage applied (async)

**onBeforeDamageApplied(effectiveDmgTotal, context)**  
- **When:** Before applying damage to a character that has this weapon (e.g. Parry).  
- **Return:** New effective damage total (or Promise of it).  
- **Context:** `{ target, roll, parryWeapon, postRoll, addActionBanner }`.  
  - `postRoll(text, displayName)` — server roll.  
  - `addActionBanner(notification)` — show banner in DiceRoller.

### 4.6 Banner interaction (post-apply UI)

| Property | Type | Purpose |
|----------|------|--------|
| `bannerStatus()` | `() => { text?, style? }` | Status text/style on banner. |
| `bannerInteraction` | object | e.g. `{ type: 'target-picker', phase: 'post-apply', loop?, prompt?, skipLabel? }` for “mark Stress to hit another target” flows. |

### 4.7 Interactive / non-automated

| Property | Type | Purpose |
|----------|------|--------|
| `interactive` | boolean | Tag gets interactive UI (e.g. Quick, Devastating). |

---

## 5. Armor feature hooks and options

### 5.1 Passive

| Property | Type | Purpose |
|----------|------|--------|
| `passiveStatMods` | `{ traits?, evasion?, rollModifiers?, ... }` | Applied by `computeArmorModifiers`. Prefer **onCharacterRender** + `ctx.addStatMod(stat, value)` or `ctx.addRollModifier({ trait, bonus, label })` so the descriptor is built the same way as ancestry. |
| `armorReduction` | number | Slots cleared per “use armor” (default 1); e.g. Fortified = 2. |
| `allowsArmorFor` | `'phy'` \| `'mag'` | When set, “Use armor” only shown for that damage type. |

### 5.2 Damage pipeline

**modifyPreThresholdDamage(dmgTotal, ctx)**  
- **When:** In `applyDamageToTarget`, before threshold/HP calculation.  
- **Signature:** `(dmgTotal, ctx) => number`  
- **Context `ctx`:** `{ target, character, tagNames, roll, dmgType }`.  
- Example: Warded subtracts `target.armorScore` from magic damage.

### 5.3 Armor slot lifecycle

**onAfterMarkArmor(ctx)**  
- **When:** After the system marks an armor slot (e.g. when “Use armor” is used).  
- **Context:** `{ character, amount: 1, source, roll?, postRollSilent?, tagNames?, dmgType? }` — `character` is the wrapped wearer; optional fields present when in damage flow.  
- Example: Reinforced sets `character.setFlag('reinforcedActive', true)` when `character.currentArmor >= character.maxArmor`. Timeslowing uses `character` and `postRollSilent` to add an Evasion modifier.

**onLastArmorSlot(ctx)**  
- **When:** When the **last** armor slot would be marked (Resilient: roll d6, on 6 save slot).  
- **Context:** `{ character, postRoll, addActionBanner }` — `character` is the wrapped wearer.  
- **Return:** `Promise<{ saveSlot: boolean }>`. If `saveSlot: true`, the slot is not marked.

### 5.4 Lifecycle (weapon/armor)

Weapon and armor descriptors can also implement **onMarkStress**, **onMarkHP**, **onMarkArmor** with the same context shapes as in section 3.9. They are collected with origin features and run from `origin-lifecycle.js`.

---

## 6. Pipeline and hook dispatch

- **runHook(featureMap, tagNames, hookName, context)** — Fire-and-forget; calls `feature[hookName](context)` for each feature in `tagNames`. Order not guaranteed.  
- **runPipelineHook(featureMap, tagNames, hookName, initialValue, context)** — Each feature gets `(currentValue, context)` and can return a new value. Sorted by `priority` (default 50; lower first).  
- **runAsyncPipelineHook(...)** — Async variant; each handler can return a Promise.

---

## 7. Registries and imports

- **Ancestry/community (origin):** `originFeatures` from `src/features/registry.js` (merge of ancestry + community maps).  
- **Weapons:** `weaponFeatures` from `src/features/registry.js`.  
- **Armor:** `armorFeatures` from `src/features/registry.js`.  
- **Entity/roll:** `wrapEntity`, `wrapRoll` from `src/features/entity.js`, `src/features/roll.js`.  
- **Lifecycle:** `runBeforeMarkStress`, `runBeforeMarkHP`, `runBeforeMarkArmor` from `src/client/lib/origin-lifecycle.js`.  
- **Hooks:** `runHook`, `runPipelineHook`, `runAsyncPipelineHook` from `src/features/hooks.js`.

---

## 8. Quick reference: context shapes

| Hook | Main context shape |
|------|--------------------|
| **onCharacterRender** | `ctx`: charData spread + `weapons`, `addStatMod`, `addThresholdBonus`, `addVirtualWeapon`, `addAdvantageTrigger` |
| **onBanner** | `banner`: `{ addChip(descriptor) }` |
| **onAct** | `ctx`: `canvas`, `roll`, `char`, `options`, `getFeatureStateFor` |
| **onRoll** | `ctx`: `{ roll }` |
| **onRest** | `rest`: `shortMoves`, `longMoves`, `addShortMove`, `addLongMove`, `addShortMoveSlot`, `addLongMoveSlot` |
| **onCard** | `card`: `{ addChip(descriptor) }` |
| **onTargeted** | `(roll, character)` — roll mutable, has `addDisadvantage(featureName?)` |
| **onSessionStart** | `(feature)` per character, or `(null, characters)` once |
| **onMarkStress/HP/Armor** | `ctx`: `character`, `amount`, `source`; Stress also has `rollDice`, `featureName`, `postAction` |
| **onChipAck** | `(roll, character, ctx, feature)` — ctx: `addDamage`, `addNarration`, `setTreatAsMissForTarget`, `characterRaw` |
| **modifyPreThresholdDamage** (armor/weapon) | `(dmgTotal, ctx)` — ctx: `target`, `character`, `tagNames`, `roll`, `dmgType` |
| **modifyHpLoss** (weapon) | `(hpLoss, ctx)` — same ctx |
| **onDamageApplied** (weapon) | `ctx` — same |
| **onAfterMarkArmor** (armor) | `{ character, amount: 1, source, roll?, postRollSilent?, tagNames?, dmgType? }` |
| **onLastArmorSlot** (armor) | `{ character, postRoll, addActionBanner }` |
| **onBeforeDamageApplied** (weapon) | `(effectiveDmgTotal, { target, roll, parryWeapon, postRoll, addActionBanner })` |

---

## 9. Conventions

- **Style:** Prefer arrow functions for one-line hook or chip fields. Use method shorthand for multi-statement bodies. **Exception:** Always write `onBanner(banner) { ... }` in method shorthand — the chip descriptor is multi-line and a one-liner hurts readability.
- **Do not duplicate feature names.** The system injects the current feature name into context. Never pass `_featureName`, `featureKey`, or the feature name as a string literal inside chip descriptors, `isVisible`, or similar; use the injected key or `resetsOn` usage tracking instead.
- **Imitate existing features.** Before adding a new one, find a similar feature in the codebase and copy its structure (e.g. Fearless for fear→hope, Thick Skin for target chips, Retracting Claws for virtual weapons, Death Connection for onCard chips).
- **One file per ancestry.** All features for an ancestry live in the same file. Communities: one file per community.
- **Descriptions from the SRD.** Use the SRD text for ancestry/community descriptions and for each feature. Bold resource costs with `**...**` to match existing conventions.
