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
3. **The Action Loop:** When a player has the **Spotlight** and does something, time slows down into a specific sequence:
   * **Intent:** A player declares an action (e.g., clicking a weapon or a trait). Features can interrupt here to offer Advantage chips or ask, "Do you want to spend Hope to add a die?"
   * **Roll:** The dice hit the virtual table. (Note: Attack rolls and Damage rolls are conceptually separate phases here).
   * **Banner (Review):** The result hangs in the air as a Banner. The GM and players look at it. Features can add toggles here (e.g., "Spend 2 Stress to reroll the Hope die").
   * **Resolution:** The GM resolves the banner. Damage is dealt, resources are spent, and the world permanently changes.
   *(Note: The Action Loop is also used for GM Rolls, but uses a d20 instead of two d12s. An Action Loop can also run without any rolls at all, such as when posting a purely narrative banner).*
4. **Downtime:** The GM triggers a **Short Rest** or **Long Rest**, which clears certain trackers and triggers healing features.
5. **Sessions:** A **Session** can begin or end at any time, resetting "once per session" abilities.

---

## 1. Building a Feature

At its core, a feature is just a JavaScript object. We divide the properties of a feature into two categories: **Passive Behaviors** (things that are always true) and **Active Behaviors** (things that require a user to click a button or spend a resource).

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
**The Syntactic Sugar Secret:** 
Under the hood, the engine separates Passive and Active behaviors. Active behaviors belong to UI elements called **Chips**. When you put `hopeCost` or `frequency` at the root level like this, the engine is secretly creating a Chip for you and placing it on the feature's Card. 

Later, in **Section 3**, we will learn how to write explicit Chips so you can put buttons on Banners, Intents, and Statblocks, or offer multiple choices for a single feature. But for 90% of features, this root-level shortcut is all you need.

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

**Advantage Triggers**
You can automatically give the player a toggleable green "Advantage" chip during the **Intent** phase.
```javascript
export const SmoothTalker = {
  name: "Smooth Talker",
  description: "You have advantage on Presence rolls to charm guards.",
  advantageTriggers: ["Presence rolls to charm guards"]
}
```

**Virtual Weapons**
Some features (like a Druid's Beastform attacks or a Katari's claws) give the character a brand new weapon that isn't in their inventory.
```javascript
export const RetractingClaws = {
  name: "Retracting Claws",
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
Often, you only want a declarative behavior (or a hook) to apply under specific circumstances. Instead of writing complex `if` statements inside functions, you can wrap *any* property or hook in a `when()` condition.

The engine will evaluate the condition using the Game Table Snapshot (which we'll cover next) and unwrap the value only if the condition is true.

```javascript
import { when } from '../feature-utils';

export const SmoothTalker = {
  name: "Smooth Talker",
  description: "You have advantage on Presence rolls to charm guards.",
  // Only show this Advantage chip during the Intent phase if the action is a Presence roll
  advantageTriggers: when(
    (table) => table.action.trait === 'Presence', 
    ["Presence rolls to charm guards"]
  )
}
```
You can use `when()` on `passiveStatMods`, `chips`, or even hooks like `onDamageReceived`.

---

## 2. The Game Table Snapshot

Whenever a feature needs to make a decision—whether inside a `when()` wrapper, a visibility check, or a lifecycle hook—the engine passes it a single object: the **Game Table Snapshot** (often just called `table`).

The `table` object is a frozen-in-time representation of the entire game state. It exposes the game's internals through a set of subdocuments, allowing your feature to read the state of the world and write changes to it.

### 2.1 The Data Model
Here are the primary subdocuments available on the `table` object:

* **`table.top`**: Global game state and engine methods. You can read global resources (`table.top.fear`) or trigger engine events (`table.top.actionLoop()`).
* **`table.me`**: The Actor (Character or Adversary) that owns this feature. You can read their stats (`table.me.currentHP`, `table.me.maxStress`) or mutate them (`table.me.markStress(1)`).
* **`table.action`**: The current Action Loop context. This tells you what is happening: `table.action.actor` (who is acting), `table.action.targets` (an array of targets), `table.action.target` (a convenience for `targets[0]`), and `table.action.attacker` (same as actor, but only defined on attacks).
* **`table.rolls`**: The dice and modifiers involved in the current action. These exist even during the Intent phase (before they are rolled), they just have a `value` of `undefined`.
  * `table.rolls.action` or `table.rolls.attack`: The primary d12s or GM d20.
  * `table.rolls.damage`: The damage roll (if applicable).
  * `table.rolls.other`: A map for dynamic extra rolls (e.g., `table.rolls.other.Parry`).
  * *Inside a roll:* You will find arrays for `.dice` and `.static` modifiers, plus convenience getters like `.hopeDie`, `.fearDie`, `.traitDie`, and `.gmDie`. Each die has a `.name`, `.die` (e.g., 'd4'), and `.value`.
* **`table.actors`**: An array of all entities on the board. You can also filter these via `table.characters` and `table.adversaries`.
  * *Actor Helpers:* Every actor has properties like `.name`, `.isCharacter`, `.isAdversary`, and `.isActing`. They also have incredibly useful spatial helpers: `.rangeFromMe`, `.rangeFromTargets`, `.rangeFromTarget`, and `.rangeFrom(actor)`.

### 2.2 Reading vs. Writing
The `table` object is designed to be safe. 
* **Reading:** You can read from any property at any time to determine if your feature should trigger (e.g., `table.action.attacker && table.me.rangeFromTarget === 'melee'`).
* **Writing:** When you call mutation methods like `table.me.markStress(1)` or `table.rolls.damage.addDie({ name: 'Fire', die: 'd4' })`, the engine queues those changes up and applies them at the correct time in the Action Loop. 

By passing this exact same `table` object to every single hook and conditional wrapper, you never have to guess what arguments your function is going to receive.

*(Note: We will cover the exact properties and methods available on each subdocument in the Appendices).*