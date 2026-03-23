# DaggerheartGM Feature Authoring Guide

Welcome to the DaggerheartGM feature system! This guide will teach you how to translate the rules of Daggerheart into code. 

Whether you are adding a simple narrative ability, a complex spell, or a weapon that bounces between enemies, you will use the same unified system. Let's start with how the engine thinks about the game.

## 0. Core Concepts

### 0.1 Character Options

In Daggerheart, players build their characters by selecting **Options**. These include their Class, Subclass, Ancestry, Community, Weapons, and Armor. In our engine, an Option is mostly just a container—a name, some flavor text, and a list of Features.

### 0.2 Features

**Features** are the actual building blocks of the game. A character in DaggerheartGM is essentially just a giant bag of features rolled up from their chosen Options. 

The engine doesn't really care where a feature came from. A feature that adds +1 to Evasion works exactly the same whether it comes from a piece of Armor or an Ancestry trait. Once you know how to build a feature, you know how to build almost anything in the game.

### 0.3 The Game Lifecycle

To know *how* to write a feature, you first need to understand *when* things happen in the engine. Time in DaggerheartGM flows through a specific lifecycle:

1. **Character Creation:** When a player builds a character, features can inject choices (e.g., "Choose two domains" or "Pick a beastform").
2. **Character Rendering:** The engine calculates the character's base stats. Passive features (like stat boosts) apply here.
3. **The Action Loop:** When a player has the **Spotlight** and does something, time slows down into a specific sequence and a Banner is displayed to the player and the GM:
  - **Intent:** A player declares an action (e.g., clicking a weapon or a trait). Features can interrupt here to offer Advantage chips or ask, "Do you want to spend Hope to add a die?"*.* 
  - **Roll:** The dice hit the virtual table and the Banner is revealed to all players. (Note: Attack rolls and Damage rolls are conceptually separate phases here).
  - **Review:** The result hangs in the air as a Banner. The GM and players look at it. Features can add toggles here (e.g., "Spend 2 Stress to reroll the Hope die").
  - **Resolution:** The GM resolves the banner. Damage is dealt, resources are spent, and the world permanently changes.
   *(Note: The Action Loop is also used for GM Rolls, but uses a d20 instead of two d12s. An Action Loop can also run without any rolls at all, such as when posting a purely narrative banner).*
4. **Downtime:** The GM triggers a **Short Rest** or **Long Rest**, which clears certain trackers and triggers healing features.
5. **Sessions:** A **Session** can begin or end at any time, resetting "once per session" abilities.

### 0.4 Trust the framework (optional chaining, not defensive null walls)

Across hooks, chip `onUse` handlers, `when()` predicates, and any other feature logic, **trust the documented APIs**. Methods like `rangeFrom`, accessors on `table.rolls`, and similar helpers already return `null` or otherwise fail closed when something is missing (e.g. tokens not on the map). You do not need long chains of `x != null && y != null &&` before calling them — a comparison like `null === 'veryClose'` is already `false`.

Use **optional chaining** (`?.`) when you want a short path to “no effect” (`table.action?.target`, `t.action.target?.rangeFrom(t.action.attacker)`). Reserve explicit null checks for rare cases where the *language* would throw (not for “might be missing” data the framework already handles).

This applies to **all** feature code, not only movement or `move()` predicates. Implementation details and a bad/good example: **CONV-018** in `docs/v2-code-conventions.md`.

---

## 1. Building a Feature

At its core, a feature is just a JavaScript object. We divide the properties of a feature into two categories: **Passive Behaviors** (things that are always true) and **Active Behaviors** (things that require a player to make a decision and click a button).

### 1.1 The Basics

Let's build the simplest possible feature: a purely narrative ability.

```javascript
export const DanceTheTango = {
  name: "Dance the Tango",
  description: "You can perform a beautiful, distracting dance."
}
```

Congratulations, you have created a feature! If you attach this to an Ancestry, Community, Class, or Subclass, and a player selects that option, the engine will automatically:

1. Render it as a Card on the player's character sheet.
2. Allow the player to click the card to post a narrative Banner to the Game Table, announcing to the group that they are dancing the tango. The banner will remain on the table until the GM resolves it.

**Optional card title:** **`name`** is always the stable SRD identifier (engine keys, usage tracking). For a different **visible** title on the character sheet / hover card, set optional **`displayName`** to a string or **`(table) => string`** (same `table` as V2 card chips). The client resolves it in `build-feature-card-model.js` and defaults to **`name`**. See **CONV-037** in `docs/v2-code-conventions.md` (e.g. Druid **Beastform** includes the active beastform name while transformed).

### 1.2 The Default Card Action (Active Behavior)

Most features aren't free. They cost Hope, cost Stress, or can only be used once per rest. 

Because this is so common, the engine provides a shortcut. You can add **Active** properties directly to the root of your feature. When you do this, you are configuring the **Default Card Action**—the thing that happens when the player clicks the feature on their sheet.

```javascript
export const DanceTheTango = {
  name: "Dance the Tango",
  description: "You can perform a beautiful, distracting dance.",
  
  // These properties configure the Default Card Action:
  hopeCost: 1,
  frequency: 'session', // Can be 'session', 'shortRest', 'longRest', or 'rest' (both)
  
  onUse: (table) => {
    // We will cover the `table` object and hooks later!
    table.me.addCondition('Exhausted');
  }
}
```

**How this works:** 
Under the hood, the engine separates Passive and Active behaviors. Active behaviors belong to UI elements called **Chips**. When you put `hopeCost` or `frequency` at the root level like this, the engine creates a Chip for you and places it on the feature's Card. 

Later, in **Section 3**, we will learn how to write explicit Chips so you can put buttons on Review banners, Intents, and Statblocks, or offer multiple choices for a single feature. But for 90% of features, this root-level shortcut is all you need.

### 1.3 Declarative Behaviors (Passive Behavior)

Sometimes a feature doesn't need a button at all. It just changes the physics of the character. You can declare these passive effects, and the engine will automatically wire them up during the **Character Rendering** phase.

**Stat Mods**
Easily change a character's base math.

```javascript
export const Nimble = {
  name: "Nimble",
  description: "You gain +1 to your Evasion.",
  passiveStatMods: {
    evasion: 1,
    majorThreshold: 2 // Adds +2 to the Major damage threshold
  }
}
```

**Virtual Weapons**
Some features (like a Druid's Beastform attacks or a Katari's claws) give the character a brand new weapon that isn't in their inventory.

```javascript
export const RetractingClaws = {
  name: "RetractingClaws",
  description: "You have natural melee weapons.",
  virtualWeapons: [
    {
      name: "Claws",
      trait: "agility",
      range: "melee",
      damage: "d8" // Note: Virtual weapons can also have their own hooks! We'll cover that later.
    }
  ]
}
```

### 1.4 Conditional Wrappers (`when`)

Often, you only want a declarative behavior (or a hook, or a chip) to apply under specific circumstances. Instead of writing complex `if` statements inside functions, you can wrap *any* property in a `when()` condition.

The engine will evaluate the condition using the Game Table Snapshot (which we'll cover next) and unwrap the value only if the condition is true.

```javascript
import { when } from '../feature-utils';

export const SmoothTalker = {
  name: "Smooth Talker",
  description: "You have advantage on Presence rolls to charm guards.",
  // Wrap the specific trigger string inside the array
  advantageTriggers: [
    when((table) => table.action?.trait === 'Presence', "Presence rolls to charm guards")
  ]
}
```

Because checking "is the character who owns this feature the one currently acting?" or "are they the target of this action?" is so common, `when()` accepts multiple condition functions and requires *all* of them to be true. We also provide built-in helpers for common checks:

```javascript
import { when, isActing, isTargeted, hasDamage, hasPhysicalDamage } from '../feature-utils';

export const Retaliate = {
  // ...
  // Only unwrap this chip if I am the one acting, AND it is a melee attack
  chips: [
    when(
      isActing, 
      (table) => table.action?.range === 'melee', 
      { /* chip definition */ }
    ),
    // Or, unwrap this chip only if I am the target of an attack
    when(
      isTargeted,
      { /* defensive chip definition */ }
    ),
    // Or, only when taking physical damage (for reviewAction-phase chips)
    when(
      isTargeted,
      hasPhysicalDamage,
      { /* damage-reduction chip definition */ }
    )
  ]
}
```

**Built-in predicates:**


| Predicate              | True when...                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ |
| `isActing`             | The feature's owner is the one currently acting                                |
| `isTargeted`           | The feature's owner is one of the action's targets                             |
| `armorUseCommitted`    | The owner committed to use armor on this hit (`useArmorByTargetId` / `useArmor` on damage effects; §C.3) |
| `hasDamage`            | There is a pending damage effect targeting the feature's owner with amount > 0 |
| `hasPhysicalDamage`    | Same as `hasDamage`, but only for `damageType: 'physical'`                     |
| `isWithinFarRangeOfMe(table, otherActor)` | `table.me.rangeFrom(otherActor)` is a band other than `veryFar` (distance ≤ 100') |
| `isPrayerDicePoolNonEmpty` | Seraph **Prayer Dice**: at least one die remains in `table.me.prayerDice.pool` |
| `hasPrayerDiceAidableDamage` | Pending `{ type: 'damage' }` to you or to an ally PC within Far range (Seraph) |
| `prayerDiceAidRollEligible` | An action or damage roll is in progress and the actor is you or an ally PC within Far range |


---

## 2. The Game Table Snapshot

Whenever a feature needs to make a decision—whether inside a `when()` wrapper or a lifecycle hook—the engine passes it a single object: the **Game Table Snapshot** (often just called `table`).

The `table` object is a frozen-in-time representation of the entire game state. It exposes the game's internals through a set of subdocuments, allowing your feature to read the state of the world and write changes to it.

### 2.1 The Data Model

Here is a quick reference of the primary subdocuments available on the `table` object:

```javascript
// Global game state and engine methods
table.top.fear // e.g. 2
table.top.map // Access to the current battle map configuration
table.top.shortRest // Access to short rest downtime moves
table.top.longRest // Access to long rest downtime moves
// The Actor (Character or Adversary) that owns this feature
table.me.currentHP // e.g. 4
table.me.maxStress // e.g. 5
table.me.markStress(1) // Mutate the actor's state
table.me.actionLoop("Dance", "I do a cool dance") // Trigger a new Action Loop

// The current Action Loop context (Only defined during phase-based hooks/chips!)
table.action.actor // The entity currently acting
table.action.targets // Array of targeted entities
table.action.target // Convenience for targets[0]
table.action.attacker // Same as actor, but only defined on attacks

// The dice and modifiers involved in the current action
// (These exist during Intent, but their values are undefined until the Roll phase)
table.rolls.action.hopeDie.value // e.g. 4
table.rolls.action.fearDie.value // e.g. 2
table.rolls.damage.addDie({ name: 'Fire', die: 'd4' }) // Add a die to the damage roll
table.rolls.damage.statics[0] // e.g. { name: 'Ice', value: 2 }
table.rolls.other.Parry // Dynamic extra rolls

// All entities on the board
table.actors // Array of all entities
table.characters // Filtered array of characters
table.adversaries // Filtered array of adversaries
table.environments // Filtered array of active environments

// Actor Helpers (available on any actor, like table.me or table.action.target)
table.me.name // e.g. "Ribbet"
table.me.isCharacter // true
table.me.isActing // true if this actor is the one taking the action
table.me.isTargeted // true if this actor is the target of the action
table.me.rangeFromTarget // e.g. 'melee' or 'far'

// Feature local state
table.feature.set('timesUsed', 3) // Remember something across turns
table.feature.get('timesUsed') // e.g. 3
// Shared state for all features from the same class/subclass/ancestry/community *option row* (see below)
table.source.set('channeledElement', 'fire') // Same bag for every feature exported from that row
table.source.get('channeledElement') // e.g. 'fire'
// Read-only view of the full feature-state bag (same reference as game state)
table.featureState // e.g. { Reinforced: { reinforcedActive: true } }

// Automatic dice rolling (for inevitable mechanics — not player choices)
table.rollDie('d6') // Roll 1d6, returns the face value (e.g. 4)
table.rollDie('2d8') // Roll 2d8, returns the sum

// Chip local state (only available via the `chip` argument in `onUse`)
chip.isOn // True if the current toggle chip is active
chip.set('myLocalVar', true) // State scoped only to this specific chip
chip.get('myLocalVar') // e.g. true
```

**Shared option state (`table.source.get` / `table.source.set`).** Use this for **cross-feature shared persistence** tied to a **registry option row** (class, subclass, ancestry, community, weapon, armor, ability, item, consumable, beastform). **`table.feature.get` / `table.feature.set`** is keyed by the **current card’s SRD feature name** (per-feature counters, etc.) — do not confuse the two.

**`loadCharacterFeatures`** always sets **`_sourceScopeKey`** on every pushed feature: if the registry row defines a non-empty **`sourceScopeKey`**, that value wins (preserves human-readable bags and existing DB keys); otherwise the default is **`${collection}:${id}`** (e.g. `classes:srd-cls-druid`, `weapons:srd-wpn-…`, `beastforms:srd-bst-…`). It always sets **`_sourceObject`** to the row. **`buildTableSnapshot`** resolves the scope from **`activeFeature._sourceScopeKey`** or **`_sourceObject.sourceScopeKey`**, then exposes **`get`/`set`** on **`table.source`** for that shared `featureState[scope]` bag. Prefer **`table.source`** for shared state; use **`queueInternalMutation(table, 'setFeatureState', …)`** only for engine internals or rare cases — not as the default author API.

For **unit tests** that build feature objects without **`loadCharacterFeatures`**, pass **`_sourceScopeKey`** and **`_sourceObject`** explicitly when you need **`table.source`** behavior.

### 2.2 Reading vs. Writing

The `table` object is designed to be safe. 

- **Reading:** You can read from any property at any time to determine if your feature should trigger (e.g., `table.action?.attacker && table.me.rangeFromTarget === 'melee'`).
- **Writing:** When you call mutation methods like `table.me.markStress(1)` or `table.rolls?.damage?.addDie({ name: 'Fire', die: 'd4' })`, the engine queues those changes up and applies them at the correct time in the Action Loop.

The same `table` object is passed to every hook and conditional wrapper, providing a consistent interface.

*(Note: We will cover the exact properties and methods available on each subdocument in the Appendices).*

---

## 3. Building UI: Chips

While passive behaviors happen automatically, active behaviors require a player to make a decision. In DaggerheartGM, every interactive button, toggle, or action is defined as a **Chip**.

As we learned in Section 1.2, you can define a single "Default Card Action" by putting properties at the root of your feature. But if your feature needs to offer multiple choices, or if it needs to interrupt a roll, you will define an explicit array of `chips`.

### 3.1 What is a Chip?

A Chip is an object that tells the engine:

1. **What** it does (description).
2. **Where** to put it (placements).
3. **What** it costs.
4. **How** it changes the game when clicked.

Because phase-based chips (like those that interrupt a roll) usually only matter when the character who owns the feature is the one acting, you will frequently wrap them in a `when(isActing, ...)` condition.

```javascript
import { when, isActing } from '../feature-utils';

export const FelineInstincts = {
  name: "Feline Instincts",
  chips: [
    when(isActing, {
      description: "Spend 2 Hope to reroll the Hope die.",
      placements: ['reviewOutcome'], // Appears during the Review Outcome phase (on the banner)
      hopeCost: 2,
      onUse: (table, chip) => {
        table.rolls?.action?.hopeDie.reroll();
      }
    })
  ]
}
```

*Note: A chip will automatically use the feature's `name` as its title. If you have multiple chips and need to differentiate them, you can provide an explicit `name` property on the chip.*

### 3.2 Placements

The `placements` array tells the engine where in the UI (and when in the Action Loop) this chip should appear. We name placements after the phases of the Action Loop to keep things predictable, even if the UI changes.

- `'card'`: The chip appears on the feature's card in the character sheet.
- `'create'`: The chip appears in the character editor during the **Character Creation** phase. This is useful for features that require a choice (like picking a beastform) and can render as a dropdown or selection UI.
- `'intent'`': The chip appears during the **Intent** phase, *before* dice are rolled. 
- `'reviewAction'`: The chip appears during the **Review Action** phase, *after* dice are rolled but *before* the engine applies damage thresholds to calculate HP/Stress loss. Use this for: rerolling dice (e.g. spending Hope to reroll the Hope Die), adding extra damage dice, modifying raw damage values (e.g. halving incoming physical damage before thresholds), temporary Evasion reactions, and movement/positioning reactions. In short: if your chip reacts to the roll *result* but changes something *before* HP boxes are marked, it is `reviewAction`.
- `'reviewOutcome'`: The chip appears during the **Review Outcome** phase, *after* dice are rolled and *after* damage thresholds have already converted raw damage into HP/Stress loss effects. Use this **only** when the feature reduces (or otherwise modifies) the final number of HP or Stress *boxes* that will be marked — e.g., "mark 1 fewer Hit Point" or "mark 2 Stress instead of 1 HP". If you are not reading `e.stat === 'currentHP'` or `e.stat === 'currentStress'` effects, you almost certainly want `reviewAction` instead.

### 3.3 Costs, Frequencies, and Lifting

Chips can define their own resource costs and reset cycles. When a user clicks a chip, the engine automatically deducts the cost and marks the cycle as used.

```javascript
import { when, isActing } from '../feature-utils';

export const ChargeUp = {
  name: "Charge Up",
  chips: [
    // A card chip doesn't need `isActing` because it's clicked outside of an action loop.
    // WARNING: `table.action` is undefined here!
    {
      description: "Charge your weapon.",
      placements: ['card'],
      onUse: (table, chip) => {
        let current = table.feature.get('charges') || 0;
        table.feature.set('charges', current + 1);
        table.me.actionLoop("Charge Up", `I now have ${current + 1} charges!`);
      }
    },
    // Most phase-based chips only matter when I am the one acting.
    when(
      isActing, 
      (table) => table.feature.get('charges') > 0,
      {
        description: "Release charges for damage.",
        placements: ['intent'],
        onUse: (table, chip) => {
          let charges = table.feature.get('charges');
          table.rolls?.damage?.addDie({ name: 'Charge', die: 'd6', value: charges });
          table.feature.set('charges', 0);
        }
      }
    )
  ]
}
```

If a feature has multiple chips with `frequency` set, they track their usage independently.

**Multiple uses per cycle:** Set optional **`frequencyMaxUses`** on a chip (number, or `(table) => number`, default **1**). The host’s **`usageStore`** tracks **`count`** per `chipKey` until it reaches the max; **`trackChipFrequency(chipKey, frequency, usageStore, maxUses)`** accepts an optional fourth argument. Example: Syndicate **Reliable Backup** merges **`contactsEverywhereSessionUses: 3`** via **`applyDeclarativeFeatures`** onto the character; **Contacts Everywhere** uses **`frequencyMaxUses: (table) => table.me.contactsEverywhereSessionUses`**.

**Lifting:** If your feature only has a *single* chip, the engine will automatically "lift" its cost and frequency up to the feature level when displaying it on the character sheet. This ensures players can see the cost of their feature at a glance without having to expand the card.

### 3.4 The Toggle State

Sometimes you don't want a button to just "happen"; you want it to act as an on/off switch. You can opt into this by adding `isToggle: true` to your chip.

**With explicit `onUse`:** When a user clicks a toggle chip that has an `onUse` function, the function fires immediately on every toggle. You can check the current state of the chip via the `chip` argument.

```javascript
chips: [
  when(isActing, {
    description: "Take aim.",
    placements: ['intent'],
    isToggle: true,
    onUse: (table, chip) => {
      if (chip.isOn) {
        table.rolls?.action?.addDie({ name: 'Aim', die: 'd6' });
      } else {
        table.rolls?.action?.removeDie('Aim');
      }
    }
  })
]
```

**Without `onUse` (Gating a Hook):** If a toggle chip has **no `onUse`** and the feature also defines a hook at the same phase, the engine automatically links them: the hook only runs when the chip is toggled ON, and the engine handles reverting its effects when toggled OFF. This is the preferred pattern for features like "Spend X Hope to modify damage" — see Section 4.7 for details.

### 3.5 GM Approval

Any chip that mutates the game state requires GM approval. When a player clicks a chip, the GM must acknowledge it before the effects (and costs) are applied. 

For example, if a player clicks a chip to add a die to the damage roll during the Review phase, the GM must approve that specific chip before the loop can continue to final resolution.

*(In the future, GMs will have the option to check "Don't ask me again" for specific features to allow players to resolve them automatically).*

---

## 4. Adding Logic: Hooks

While Chips are for *choices*, Hooks are for *inevitabilities*. If a feature automatically changes a number (like adding +1 to a roll) or automatically triggers an effect (like clearing 1 HP every time you deal damage), you will use a Hook.

Hooks are functions that the engine calls at specific moments during the game lifecycle. 

### 4.1 Global Hook Execution

Before we list the hooks, you must understand a critical concept: **every feature on the table has its hooks executed for every event.**

If Actor X attacks Actor Y, a weapon feature belonging to Actor Z will have its hooks called. 

This allows you to build features like: "When an ally in melee range is attacked, you may..." or "Enemies within Close range of you have -1 Evasion."

Because every feature sees every event, you will almost always use conditional wrappers like `when(isActing, ...)` to filter out the 99% of events your feature doesn't care about.

### 4.2 Everything is an Action Loop

The engine treats most events at the table as an Action Loop. 

An attack is an Action Loop. A player making a narrative skill check is an Action Loop. A **Short Rest** is also an Action Loop (just one without dice). A **Session Start** is an Action Loop. 

Because of this, there are three primary Event Hooks. They form a perfect symmetry of intercepting and reacting:

- `onIntent(table)`: **Intercept Rolls.** Fires before dice are rolled. This is where you add modifiers or extra dice.
- `onReviewAction(table)`: **Intercept Raw Damage.** Fires after dice are rolled, but before damage thresholds convert raw damage into HP/Stress loss. Effects here have `type: 'damage'` with an `amount` field. Mutate `amount` to change damage before thresholds are applied (e.g., halving physical damage).
- `onReviewOutcome(table)`: **Intercept HP/Stress Loss.** Fires after damage thresholds have been applied. Effects have `stat: 'currentHP'` with `amount` representing boxes to mark. Mutate to reduce final impact (e.g., "reduce HP loss by 1").
- `onResolve(table)`: **React to Effects.** Fires after the GM approves the banner and the world is mutated. You can react to the `appliedEffects` (what *actually* happened).

*(Note: Not every Action Loop has an action target or dice. Use optional chaining as in §0.4, e.g. `table.action?.range === 'melee'` or `table.rolls?.action`.)*

### 4.3 Intercepting Rolls (onIntent)

Instead of special pipeline hooks, you modify math directly during the `onIntent` phase using write methods on the `table.rolls` objects.

```javascript
export const Reliable = {
  name: "Reliable",
  description: "When you attack with this weapon, you can add +1 to your action roll.",
  hooks: {
    onIntent: when(isActing, (table) => {
      table.rolls?.action?.addStatic({ name: 'Reliable', value: 1 });
    })
  }
}
```

### 4.4 Intercepting Effects (onReviewAction and onReviewOutcome)

The engine calculates what it *thinks* should happen and places it in `table.action?.effects`. This happens in a two-step pipeline:

1. **Review Action (`onReviewAction`)**: The engine proposes raw damage effects (e.g., `{ type: 'damage', target: Actor, amount: 14, damageType: 'physical' }`). Hooks and chips running in this phase can modify the raw `amount` before it is converted to HP loss.
2. **Threshold Conversion**: The engine internally applies the target's damage thresholds (Minor/Major/Severe) to convert the raw `damage` effects into HP/Stress loss effects.
3. **Review Outcome (`onReviewOutcome`)**: The engine proposes stat changes (e.g., `{ stat: 'currentHP', target: Actor, amount: 2, damageType: 'physical' }`). Hooks and chips running in this phase can modify the final HP or Stress amount before the GM resolves them.

You can mutate these pending effects before the GM resolves them.

```javascript
export const ThickSkin = {
  name: "Thick Skin",
  description: "You automatically reduce incoming physical damage by 1.",
  hooks: {
    // Thick Skin reduces HP loss, so it runs in onReviewOutcome
    onReviewOutcome: (table) => {
      // Find pending HP marking targeting me that is physical
      const incomingDamage = table.action?.effects?.find(
        effect => effect.stat === 'currentHP' && effect.target === table.me && effect.damageType === 'physical'
      );
      
      if (incomingDamage && incomingDamage.amount > 0) {
        incomingDamage.amount -= 1;
      }
    }
  }
}
```

*(Note: If a feature requires the player to spend Hope to reduce damage, that is a **Chip** with `placements: ['reviewAction']` or `placements: ['reviewOutcome']`, not a Hook! Hooks are only for automatic, inevitable changes).*

> **Scoping effects to the right target:** `table.action.effects` contains entries for *every* entity affected by the action (the target, the attacker, and any bystanders). Always check `e.target?.instanceId` before mutating an effect. For attacker-perspective features ("when you deal damage…"), scope to `table.action?.target?.instanceId`; for defender-perspective features ("when you take damage…"), scope to `table.me?.instanceId`. Implementation detail and rule ID: **CONV-026** in `docs/v2-code-conventions.md`.

### 4.5 Reacting to Effects (onResolve)

During the Resolve phase, the engine has mutated the world. `table.action?.effects` contains exactly what happened (e.g., `{ stat: 'currentHP', target: Actor, amount: 1 }`).

```javascript
export const Lifestealing = {
  name: "Lifestealing",
  description: "When you deal damage, clear 1 HP.",
  hooks: {
    onResolve: when(isActing, (table) => {
      // Check if any of the applied effects were HP marked on a target by me
      const dealtDamage = table.action?.effects?.some(
        effect => effect.stat === 'currentHP' && effect.source === table.me && effect.amount > 0
      );
      
      if (dealtDamage) {
        table.me.clearHP(1);
      }
    })
  }
}
```

### 4.6 Automatic Dice Rolls in Hooks (`table.rollDie`)

Some features automatically roll a die as part of their effect — not as a player choice, but as an *inevitable mechanic*. For these cases, use `table.rollDie(notation)`.

```javascript
export const Unshakable = {
  name: "Unshakable",
  description: "When you would mark a Stress, roll a d6. On a result of 6, don't mark it.",
  hooks: {
    onReviewOutcome(table) {
      // Find a pending stress effect targeting me
      const stressEffect = table.action?.effects?.find(
        (e) =>
          e.stat === 'currentStress' &&
          e.target?.instanceId === table.me?.instanceId &&
          e.amount > 0
      );
      if (!stressEffect) return;

      // Roll the d6 — the result is synchronous
      const roll = table.rollDie('d6');
      if (roll === 6) {
        stressEffect.amount = 0; // Cancel the stress marking
      }
    },
  },
};
```

**Supported notation:** `'dN'` (e.g. `'d6'`, `'d20'`) or `'NdM'` (e.g. `'2d8'`). Multi-die notations return the sum.

**Testability:** In tests, inject a deterministic RNG via `_rng` in the game state (passed to `runReviewOutcome` / `mockTable` / `mockGameState`):

```javascript
// Force the d6 to roll a 6
runReviewOutcome(Unshakable, { _rng: () => 5 / 6, ... });

// Force the d6 to roll a 1
runReviewOutcome(Unshakable, { _rng: () => 0, ... });
```

**When to use this vs. a Chip:** Use `table.rollDie()` only for *automatic, inevitable* rolls (no player choice). If the player needs to decide whether to roll (e.g. "spend 1 Hope to roll a d6"), use a Chip with `onUse` calling `table.rollDie()`.

---

### 4.7 Bridging Chips and Hooks

Sometimes a feature requires a player choice (a Chip) that changes what happens after the roll (a Hook). 

Because the `chip` object is only passed to a chip's `onUse` function, a hook cannot read `chip.isOn` directly. Instead, you use `table.feature.set()` to pass state from the chip to the hook.

*(Note: Resource costs defined on a chip, like* `hopeCost: 1`*, are automatically handled by the engine's transaction system. They are only deducted if the chip is active and the GM acknowledges the chip and intent).*

```javascript
export const PushAttack = {
  name: "Push Attack",
  chips: [
    when(isActing, {
      description: "Spend 1 Hope to push the target on a hit.",
      placements: ['intent'],
      hopeCost: 1,
      isToggle: true,
      onUse: (table, chip) => {
        // Store the toggle state at the feature level so our hook can see it
        table.feature.set('pushActive', chip.isOn);
      }
    })
  ],
  hooks: {
    onResolve: when(
      isActing,
      // Read the state we set in the chip
      (table) => table.feature.get('pushActive'), 
      (table) => {
        if (table.rolls?.action?.isSuccess) {
           table.action.addNarration('The target is pushed to Very Close. Please move them.');
        }
        // Clean up the state for the next action
        table.feature.set('pushActive', false);
      }
    )
  }
}
```

*(Note: For a full analysis of how these hooks map to the Daggerheart SRD, see `docs/hook-analysis.md`)*

### 4.7 Toggle Chips That Gate Hooks (Automatic Linking)

Often, a feature's effect is simple (halve damage, reduce HP loss) but requires a player choice and resource cost to activate. You *could* put all the logic in `onUse`, but then you'd have to manually handle both the toggle-on and toggle-off states (snapshotting original values, restoring them, etc.).

Instead, use the **chip-gates-hook** pattern: define a toggle chip with **no `onUse*`* and a hook at the same phase. The engine automatically links them:

1. The hook is **skipped** during phase execution (it won't fire unconditionally).
2. When the player toggles the chip **ON**, the engine snapshots the current effects, then runs the hook.
3. When the player toggles the chip **OFF**, the engine restores the snapshotted effects.
4. Resource costs are deducted only if the chip is ON when the GM acknowledges.

This dramatically simplifies features that gate a damage modification behind a player choice:

```javascript
import { when, isTargeted, hasPhysicalDamage } from '../feature-utils';

export const IncreasedFortitude = {
  name: "Increased Fortitude",
  description: "Spend 3 Hope to halve incoming physical damage.",
  chips: [
    when(isTargeted, hasPhysicalDamage, {
      placements: ['reviewAction'],
      hopeCost: 3,
      isToggle: true,
      // No onUse — the engine gates the hook below
    })
  ],
  hooks: {
    onReviewAction: (table) => {
      const dmg = table.action?.effects?.find(
        e => e.type === 'damage' &&
             e.target?.instanceId === table.me?.instanceId &&
             e.damageType === 'physical'
      );
      if (dmg) dmg.amount = Math.floor(dmg.amount / 2);
    }
  }
}
```

Compare this to writing it all in `onUse`, which would require manually storing the original damage, halving on toggle-on, restoring on toggle-off, and handling edge cases. The chip-gates-hook pattern eliminates all of that boilerplate.

**When to use this pattern:**

- The feature modifies `table.action.effects` (damage or stat changes) behind a player choice.
- The modification is simple enough to express as a hook (most are).

**When to use explicit `onUse` instead:**

- The chip needs to do something beyond mutating effects (e.g., setting feature state, adding dice to a roll, triggering a new action loop).
- The chip's toggle-on and toggle-off behaviors are asymmetric.

*(Note: For a full analysis of how these hooks map to the Daggerheart SRD, see `docs/hook-analysis.md`)*

---

## Appendices

### A. Declarative API Reference

Declarative properties (often called "Passive Behaviors") are evaluated during the **Character Rendering** phase. They alter the character's base math, add new capabilities, or define persistent states without requiring the player to click a button.

Below is the complete list of declarative properties you can add to the root of a feature object.

#### The Recursive Unwrapper (`when` goes anywhere)

The engine uses a "recursive unwrapper" to evaluate declarative properties. This means you can place a `when()` wrapper *anywhere* in the declarative tree—you can wrap an entire property, an individual key-value pair inside an object, or a single element inside an array. The engine will walk the tree, evaluate the conditions, and seamlessly strip out anything that returns false.

Always place the `when()` wrapper where it makes the most semantic sense and produces the cleanest code.

```javascript
// Wrap an entire object if the whole block is conditional
passiveStatMods: when((table) => table.me.isBloodied, { evasion: 1, armorScore: 2 })

// Or wrap individual values if you want to mix static and conditional mods
passiveStatMods: {
  evasion: 1,
  armorScore: when((table) => table.me.isBloodied, 2)
}
```

#### `passiveStatMods`

An object containing modifiers to the character's core attributes. These are added together across all active features.

Each value can be either a **static number** or a **function** for values that depend on runtime state. Functions receive two arguments: `(table, feature)` — the current Game Table Snapshot and the feature object itself.

- `(table) => number` — scales with game state (e.g., Proficiency, level)
- `(table, self) => number` — scales with per-instance weapon data (e.g., `self._weaponTier` for weapon properties)

```javascript
passiveStatMods: {
  // Core Stats
  evasion: 1,
  armorScore: 2,
  maxHP: 1,
  maxStress: 2,
  maxHope: 1,
  maxArmor: 1, // Adds an additional Armor Slot
  
  // Traits
  agility: 1,
  strength: 1,
  finesse: 1,
  instinct: 1,
  presence: 1,
  knowledge: 1,
  
  // Damage Thresholds
  majorThreshold: 2,
  severeThreshold: 3,
  
  // Rest Slots
  numShortRestSlots: 1,      // Extra short-rest downtime move slots
  numLongRestSlots: 1,       // Extra long-rest downtime move slots
  numLongMovesInShortRest: 1 // Short-rest slots that may use long-rest move list
}

// Example: dynamic value scaling with Proficiency
passiveStatMods: {
  majorThreshold: (table) => table.me?.proficiency ?? 1,
  severeThreshold: (table) => table.me?.proficiency ?? 1,
}

// Example: tier-varying weapon property (e.g. Barrier)
passiveStatMods: {
  armorScore: (table, self) => (self?._weaponTier ?? 1) + 1,
  evasion: -1,
}
```

**Weapon property context fields** — when a `passiveStatMods` function runs for a weapon property feature, the `self` object carries these fields injected by the engine:

- `self._weaponId` *(string)*: The ID of the source weapon. Use this with `table.me.weapons` to look up the weapon object and read its tier, range, etc.
- `self._weaponFeatureText` *(string | undefined)*: The raw feature text from the weapon's SRD entry (e.g. `"+3 to Armor Score; -1 to Evasion"`). Available as a last-resort fallback.

Prefer reading tier via `table.me.weapons` rather than any field on `self`:

```javascript
// ✓ Preferred — reads tier from the live weapon object
armorScore: (table, self) => {
  const weapon = table.me?.weapons?.find((w) => w.id === self?._weaponId);
  return (weapon?.tier ?? 1) + 1;
},
```

#### `virtualWeapons`

An array of weapon objects. These weapons are added to the character's attack options but do not exist in their inventory (e.g., natural claws, magical blasts, or Beastform attacks). 

Because virtual weapons are essentially just mini-features that act as weapons, they can have their own `chips` and `hooks` just like a normal feature!

```javascript
virtualWeapons: [
  {
    name: "Retracting Claws",
    trait: "agility",
    range: "melee",
    damage: "d8",
    description: "Your natural claws.",
    // Virtual weapons can also have their own hooks!
    hooks: { ... }
  }
]
```

**Activation costs:** If the SRD requires the player to spend a resource to use the weapon (e.g. "Mark a Stress to use your tongue"), declare the cost directly on the virtual weapon object using the same cost properties you would use on a chip:

```javascript
virtualWeapons: [
  {
    name: "Long Tongue",
    trait: "finesse",
    range: "close",
    damage: "d12",
    stressCost: 1,   // SRD: "Mark a Stress to use your tongue as a weapon"
  }
]
```

Supported cost properties on virtual weapons: `hopeCost`, `stressCost`, `armorMark`, `armorClear`. The engine automatically deducts these when the weapon is used. Do **not** add a `chips` array inside a virtual weapon object to express a cost — that pattern is not documented and not supported.

**`multiTarget: true`** — Set this when the SRD says the attack can target "a target or group of targets". The engine will enable multi-target selection in the UI so the player can choose one or more targets before the attack resolves.

```javascript
virtualWeapons: [
  {
    name: "Elemental Breath",
    trait: "instinct",
    range: "veryClose",
    damage: "d8",
    damageType: "magic",
    multiTarget: true,   // SRD: "against a target or group of targets"
  }
]
```

> **Important:** Only include `damage` when the SRD explicitly states a damage expression (e.g. "deals **d8** magic damage"). If the SRD describes an attack that only applies a condition or narrative effect on success, omit `damage` entirely — do not invent a value.

#### `advantageTriggers`

An array of strings or `when()` conditions that describe situations where the character has Advantage. The engine uses these to automatically offer Advantage chips during the Intent phase when the condition is met.

```javascript
advantageTriggers: [
  "rolls to recall historical facts",
  when((table) => table.action?.range === 'melee', "melee attacks against larger foes")
]
```

**Rule:** If the SRD text specifies a particular trait (e.g. "Agility Rolls", "Presence Rolls"), you **must** wrap the trigger string in a `when()` predicate that checks `table.action?.trait === 'TraitName'`. Without the guard the engine will offer the Advantage chip on every roll, regardless of trait.

```javascript
// SRD: "You have advantage on Agility Rolls that involve balancing and climbing."
advantageTriggers: [
  when(
    (table) => table.action?.trait === 'Agility',
    'Agility Rolls that involve balancing and climbing'
  )
]
```

Plain narrative conditions (e.g. "rolls to intimidate hostile creatures") that describe *what* you are doing rather than *which trait* you are rolling are fine as plain strings.

#### `damageAffinities`

An object defining how the character reacts to specific types of damage. The engine automatically applies these during the Review phase before thresholds are calculated.

```javascript
damageAffinities: {
  // You can use when() on individual array elements
  resistances: ['physical', when((table) => table.me.hasCondition('shielded'), 'magic')],
  immunities: ['fire'],
  vulnerabilities: ['ice']
}
```

#### `rangeOverrides`

A plain object that remaps range band names. When this character uses a weapon, ability, spell, or feature, any stated range that matches a key in `rangeOverrides` is treated as the corresponding value instead. The engine and map system use this when computing target eligibility.

```javascript
// Treat any Melee-range weapon or feature as Very Close range
rangeOverrides: { melee: 'veryClose' }
```

Valid range band names (both keys and values): `'melee'`, `'veryClose'`, `'close'`, `'far'`, `'veryFar'`.

If multiple active features each declare `rangeOverrides`, their maps are merged. In the rare case of a conflict on the same key, the last-loaded feature wins.

`applyDeclarativeFeatures` returns the merged `rangeOverrides` object in its result. Consumers (target-selection logic, weapon card display) apply it by looking up a weapon's `range` in the map and using the value when present, or the original range when absent.

#### `onRender` (weapon properties)

Optional **root-level** function on **weapon property** features (not inside `hooks`). Runs during **`applyDeclarativeFeatures`** with the usual character snapshot (`table.me` is the owning character).

**`table.source`** is the **weapon option row** for this feature (`registry.weapons[id]`). During declarative evaluation the engine passes a **shallow copy**, so you may set **`table.source.isDisabled`** and **`table.source.disabledReason`** without mutating the shared registry (which would affect every character).

```javascript
// SRD Pompous — must have Presence 0 or lower
onRender(table) {
  if ((table.me?.traits?.presence ?? 0) > 0) {
    table.source.isDisabled = true;
    table.source.disabledReason = 'Requires Presence ≤ 0';
  } else {
    table.source.isDisabled = false;
  }
}
```

- Wrap the handler in **`when(...)`** if it should only run under certain predicates.
- After **`onRender`**, the engine copies **`isDisabled` / `disabledReason`** from that ephemeral **`table.source`** into **`weaponRenderHints[weaponId]`** for merge onto the character element (same pattern as `_rangeOverrides` / `substituteArmorForHope`).
- **`table.me.primaryWeapon`**, **`secondaryWeapon`**, and **`weapons`** include **`isDisabled`** / **`disabledReason`** when hints are merged onto the element before **`buildTableSnapshot`**.
- **Host UI** (Game Table / character sheet) must respect **`isDisabled`** on weapon views when V2 integration is enabled — see **V2 UI integration backlog** in `docs/v2-migration-tracker.md`.

**Persisted feature state during declarative rendering:** For character sheet / stat recomputation, `applyDeclarativeFeatures` merges, in order: `tableBase.featureState` (from `buildTableSnapshot`, i.e. the live game-state bag), then `character.featureState` (character wins on overlapping keys). Values in that bag should come from runtime `table.feature.set(...)` (e.g. in hooks), not from ad hoc element fields. Export `mergeDeclarativeFeatureState(character, tableBase)` if you need the merged bag outside `applyDeclarativeFeatures`.

### B. Hooks and Chips Reference

This section provides a complete reference for defining Hooks and Chips in your features.

#### B.1 Hooks Reference

Hooks are functions defined inside the `hooks` object of a feature. They are called automatically by the engine at specific phases of the game lifecycle. Every feature on the table has its hooks executed for every event, so you should almost always use `when()` to filter when your hook actually runs.

- `onIntent(table)`: **Intercept Rolls.** Fires during the Intent phase of an Action Loop, *before* dice are rolled. This is the correct place to add modifiers, extra dice, or advantage to a roll (e.g., using `table.rolls.action.addStatic()`).
- `onStateChange(table)`: **Post-mutation logic (outside the Action Loop).** Fires when the host calls `dispatchStateChangeHooks(gameState, features, mutationBatch)` after applying a batch of table mutations (e.g. clearing armor on the character, rest moves). **`gameState` must already reflect post-mutation truth**; `mutationBatch` is the same batch, for predicates. During this hook only, `table.mutationBatch` is a read-only copy of that batch (each entry `{ type, payload }` matches queued mutations such as `clearArmor`, `markArmor`). In all other snapshots `table.mutationBatch` is `[]`. Use `when()` so the hook runs only when the batch is relevant (e.g. “this batch includes `clearArmor` for `table.me`”).
- `onTokenMove(table)`: **Battle map position change (outside the Action Loop).** Fires when the host calls `dispatchTokenMoveHooks(gameState, features, { moverInstanceId })` after a token’s position is updated. **`table.me` is always the feature owner** (never the moved token). The moved actor is **`table.tokenMove.mover`** (`moverInstanceId` matches the token that moved). **`gameState` must be post-move**; `gameState._previousPositions[moverInstanceId]` must store that token’s coordinates **before** the move so `mover.lastPosition.rangeFrom(table.me)` is meaningful. `table.mutationBatch` contains `{ type: 'tokenMove', payload: { moverInstanceId } }`. Use `when()` to detect range-band changes (e.g. adversary leaving your Melee — see **Attack of Opportunity** in `classes/Warrior.js`).
- `onSceneEnd(table)`: **Encounter scene boundary (outside the Action Loop).** Fires when the host calls `dispatchSceneEndHooks(gameState, features)` — e.g. when the table leaves a combat scene. Not the same as **session** start/end. `table.mutationBatch` contains `{ type: 'sceneEnd', payload: {} }` for predicates. Use for SRD text like “when the scene ends” (e.g. **Unstoppable** in `classes/Guardian.js`).
- `onReviewAction(table)`: **Intercept Raw Damage.** Fires during the Review Action phase, *after* dice are rolled but *before* damage thresholds are applied. Effects in `table.action.effects` at this stage have `type: 'damage'` with a raw `amount` (the number that will be compared against thresholds). Mutate `amount` here to change damage before it becomes HP loss. If the feature has a toggle chip at `reviewAction` without `onUse`, this hook is automatically gated by that chip (see Section 4.7).
- `onReviewOutcome(table)`: **React to Rolls & Intercept Effects.** Fires during the Review Outcome phase, *after* dice are rolled and *after* the engine has applied damage thresholds to convert raw damage into HP/Stress loss. Effects here have `stat: 'currentHP'` or `stat: 'currentStress'` with `amount` representing the number of boxes to mark. Mutate these to reduce or increase the final HP/Stress impact.
- `onResolve(table)`: **React to Effects.** Fires during the Resolve phase, *after* the GM has approved the banner and the world has been permanently mutated. You can read `table.action.appliedEffects` to see what actually happened and trigger follow-up actions (e.g., "When you deal damage, clear 1 Stress").
- `onRest(table)`: **Downtime.** Fires when the GM triggers a Short Rest or Long Rest. You can check `table.action.restType` (which will be `'short'` or `'long'`) and apply healing or reset local feature state.
- `onSessionStart(table)`: **Session Management.** Fires when the GM starts a new Session. Useful for features that need to do something specific at the very beginning of a session beyond just resetting `'session'` frequency chips.

#### B.2 Chips Reference

Chips are interactive UI elements (buttons or toggles) defined in the `chips` array of a feature. They allow players to make choices and spend resources.

**Core Properties:**

- `description` *(string, required)*: A clear explanation of what the chip does. Displayed on the UI.
- `placements` *(array of strings, required)*: Where and when the chip appears. Valid values:
  - `'card'`: On the feature's card in the character sheet.
  - `'create'`: In the character editor during Character Creation.
  - `'intent'`: On the pre-roll banner during the Intent phase.
  - `'reviewAction'`: On the post-roll banner during the Review Action phase (before thresholds).
  - `'reviewOutcome'`: On the post-roll banner during the Review Outcome phase (after thresholds).
- `onUse` *(function(table, chip))*: The function executed when the chip is clicked (or toggled). The `chip` argument provides access to local chip state (e.g., `chip.isOn`, `chip.set()`). If omitted, the chip will still deduct any specified resource costs or toggle its state, which is useful for chips that purely act as state flags for hooks.

**Optional Properties:**

- `showOnOtherSheets` *(boolean)*: When `true`, the chip may be included when the host calls `collectChipsForOtherCharacterSheets(viewerId, party, registry, phase, gameState)` — the engine evaluates predicates with **`table.me` = the character whose sheet is open** (including when that character **owns** the feature), while the chip still carries `_ownerInstanceId` / `_crossSheetFromOwnerInstanceId` from the **source** feature (e.g. Bard **Rally** spend under Modifiers for allies **and** for the Bard). Normal `collectChips` ignores this flag. Intended UI placement: the **Modifiers** row under Experiences (`CharacterExperiences` prop `crossSheetChips` in the SPA).
- `name` *(string)*: The title of the chip. If omitted, defaults to the Feature's name.
- `isToggle` *(boolean)*: If `true`, the chip acts as an on/off switch. The `onUse` function fires immediately on toggle, and you can check `chip.isOn` to apply or remove effects.
- `isSelect` *(function)*: If provided, the chip renders as a dropdown (`<select>`) instead of a button. Must be a function `(table) => [{ id, name, description? }, ...]` that returns the list of options to display. When the player confirms a selection, the engine stores the chosen id in chip state (accessible via `chip.get('selectedId')`) and then calls `onUse`. Use this for permanent one-time choices made during character creation — e.g. picking an Experience to receive a permanent bonus.
- `multiSelect` *(boolean)* with **`isSelect`**: When both are set, the UI should allow picking **multiple** option ids (e.g. Attack of Opportunity: 1 choice on a success, 2 on a critical). Pass `{ selectedIds: string[] }` into chip activation; read them with `chip.get('selectedIds')`. Use optional **`maxSelections`** *(number | `(table) => number`)* to cap how many ids the UI allows (the engine does not enforce the cap — validate in `onUse` if needed).

```javascript
// Example: a create-time choice that grants a permanent bonus
{
  description: 'Choose an Experience to gain +1.',
  placements: ['create'],
  isSelect: (table) => table.me?.experiences.map(e => ({ id: e.id, name: e.name })),
  onUse: (table, chip) => {
    const selectedId = chip.get('selectedId');
    if (selectedId) table.me?.addExperienceBonus(selectedId, 1);
  },
}
```

- `selectTargets` *(function)*: If provided, the chip renders a combat target picker instead of (or before) the normal button. Must be a function `(table) => Actor[]` that returns the list of valid target Actors the player can choose from. When the player confirms their selection, the host calls `activateChip(chip, table, chipState, { selectedTargetIds: string[] })`; **`chip-system.js`** copies that array into chip state, then `onUse` reads it with `chip.get('selectedTargetIds')` (feature code does not call `set` for this). Use this for features that apply effects to chosen combatants — e.g. Bard **Make a Scene** (one adversary), weapon properties that bounce to extra targets, or secondary weapon damage.
- `multiSelect` *(boolean)*: When `true` (and `selectTargets` is also set), the player can select multiple targets from the list. When `false` or omitted, only a single target may be selected. The number of selected targets can drive a variable `stressCost` function.

```javascript
// Example: Bouncing — mark Stress to hit additional targets in range
when(isActing, (table) => table.action?.type === 'attack', (table) => table.rolls?.action?.isSuccess, {
  description: 'Mark Stress to bounce to additional targets in range.',
  placements: ['reviewAction'],
  stressCost: (table) => table.feature.get('bounceTargets') ?? 0,
  multiSelect: true,
  selectTargets: (table) => {
    const targetId = table.action?.target?.instanceId;
    return table.adversaries.filter((a) => a.instanceId !== targetId);
  },
  onUse(table, chip) {
    const selectedIds = chip.get('selectedTargetIds') || [];
    table.feature.set('bounceTargets', selectedIds.length);
    const targets = table.adversaries.filter((a) => selectedIds.includes(a.instanceId));
    if (targets.length > 0) {
      table.action?.addDamageRoll({ name: 'Bouncing', dice: 'd8', targets });
    }
  },
})

// Example: Doubled Up — deal secondary weapon damage to another Melee target
when(isActing, (table) => table.action?.type === 'attack', (table) => table.rolls?.action?.isSuccess, {
  description: 'Deal secondary weapon damage to another target within Melee range.',
  placements: ['reviewAction'],
  selectTargets: (table) => {
    const targetId = table.action?.target?.instanceId;
    return table.adversaries.filter(
      (a) => a.instanceId !== targetId && table.me?.rangeFrom(a) === 'melee'
    );
  },
  onUse(table, chip) {
    const selectedIds = chip.get('selectedTargetIds') || [];
    const target = table.adversaries.find((a) => selectedIds.includes(a.instanceId));
    if (target) {
      const diceStr = table.me?.secondaryWeapon?.damage ?? 'd6';
      table.action?.addDamageRoll({ name: 'Doubled Up', dice: diceStr, targets: [target] });
    }
  },
})
```

**Resource Costs & Frequencies:**
When these properties are defined on a chip, the engine automatically handles deducting the cost or tracking the usage cycle when the GM approves the action.

- `hopeCost` *(number | `(table) => number`)*: Amount of Hope to spend. Can be a function evaluated at deduction time.
- `stressCost` *(number | `(table) => number`)*: Amount of Stress to mark. Can be a function evaluated at deduction time.
- `armorMark` *(number | `(table) => number`)*: Number of Armor slots to mark. Can be a function evaluated at deduction time.
- `armorClear` *(number | `(table) => number`)*: Number of Armor slots to clear. Can be a function evaluated at deduction time.
- `frequency` *(string)*: Limits how often the chip can be used. Valid values: `'session'`, `'shortRest'`, `'longRest'`, or `'rest'` (resets on both short and long rests).
- `frequencyMaxUses` *(number | `(table) => number`, optional)*: How many times this chip may be used per frequency cycle (default **1**). Use when a rule grants multiple uses per session/rest (e.g. **Reliable Backup** and **Contacts Everywhere**).
- `temporaryStatMods` *(object)*: A declarative object of stat boosts to apply for the duration of the current action loop when this chip is used. Each value can be a static number (e.g., `{ evasion: 2 }`) or a function `(table) => number` for dynamic boosts (e.g., `{ evasion: (table) => table.me?.armor ?? 0 }`). Function values are resolved at activation time and cached so toggle-off removes the same amount.

**Variable costs:** When `stressCost` (or any cost property) is a function, the engine calls it with the current `table` at the moment the cost is deducted (after GM approval). The typical pattern is for the chip's `onUse` to store the player's chosen amount in feature state, and for the cost function to read it back:

```javascript
{
  description: "Mark Stress to bounce to that many targets.",
  placements: ['reviewAction'],
  stressCost: (table) => table.feature.get('bounceTargets') ?? 1,
  onUse: (table, chip) => {
    const count = table.feature.get('bounceTargets') ?? 1;
    // queue count additional attack effects…
  }
}
```

Because `table.feature.set()` updates the snapshot's in-memory state synchronously, any value stored by `onUse` is immediately visible to a subsequent `stressCost` function call on the same snapshot.

**Armor-for-Hope substitution:** Armor property features that set the declarative boolean **`substituteArmorForHope: true`** (e.g. the SRD **Hopeful** property) cause `applyDeclarativeFeatures` to return **`substituteArmorForHope`** in its result. The **client must merge** that onto the character element (`element.substituteArmorForHope = true`) before building table snapshots so `table.me.substituteArmorForHope` is accurate. The engine never looks up armor by SRD name (see **CONV-029**).

- Manual calls: `table.me.spendHope(amount, { armorInstead: true })` queues **`markArmor`** for that many slots instead of `spendHope`. Throws if `substituteArmorForHope` is not true on the element or there are not enough available armor slots (`armor`).
- Chip costs: `deductChipCosts(chip, table, { armorInsteadOfHope: true })` uses substitution only when `table.me.substituteArmorForHope` **and** there are enough armor slots; otherwise it spends Hope normally.

*(Note: If a feature only has a single chip, you can place these properties directly at the root of the feature object to define the "Default Card Action".)*

### C. Game Table Snapshot Reference

The Game Table Snapshot (usually named `table`) is passed to every hook and `when()` condition. It provides a frozen-in-time view of the game state and exposes methods to safely mutate that state.

#### C.1 Global State (`table.top`)

Contains global information about the game table.

- `table.top.fear` *(number)*: The GM's current Fear pool.
- `table.top.map` *(object)*: Information about the current battle map and token placements.
- `table.top.shortRest` / `table.top.longRest` *(object)*: Access to downtime moves (only relevant during Rest action loops).
- `table.top.broadcast(message)` *(method)*: Posts a generic string to the Action Log. **Do not use this for feature mechanics or character-scoped prompts** — use **`table.me.actionLoop(title, description)`** instead so the host can show a proper banner / action loop (see **CONV-033** in `docs/v2-code-conventions.md`). Reserve `broadcast` for rare OOC or debug-style messages only.

**Write Methods (Queued Mutations):**

- `gainFear(amount)`: Adds Fear to the GM's pool.
- `spendFear(amount)`: Removes Fear from the GM's pool.

#### C.2 Actors (`table.me`, `table.action.actor`, `table.actors`)

Entities on the board (Characters and Adversaries) share a common Actor API. `table.me` always refers to the Actor that owns the feature currently executing. **`table.action.actor`** is whoever initiated the current Action Loop — use it when an effect should apply to **that** character’s roll (e.g. Bard **Rally** **Spend Rally Die — Action** / **Spend Rally Die — Damage**: two **`reviewAction`** chips; `when()` checks **`table.feature.get('partyDice')`**, **`table.action.actor`**, and either **`table.rolls.action`** or **`table.rolls.damage`**; **`onUse`** updates **`partyDice`** on spend, not **`table.me`**).

**Read Properties:**

- `name` *(string)*: The actor's name.
- `isCharacter` / `isAdversary` *(boolean)*: Entity type flags.
- `isActing` *(boolean)*: True if this actor initiated the current Action Loop.
- `isTargeted` *(boolean)*: True if this actor is one of the targets of the current Action Loop.
- `currentHP`, `maxHP`, `currentStress`, `maxStress`, `hope`, `armor`, `maxArmor` *(numbers)*: Current resource values. `armor` is the number of currently available (unmarked) armor slots; `maxArmor` is the total number of slots.
- `armorScore` *(number)*: Static Armor Score from equipped armor (used for rules that reduce damage by “your Armor Score,” e.g. Warded). Distinct from slot counts `armor` / `maxArmor`. Defaults to `0` when not set on the element.
- `substituteArmorForHope` *(boolean)*: When true, this actor may pay Hope costs by marking armor slots (`spendHope` with `{ armorInstead: true }`). Populated from declarative feature data via `applyDeclarativeFeatures` → merge onto the element (not by hardcoding SRD names in the engine).
- `traits` *(object)*: The character's six trait scores as an object: `{ agility, strength, finesse, instinct, presence, knowledge }`. Each value is a number (e.g. `table.me.traits.agility`). Defaults to `{}` for adversaries (traits not applicable).
- `difficulty` *(number | null)*: **Adversaries only** — the stat block's base Difficulty value (before runtime modifiers). Characters use Evasion for defense instead; for them this is `null`.
- `difficultyMod` *(number | null)*: **Adversaries only** — cumulative runtime change to Difficulty (e.g. from Bard **Make a Scene**). `0` when unset. **Characters:** `null`.
- `effectiveDifficulty` *(number | null)*: **Adversaries only** — `difficulty + difficultyMod` for DC checks vs this stat block. Prefer this over `difficulty` alone when evaluating whether a roll meets or beats the adversary's Difficulty. **Characters:** `null`.
- `weaponRenderHints` *(object)*: Map of weapon id → `{ isDisabled?, disabledReason? }` from weapon property **`onRender`** (merge **`weaponRenderHints`** from `applyDeclarativeFeatures` onto the element). Read-only getter returns a shallow copy. Empty when no hints apply.
- `proficiency` *(number)*: The character's current Proficiency score (base 1, increases with advancement picks). Defaults to `1` when not explicitly set on the element.
- `level` *(number)*: The character's level (typically 1–10). Distinct from proficiency — use this for SRD effects keyed to level (e.g. damage bonuses, token caps). Defaults to `1` when not explicitly set on the element.
- `tier` *(number)*: Character tier (1–4). When **`element.tier`** is set, that value is used; otherwise the engine derives tier from **`level`** (level 1 → tier 1; levels 2–4 → tier 2; levels 5–7 → tier 3; levels 8+ → tier 4).
- `classId` / `subclassId` *(string | null)*: **Characters** — optional SRD option ids (`srd-cls-*`, `srd-sub-*`) when present on the element. Used for rules that depend on class/subclass (e.g. Bard **Rally** die size vs Wordsmith **Epic Poetry** d10) without hardcoding feature display names in the engine (**CONV-029**).
- `activeModifiers` *(array)*: Read-only copy of **`element.activeModifiers`** — runtime modifier tokens shared with the Phase 1 Game Table (`[{ id, name, dice?, value?, mode?, type?, refreshOn?, … }]`). Bard **Rally** grants **Rally Die** entries here; the sheet UI and banner toggles read the same field.
- `addActiveModifier(mod)` *(method)*: Queues **`appendActiveModifier`** — host appends **`mod`** to **`element.activeModifiers`**. **`mod`** must include **`id`** and **`name`** (e.g. `{ id: 'rally-die-<instanceId>', name: 'Rally Die', dice: 'd6', type: 'rally', refreshOn: 'session' }`). When applying a batch of V2 mutations to table state, merge modifier rows with **`applyV2ActiveModifierMutations`** in `src/client/lib/table-ops.js` (handles **`appendActiveModifier`** and **`removeActiveModifier`** in order; ignores other mutation types).
- `removeActiveModifier(id)` *(method)*: Queues **`removeActiveModifier`** — host removes the modifier with that **`id`** when the table clears a token (e.g. after spend is resolved in the VTT).
- `spellcastTrait` *(string | null)*: **Characters** — trait **key** for this subclass’s Spellcast trait (e.g. `'presence'`). Host sets from the builder / sync. Use with `traits[spellcastTrait]` for rules that count Spellcast (e.g. Seraph **Prayer Dice** session-start d4 count). `null` when unset.
- `contactsEverywhereSessionUses` *(number)*: **Characters** — max uses per session for the **Contacts Everywhere** card chip (`1` by default; **Reliable Backup** sets **`3`** via `applyDeclarativeFeatures` → merge onto the element for `frequencyMaxUses`).
- `shadowStepperVeryFarUnlocked` *(boolean)*: **Characters** — merged from **Nightwalker** **Fleeting Shadow** via `applyDeclarativeFeatures` / `mergeV2DeclarativeSheetOverlay`. When true, **Shadow Stepper** uses Very Far range (`table.me.shadowStepperVeryFarUnlocked` in snapshots).
- `prayerDice` *({ pool: number[] } | null)*: **Characters — Seraph Prayer Dice.** Read-only view of `element.prayerDice.pool` (remaining d4 faces 1–4 for this session). Empty `pool` when unset.
- `setPrayerDicePool(pool)` *(method)*: Queues **`setPrayerDicePool`** — host persists `prayerDice` on the element (typically from **`hooks.onSessionStart`** after rolling one d4 per Spellcast point).
- `removePrayerDieAt(index)` *(method)*: Queues **`removePrayerDieAt`** after spending a die from **reviewAction** chips.
- `clearPrayerDicePool()` *(method)*: Queues an empty pool (session end).

**Tag Team (co-op rolls)** — core session allowance is **`DEFAULT_TAG_TEAM_INITIATIONS_PER_SESSION`** (1) from `src/features-v2/engine/table.js`; initiator Hope cost before partner discounts is **`DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST`** (3). Features merge **`extraTagTeamInitiationsPerSession`** and **`tagTeamPartnerHopeDiscount`** from `applyDeclarativeFeatures` onto the element. *Example shape for a future full **Camaraderie** implementation:* +1 initiation; discount `1` so an ally pays 2 Hope instead of 3 when you are the partner — **Camaraderie** is narrative-only in V2 until Tech Debt “Implement **Camaraderie** fully” (`docs/v2-migration-tracker.md`).

- `extraTagTeamInitiationsPerSession` *(number)*: Added to the core allowance for **`tagTeamInitiationsBudget`** / **`tagTeamInitiationsRemaining`**.
- `tagTeamPartnerHopeDiscount` *(number)*: Subtracted from the initiator’s cost when **`gameState.action.type === 'tagTeam'`** and **`tagTeamPartnerInstanceId`** points at this character.
- `tagTeamInitiationsBudget`, `tagTeamInitiationsUsedThisSession`, `tagTeamInitiationsRemaining` *(numbers)*: Read-only session math; the host persists **`tagTeamInitiationsUsedThisSession`** on the element.
- `consumeTagTeamInitiation()` *(method)*: Queues **`setTagTeamInitiationsUsed`** (increment). Throws when no initiations remain.
- `resetTagTeamInitiationsForSession()` *(method)*: Queues used count **0** — call when a new **session** begins (alongside other session-scoped resets).

- `registry` *(object)*: The V2 registry passed on **`gameState.registry`** when building snapshots (same object as **`loadCharacterFeatures(character, registry)`**). Exposed as **`table.registry`** (read-only reference). Druid **Beastform** / **Evolution** **`isSelect`** callbacks filter **`table.registry.beastforms`** by **`table.me.tier`** (see `classes/Druid.js`).
- `domainLoadoutDisabled` *(boolean)*: When **`true`** (merged from **`applyDeclarativeFeatures` → `domainLoadoutDisabled`** while a beastform is active), the host should treat domain spell cards as unavailable — Druid **Beastform** / **Evolution** SRD: no casting from domain cards while transformed.
- `experiences` *(array of `{ id, name }`)*: The character's experience list. Use in `isSelect` callbacks to populate a picker for create-time choices. Also use to detect whether the player used an experience on the current roll: when a player applies an experience during the Intent phase, the engine adds `{ name: experienceName, value: 2 }` to `table.rolls.action.statics`. Cross-referencing `table.me.experiences` names against `table.rolls.action.statics` tells you whether any experience was used:

  ```javascript
  const expNames = new Set((table.me?.experiences || []).map(e => e.name));
  const usedExperience = (table.rolls?.action?.statics || []).some(s => expNames.has(s.name));
  ```
- `primaryWeapon` *(object | null)*: The character's primary weapon, or `null` if none. See Weapon Object below.
- `secondaryWeapon` *(object | null)*: The character's secondary weapon, or `null` if none.
- `weapons` *(array)*: All equipped weapons (primary + secondary) plus any pre-computed virtual weapons. Each entry is a Weapon Object. Use `weapons.find(w => w.id === self._weaponId)` inside a weapon-property `passiveStatMods` function to look up the specific weapon that owns the feature.

**Weapon Object** — each entry in `primaryWeapon`, `secondaryWeapon`, and `weapons` has:
- `id` *(string | null)*: The SRD weapon ID.
- `name` *(string)*: The weapon's display name.
- `tier` *(number)*: The weapon's tier (1–4). Always a number regardless of how the raw data stored it.
- `range` *(string | null)*: The weapon's effective range (after any `rangeOverrides` are applied). Values: `'melee'`, `'veryClose'`, `'close'`, `'far'`, `'veryFar'`.
- `baseRange` *(string | null)*: The weapon item's range band **before** `rangeOverrides` (same value set as `range` when no override applies). Use when SRD text depends on the weapon's printed range, not the post-override band — e.g. Divine Wielder **Spirit Weapon** / **Sacred Resonance** (Melee or Very Close on the item). Compare with `table.action.weaponId` via `table.me.weapons.find(w => w.id === table.action.weaponId)`.
- `trait` *(string | null)*: The trait used to attack with this weapon.
- `damage` *(string | null)*: The damage die expression (e.g. `'d8'`).
- `features` *(string[])*: Names of weapon features attached to this weapon.
- `isDisabled` *(boolean, optional)*: When `true`, the host should not allow attacks with this weapon until the disabling condition clears (e.g. Pompous / **`onRender`** + merged **`weaponRenderHints`**).
- `disabledReason` *(string, optional)*: Tooltip or banner text when `isDisabled` is true.

- `rangeFromTarget` *(string)*: Distance to `table.action.target`. Returns one of: `'melee'` (≤5'), `'veryClose'` (≤10'), `'close'` (≤30'), `'far'` (≤100'), `'veryFar'` (≤300'), or `null` if positions are unknown.
- `rangeFrom(actor)` *(method → string | null)*: Same band strings as `rangeFromTarget`, measured from this actor to another (e.g., `table.me.rangeFrom(table.action.actor)`). Use this instead of reading raw token coordinates when the reference actor is not the action target — e.g., checking whether an ally is within Close range of you.
- `lastPosition` *(object | null)*: The actor's position immediately before their most recent `move`. Returns `null` when no prior position is recorded (e.g., the actor has not moved this session, or their token is not on the map). When not `null`, exposes the same range interface as the actor itself:
  - `rangeFrom(otherActor)` *(method → string | null)*: Range band from this actor's **previous** position to another actor's current position.
  - `rangeFromTarget` *(getter → string | null)*: Range band from this actor's **previous** position to the current action target's position.

  ```javascript
  // SRD: "move from Far or Very Far range into Melee range"
  const lastRange = table.me.lastPosition?.rangeFrom(table.action?.target);
  const wasFarAway = lastRange === 'far' || lastRange === 'veryFar';
  ```

**Ranger's Focus — table parity (v1 fields):**

- `focusTargetInstanceId` *(string | null)* (legacy: `focusTargetId`), `isFocusTarget(otherActor)`, `setFocusTarget(id | null)`. On **`type: 'attack'`** actions, compare **`table.me.focusTargetInstanceId === table.action.target?.instanceId`** when you need “this attack’s primary target is my Focus” — the engine does not expose a dedicated `action.isAgainstFocusTarget` helper.
- `rangerFocusOnNextAttack` *(boolean)*: Read from the character element. When true, the **next weapon attack** should spend 1 Hope for a Focus attempt; Hope is queued in **`onReviewAction`** when that attack resolves (not when arming). Use the **Next weapon attack** card toggle (`setRangerFocusOnNextAttack`).
- `focusedBy` *(string | null)* on **adversaries**: Which character name currently has this creature as Focus — drives “Focused by …” badges. Update with `setFocusedBy(name | null)` when setting or clearing Focus so UI stays consistent with id-based `focusTargetInstanceId` on the Ranger.

**Write Methods (Queued Mutations):**

- `markStress(amount)`, `clearStress(amount)`
- `markHP(amount)`, `clearHP(amount)`
- `spendHope(amount, opts?)`, `gainHope(amount)` — optional second argument `{ armorInstead: true }` or `{ payWithArmorSlot: true }` marks armor slots instead of spending Hope when `substituteArmorForHope` is true on the element and slots are available (throws otherwise); see **Armor-for-Hope substitution** under Resource Costs above.
- `markArmor(amount)`, `clearArmor(amount)`
- `addCondition(conditionName)`, `removeCondition(conditionName)`
- `addExperienceBonus(experienceId, amount)`: Queues a permanent +`amount` bonus to the experience with the given id. Typically called from a `create`-phase `isSelect` chip's `onUse` when the player makes their selection.
- `actionLoop(title, description, opts?)`: Triggers a brand new Action Loop (useful for features that grant free attacks or actions). Optional `opts` fields:
  - `trait` *(string)*: The trait name to roll (e.g. `'Instinct'`). When provided, the engine scopes the roll to that trait.
  - `difficulty` *(number)*: The DC for the roll. When provided, the engine evaluates success/failure against this threshold.

  ```js
  // Plain action loop
  table.me.actionLoop("Charge Up", "Gaining charges.");
  // Trait roll at a specific DC
  table.me.actionLoop("Fungril Network", "Communicate across any distance on success.", { trait: 'Instinct', difficulty: 12 });
  ```

- `restrictMovement(reason?)` *(method)*: Prevents this actor's token from being manually dragged on the battle map. See "Movement and Positioning" below for details and usage pattern.
- `allowMovement(reason?)` *(method)*: Lifts a restriction set by `restrictMovement(reason?)` — pass the **same `reason` string** when removing one lock.

- `applyStatMod(stat, delta)` *(method)*: Queues a **`runtimeStatMod`** mutation — additive runtime change to a **named stat** on **this** actor (distinct from declarative `passiveStatMods` on features). The host merges `delta` into the correct element field for `stat`. Supported keys today: **`difficulty`** (adversaries only → `difficultyMod`; e.g. on the chosen adversary actor, `applyStatMod('difficulty', -2)` for **Make a Scene**). Throws for unsupported `stat` or `difficulty` on a character.

**Druid — Beastform list:**

Pass the V2 **`registry`** on **`gameState.registry`** to **`buildTableSnapshot`** so **`table.registry.beastforms`** is available. The full map lives in **`src/features-v2/beastforms/index.js`** (generated **`BEASTFORM_ITEMS`** from `srd-data.js` plus per-form V2 feature lists **married** to stable SRD ids via **`marryBeastformFeatures`**). **Beastform** / **Evolution** tier filtering (forms with **`tier` ≤** the PC’s tier) is implemented in **`classes/Druid.js`**, not the feature loader. Regenerate the data file after SRD updates: `node scripts/generate-beastform-srd-data.mjs`. Author new beastform mechanics in `src/features-v2/beastforms/<FormName>.js` as named exports + **`features`** array (**CONV-034** in `docs/v2-code-conventions.md`).

**Druid — active form features (`loadCharacterFeatures`):** While transformed, **`loadCharacterFeatures`** resolves the active beastform id from the **`classes:srd-cls-druid`** scoped bag first, then legacy **`featureState.Beastform` / `Evolution`**, or legacy **`character.activeBeastform.id`** (or **`beastformId`**), then appends each object in **`registry.beastforms[id].features`** to the flat feature list. Entries use **`_source: 'beastform'`**, **`_beastformId`**, and **`_sourceObject`** pointing at the **full registry row** (so **`table.source`** in declarative snapshots is the row; **`table.activeFeature`** is the sub-feature). They run through the same declarative pass as class/weapon features. The registry row carries **`passiveStatMods`** derived once at build time from SRD **`trait_bonus`** / **`evasion_bonus`** (see **`passiveStatModsFromBeastformRow`** in **`beastform-row-stat-mods.js`**). **`applyDeclarativeFeatures`** applies **`_sourceObject.passiveStatMods` once per **`_sourceScopeKey`** for **`_source === 'beastform'`** only (before per-feature **`passiveStatMods`**) so row-level bonuses are not duplicated across sub-features; other collections may use a single object as both source and feature row, so source-level mods are not merged there to avoid double-counting.

**Druid — in-beastform combat overlay (`applyDeclarativeFeatures`):** When **`featureState.Beastform.activeBeastform`** or **`featureState.Evolution.activeBeastform`** holds `{ beastformId, viaEvolution }`, or the host still uses a legacy full **`character.activeBeastform`** row from Phase 1, the loader resolves the SRD row and:

- Merges row **`trait_bonus`** / **`evasion_bonus`** into the computed stat bag via the registry row’s **`passiveStatMods`** (string parsing: **`parseBeastformStatBonus`** in **`beastform-row-stat-mods.js`**, re-exported from **`feature-loader.js`**; attack line: **`parseBeastformAttackLine`**).
- Appends one **virtual weapon** from the row’s **`attack`** line (e.g. `"Melee Agility d4 phy"` → natural attack for the form).
- Sets **`weaponRenderHints`** for **`primaryWeaponId`**, **`secondaryWeaponId`**, and **`weaponIds`** entries to **`isDisabled: true`** (`disabledReason: 'Beastform active'`).
- Sets **`domainLoadoutDisabled: true`** in the declarative result — merge onto the element so **`table.me.domainLoadoutDisabled`** is true (no domain spells while transformed).

**Evolution trait +1:** Pass **`evolutionTraitKey`** alongside **`selectedId`** in **`activateChip`** (fourth argument). **Evolution** `onUse` stores it under **`featureState.Evolution.evolutionTraitKey`**; the overlay adds **+1** to that trait while the form lasts.

**Auto-drop at 0 HP:** **`Beastform`** exposes **`hooks.onStateChange`**: when **`table.me.currentHP`** is **`≤ 0`** and a beastform is active in **`table.featureState`**, the hook queues **`setFeatureState`** clears for **`activeBeastform`** (Beastform + Evolution) and **`evolutionTraitKey`**. **Fragile** (drop on Major+), voluntary Drop Out, and clearing Phase 1 **`selectedBeastformAdvantage`** remain host/VTT responsibilities unless extended later.

**Movement and Positioning:**

- `move(conditionFn, desiredCondition, description?, opts?)`: Requests a movement on the battle map. The `conditionFn` receives the `table` object and must return `true` if the new position is valid. **`desiredCondition`** is a short human-readable statement of what the map must satisfy (tooltips / blocking copy). **`description`** is optional longer guidance. **`opts`**: `{ freezeOtherInstanceId, freezeReason }` — while the pending move is active, the host **locks that actor’s token** (same persistence as `restrictMovement`) so only the mover should be repositioned; the lock clears with **`v2PendingMove` on banner ack/cancel** (and the host runs the same cleanup when the roll disappears from the pending banner queue, so Cancel and player cancel cannot strand a lock). On the **Game Table**, after a review chip applies this mutation, the client keeps `conditionFn` in memory, stores a lightweight `v2PendingMove` blob on the mover’s element (including `conditionMet`), and **re-runs `conditionFn(table)` on each GM token drop**, updating `conditionMet` to match the current positions. While `conditionMet` is false, the GM’s primary Acknowledge control is disabled and labeled like **Apply Kick to acknowledge**; if the token is moved so the condition fails again, Ack reverts to that state. **`v2PendingMove` clears on banner ack/cancel**, not when the condition is briefly satisfied. Server follow-ups that replace the banner row (e.g. bonus damage) re-key the pending move to the new `rollDbId` automatically. Use `actor.rangeFrom(other)` to test the distance **band** after the move (`'melee'`, `'veryClose'`, `'close'`, etc.); do **not** replace knockback with `addNarration`. There is no `move(to)` — only the condition predicate. You may omit **`description`** and pass **`opts`** as the third argument: `move(fn, desiredCondition, opts)`.  
*Example:* `table.action.target.move(t => t.action.target.rangeFrom(t.action.attacker) !== 'melee', "Not in melee with attacker", "Push target out of melee.")`  
*Example (end at Very Close):* `table.me.move(t => t.me.rangeFrom(t.action.target) === 'veryClose', "Very Close range from target", "Leap to Very Close.")` — requires tokens on the map; if positions are unknown, `rangeFrom` is `null` and no valid placement.  
When the SRD lets the player choose **who** moves (e.g. you or the target), add **two** `when()` chips with distinct `name` strings (e.g. `Kick (push target)` vs `Kick (leap back)`) so each option queues a single `move` on the correct actor. For predicates inside `move`, see §0.4.

- `restrictMovement(reason?)`: Prevents this actor's token from being manually dragged on the battle map. `reason` is an optional string shown to the player when they attempt to move the token (e.g. `"Can't move — retracted into shell."`). The restriction persists until `allowMovement()` is called. This is the correct implementation for SRD text like "you can't move" or "this character cannot move this turn." Queue the restriction inside a toggle chip's `onUse` so it lifts automatically when the toggle is turned off.

- `allowMovement(reason?)`: Lifts a movement restriction previously set by `restrictMovement()` with the same `reason`. Call this in the `else` branch of a toggle chip's `onUse` (when the toggle is turned off) to restore the actor's ability to move.

```javascript
// Example: toggle chip that prevents movement while active
chips: [{
  description: "Retract into your shell — you can't move while retracted.",
  placements: ['card'],
  stressCost: 1,
  isToggle: true,
  onUse(table, chip) {
    table.feature.set('retracted', chip.isOn);
    if (chip.isOn) {
      table.me.restrictMovement("Can't move — retracted into shell.");
    } else {
      table.me.allowMovement("Can't move — retracted into shell.");
    }
  },
}]
```

**Inventory and Loadout:**

- `inventory.add(itemObject)`: Adds an item to the actor's inventory.
- `inventory.remove(itemName)`: Removes an item from the actor's inventory.
- `loadout.swapCard(currentCardId, newCardId)`: Swaps an active domain card with one from the vault.

**Focus (Ranger's Focus — queued mutations):**

- `setFocusTarget(instanceId | null)` — persist on the **character** (`focusTargetInstanceId` / `focusTargetId`).
- `setRangerFocusOnNextAttack(boolean)` — persist on the **character** (`rangerFocusOnNextAttack`).
- `setFocusedBy(name | null)` — persist on **adversaries** (`focusedBy` string for “Focused by …”).

**Domain spell cards (characters):**

- `domainLoadout` (read-only array): domain cards in the active loadout. Each entry is an object with at least `id`; include `level` or `tier` for mechanics that scale with card level.
- `domainVault` (read-only array): domain cards in the vault (inactive).
- `moveDomainCardToVault(cardId)`: Queues a `domainCardMoveToVault` mutation so the VTT removes the card from `domainLoadout` and appends it to `domainVault`.

#### C.3 Action Context (`table.action`)

Contains information about the current Action Loop. *Note: This object is undefined if the feature is being evaluated outside of an Action Loop (e.g., when rendering the character sheet).*

- `tagTeamPartnerInstanceId` *(string | null)*: When **`type === 'tagTeam'`**, the initiator’s chosen partner. Drives **`tagTeamInitiatorHopeCost`** (core 3 Hope minus the partner’s merged **`tagTeamPartnerHopeDiscount`**).
- `tagTeamInitiatorHopeCost` *(getter → number)*: Hope the **initiator** pays for this Tag Team action. Use for chips on the initiator, e.g. `hopeCost: (table) => table.action?.tagTeamInitiatorHopeCost ?? DEFAULT_TAG_TEAM_INITIATOR_HOPE_COST` when the action loop is hydrated.

- `reducePendingDamageForTarget(targetInstanceId, amount)` *(method)*: Mutates the first pending `{ type: 'damage' }` effect for that target, subtracting `amount` from its numeric `amount`. If the target is **not** the feature owner, the target must be **within Far range** of the owner (any band except `veryFar`). No-op if out of range or missing effects. (Seraph **Prayer Dice**; same idea as mutating `effects` during `reviewAction`.)

**Convention — spend on Action roll vs Damage roll:** When a feature adds a static bonus to “the roll” and both **action** and **damage** rolls can exist in the same loop, expose **two** `reviewAction` chips gated with `(table) => table.rolls?.action != null` vs `(table) => table.rolls?.damage != null`, so the player picks the matching chip. See **Bard Rally** (`Spend Rally Die — Action` / `— Damage`) and **Seraph Prayer Dice** (`Prayer Die — Action` / `— Damage`).

`**table.action.type` — Action Type Taxonomy**

The `type` string describes the primary nature of the current loop. Types are mutually exclusive.


| `type`                       | Duality dice | Has target | Hope/Fear | Spotlight | Trait fixed                     |
| ---------------------------- | ------------ | ---------- | --------- | --------- | ------------------------------- |
| `'action'`                   | yes          | no         | yes       | yes       | **no** — trait can still change |
| `'trait'`                    | yes          | no         | yes       | yes       | yes                             |
| `'attack'`                   | yes          | yes        | yes       | yes       | yes                             |
| `'spellcast'`                | yes          | no         | yes       | yes       | yes                             |
| `'reaction'`                 | yes          | no         | **no**    | **no**    | yes                             |
| `'damage'`                   | no           | optional   | no        | no        | n/a                             |
| `'free'`                     | no           | no         | no        | no        | n/a                             |
| `'shortRest'` / `'longRest'` | no           | —          | —         | —         | n/a                             |
| `'sessionStart'`             | no           | —          | —         | —         | n/a                             |
| `'tagTeam'`                  | yes          | yes*       | yes       | yes       | yes                             |

\*Target is the **Tag Team partner** — set **`tagTeamPartnerInstanceId`** on the action (alongside **`actorInstanceId`** = initiator).

`'action'` is the most open-ended form: duality dice with a trait that features may still swap or modify. `'trait'` locks in a specific chosen trait. `'attack'` adds a target. `'spellcast'` uses the character's Spellcast trait specifically. `'reaction'` is a response roll that uses duality dice but does not generate Hope/Fear or move the spotlight.

**Reading SRD text to choose the right type:**

When the SRD text says **"succeed on an X Roll"** (e.g. "Agility Roll", "Instinct Roll"), that is a `type: 'trait'` loop. When it says **"succeed on an attack"**, that is `type: 'attack'`. The key difference is whether a specific target is named in the action — attacks have one, trait rolls do not.

**Spatial queries on trait rolls:**

`type: 'trait'` actions have no `action.targets` and no `action.range`. If the feature effect depends on enemies or allies at a certain range (e.g. "all targets within Melee range"), you must query the board directly using `table.adversaries` / `table.characters` filtered by `actor.rangeFrom(other)`:

```javascript
// Find adversaries currently in melee range of the acting character
const meleeEnemies = table.adversaries.filter(
  (adv) => table.me.rangeFrom(adv) === 'melee'
);
```

This requires tokens to be placed on the map. When positions are unknown, `rangeFrom` returns `null` (not `'melee'`), so the feature will not trigger — which is the correct conservative behaviour.

**Helper booleans** (derived from `type`; prefer these over enumerating types):

- `isDualityRoll` *(boolean)*: True for `action` / `trait` / `attack` / `spellcast` / `reaction`.
- `generatesHopeFear` *(boolean)*: True for `action` / `trait` / `attack` / `spellcast`. False for `reaction`.
- `isReaction` *(boolean)*: True only when `type === 'reaction'`.
- `isLeaveMeleeReaction` *(boolean)*: True when `type === 'reaction'` and **`reactionContext.kind === 'leaveMelee'`** — a foe is attempting to leave your Melee range (see **Attack of Opportunity** in the Warrior class feature).
- `traitIsFinal` *(boolean)*: True when the trait is locked (`trait` / `attack` / `spellcast` / `reaction`). False for `action` (trait can still be mutated by features).

**Reaction context (`gameState.action.reactionContext`)**

The Game Table sets this when starting a **reaction** loop so features know *why* the reaction was declared (without hardcoding feature names in the engine).

- **`{ kind: 'leaveMelee', moverInstanceId }`** — A combatant is trying to leave Melee range of the reactor. `moverInstanceId` must be the leaving actor (usually the same as `targetInstanceIds[0]` when the reaction targets that foe). Compare the mover's **`table.action.target.difficulty`** to the reaction roll total for success. **Map automation** (detecting token drag out of melee) is optional; the GM can always open this reaction loop manually when a player declares an AoO.

**Other properties:**

- `actor` *(Actor)*: The entity performing the action.
- `targets` *(array of Actors)*: All entities targeted by the action.
- `target` *(Actor)*: Convenience accessor for `targets[0]`.
- `attacker` *(Actor)*: Same as `actor`, but only defined if the action is an attack.
- `trait` *(string)*: The trait being rolled (e.g., `'Agility'`, `'Presence'`).
- `range` *(string)*: The range between the attacker and the target (e.g., `'melee'`, `'close'`). Undefined if the action is not an attack.
- `restType` *(string)*: `'short'` or `'long'` (only defined during Rest loops).
- `effects` *(array)*: State changes proposed by the action. The shape depends on the phase:
  - During `onReviewAction`: `{ type: 'damage', target, amount, damageType, source }` — raw damage before thresholds.
  - During `onReviewOutcome`: `{ stat: 'currentHP'|'currentStress', target, amount, damageType, source }` — HP/Stress boxes to mark after threshold conversion.
  - During `onResolve`: same shape as `onReviewOutcome`, representing what actually occurred.
  - Damage-line effects (`type === 'damage'`) may also carry **`armorSlotReductionDisallowed`** *(boolean)* — when `true`, the target cannot use armor slots against that damage type (e.g. Physical armor vs magic damage); features that care about “will they use armor?” should treat commitment as irrelevant for that effect.

**Armor commitment (banner / VTT)**

These fields describe whether a character **committed** to mark armor slot(s) to reduce an incoming hit — the same choice as the Game Table damage banner’s “Use armor” toggle, once the VTT copies it into the action loop (`gameState.action`).

- **`table.action.useArmorByTargetId`** *(object or undefined)*: `{ [targetInstanceId: string]: boolean }`. **`true`** means that target committed to use armor for **this** action’s resolution. **Missing keys** (or `false`) mean not committed. **Do not** read the pending roll’s `_useArmorByTargetId` in feature code — use this map only (**CONV-026** in `docs/v2-code-conventions.md`).
- **`useArmor`** on a **`{ type: 'damage', target, ... }`** entry in `table.action.effects`: optional boolean; **`true`** means the same commitment for that effect’s `target`. Prefer reading `useArmor` when iterating damage effects; use `useArmorByTargetId` for bulk lookup by instance id.

**Phases:** Typically populated for **`onReviewOutcome`** and **`onResolve`**; often absent during **`onReviewAction`**. Unit tests may set these fields on `gameState.action` / `effects` explicitly.

**Last armor slot (Resilient):** When `table.me.armor === 1` (exactly one unmarked slot) and armor use is committed (`armorUseCommitted`), an `onReviewOutcome` hook may call `table.rollDie('d6')`. On a **6**, reduce the wearer’s pending HP loss by one threshold step (mutate `effects` the same way as **Fortified** — `stat: 'currentHP'` or `type: 'damage'` `amount`) and **revoke** armor commitment by setting `table.action.useArmorByTargetId[targetId]` to `false` and `useArmor` to `false` on matching `type: 'damage'` effects so no armor slot is consumed. On any other die result, leave commitment unchanged.

**Unyielding (beastform, e.g. Epic Aquatic Beast):** Same revocation and effect mutation as **Resilient**, but the hook runs whenever armor use is committed for this hit (**no** “last slot only” predicate), and a **5+** on the d6 succeeds. Shared helpers live in `src/features-v2/engine/armor-review-outcome.js`.

**Example** (detect commitment for the feature owner taking damage):

```javascript
const id = table.me?.instanceId;
const committed =
  table.action?.useArmorByTargetId?.[id] === true ||
  (table.action?.effects ?? []).some(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === id &&
      e.amount > 0 &&
      e.useArmor === true
  );
```

*Example feature:* **Sheltering** (`src/features-v2/weapon_properties/Sheltering.js`) uses this pattern in `onReviewOutcome` (ally spread: same-hit cohort + Melee range).

- `addNarration(text)` *(method)*: Appends a line of text to the action's banner.
- `addDamageRoll({ name, dice, damageType, targets })` *(method)*: Queues a separate damage roll that the engine will resolve independently from the main weapon damage. The `dice` string (e.g. `'1d12'`) is rolled once by the engine; the resulting damage is applied as a new `{ type: 'damage' }` effect to each Actor in the `targets` array and enters the normal threshold pipeline. Use this in `reviewAction`-phase chips for AOE features that deal their own damage (e.g. Charge). When `targets` is empty, no effects are created.
- `reduceIncomingPhysicalSeverityBySteps(steps?)` *(method)*: During **`onReviewAction`**, reduces incoming **physical** damage by `steps` HP (default **1**), i.e. one threshold step per point. Only mutates pending `{ type: 'damage', damageType: 'physical' }` effects whose `target.instanceId` equals **`gameState._ownerInstanceId`** — the feature owner must be the damage recipient (use with **`isTargeted`**). Does not affect magic damage. See **Unstoppable** (`classes/Guardian.js`).
- `redeemSelfPendingStressWithArmorMarks()` *(method)*: During **`reviewOutcome`**, finds the feature owner’s pending `{ stat: 'currentStress' }` loss, sets its `amount` to **0**, and queues **`markArmor`** for that many slots. No-op if there is no matching effect. **Grace-Touched** (armor instead of Stress). Do not mutate `effects` manually for this swap — use this helper (**CONV-010**).
- `convertPendingHpLossToStressOnTarget(targetInstanceId)` *(method)*: During **`reviewOutcome`**, moves pending **`currentHP`** loss on that target to **`currentStress`** (same `amount`, clears the HP effect). Appends or merges into an existing Stress effect on the same target. No-op if there is no pending HP loss. **Grace-Touched** (Stress instead of HP when you force a target to mark HP).

#### C.4 Dice and Rolls (`table.rolls`)

Contains information about the dice involved in the current Action Loop. *Note: Undefined for narrative or rest loops that don't involve dice.*

**Roll Objects (`table.rolls.action`, `table.rolls.damage`, etc.):**
All roll objects share a common set of read properties and write methods.

**Read Properties (available on any roll object):**

- `dice` *(array of `{ name, die, value? }`)*: All dynamic dice added to this roll. Each entry has:
  - `name` *(string)*: A label for the die (e.g. `'Reliable'`, `'Fire'`). Used for display and to target removal via `removeDie(name)`.
  - `die` *(string)*: The die notation that will be rolled (e.g. `'d6'`, `'2d8'`).
  - `value` *(number | undefined)*: The resolved face total for this entry — populated after the dice have been rolled (Review/Resolve phases). `undefined` during `onIntent`.
  - `_advantage` *(boolean | undefined)*: Set to `true` for advantage dice added via `addAdvantageDie()`.
  - `_disadvantage` *(boolean | undefined)*: Set to `true` for disadvantage dice added via `addDisadvantageDie()`.
- `advantageDice` *(array)*: A filtered array of all dice in the pool that have `_advantage: true`.
- `disadvantageDice` *(array)*: A filtered array of all dice in the pool that have `_disadvantage: true`.

- `statics` *(array of `{ name, value }`)*: All flat bonuses added to this roll. Each entry has:
  - `name` *(string)*: A label for the modifier (e.g. `'Reliable'`, `'Proficiency'`).
  - `value` *(number)*: The flat number added to the roll total.

```javascript
// Check whether a bonus has already been added (avoid double-adding)
const hasFireBonus = table.rolls?.damage?.dice.some(d => d.name === 'Fire');

// Sum all flat modifiers currently on the roll
const totalStatic = table.rolls?.damage?.statics.reduce((sum, s) => sum + s.value, 0);

// Inspect the resolved value of a specific die during Review
const fireDie = table.rolls?.damage?.dice.find(d => d.name === 'Fire');
// fireDie?.value is the rolled face (undefined if still in onIntent)
```

**Write Methods (available on any roll object):**

- `addStatic({ name, value })` *(method)*: Adds a flat modifier to the roll total.
- `addDie({ name, die, value? })` *(method)*: Adds dice to the roll. Use `die` for the **notation** the engine will roll or display: a single die (`'d6'`, `'d8'`) or a full expression (`'2d6'`, `'1d4'`). Omit `value` until the die has been rolled and you are recording the **resolved total** for that entry—do **not** use `value` to mean “how many dice” (e.g. extra **2d6** damage is `die: '2d6'`, not `die: 'd6', value: 2`).
- `addAdvantageDie(name)` *(method)*: Adds an advantage die (d6) to the roll.
- `addDisadvantageDie(name)` *(method)*: Adds a disadvantage die (d6) to the roll. Use this when a feature causes a roll to be made with disadvantage (e.g., "attacks against you have disadvantage", "you have disadvantage on action rolls").
- `removeDie(name)` *(method)*: Removes a previously added die by name.
- `removeAdvantageDie(name)` *(method)*: Removes a previously added advantage die by name.
- `removeDisadvantageDie(name)` *(method)*: Removes a previously added disadvantage die by name. Use this for features that grant immunity to disadvantage (e.g., "You ignore disadvantage on Agility Rolls"):
  ```javascript
  hooks: {
    onIntent: when(
      (table) => table.action?.trait === 'Agility',
      (table) => {
        (table.rolls?.action?.disadvantageDice ?? []).forEach((dd) => {
          table.rolls?.action?.removeDisadvantageDie(dd.name);
        });
      }
    )
  }
  ```
- `rerollAllDice()` *(method, damage roll only)*: Queues one `rerollDie` mutation per named die in `table.rolls.damage.dice` so the VTT can reroll the adversary’s damage pool (e.g. Wizard **Not This Time** when the banner is on the damage roll). See **CONV-031** in `docs/v2-code-conventions.md` for payload shape.
- `rerollDiceBelow(maxExclusive)` *(method, damage roll only)*: Queues a `rerollDie` mutation for each damage die whose resolved `value` is strictly less than `maxExclusive` (e.g. `rerollDiceBelow(3)` for Blade **Not Good Enough** — reroll faces of 1 or 2).
- `setOutcome(outcome)` *(method, action roll only)*: Forces the roll result type to the given outcome regardless of which die dominates. Valid values: `'hope'`, `'fear'`. Use this for features that say "change it into a roll with Hope/Fear instead" (e.g. Fearless).

**Action Roll Specifics (`table.rolls.action`):**

- `hopeDie` *(Die Object | null)*: The Hope d12 (PC / spotlight rolls). `null` when not used (e.g. adversary attacks).
- `fearDie` *(Die Object | null)*: The Fear d12 (PC / spotlight rolls). `null` when not used.
- `gmDie` *(Die Object | null)*: The **GM die** for adversary and other GM-rolled checks — typically the d20 (plus trait) vs a Difficulty or Evasion. Adversary attacks do **not** use Hope/Fear; they use `gmDie` instead.
- `isSuccess` *(boolean | null)*: True if the total meets or beats the difficulty (available during Review/Resolve). `null` during `onIntent`.
- `isCritical` *(boolean | null)*: True if the Hope and Fear dice showed the same face value. `null` during `onIntent`.

**Die Objects (`hopeDie`, `fearDie`, `gmDie`):**

- `value` *(number | undefined)*: The face value of the rolled die. `undefined` during `onIntent` (before the roll), populated during Review and Resolve phases.
- `reroll()` *(method)*: Flags this specific die to be rerolled (e.g. `table.rolls?.action?.hopeDie.reroll()` for PCs, `table.rolls?.action?.gmDie.reroll()` for an adversary’s attack).
- `setDie(die)` *(method)*: Changes the die notation for this specific die (e.g. `table.rolls?.action?.hopeDie.setDie('d20')`). Use this for features that replace the standard d12 with a different die.

**Action roll only — swap duality faces:**

- `swapHopeFear()` *(method on `table.rolls.action`)*: After both Hope and Fear d12s have resolved, swaps their **face values** (e.g. Vengeance **Nemesis**). Queues a `swapHopeFearDice` mutation (`payload: { rollKey: 'action' }`) so the VTT/banner can persist the swap; mutates backing roll state so the same snapshot reads updated values from `hopeDie.value` / `fearDie.value`. No-op if either die is missing or either value is still unset.
- `setActionSuccess(success)` *(method, action roll only)*: Forces hit (`true`) or miss (`false`). Queues `setActionRollSuccess` (e.g. Bone **Bone-Touched**).
- `setActionCritical(critical)` *(method, action roll only)*: Forces critical (`true`) or not (`false`) for duality rolls. Queues `setActionRollCritical` and updates backing state so `isCritical` matches (e.g. **Homet's Secret Potion**).

**HP-based Hope die (intent):** When the rule depends on how many **HP boxes remain unmarked**, compare against `table.me.currentHP` during **`hooks.onIntent`**. On character elements, `currentHp` / `currentHP` is **remaining HP** (same as the Game Table HP track: unmarked boxes). Example — **Rise to the Challenge** swaps to a d20 while `currentHP <= 2`:

```javascript
hooks: {
  onIntent: when(
    isActing,
    (table) => table.me?.currentHP != null && table.me.currentHP <= 2,
    (table) => table.rolls?.action?.hopeDie?.setDie('d20')
  ),
}
```

Use optional chaining on `hopeDie` so rolls without a Hope die (e.g. some GM-side loops) are no-ops.

```javascript
// Read the Hope die's rolled value (only meaningful after the roll)
const hopeVal = table.rolls?.action?.hopeDie?.value; // undefined during onIntent, number during Review

// Check if both duality dice rolled the same face (Critical)
const isCrit = table.rolls?.action?.isCritical; // true/false/null

// Check if any damage die rolled its maximum face
const damageDice = table.rolls?.damage?.dice ?? [];
const anyMaxD8 = damageDice.some(d => d.die === 'd8' && d.value === 8);
```

#### C.5 Board Queries (`table.actors`, `table.characters`, `table.adversaries`, `table.environments`)

Arrays containing all entities and environments currently on the game table. Useful for features that affect allies or enemies in an area, or interact with the environment.

#### C.6 Local State (`table.feature` and `chip`)

Features and Chips can store temporary state to remember things across phases or turns.

- `table.tokenMove` *(object | undefined)*: Only set during **`hooks.onTokenMove`** (`dispatchTokenMoveHooks`). **`{ moverInstanceId, mover }`** — the token that moved (`mover` is an Actor). **`table.me` is still the feature owner**, not the mover. Undefined outside that hook.

- `table.feature.set(key, value)` / `table.feature.get(key)`: State scoped to the feature.
- `chip.set(key, value)` / `chip.get(key)`: State scoped to a specific chip (only accessible inside `onUse`).
- `chip.isOn` *(boolean)*: True if the chip is a toggle and is currently active.

#### C.7 Automatic Dice Rolling (`table.rollDie`)

For features that automatically roll a die as part of an inevitable mechanic (no player choice required), use `table.rollDie(notation)`.

- `table.rollDie(notation)` *(method → number)*: Rolls the die(s) described by `notation` and returns the total. A `rollDie` mutation is queued for auditing/logging. Supported formats: `'dN'` (e.g. `'d6'`, `'d20'`) or `'NdM'` (e.g. `'2d8'`); multi-die expressions return the sum.

For **testability**, inject a deterministic RNG by passing `_rng: () => someValue` in the game state (via `runReviewOutcome`, `mockGameState`, etc.). The function receives no arguments and must return a number in `[0, 1)`.

**Use `table.rollDie()` only for automatic rolls.** If the feature lets the player choose whether to roll, implement it as a Chip with `onUse` calling `table.rollDie()`.

---

> **⚠️ A Note for AI Assistants & Developers:**
> Do not look at or attempt to mimic the **removed** legacy `src/features/` tree or ad hoc patterns in `src/client/components/` when writing features based on this guide. The old system used entirely different concepts (`isVisible`, `onBanner`, `acknowledge`, `onChipAck`, `roll.isMine`, etc.) that do not exist in this unified architecture. Stick strictly to the concepts defined in this document (`table`, `chips`, `onIntent`, `onStateChange`, `onTokenMove`, `onSceneEnd`, `onReviewAction`, `onReviewOutcome`, `onResolve`, `when`).

