# Feature Hook Analysis

This document validates the hook API proposed in `docs/feature-authoring-guide.md` against the Daggerheart SRD. The goal is to ensure that our Action Loop system (`onIntent`, `onReviewAction`, `onReviewOutcome`, `onResolve`) is sufficient to implement the wide variety of mechanics found in the game.

## Intercepting Rolls (`onIntent`)

### Reliable (Weapon Feature)
*   **SRD Quote:** "When you attack with this weapon, you can add +1 to your action roll."
*   **Implementation:** `onIntent` wrapped in `when(isActing)`. Calls `table.rolls?.action?.addStatic({ name: 'Reliable', value: 1 })`.

### Sharpwing (Weapon Feature)
*   **SRD Quote:** "Add your Agility to damage."
*   **Implementation:** `onIntent` wrapped in `when(isActing)`. Calls `table.rolls?.damage?.addStatic({ name: 'Agility', value: table.me.stats.agility })`.

### Painful (Weapon Feature)
*   **SRD Quote:** "Mark 1 Stress when you attack with this weapon."
*   **Implementation:** `onIntent` wrapped in `when(isActing)`. Calls `table.me.markStress(1)`. (The engine queues this mutation to be applied during resolution).

## Reacting to Rolls & Intercepting Effects (`onReviewOutcome`)

During `onReviewOutcome`, the engine exposes `table.action?.pendingEffects`.

### Brutal (Weapon Feature)
*   **SRD Quote:** "If you roll the maximum value on a damage die, roll another die of the same size and add it to the damage total."
*   **Implementation:** `onReviewOutcome` wrapped in `when(isActing)`. Inspects `table.rolls?.damage?.dice`. If a max value is found, calls `table.rolls.damage.addDie(...)`.

### Unstoppable (Guardian Class)
*   **SRD Quote:** "When you take physical damage, you can spend 1 Hope to reduce the damage by 1."
*   **Implementation:** This is actually a **Chip** with `placements: ['reviewOutcome']`, not a hook, because it requires a player choice. The chip's `when()` wrapper checks if `table.action?.pendingEffects` contains physical damage (`stat: 'currentHP'`) targeting `table.me`. The chip's `onUse` mutates that pending effect to reduce the amount by 1.

## Reacting to Effects (`onResolve`)

During `onResolve`, the engine exposes `table.action?.appliedEffects`.

### Lifestealing (Weapon Feature)
*   **SRD Quote:** "When you deal damage, heal 1 HP."
*   **Implementation:** `onResolve` wrapped in `when(isActing)`. Inspects `table.action?.appliedEffects` to see if a `currentHP` effect was applied where `source === table.me`. If so, calls `table.me.clearHP(1)`.

### Knockback (Weapon Feature)
*   **SRD Quote:** "On a successful hit, push the target out of melee."
*   **Implementation:** `onResolve` wrapped in `when(isActing)`. Checks if `table.rolls?.action?.isSuccess`. If so, calls `table.action?.addNarration(...)`.

## Bridging Chips and Hooks

Sometimes a player makes a choice (Chip) that changes what happens after the roll (Hook).

### Push Attack (Hypothetical)
*   **SRD Quote:** "Spend 1 Hope to push the target on a hit."
*   **Implementation:** 
    *   **Chip:** `placements: ['intent']`, `hopeCost: 1`, `isToggle: true`. In `onUse(table, chip)`, calls `table.feature.set('pushActive', chip.isOn)`. (The engine automatically handles deducting the Hope cost only if the toggle is ON and the GM acknowledges).
    *   **Hook:** `onResolve` wrapped in `when(isActing, (table) => table.feature.get('pushActive'))`. Checks if `table.rolls?.action?.isSuccess`. If so, calls `table.action?.addNarration(...)`. Finally, calls `table.feature.set('pushActive', false)` to clean up.

## Non-Combat Action Loops

Because Rests and Session Starts are treated as Action Loops without dice, we don't need special hooks for them.

### Celestial Trance (Elf Ancestry)
*   **SRD Quote:** "When you take a Short or Long Rest, you get an extra downtime action."
*   **Implementation:** `onIntent` wrapped in `when((table) => table.action?.type === 'shortRest' || table.action?.type === 'longRest')`. Modifies the rest state by calling `table.me.addRestAction()`.

### Luckbringer (Halfling Ancestry)
*   **SRD Quote:** "At the start of a session, each party member gains 1 Hope."
*   **Implementation:** `onResolve` wrapped in `when((table) => table.action?.type === 'sessionStart')`. Iterates over `table.characters` and calls `.gainHope(1)` on each.

## The Omnipresent Execution Model Validation

Because every feature's hooks are executed for *every* event on the table, we can easily implement "reactionary" features that don't belong to the active player.

### Defender (Hypothetical/Community Feature)
*   **SRD Quote:** "When an ally in melee range is attacked, they gain +1 Evasion."
*   **Implementation:** 
    *   Hook: `onIntent`
    *   Condition: `when((table) => table.action?.target?.isCharacter && table.action?.target !== table.me && table.me.rangeTo(table.action.target) === 'melee')`
    *   Action: `table.action.target.addTemporaryEvasion(1)`

## Do we need `onCreate` or `onRender` hooks?

**No.**

*   **Character Creation:** Features that require choices during character creation (e.g., "Choose two domains" or "Pick a beastform") are handled via **Chips** with `placements: ['create']`. The UI renders the chip as a dropdown or selection interface. No hook is required.
*   **Character Rendering:** Features that statically change character math (e.g., Nimble: "You gain +1 to your Evasion") are handled declaratively via the `passiveStatMods` property on the feature object. The engine applies these automatically when rendering the character sheet. No hook is required.
