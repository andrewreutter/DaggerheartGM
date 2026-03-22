# V2 features — browser test plan

This document enumerates the V2 feature framework, defines a fixed cast of **seven** library characters (each with all six **character options**: Class, Subclass, Ancestry, Community, Weapons, Armor), and gives a test script mapping capabilities to UI surfaces.

**Seed data:** Run `npm run seed:v2-browser-chars` with the same `DATABASE_URL` as the app. `DH_GM_UID` is optional if your database has exactly one primary `table_state` row (`id = user_id`); otherwise set `DH_GM_UID` in `.env`.

---

## 1. V2 framework capabilities

### A. Declarative rendering (`loadCharacterFeatures` / `applyDeclarativeFeatures`)

| Capability | Meaning |
|------------|--------|
| Passive stat mods | `passiveStatMods` merged into sheet math |
| Virtual weapons | Extra attacks (ancestry, beastform, class) |
| Advantage triggers | `advantageTriggers` + `when()` → experience-row advantage chips |
| Movement / damage affinity | `movementModes`, `damageAffinities` |
| Conditional wrappers | `when(predicates, …)` on declarative fields, chips, hooks |
| Shared option scope | `table.source.get` / `set` via registry `sourceScopeKey` |
| Per-feature bags | `table.feature.get` / `set` |
| Beastform | `attachBeastformOptions` + tier filtering (Druid) |
| Merged feature state | `mergeDeclarativeFeatureState` / `featureState` on character + table |

### B. Chips

| Capability | Meaning |
|------------|--------|
| Placements | `card`, `statblock`, `create`, `intent`, `reviewAction`, `reviewOutcome`, `resolveAction` |
| Default card action | Root `hopeCost` / `stressCost` / `frequency` / `onUse` |
| Costs & frequency | `frequency`, optional `frequencyMaxUses` |
| Toggles | `isToggle`, gating hooks without `onUse` |
| Cross-sheet | `showOnOtherSheets` → `collectChipsForOtherCharacterSheets` |
| Disabled state | `isDisabled` |

### C. Hooks (lifecycle)

| Capability | Meaning |
|------------|--------|
| Action loop | `onIntent`, `onReviewAction`, `onReviewOutcome`, `onResolve` |
| Rest / session | `onRest`, `onSessionStart` (via rest/session action types in the engine) |
| External mutations | `onStateChange` + `table.mutationBatch` |
| Map | `onTokenMove` + `table.tokenMove` |
| Scene | `onSceneEnd` |

### D. Table snapshot

| Capability | Meaning |
|------------|--------|
| Rolls API | `table.rolls.action` / `table.rolls.damage` |
| Effects pipeline | `table.action.effects` (raw damage → thresholds → HP/Stress) |
| Automatic rolls | `table.rollDie(...)` inside hooks |
| Predicates | `isActing`, `isTargeted`, `armorUseCommitted`, `hasDamage`, `hasPhysicalDamage`, range helpers, Seraph prayer-dice helpers |
| Mutations queue | Snapshot mutators → `applyMutations` |

### E. Game Table UI (current wiring)

| Surface | Exercises |
|---------|-----------|
| V2 declarative sheet | Merged V2 declaratives (`?v2Sheet=1` or user menu **V1 / V2**) |
| Character hover sheet | Feature cards, traits, weapons, experiences, defense |
| Dice `ResultBanner` | **`V2ReviewChipRow`** — review-phase chips from `collectV2ReviewActionChips` |
| Experiences / modifiers | Cross-sheet chips when parent passes `crossSheetChips` |
| Character editor | **`create`** placement chips |
| Battle map | Token drag → `dispatchTokenMoveHooks` / Phase 4 bridge |

Some hooks (rest/session/scene-end) may only be fully covered by unit tests until listed in the V2 UI integration backlog.

---

## 2. Cast of characters (six options each)

| # | Name | Class | Subclass | Ancestry | Community | Weapons | Armor |
|---|------|--------|----------|----------|-----------|---------|-------|
| 1 | **Aria** | Druid | Beastbound | Faun | Wildborne | Quarterstaff | Leather Armor |
| 2 | **Brix** | Bard | Troubadour | Human | Highborne | Rapier + Shortsword (Paired) | Gambeson Armor |
| 3 | **Cass** | Seraph | Divine Wielder | Halfling | Seaborne | Mace | Elundrian Chain Armor (Warded) |
| 4 | **Dara** | Warrior | Stalwart | Drakona | Orderborne | Greatsword | IronTree Breastplate (Reinforced) |
| 5 | **Echo** | Rogue | Nightwalker | Katari | Underborne | Dagger | Leather Armor |
| 6 | **Finn** | Wizard | Elemental Origin | Clank | Wanderborne | Mage Orb | Leather Armor |
| 7 | **Gideon** | Guardian | Warden of Renewal | Human | Orderborne | Battleaxe | Full Fortified Armor |

Library IDs are fixed UUIDs (`f2b00000-0000-4000-8000-0000000000n`) so re-running the seed updates the same rows.

---

## 3. Test script (capabilities × features × UI)

| Capability bucket | Character | What to exercise | Where |
|-------------------|-----------|------------------|-------|
| passiveStatMods | Brix, Dara, Gideon | Class/subclass; armor/weapon passives | Sheet — stats, defense, tooltips |
| virtualWeapons | Aria, Echo | Beastform attacks; Katari claws | Sheet — weapon list |
| advantageTriggers | Echo, Dara | Subclass/class advantage text | Sheet — green experience toggles |
| table.source / stateful subclass | Finn | Elemental Origin shared bags | Sheet + banners when applicable |
| Default card action | Any | Hope/Stress/session costs | Sheet — **Use** on feature cards |
| Chips `card` / Rally | Brix | Troubadour / Rally | Sheet; allies’ sheets for Rally |
| Phase chips on banner | Dara, Echo, Finn | Weapon/armor tags; Codex spells | **ResultBanner** — **V2ReviewChipRow** |
| showOnOtherSheets | Brix | Rally | Ally **CharacterExperiences** / modifiers |
| Arcana spells (V2) | Aria | Rune Ward, Cinder Grasp | Sheet + banner when casting |
| onStateChange / beastform | Aria | Drop beastform at 0 HP | Sheet after HP changes |
| onTokenMove | Dara, Echo | Warrior / Rogue map hooks | Map — token drag |
| onRest / onSessionStart | Brix, Cass, Finn | Troubadour, Halfling/Seaborne, Divine Wielder | Short/Long Rest; **Start Session** |
| Clank create / bonus | Finn | Purposeful Design + experiences | Editor (re-open); sheet scores |
| Guardian / armor | Gideon | Unstoppable; Fortified armor | Sheet; damage banner (V1 armor track) |

### Suggested session order

1. Enable V2 sheet (`?v2Sheet=1` or menu).
2. Run `npm run seed:v2-browser-chars`; open Game Table — confirm seven PCs.
3. Per PC: open hover sheet — stats, features, weapons.
4. Combat: attack with Echo/Dara — target adversary — use **V2ReviewChipRow** on the banner.
5. Brix: confirm Rally-related UI on another PC if wired.
6. Aria: Beastform → attack; optionally test HP-to-zero in form.
7. Map: token drags for Warrior/Rogue hooks.
8. **Start Session** + **Short Rest** once — spot-check session/rest-dependent features.

---

## 4. Environment variables (seed script)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (same as the running app) |
| `DH_GM_UID` | No* | Your Firebase user id — required only if the DB has zero or multiple primary table owners |
| `APP_ID` | No | Defaults to `daggerheart-gm-tool` |

\*If omitted, the script selects the owner of the primary `table_state` row where `id = user_id` (see migration 017).

Re-running the seed **upserts** the same character rows and **replaces** any prior table elements that reference those library IDs, then appends fresh runtime elements for the seven PCs.
