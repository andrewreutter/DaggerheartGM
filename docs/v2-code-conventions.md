# V2 Feature Code Conventions

This file is read by the validation agent **at the start of every batch**.
Add new rules here at any time — they will be enforced on the next batch.

Each rule has a short **ID** (for referencing in Notes), a **description**,
and a **✗ Bad / ✓ Good** example where helpful.

---

## CONV-001 — Use `when()` instead of early returns in hooks

If a hook or chip `onUse` begins with an `if (!condition) return;` guard,
that guard should be a `when()` wrapper on the feature or chip instead.
Early returns are a smell that the condition belongs in the declarative layer.

```js
// ✗ Bad
onIntent(table) {
  if (!table.me.isActing) return;
  table.rolls.damage.addStatic({ name: 'Reliable', value: 1 });
}

// ✓ Good
chips: [
  when(isActing, {
    placements: ['intent'],
    onUse(table) {
      table.rolls.damage.addStatic({ name: 'Reliable', value: 1 });
    }
  })
]
```

---

## CONV-002 — Never mutate raw objects directly

All state changes must go through the queued-mutation methods on `table.me`,
`table.action.target`, `table.top`, etc. Never write to a raw element field.

```js
// ✗ Bad
table.me._raw.currentStress += 1;

// ✓ Good
table.me.markStress(1);
```

---

## CONV-003 — Passive properties must use the declarative API

Features whose only effect is a stat modifier, a virtual weapon, a movement
mode, or a damage affinity must use the corresponding declarative key
(`passiveStatMods`, `virtualWeapons`, `movementModes`, `damageAffinities`).
Using a hook to replicate what a declarative property already does is wrong.

```js
// ✗ Bad — using a hook to do what passiveStatMods handles
onIntent(table) {
  table.me.evasion += 1; // also illegal — mutates raw
}

// ✓ Good
passiveStatMods: { evasion: 1 }
```

---

## CONV-004 — Named exports only; no default exports

Every feature must be a named `const` export. No `export default`.
Barrel `index.js` files re-export every named feature from that directory.

```js
// ✗ Bad
export default { name: "Reliable", ... }

// ✓ Good
export const Reliable = { name: "Reliable", ... }
```

---

## CONV-005 — `name` must exactly match the SRD feature name

The `name` field is the primary identifier used by the engine and tracker.
It must be a verbatim copy of the feature name as it appears in the SRD
(correct capitalisation, spacing, punctuation).

---

## CONV-006 — Purely narrative features must be minimal

If the SRD feature has no mechanical effect (no roll, no resource cost,
no stat change), the implementation should be just `{ name, description }`.
Do not invent chips or hooks for flavor-only features.

---

## CONV-007 — Frequency must be declared when the SRD specifies it

If the SRD says "once per session" or "once per rest", the feature or chip
must include a `frequency` field (`'session'` or `'rest'`). Omitting it
makes the feature infinitely repeatable in contravention of the rules.

```js
// ✓ Good
{
  description: "Once per session, ...",
  frequency: 'session',
  onUse(table) { ... }
}
```

---

## CONV-008 — Tests must not use `toBeTruthy` / `toBeFalsy` for mutation checks

Tests that verify a specific mutation was queued must use `toContainEqual`
with an `expect.objectContaining(...)` matcher, not loose truthiness checks.
This ensures the mutation type and payload are both verified.

```js
// ✗ Bad
expect(mutations.length).toBeGreaterThan(0);

// ✓ Good
expect(mutations).toContainEqual(
  expect.objectContaining({ type: 'markStress', payload: { instanceId: 'c1', amount: 1 } })
);
```

---

## CONV-009 — Player choices must be toggle chips

If a feature represents an optional player choice (e.g., "You may spend 1 Hope to..."), it must be implemented as a chip with `isToggle: true` (or an explicit `onUse` action button) so the player can decide whether to activate it. Do not force optional effects automatically in a hook.

```js
// ✗ Bad (forces the effect automatically)
onIntent(table) {
  table.me.spendHope(1);
  table.rolls.action.addAdvantageDie('Scales');
}

// ✓ Good (gives the player a choice)
chips: [
  when(isActing, {
    label: "Scales",
    description: "Spend 1 Hope to add an advantage die.",
    isToggle: true,
    hopeCost: 1,
    onUse(table) {
      table.rolls.action.addAdvantageDie('Scales');
    }
  })
]
```

---

## CONV-010 — Do not hallucinate API methods

Use ONLY the methods and properties explicitly documented in `docs/feature-authoring-guide.md`. If you see a helper or method in the legacy code (e.g., `isTargeted` if it's not in the guide, or `table.action.effects.push`), do NOT use it. If the V2 API cannot do what you need, mark the feature `Blocked` in the tracker.

---

## CONV-011 — Rest slot counts must be declared as passive stat mods

Features that grant extra downtime move slots (or allow long-rest moves during
a short rest) must declare that via `passiveStatMods`, not via an `onRest` hook
that queues a mutation. Passive stat mods are evaluated during Character
Rendering, so the rest UI knows the correct slot count *before* the player
makes a choice. A queued mutation fires at phase-end, which is too late.

Valid keys in `passiveStatMods` for rest slots:

- `numShortRestSlots` — extra short-rest downtime move slots
- `numLongRestSlots` — extra long-rest downtime move slots
- `numLongMovesInShortRest` — short-rest slots that may be filled from the
  long-rest move list instead (e.g. Clank Efficient)

```js
// ✗ Bad — timing is wrong; also uses undocumented addRestAction()
hooks: {
  onRest: (table) => { table.me.addRestAction(); }
}

// ✓ Good
passiveStatMods: { numShortRestSlots: 1, numLongRestSlots: 1 }
```

Implementation: `applyDeclarativeFeatures` in `src/features-v2/engine/feature-loader.js` accumulates `numShortRestSlots`, `numLongRestSlots`, and `numLongMovesInShortRest` into the returned `stats` object. The Rest banner uses `getRestMovesForCharacter` in `src/client/lib/rest-moves.js`, which applies the same modifiers by reading the V2 ancestry feature registry (so slot counts and Efficient’s long-move options stay in sync with CONV-011).

---

## CONV-012 — Damage halving rounds UP in Daggerheart

When halving damage (e.g., "halve incoming damage"), always use `Math.ceil()` to round up, not `Math.floor()`. This is the standard Daggerheart rule.

```js
// ✗ Bad
dmg.amount = Math.floor(dmg.amount / 2);

// ✓ Good
dmg.amount = Math.ceil(dmg.amount / 2);
```

---

## CONV-013 — Use `== null` (not `!value`) when checking token positions

Token positions (`tokenX`, `tokenY`) are numbers that can legitimately be `0`.
Never use `!element.tokenX` or `!actor.tokenX` as a null guard — `0` is falsy
and will be incorrectly treated as "not placed". Always use `== null` (which
catches both `null` and `undefined` but passes `0`).

```js
// ✗ Bad — rejects a token placed at coordinate 0
if (!element.tokenX || !otherActor.tokenX) return null;

// ✓ Good
if (element.tokenX == null || otherActor.tokenX == null) return null;
```

This applies everywhere token positions are read: `rangeFromTarget`,
`rangeFrom`, and any feature that accesses `actor.tokenX` / `actor.tokenY`.

---

## CONV-014 — Inline single-use `when()` predicates

If a predicate passed to `when()` is only referenced once, write it inline (e.g.
`when((table) => table.feature.get('x') === true, { ... })`). Do not add a
file-level or module-level named function solely for that one call — reuse
shared predicates from `when.js` (`isActing`, `hasPhysicalDamage`, etc.) when
they apply.

---

## CONV-015 — Use `addDisadvantageDie(name)` for disadvantage; never fake it with `value: -1`

The V2 API provides `addDisadvantageDie(name)` (symmetric counterpart to `addAdvantageDie(name)`) to grant disadvantage on a roll. Using `addDie({ die: 'd6', value: -1 })` is **not** a documented use of `value` and must not be used.

```js
// ✗ Bad — value: -1 is undocumented
table.rolls?.action?.addDie({ name: 'Disadvantage', die: 'd6', value: -1 });

// ✓ Good
table.rolls?.action?.addDisadvantageDie('Sturdy');
```

The mutation queued is `{ type: 'addDisadvantageDie', payload: { rollKey, name } }`. Features that still cannot be implemented due to missing *other* APIs (e.g., movement restriction, disadvantage immunity) should remain **Blocked** and note the specific remaining gap.

---

*Add new conventions below this line. Use the next available CONV-NNN ID.*

---

## CONV-026 — When iterating effects, always scope to the correct target

When iterating `table.action?.effects` to modify or react to effects, always check `e.target?.instanceId` against the intended target(s). Never mutate all effects that match a `stat` + `amount` condition alone — the effects array can contain entries for the attacker, allies, or other bystanders.

For "on deal damage" features (attacker perspective): scope to `e.target?.instanceId === table.action?.target?.instanceId`.  
For "when I take damage" features (defender perspective): scope to `e.target?.instanceId === table.me?.instanceId`.

```js
// ✗ Bad — modifies HP effects on ANY entity, including the attacker and allies
for (const e of table.action?.effects || []) {
  if (e.stat === 'currentHP' && e.amount >= 3) {
    e.amount += 1;
  }
}

// ✓ Good — scoped to the action's primary target
const targetId = table.action?.target?.instanceId;
for (const e of table.action?.effects || []) {
  if (e.stat === 'currentHP' && e.amount >= 3 && e.target?.instanceId === targetId) {
    e.amount += 1;
  }
}
```

---

## CONV-025 — "On a successful attack" requires both `isSuccess` and `type === 'attack'`

When the SRD says "on a successful attack", the feature must check **both** conditions. Checking `isSuccess === true` alone allows the feature to fire on successful trait rolls, spellcasts, and other non-attack actions.

Always add `(table) => table.action?.type === 'attack'` as a predicate in the `when()` chain **before** the `isSuccess` check.

```js
// ✗ Bad — fires on any successful action, not just attacks
hooks: {
  onResolve: when(
    isActing,
    (table) => table.rolls?.action?.isSuccess === true,
    (table) => { table.action?.target?.markStress(1); }
  ),
}

// ✓ Good — scoped to attack actions only
hooks: {
  onResolve: when(
    isActing,
    (table) => table.action?.type === 'attack',
    (table) => table.rolls?.action?.isSuccess === true,
    (table) => { table.action?.target?.markStress(1); }
  ),
}
```

This applies to both hooks and chip `when()` conditions. Tests must include a negative case: a successful action of a different type (e.g. `type: 'trait'`) must not trigger the feature.

---

## CONV-021 — Use `isSelect` for permanent character-creation choices

When a feature requires the player to permanently choose one item from a dynamic list at character creation (e.g. "pick one of your Experiences"), implement it as a `create`-phase chip with `isSelect`. Never implement this as a static dropdown hardcoded in the feature; the list must be populated at runtime from `table.me` (e.g. `table.me.experiences`).

```js
// ✓ Good
{
  description: 'Choose an Experience to gain a permanent +1 bonus.',
  placements: ['create'],
  isSelect: (table) => (table.me?.experiences || []).map((e) => ({ id: e.id, name: e.name })),
  onUse: (table, chip) => {
    const selectedId = chip.get('selectedId');
    if (selectedId) table.me?.addExperienceBonus(selectedId, 1);
  },
}
```

`isSelect` is a function `(table) => [{ id, name, description? }, ...]`. The engine stores the chosen id in chip state as `'selectedId'` before calling `onUse`, so `chip.get('selectedId')` always returns the player's selection.

---

## CONV-020 — Virtual weapon `damage` must be stated in the SRD

Only include the `damage` field on a virtual weapon if the SRD text explicitly states a damage expression (e.g. "deals **d8** magic damage"). Do not invent a damage value as a stand-in. If the SRD describes an attack that has no stated damage (e.g. it only applies a condition on success), omit `damage` entirely.

```js
// ✗ Bad — SRD says nothing about damage
virtualWeapons: [{ name: 'Retracting Claws', trait: 'agility', range: 'melee', damage: 'd6' }]

// ✓ Good — SRD says "deals d12 physical damage"
virtualWeapons: [{ name: 'Long Tongue', trait: 'finesse', range: 'close', damage: 'd12' }]

// ✓ Good — SRD has no damage; omit the field
virtualWeapons: [{ name: 'Retracting Claws', trait: 'agility', range: 'melee' }]
```

---

## CONV-020 — Trait-scoped advantage triggers must use `when()` to gate on that trait

If the SRD text says "You have advantage on **[Trait] Rolls** to …", the entry in
`advantageTriggers` must be wrapped in a `when()` predicate that checks
`table.action?.trait === 'TraitName'`. Without the guard the engine will offer the
advantage chip on *every* roll, not just rolls of that trait.

Purely narrative conditions (e.g. "rolls to intimidate hostile creatures") that
describe *what* you are doing rather than *which trait* you are rolling are fine as
plain strings.

```js
// ✗ Bad — fires on all rolls, not just Agility
advantageTriggers: ['Agility Rolls that involve balancing and climbing']

// ✓ Good — engine only offers the chip when the action trait is Agility
advantageTriggers: [
  when(
    (table) => table.action?.trait === 'Agility',
    'Agility Rolls that involve balancing and climbing'
  )
]
```

---

## CONV-016 — Use declarative `temporaryStatMods` for temporary stat boosts

If a chip grants a temporary stat boost (like +2 Evasion for the current action loop), do not use an imperative hook or mutation method like `table.me.addTemporaryStatMod()`. Instead, use the declarative `temporaryStatMods` property on the chip. The engine will automatically apply and remove the boost.

```js
// ✗ Bad
chips: [
  when(isTargeted, {
    placements: ['reviewOutcome'],
    onUse(table) {
      table.me.addTemporaryStatMod('evasion', 2);
    }
  })
]

// ✓ Good
chips: [
  when(isTargeted, {
    placements: ['reviewOutcome'],
    temporaryStatMods: { evasion: 2 }
  })
]
```

---

## CONV-018 — Trust the framework; don't add defensive null guards inside conditionFns

Applies to **all** feature logic (hooks, chips, `when()` predicates, `move` callbacks, etc.), not only movement. See **§0.4** in `docs/feature-authoring-guide.md` for the author-facing rule.

`move(conditionFn)`, `rangeFrom`, and similar framework methods return `null` or `false` gracefully when actors or positions are missing — that is the correct conservative result. Do not add explicit `!= null` / `!== null` guards before calling them. If a guard is truly needed (e.g. short-circuiting optional chaining on a live path), use `?.` notation, not multi-line `if` blocks or `!= null` comparisons.

```js
// ✗ Bad — redundant null checks, noisy and untrusting of framework
target.move(
  (t) =>
    t.action.target != null &&
    t.action.attacker != null &&
    t.action.target.rangeFrom(t.action.attacker) === 'veryClose',
  'Kick'
);

// ✓ Good — rangeFrom returns null when positions unknown; === 'veryClose' is then false
table.action?.target?.move(
  (t) => t.action.target?.rangeFrom(t.action.attacker) === 'veryClose',
  'Kick'
);
```

---

## CONV-019 — `reviewOutcome` is only for HP/Stress-loss reduction; use `reviewAction` for everything else

`reviewOutcome` chips and hooks run **after** the engine has already applied damage thresholds and converted raw damage into HP/Stress loss counts (`e.stat === 'currentHP'` / `'currentStress'`). Use `reviewOutcome` only when the feature reads those post-threshold effects and reduces the number of boxes marked (e.g., "mark 1 fewer Hit Point", "mark 2 Stress instead of 1 HP").

Everything else that reacts after the roll — rerolling dice, adding extra damage dice, modifying raw damage before thresholds, temporary stat boosts (Evasion reactions), and movement/positioning — belongs at `reviewAction`.

```js
// ✗ Bad — rerolling a die is a reviewAction concern, not reviewOutcome
chips: [{
  placements: ['reviewOutcome'],
  onUse(table) { table.rolls?.action?.fearDie?.reroll(); }
}]

// ✓ Good — die rerolls happen before thresholds are applied
chips: [{
  placements: ['reviewAction'],
  onUse(table) { table.rolls?.action?.fearDie?.reroll(); }
}]

// ✓ Good — HP-loss reduction correctly uses reviewOutcome
chips: [{
  placements: ['reviewOutcome'],
  isToggle: true,
}],
hooks: {
  onReviewOutcome(table) {
    const hp = table.action?.effects?.find(
      e => e.stat === 'currentHP' && e.target?.instanceId === table.me?.instanceId
    );
    if (hp) hp.amount -= 1;
  }
}
```

**Quick test:** if your feature's predicate reads `e.stat === 'currentHP'` or `e.stat === 'currentStress'`, use `reviewOutcome`. If it reads dice values, `isSuccess`, raw damage amounts, or anything else, use `reviewAction`.

---

## CONV-017 — Multi-die damage: use `die: 'NdX'`, not `value` as a count

`addDie({ name, die, value? })` records a **die pool entry**. The `value` field is for a **resolved numeric total** once dice are known, not for “how many dice.” Express multiple dice in the `die` string (e.g. `'2d6'`, `'3d8'`). Using `die: 'd6', value: 2` reads as one d6 showing **2**, not two d6.

```js
// ✗ Bad — value looks like a rolled face or confuses consumers
table.rolls?.damage?.addDie({ name: 'Kick', die: 'd6', value: 2 });

// ✓ Good — full expression, value omitted until the engine resolves the roll
table.rolls?.damage?.addDie({ name: 'Kick', die: '2d6' });
```

---

## CONV-022 — Virtual weapon activation costs go on the weapon object, not in a `chips` array

If the SRD requires spending a resource to use a virtual weapon (e.g. "Mark a Stress to use your tongue"), declare the cost **directly on the virtual weapon object** using the standard chip cost properties (`hopeCost`, `stressCost`, `armorMark`, `armorClear`). Do **not** nest a `chips` array inside a virtual weapon entry — that pattern is undocumented and not supported by the engine.

```js
// ✗ Bad — chips array inside a virtualWeapons entry is not a documented API
virtualWeapons: [{
  name: 'Long Tongue',
  trait: 'finesse',
  range: 'close',
  damage: 'd12',
  chips: [{ placements: ['card'], stressCost: 1, onUse() {} }],
}]

// ✓ Good — cost declared directly on the weapon object
virtualWeapons: [{
  name: 'Long Tongue',
  trait: 'finesse',
  range: 'close',
  damage: 'd12',
  stressCost: 1,
}]
```

Supported cost properties on virtual weapons: `hopeCost`, `stressCost`, `armorMark`, `armorClear`.

---

## CONV-020 — In Daggerheart, attacks against characters are always made by adversaries

The Daggerheart system has no character-vs-character attack mechanic. Whenever `table.action.type === 'attack'` and the target is a character, the attacker is always an adversary. Features that react to "an adversary makes an attack against you" do **not** need to additionally check `table.action?.attacker?.isAdversary` — `isTargeted` is sufficient as a condition.

```js
// ✗ Over-specified — attacker.isAdversary is always true in this context
when(
  isTargeted,
  (table) => table.action?.attacker?.isAdversary,
  { ... }
)

// ✓ Correct — isTargeted is sufficient; attacks are always adversary→character in Daggerheart
when(isTargeted, { ... })
```

---

## CONV-023 — Use specific removal methods for advantage/disadvantage dice

When removing advantage or disadvantage dice from a roll, always use `removeAdvantageDie(name)` or `removeDisadvantageDie(name)`. Do not use the generic `removeDie(name)` method. `removeDie` filters only by name, which can accidentally remove a regular die that happens to share the same name.

```js
// ✗ Bad — might accidentally remove a regular die named "Condition"
table.rolls?.action?.removeDie('Condition');

// ✓ Good — safely removes only disadvantage dice with that name
table.rolls?.action?.removeDisadvantageDie('Condition');
```

---

## CONV-024 — `temporaryStatMods` values may be functions `(table) => number`

Like chip cost properties, `temporaryStatMods` values accept either a static number or a `(table) => number` function. The engine resolves the function at toggle-on time and caches the resolved value in chip state so toggle-off removes exactly the same amount.

```js
// ✓ Good — dynamic evasion bonus equal to available armor slots
temporaryStatMods: {
  evasion: (table) => table.me?.armor ?? 0,
}
```

## CONV-027 — Use `isTargetSelect` for post-apply target selection in combat chips

When a feature lets the player choose additional combat targets (e.g. Bouncing, Doubled Up), use a chip with `isTargetSelect` at the `resolve` placement. `isTargetSelect` is a function `(table) => Actor[]` that returns eligible target actors. The engine stores the chosen actor's `instanceId` in chip state as `'selectedTargetId'` before calling `onUse`, so `chip.get('selectedTargetId')` always returns the player's selection. Set `loop: true` when the player may pick multiple targets in sequence (e.g. Bouncing — each activation costs 1 Stress). The host manages excluding already-hit targets and offering a "Done" button.

```js
// ✓ Good — resolve-phase target selector with loop
when(isActing, (table) => table.action?.type === 'attack', {
  description: 'Mark 1 Stress to hit another target in range.',
  placements: ['resolve'],
  stressCost: 1,
  loop: true,
  isTargetSelect(table) {
    return table.actors.filter(a =>
      a.instanceId !== table.action?.target?.instanceId &&
      a.instanceId !== table.me?.instanceId &&
      table.me.rangeFrom(a) != null
    );
  },
  onUse(table, chip) {
    const target = table.actors.find(a => a.instanceId === chip.get('selectedTargetId'));
    if (target) {
      table.action?.addDamageRoll({ name: 'Bouncing', dice: 'd8', targets: [target] });
    }
  },
})
```

Do **not** use `isSelect` for combat targets — `isSelect` is for permanent creation-time choices (CONV-021). Do **not** use `addDamageRoll` with pre-computed target lists for features that require player choice — that pattern is for AOE damage where all targets are hit (e.g. Charge).
