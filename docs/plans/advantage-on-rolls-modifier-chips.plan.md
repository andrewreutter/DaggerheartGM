# Advantage-on-rolls modifier chips (updated)

## Updates from original plan

1. **Dedicated advantage color** — Advantage modifier chips and the resulting advantage d6 in the dice roll use a **matching dedicated color** (e.g. emerald/green). Chips use this for border/background/text; the 3D die and any banner display for that sub-item use the same palette via `ADVANTAGE_COLORSET` in DiceRoller and `getColorsetForLabel('Advantage')`.
2. **Not mutually exclusive** — Advantage chips are **not** mutually exclusive with each other or with other modifier types. A player can select multiple advantage chips (each adds one d6) and also a roll-mode chip (e.g. Rally Die) for the same roll. Selection state: `selectedRollModId` (single, for roll-mode chips) + `selectedAdvantageIds` (array/set of ids for advantage chips). Roll text appends one ` Advantage [d6]` per selected advantage chip, plus the roll modifier’s dice when a roll chip is selected.

---

## Current state (unchanged)

- **Modifier chips** live in `el.activeModifiers` and are rendered in [CharacterDisplay.jsx](src/client/components/CharacterDisplay.jsx) via `CharacterExperiences` / `ModifierChip`. Chips have `id`, `name`, `mode` (`'roll'`, `'advantage'`, `'clearStress'`, etc.), and optional `dice`/`value`/`tooltip`.
- **Dread Visage** is special-cased in [CharacterHoverCard.jsx](src/client/components/CharacterHoverCard.jsx): using the feature pushes an advantage chip into `activeModifiers`. Roll text never uses it (only `mode === 'roll'` is handled); remove this special-case and use derived advantage chips only.
- **Feature sources**: `el.classFeatures`, `el.subclassFeatures`, `el.ancestryFeatures`, `el.communityFeatures`; weapons via `el.weapons` and `weapon.feature` (description from SRD or `WEAPON_TAG_DESCRIPTIONS`).
- **Roll building**: CharacterHoverCard builds roll text in several handlers; server parses `[expr]` in server.js. Appending ` Advantage [d6]` (with "Advantage" as the `pre` text) gives a distinct sub-item so the client can color that die.

---

## Goal (unchanged)

Any class, subclass, ancestry, community, or weapon feature whose description matches “You have advantage on rolls to…” (or “gain advantage on…”, “have advantage on…”) produces a **persistent modifier chip** (derived at render time): chip name = feature name, tooltip = the clause after the phrase. When selected, the character gains an advantage die (d6) on that roll. Multiple advantage chips and/or a roll chip can be selected for the same roll.

---

## Implementation changes from original

### Dedicated advantage color (chips + die)

- **CharacterDisplay.jsx — ModifierChip**: For `mod.mode === 'advantage'`, use a single dedicated color class (e.g. emerald: `bg-emerald-950/40 border-emerald-700/60 text-emerald-300` unselected, `bg-emerald-800/70 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50` selected). Remove or generalize the hardcoded `mod.name === 'Dread Visage'` branch so all advantage chips use this style.
- **DiceRoller.jsx**: Define `ADVANTAGE_COLORSET` with the same palette (e.g. foreground/background/outline in emerald hex values to match Tailwind emerald-500/700/950). In `getColorsetForLabel(label)`, add: if `/advantage/i.test(l)` return `ADVANTAGE_COLORSET`. Roll text must use the literal word “Advantage” before the bracket (e.g. ` Advantage [d6]`) so `sub.pre` is “Advantage ” and the 3D dice and any banner row for that sub-item get the advantage color.
- **ResultBanner / dice log**: If any sub-items are rendered by label (e.g. in the banner breakdown), style the “Advantage” row/label with the same emerald classes so the chip and die match everywhere.

### Non–mutually-exclusive selection

- **CharacterHoverCard.jsx state**: Replace single `selectedModId` with:
  - `selectedRollModId` — one id for a roll-mode chip (Rally Die, etc.), or null.
  - `selectedAdvantageIds` — array (or Set) of ids for advantage chips (can be 0, 1, or many).
- **Selection behavior**: Clicking an advantage chip toggles its id in `selectedAdvantageIds`. Clicking a roll-mode chip sets `selectedRollModId` (single selection; clicking same again clears). Both can be active at once.
- **Roll text**: When building roll text in `handleTraitClick`, `handleSpellcastRoll`, `handleWeaponClick`, and `buildFeatureRollText`:
  - If `selectedRollModId` is set, resolve the chip from `allModifierChips` and, if `mode === 'roll'` and `dice`, append ` ${chip.name} [${chip.dice}]`.
  - For each id in `selectedAdvantageIds`, append ` Advantage [d6]` (one d6 per selected advantage chip). Use the same “Advantage” label so the die gets the advantage colorset.
- **CharacterExperiences / ModifierChip**: Pass down selection state and callbacks so that:
  - Advantage chips receive `selected={selectedAdvantageIds.includes(mod.id)}` and `onSelect={() => toggleAdvantage(mod.id)}`.
  - Roll-mode chips receive `selected={selectedRollModId === mod.id}` and `onSelect={() => setSelectedRollModId(selectedRollModId === mod.id ? null : mod.id)}`.
- **Consume-on-use / clear after roll**: When a roll chip is consumed (`_usedModifierId`), clear `selectedRollModId` if it matched. Advantage chips are not consumed; clear `selectedAdvantageIds` (or leave them selected) after roll per existing UX preference—likely clear after roll so the player re-selects next time.

### Rest of implementation (as in original plan)

- **feature-actions.js**: Add `parseAdvantageOnRolls(description)`; return `{ hasAdvantage: true, tooltip }` or null. Unit tests for sample phrases.
- **CharacterHoverCard**: Derive `advantageChipsFromFeatures` from class/subclass/ancestry/community/weapon features; merge with `activeModifiers` into `allModifierChips`; pass `modifierChips={allModifierChips}` to CharacterExperiences; remove Dread Visage `_addModifiers` block.
- **CharacterDisplay**: `CharacterExperiences` accepts optional `modifierChips`; `ModifierChip` uses `mod.tooltip` in title when present; advantage chips use the dedicated color (no per-name list).
- **WEAPON_TAG_DESCRIPTIONS**: Export from CharacterDisplay (or move to shared) and use in HoverCard when collecting weapon feature descriptions for `parseAdvantageOnRolls`.
- **Docs**: srd-implementation.md and project.mdc note advantage-on-rolls chips and matching chip/die color.

---

## Files to touch (summary)

| File | Changes |
|------|--------|
| [src/client/lib/feature-actions.js](src/client/lib/feature-actions.js) | Add `parseAdvantageOnRolls`; tests. |
| [test/unit/feature-actions.test.js](test/unit/feature-actions.test.js) | Tests for `parseAdvantageOnRolls`. |
| [src/client/components/CharacterHoverCard.jsx](src/client/components/CharacterHoverCard.jsx) | `selectedRollModId` + `selectedAdvantageIds`; derive advantage chips; merge list; append one ` Advantage [d6]` per selected advantage + roll chip dice; pass selection state/callbacks to experiences; remove Dread Visage _addModifiers. |
| [src/client/components/CharacterDisplay.jsx](src/client/components/CharacterDisplay.jsx) | `CharacterExperiences`: optional `modifierChips`; accept `selectedAdvantageIds`/`selectedRollModId` and per-type callbacks; `ModifierChip`: tooltip, dedicated advantage color for `mode === 'advantage'`; export WEAPON_TAG_DESCRIPTIONS if needed. |
| [src/client/components/DiceRoller.jsx](src/client/components/DiceRoller.jsx) | Add `ADVANTAGE_COLORSET`; in `getColorsetForLabel`, return it for label matching /advantage/i; ensure ResultBanner uses same color for Advantage sub-items. |
| [docs/srd-implementation.md](docs/srd-implementation.md) | Note advantage-on-rolls chips and chip/die color. |
| [.cursor/rules/project.mdc](.cursor/rules/project.mdc) | Bullet on advantage chips and matching color. |
