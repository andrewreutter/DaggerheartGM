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

## CONV-015 — Disadvantage-granting features must be marked Blocked

The V2 API has `addAdvantageDie(name)` for advantage but **no documented counterpart for disadvantage**. Using `addDie({ die: 'd6', value: -1 })` is not a documented use of `value` (the guide defines it as a positive multiplier for die count). Any feature that grants disadvantage on a roll (e.g., "attacks against you have disadvantage") must be marked **Blocked** in the tracker until the engine exposes a documented `addDisadvantageDie()` or equivalent method.

```js
// ✗ Bad — value: -1 is undocumented
table.rolls?.action?.addDie({ name: 'Disadvantage', die: 'd6', value: -1 });

// ✓ Good — mark the feature Blocked; note the API gap
// Blocked: V2 API has no addDisadvantageDie() method.
```

---

*Add new conventions below this line. Use the next available CONV-NNN ID.*

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

## CONV-017 — Multi-die damage: use `die: 'NdX'`, not `value` as a count

`addDie({ name, die, value? })` records a **die pool entry**. The `value` field is for a **resolved numeric total** once dice are known, not for “how many dice.” Express multiple dice in the `die` string (e.g. `'2d6'`, `'3d8'`). Using `die: 'd6', value: 2` reads as one d6 showing **2**, not two d6.

```js
// ✗ Bad — value looks like a rolled face or confuses consumers
table.rolls?.damage?.addDie({ name: 'Kick', die: 'd6', value: 2 });

// ✓ Good — full expression, value omitted until the engine resolves the roll
table.rolls?.damage?.addDie({ name: 'Kick', die: '2d6' });
```
