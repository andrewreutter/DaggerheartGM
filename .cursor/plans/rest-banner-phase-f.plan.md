---
name: Rest banner Phase F (chip placement)
overview: "Add declarative **`placement: 'rest'`** chips on the Rest banner; **Potion of Stability** uses a rest chip whose **`onUse`** consumes the potion and unlocks **CONV-011 `passiveStatMods`** (`numShortRestSlots` / `numLongRestSlots`) for that rest. Unifies with existing rest-slot mechanics rather than inventory-only slot math in `getRestMovesForCharacter`."
todos:
  - id: rest-placement-engine
    content: Document and implement `rest` as a valid `collectChips` phase; optional helper to build per-PC `table` snapshot for shortRest/longRest
    status: completed
  - id: rest-banner-ui
    content: Render rest chips in DiceRoller `RestBanner` + wire mutations (GM/player parity with existing V2 chip table paths)
    status: completed
  - id: potion-module
    content: "Potion of Stability — `placements: ['rest']`, inventory visibility, onUse + `when()` passiveStatMods per CONV-011"
    status: completed
  - id: slot-stats-plumbing
    content: Align Rest banner slot counts with merged character stats / `featureState` after chip use (close gap vs ancestry-only `getRestMovesForCharacter` scan)
    status: completed
  - id: tests-docs
    content: Unit tests + update docs/v2-code-conventions.md (CONV-011 / placement), feature-authoring-guide, v2-game-table-cutover-remaining when done
    status: completed
isProject: true
---

# Rest banner — Phase F (revised): `placement: 'rest'` + passive slots

## Product intent

Treat **all Rest-related VTT affordances** in one model:

1. **New chip placement: `'rest'`** — Features and consumables expose declarative chips with `placements: ['rest']`. Those chips are **collected for the Rest banner** and shown **per character** (same ownership rules as other phases: GM edits all; players edit assigned PC).
2. **Potion of Stability** — Uses that placement: a **“use potion”** chip on the banner while the character has the item. **Using the chip** runs the consumable’s `**onUse`** (inventory + `featureState` mutations as needed).
3. **Extra downtime slots** — **Already specified in engine/docs:** [CONV-011](docs/v2-code-conventions.md) — extra short/long rest move slots must be declared via `**passiveStatMods`** (`numShortRestSlots`, `numLongRestSlots`, `numLongMovesInShortRest`), not ad hoc hooks, so the UI knows slot counts **before** choices are finalized. Examples today: Elf **Celestial Trance**, Sage **Forager**, Codex **Safe Haven** (see `passiveStatMods` in `src/features-v2/`).

The revised flow: **rest chip → `onUse` → (optional) `featureState` → `passiveStatMods` with `when()` → slot count increases** for that character for the current rest resolution.

---

## Current code (baseline)


| Area                                                                                                   | Role                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[src/features-v2/engine/chip-system.js](src/features-v2/engine/chip-system.js)`                       | `collectChips(features, phase, table, usageStore)` — `phase` is any string matched against `chip.placements`.                                                                                          |
| `[src/client/components/DiceRoller.jsx](src/client/components/DiceRoller.jsx)`                         | `RestBanner` — only **CustomSelect** downtime rows; no V2 chip strip.                                                                                                                                  |
| `[src/client/lib/rest-moves.js](src/client/lib/rest-moves.js)`                                         | `getRestMovesForCharacter` — builds slot counts from **ancestry + ability** registries (`applyV2AncestryRestMods` / `applyV2AbilityRestMods`), **not** from full merged `loadCharacterFeatures` stats. |
| `[src/features-v2/consumables/PotionOfStability.js](src/features-v2/consumables/PotionOfStability.js)` | Narrative-only stub; Tech Debt pointer.                                                                                                                                                                |


---

## Design

### 1. Engine: `'rest'` placement (no feature-specific branches in framework)

- Add `**'rest'`** to authoring docs as a first-class `**placements`** value alongside `intent`, `reviewAction`, `card`, etc.
- **Collection:** For each character column on the banner, build a **synthetic `gameState` + `table`** (via `buildTableSnapshot`) with:
  - `action.type`: `'shortRest'` or `'longRest'` matching `roll._restDuration`
  - `table.me` = that character
  - `activeElements`, `featureState`, fear/map as today’s bridges do for other snapshots
- Call `**collectChips(loadedFeatures, 'rest', table, usageStore)**` (or a thin wrapper `collectRestBannerChipsForCharacter` in client bridge code to stay feature-agnostic: **no** SRD name checks in `DiceRoller`).

### 2. Potion of Stability (consumable module only)

- `**cards` / `chips`:** one chip with `placements: ['rest']`, label e.g. drinking / using the potion.
- **Visibility:** Predicate that inventory includes this consumable (pattern can mirror other consumables that key off inventory).
- `**onUse`:** Mutations to remove one item from `inventory` and, if needed, set a **scope-bag** flag so `**passiveStatMods`** can use `when()` (CONV-011: slots must be passive stats, not “fire at end of phase” hooks).
- `**passiveStatMods`:** `when(table => …)` returning `{ numShortRestSlots: 1 }` and/or `numLongRestSlots: 1` per SRD (typically both rests get +1 move when the potion is used — confirm against SRD text during implementation).

### 3. Slot count plumbing (critical)

After the chip applies, the **dropdown row count** must match **merged** passive rest stats. Today `getRestMovesForCharacter` does **not** include consumable-conditional stats from merged features. **Close the gap** by one of:

- **Preferred:** Drive slot counts from the same **merged stats** pipeline used elsewhere (`recomputeCharacter` / `loadCharacterFeatures` output stats for `numShortRestSlots` / `numLongRestSlots` / `numLongMovesInShortRest`), and **reduce duplication** with ancestry/ability registry scans over time, **or**
- **Incremental:** Extend `getRestMovesForCharacter` to merge in **aggregated** rest-slot stats from merged `activeFeatures` / character calc for the element.

Without this, the potion’s `passiveStatMods` will not change the Rest banner slot UI.

### 4. UI + mutations (`RestBanner`)

- Add a **chip row** (per character or inline) using existing V2 chip button styling / disabled hints.
- **Apply** path: reuse the same **table op / character-update** patterns as other V2 banner or sheet chips (`applyV2*` / `partitionV2BannerChipMutations` as applicable); ensure **player-assigned** characters can activate their own rest chips with server validation.
- **Order of operations UX:** Chip to drink potion **before** or **alongside** filling moves — product decision; document in QA (e.g. extra slot appears after chip, then user fills new slot).

### 5. Framework boundaries

- `[v2-framework-boundaries.mdc](.cursor/rules/v2-framework-boundaries.mdc)`: `**DiceRoller` / `RestBanner`** stay free of `'Potion of Stability'` strings — only generic **placement `rest`** + merged feature chips.
- Per-feature behavior stays in `[src/features-v2/consumables/PotionOfStability.js](src/features-v2/consumables/PotionOfStability.js)` and tests.

---

## Documentation (mandatory when closing milestone)

- `[docs/v2-code-conventions.md](docs/v2-code-conventions.md)` — CONV-011 cross-link + new `**placement: 'rest'**` note.
- `[docs/feature-authoring-guide.md](docs/feature-authoring-guide.md)` — how to author rest chips.
- `[docs/v2-game-table-cutover-remaining.md](docs/v2-game-table-cutover-remaining.md)` — rest / session lifecycle as applicable; [`docs/v2-game-table-polestar.md`](docs/v2-game-table-polestar.md) for phase context.
- `[docs/srd-implementation.md](docs/srd-implementation.md)` — Potion row if status moves to **Done** (per srd-tracking).

---

## Verification

- `npm run test:unit` — chip collection for `placement: 'rest'`, Potion visibility/onUse, passive slot stats.
- Manual — Short/Long Rest: banner shows rest chip with potion in inventory; after use, inventory decreases and **extra move slot** appears; acknowledge applies fear + move `onApply` as today.

---

## Non-goals (this milestone)

- Migrating **every** rest-adjacent mechanic to `placement: 'rest'` (only Potion + infrastructure required for the milestone).
- Replacing `**runV2RestHooksForTable`** / `onRest` lifecycle hooks wholesale (orthogonal; long-rest `action.type` in that helper remains a separate backlog item if needed).

