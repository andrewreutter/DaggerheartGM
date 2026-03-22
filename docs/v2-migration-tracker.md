# V2 Feature System Migration Tracker

This file is the single source of truth for tracking implementation progress of all Daggerheart SRD features in the V2 engine (`src/features-v2/`). Multiple agents read and write this file.

**Cross-collection implementation order (mandatory for implementation agents):** **`abilities/` → `beastforms/` → `items/` → `consumables/`** — do not claim a later collection while any row in an earlier one is still `Unclaimed` here. **`subclasses/`** is **not** in this chain (subclass rows live in [`v2-migration-to-review.md`](v2-migration-to-review.md); unclaimed subclass work does **not** block the four collections above). See **`docs/agent-prompts/implementation-agent.md`** (**Cross-collection priority**). Within **`abilities/`**, order is still **spell card tier** (Tier 1, then 2, then 3) and **priority domains** within each tier.

## Status Summary


| Collection             | Total   | Validated | Reviewed | Validating | Done  | In Progress | Unclaimed | Needs Fix | Fixing | Blocked | Skipped |
| ---------------------- | ------- | --------- | -------- | ---------- | ----- | ----------- | --------- | --------- | ------ | ------- | ------- |
| Ancestries (features)  | 35      | 0         | 35       | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Communities (features) | 9       | 0         | 9        | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Weapon Properties      | 50      | 46        | 4        | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Armor Properties       | 21      | 0         | 21       | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Classes (features)     | 24      | 23        | 1        | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Subclasses (features)  | 75      | 72        | 1        | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Abilities              | 189     | 21        | 0        | 0          | 2     | 0           | 163       | 0         | 3      | 0       | 0       |
| Beastforms             | 24      | 24        | 0        | 0          | 0     | 0           | 0         | 0         | 0      | 0       | 0       |
| Items                  | 60      | 0         | 0        | 0          | 0     | 0           | 60        | 0         | 0      | 0       | 0       |
| Consumables            | 60      | 0         | 0        | 0          | 0     | 0           | 60        | 0         | 0      | 0       | 0       |
| **TOTAL**              | **547** | **176**   | **71**   | **0**      | **14** | **0**       | **283**   | **0**     | **3**  | **0**   | **0**   |

<!-- v2-queue:start -->

## Implementation queue (generated)

```text
V2 implementation queue (derived from docs/v2-migration-tracker.md)
Rules: docs/agent-prompts/implementation-agent.md (Cross-collection priority, Domain tier order).

Active collection (impl): abilities
Claimable tier: 1
Blade/Bone blocked by priority domains in this tier: yes

Next claimable Unclaimed rows (up to 15):
  - [Tier 1] Midnight — Chokehold (abilities/Midnight/Chokehold.js)
  - [Tier 1] Midnight — Veil of Night (abilities/Midnight/VeilOfNight.js)
  - [Tier 1] Sage — Gifted Tracker (abilities/Sage/GiftedTracker.js)
  - [Tier 1] Sage — Nature's Tongue (abilities/Sage/NaturesTongue.js)
  - [Tier 1] Sage — Vicious Entangle (abilities/Sage/ViciousEntangle.js)
  - [Tier 1] Sage — Conjure Swarm (abilities/Sage/ConjureSwarm.js)
  - [Tier 1] Sage — Natural Familiar (abilities/Sage/NaturalFamiliar.js)
  - [Tier 1] Sage — Corrosive Projectile (abilities/Sage/CorrosiveProjectile.js)
  - [Tier 1] Sage — Towering Stalk (abilities/Sage/ToweringStalk.js)
  - [Tier 1] Splendor — Bolt Beacon (abilities/Splendor/BoltBeacon.js)
  - [Tier 1] Splendor — Mending Touch (abilities/Splendor/MendingTouch.js)
  - [Tier 1] Splendor — Reassurance (abilities/Splendor/Reassurance.js)
  - [Tier 1] Splendor — Final Words (abilities/Splendor/FinalWords.js)
  - [Tier 1] Splendor — Healing Hands (abilities/Splendor/HealingHands.js)
  - [Tier 1] Splendor — Second Wind (abilities/Splendor/SecondWind.js)

Claim: set Status to In Progress and Agent id in docs/v2-migration-tracker.md (tracker protocol).
```

<!-- v2-queue:end -->

---

## Feature Checklists

Columns: **Feature Name** | **Source File** | **Status** | **Agent** | **Impl Notes** | **Val Notes** | **Fix Notes**

Status values: `Unclaimed` | `In Progress` | `Done` | `Validating` | `Validated` | `Reviewed` | `Needs Fix` | `Fixing` | `Blocked` | `Skipped`

> **Blocked rollup**: A feature row remains `Blocked` while **any** pending row in the active **Blocked / API Extension Requests** table (below) lists that feature. Completed resolutions are **appended** to `[docs/v2-blocked-resolutions-done.md](v2-blocked-resolutions-done.md)` and removed from the active table. When no active row lists the feature, the Unblocking Agent promotes it to `Done` in the main tracker (the agent implemented the feature as part of the resolution).

---

### Ancestries & Communities (Reviewed — see archive)

Full checklists (impl / val / fix notes) for all ancestry and community V2 features live in `[v2-migration-reviewed-archive.md](v2-migration-reviewed-archive.md)` so this file stays smaller for agents. Every feature in those collections is **Reviewed**; counts stay in the **Status Summary** table above.

---

### Weapon Properties (see to-review file)

Full checklist (impl / val / fix notes) for all weapon property V2 features live in `[v2-migration-to-review.md](v2-migration-to-review.md)` so this file stays smaller for agents. Counts stay in the **Status Summary** table above.

---

### Armor Properties (Reviewed — see archive)

Full checklists (impl / val / fix notes) for all armor property V2 features live in `[v2-migration-reviewed-archive.md](v2-migration-reviewed-archive.md)` so this file stays smaller for agents. Every feature in that collection is **Reviewed**; counts stay in the **Status Summary** table above.

---

### Classes (see archive)

Full checklist (impl / val / fix notes) for all class V2 features live in `[v2-migration-reviewed-archive.md](v2-migration-reviewed-archive.md)` so this file stays smaller for agents. Counts stay in the **Status Summary** table above.

---

### Subclasses (see to-review file)

Full checklist (impl / val / fix notes) for all subclass V2 features lives in [`v2-migration-to-review.md`](v2-migration-to-review.md) so this file stays smaller for agents. Counts stay in the **Status Summary** table above.


---

### Abilities (189 abilities across 9 domains)

> Implement in `src/features-v2/abilities/<Domain>/<AbilityName>.js`.

**Implementation order (mandatory):** **Cross-collection priority** (`docs/agent-prompts/implementation-agent.md`) puts **Abilities** first among the gated collections — **Unclaimed subclass rows do not block** Abilities. Work **by spell card tier**, not by finishing one domain at a time. Complete **all Tier 1** abilities (every domain) before **Tier 2**, then **Tier 3**. Within each tier, implement **priority domains** first (see **Domain abilities — tier order** in `docs/agent-prompts/implementation-agent.md`): **Arcana, Codex, Grace, Midnight, Sage, Splendor, Valor** — the domains used by **Bard**, **Rogue**, **Seraph**, and **Druid** — then **Blade** and **Bone**. Tier is the domain card tier (1–3); each domain has seven cards per tier in SRD order.

#### Tier 1 — complete all domains before Tier 2 (63 abilities)

| Domain   | Feature Name         | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------- | -------------------- | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Arcana | Rune Ward | abilities/Arcana/RuneWard.js | Validated | val-n5kp     | `Ward Holder` `card` + `selectTargets` → `runeWardHolderInstanceId`; `reviewAction` + `showOnOtherSheets`; bridge merges `collectChipsForOtherCharacterSheets` for damage targets; `activateV2ReviewChip` uses `_crossSheetViewerInstanceId` for Hope. Tests: `ArcanaTier1.test.js`, `v2-action-loop-bridge.test.js`.            | SRD: holder choice, 1d8 reduction, depletes on 8, rest recharge; `onRest` clears depletion. Tests cover chip + bridge. |           |
| Arcana | Unleash Chaos | abilities/Arcana/UnleashChaos.js | Validated | val-t3wk     | `onSessionStart` token fill; Replenish stress; Cast `isSelect` + `actionLoop`. Tests: `ArcanaTier1.test.js`.            |           |           |
| Arcana | Wall Walk | abilities/Arcana/WallWalk.js | Validated | val-t3wk     | Hope `card` chip + `actionLoop`. Tests: `ArcanaTier1.test.js`.            |           |           |
| Arcana | Cinder Grasp | abilities/Arcana/CinderGrasp.js | Fixing | fix-cg4p     | `actionLoop` Spellcast prompt; `hooks.onResolve` queues `addDamageRoll` 2d6 magic when action actor has `On Fire` (end-of-action tick). Tests: `ArcanaTier1.test.js`.            | SRD: while _On Fire_, **2d6** extra magic damage at **end of their action** if still On Fire — not automated (card `actionLoop` only covers the initial hit / On Fire application).          |           |
| Arcana | Floating Eye | abilities/Arcana/FloatingEye.js | Validated | val-t3wk     | Hope `card` chip + `actionLoop`. Tests: `ArcanaTier1.test.js`.            |           |           |
| Arcana | Counterspell | abilities/Arcana/Counterspell.js | Fixing | fix-k8qm     | `reviewOutcome` + `moveDomainCardToVault('srd-abl-counterspell')` on successful reaction. Tests: `ArcanaTier1.test.js`.            | CONV/placement: `docs/feature-authoring-guide.md` §3.2 — `reviewOutcome` is for chips that modify final HP/Stress boxes after thresholds; Counterspell only vaults the card on a successful **reaction** (“effect stops… consequences avoided”) and should use `reviewAction` (update `ArcanaTier1.test.js` phase).           |           |
| Arcana | Flight | abilities/Arcana/Flight.js | Validated | val-w4np     | Card sets `flightTokens` / `flightActive`; `onIntent` spends token on Hope/Fear rolls. Spellcast (15) gate is table/GM. Tests: `ArcanaTier1.test.js`.            |           |           |
| Codex | Book of Ava | abilities/Codex/BookOfAva.js | Validated | fix-h2kc     | Tier 1 grimoire: card chips per sub-spell (`Power Push`, `Tava's Armor` Hope, `Ice Spike`); `actionLoop` + Spellcast trait. Tests: `CodexTier1Books.test.js`.            |           | `fix-h2kc`: `CodexTier1Books.test.js` — Tava's Armor asserts `actionLoop` via `toContainEqual`/`expect.objectContaining` (CONV-008). |
| Codex | Book of Illiat | abilities/Codex/BookOfIlliat.js | Validated | val-z9xq     | `Slumber`, `Arcane Barrage` (`frequency: 'rest'`), `Telepathy` (Hope). Tests: `CodexTier1Books.test.js`.            |           |           |
| Codex | Book of Tyfar | abilities/Codex/BookOfTyfar.js | Validated | fix-w3qp     | `Wild Flame`, `Magic Hand`, `Mysterious Mist`. Tests: `CodexTier1Books.test.js`.            |            | Magic Hand chip `description` aligned to SRD (removed invented dismiss/scene duration).            |
| Codex | Book of Sitil | abilities/Codex/BookOfSitil.js | Validated | val-z9xq     | `Adjust Appearance`, `Parallela` (2 Hope), `Illusion`. Tests: `CodexTier1Books.test.js`.            |           |           |
| Codex | Book of Vagras | abilities/Codex/BookOfVagras.js | Validated | val-z9xq     | `Runic Lock` (`rest`), `Arcane Door` (Hope after success — no auto `hopeCost` on chip), `Reveal`. Tests: `CodexTier1Books.test.js`.            |           |           |
| Codex | Book of Korvax | abilities/Codex/BookOfKorvax.js | Validated | val-m4kt     | Levitation / Recant (Hope 1) / Rune Circle (Stress 1); `actionLoop` + Spellcast trait. Tests: `CodexTier1Books.test.js`.            |           |           |
| Codex | Book of Norai | abilities/Codex/BookOfNorai.js | Validated | val-m4kt     | Mystic Tether + Fireball card chips; `actionLoop`. Tests: `CodexTier1Books.test.js`.            |           |           |
| Grace | Deft Deceiver | abilities/Grace/DeftDeceiver.js | Validated | val-r8nq     | `intent` Hope 1 + `addAdvantageDie`. Tests: `GraceTier1.test.js`.            |           |           |
| Grace | Enrapture | abilities/Grace/Enrapture.js | Validated | val-r8nq     | `card` Spellcast + `Enrapture — Shared Duress` (`frequency: 'rest'`, Stress 1). Tests: `GraceTier1.test.js`.            |           |           |
| Grace | Inspirational Words | abilities/Grace/InspirationalWords.js | Validated | fix-n7p9     | `hooks.onRest` (long rest) sets tokens = Presence; `card` `isSelect` spend token + `actionLoop`. Tests: `GraceTier1.test.js`.            |           | `fix-n7p9`: `GraceTier1.test.js` — CONV-008: `actionLoop` assertion uses `toContainEqual`/`expect.objectContaining` (test-only fix).            |
| Grace | Tell No Lies | abilities/Grace/TellNoLies.js | Validated | val-r8nq     | `card` Spellcast `actionLoop`. Tests: `GraceTier1.test.js`.            |           |           |
| Grace | Troublemaker | abilities/Grace/Troublemaker.js | Validated | val-r8nq     | `card` `frequency: 'rest'` Presence taunt `actionLoop` (Proficiency × d4). Tests: `GraceTier1.test.js`.            |           |           |
| Grace | Hypnotic Shimmer | abilities/Grace/HypnoticShimmer.js | Done | impl-g9wz     | `frequency: 'rest'` + `actionLoop` Spellcast vs adversaries in front within Close; Stun + Stress on GM success. Tests: `GraceTier1.test.js`.            |           |           |
| Grace | Invisibility | abilities/Grace/Invisibility.js | Done | impl-g9wz     | `actionLoop` Spellcast (10), Stress + ally/Melee + tokens + disadvantage (GM). Tests: `GraceTier1.test.js`.            |           |           |
| Midnight | Pick and Pull | abilities/Midnight/PickAndPull.js | Validated | val-h3kp     | `advantageTriggers` locks/traps/steal. Tests: `MidnightTier1.test.js`.            | SRD phrase match; `applyDeclarativeFeatures`; preflight + `MidnightTier1.test.js`.           |           |
| Midnight | Rain of Blades | abilities/Midnight/RainOfBlades.js | Validated | val-h3kp     | Hope `card` Spellcast AoE Very Close d8+2 + Vulnerable note. Tests: `MidnightTier1.test.js`.            | SRD: Hope, Spellcast vs Very Close, d8+2 + Proficiency, extra d8 if Vulnerable; `actionLoop` + CONV-008 mutations.           |           |
| Midnight | Uncanny Disguise | abilities/Midnight/UncannyDisguise.js | Validated | fix-ud9k     | Stress `card` sets Spellcast tokens; `when` advantage while tokens; `onResolve` spends token. Tests: `MidnightTier1.test.js`.            |           | `fix-ud9k`: `advantageTriggers` also gates `table.action?.trait === 'presence'` (CONV-020 trait-scoped advantage). `MidnightTier1.test.js` updated.            |
| Midnight | Midnight Spirit | abilities/Midnight/MidnightSpirit.js | Fixing | fix-ms4k     | Summon (Hope) + Strike (`actionLoop`); `featureState` one-spirit flag. Tests: `MidnightTier1.test.js`.            | SRD: (1) **Strike** only after summoning — add `isDisabled` on Strike when `!midnightSpiritActive`; (2) Summon lasts **until your next rest** — add `hooks.onRest` to clear an active summon (see `InspirationalWords.js` / `RuneWard.js`).           |           |
| Midnight | Shadowbind | abilities/Midnight/Shadowbind.js | Validated | val-h3kp     | Spellcast `card` vs Very Close adversaries Restrained (`actionLoop`). Tests: `MidnightTier1.test.js`.            | SRD: Spellcast vs all adversaries Very Close → Restrained; `actionLoop` text matches.           |           |
| Midnight | Chokehold | abilities/Midnight/Chokehold.js | Unclaimed | —     |            |           |           |
| Midnight | Veil of Night | abilities/Midnight/VeilOfNight.js | Unclaimed | —     |            |           |           |
| Sage | Gifted Tracker | abilities/Sage/GiftedTracker.js | Unclaimed | —     |            |           |           |
| Sage | Nature's Tongue | abilities/Sage/NaturesTongue.js | Unclaimed | —     |            |           |           |
| Sage | Vicious Entangle | abilities/Sage/ViciousEntangle.js | Unclaimed | —     |            |           |           |
| Sage | Conjure Swarm | abilities/Sage/ConjureSwarm.js | Unclaimed | —     |            |           |           |
| Sage | Natural Familiar | abilities/Sage/NaturalFamiliar.js | Unclaimed | —     |            |           |           |
| Sage | Corrosive Projectile | abilities/Sage/CorrosiveProjectile.js | Unclaimed | —     |            |           |           |
| Sage | Towering Stalk | abilities/Sage/ToweringStalk.js | Unclaimed | —     |            |           |           |
| Splendor | Bolt Beacon | abilities/Splendor/BoltBeacon.js | Unclaimed | —     |            |           |           |
| Splendor | Mending Touch | abilities/Splendor/MendingTouch.js | Unclaimed | —     |            |           |           |
| Splendor | Reassurance | abilities/Splendor/Reassurance.js | Unclaimed | —     |            |           |           |
| Splendor | Final Words | abilities/Splendor/FinalWords.js | Unclaimed | —     |            |           |           |
| Splendor | Healing Hands | abilities/Splendor/HealingHands.js | Unclaimed | —     |            |           |           |
| Splendor | Second Wind | abilities/Splendor/SecondWind.js | Unclaimed | —     |            |           |           |
| Splendor | Voice of Reason | abilities/Splendor/VoiceOfReason.js | Unclaimed | —     |            |           |           |
| Valor | Bare Bones | abilities/Valor/BareBones.js | Unclaimed | —     |            |           |           |
| Valor | Forceful Push | abilities/Valor/ForcefulPush.js | Unclaimed | —     |            |           |           |
| Valor | I Am Your Shield | abilities/Valor/IAmYourShield.js | Unclaimed | —     |            |           |           |
| Valor | Body Basher | abilities/Valor/BodyBasher.js | Unclaimed | —     |            |           |           |
| Valor | Bold Presence | abilities/Valor/BoldPresence.js | Unclaimed | —     |            |           |           |
| Valor | Critical Inspiration | abilities/Valor/CriticalInspiration.js | Unclaimed | —     |            |           |           |
| Valor | Lean on Me | abilities/Valor/LeanOnMe.js | Unclaimed | —     |            |           |           |
| Blade | Get Back Up | abilities/Blade/GetBackUp.js | Unclaimed | —     |            |           |           |
| Blade | Not Good Enough | abilities/Blade/NotGoodEnough.js | Unclaimed | —     |            |           |           |
| Blade | Whirlwind | abilities/Blade/Whirlwind.js | Unclaimed | —     |            |           |           |
| Blade | A Soldier's Bond | abilities/Blade/ASoldiersBond.js | Unclaimed | —     |            |           |           |
| Blade | Reckless | abilities/Blade/Reckless.js | Unclaimed | —     |            |           |           |
| Blade | Scramble | abilities/Blade/Scramble.js | Unclaimed | —     |            |           |           |
| Blade | Versatile Fighter | abilities/Blade/VersatileFighter.js | Unclaimed | —     |            |           |           |
| Bone | Deft Maneuvers | abilities/Bone/DeftManeuvers.js | Unclaimed | —     |            |           |           |
| Bone | I See It Coming | abilities/Bone/ISeeItComing.js | Unclaimed | —     |            |           |           |
| Bone | Untouchable | abilities/Bone/Untouchable.js | Unclaimed | —     |            |           |           |
| Bone | Ferocity | abilities/Bone/Ferocity.js | Unclaimed | —     |            |           |           |
| Bone | Strategic Approach | abilities/Bone/StrategicApproach.js | Unclaimed | —     |            |           |           |
| Bone | Brace | abilities/Bone/Brace.js | Unclaimed | —     |            |           |           |
| Bone | Tactician | abilities/Bone/Tactician.js | Unclaimed | —     |            |           |           |

#### Tier 2 — after Tier 1 has no `Unclaimed` or `In Progress` rows (63 abilities)

| Domain   | Feature Name         | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------- | -------------------- | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Arcana | Blink Out | abilities/Arcana/BlinkOut.js | Unclaimed | —     |            |           |           |
| Arcana | Preservation Blast | abilities/Arcana/PreservationBlast.js | Unclaimed | —     |            |           |           |
| Arcana | Chain Lightning | abilities/Arcana/ChainLightning.js | Unclaimed | —     |            |           |           |
| Arcana | Premonition | abilities/Arcana/Premonition.js | Unclaimed | —     |            |           |           |
| Arcana | Rift Walker | abilities/Arcana/RiftWalker.js | Unclaimed | —     |            |           |           |
| Arcana | Telekinesis | abilities/Arcana/Telekinesis.js | Unclaimed | —     |            |           |           |
| Arcana | Arcana-Touched | abilities/Arcana/ArcanaTouched.js | Unclaimed | —     |            |           |           |
| Codex | Book of Exota | abilities/Codex/BookOfExota.js | Unclaimed | —     |            |           |           |
| Codex | Book of Grynn | abilities/Codex/BookOfGrynn.js | Unclaimed | —     |            |           |           |
| Codex | Manifest Wall | abilities/Codex/ManifestWall.js | Unclaimed | —     |            |           |           |
| Codex | Teleport | abilities/Codex/Teleport.js | Unclaimed | —     |            |           |           |
| Codex | Banish | abilities/Codex/Banish.js | Unclaimed | —     |            |           |           |
| Codex | Sigil of Retribution | abilities/Codex/SigilOfRetribution.js | Unclaimed | —     |            |           |           |
| Codex | Book of Homet | abilities/Codex/BookOfHomet.js | Unclaimed | —     |            |           |           |
| Grace | Soothing Speech | abilities/Grace/SoothingSpeech.js | Unclaimed | —     |            |           |           |
| Grace | Through Your Eyes | abilities/Grace/ThroughYourEyes.js | Unclaimed | —     |            |           |           |
| Grace | Thought Delver | abilities/Grace/ThoughtDelver.js | Unclaimed | —     |            |           |           |
| Grace | Words of Discord | abilities/Grace/WordsOfDiscord.js | Unclaimed | —     |            |           |           |
| Grace | Never Upstaged | abilities/Grace/NeverUpstaged.js | Unclaimed | —     |            |           |           |
| Grace | Share the Burden | abilities/Grace/ShareTheBurden.js | Unclaimed | —     |            |           |           |
| Grace | Endless Charisma | abilities/Grace/EndlessCharisma.js | Unclaimed | —     |            |           |           |
| Midnight | Stealth Expertise | abilities/Midnight/StealthExpertise.js | Unclaimed | —     |            |           |           |
| Midnight | Glyph of Nightfall | abilities/Midnight/GlyphOfNightfall.js | Unclaimed | —     |            |           |           |
| Midnight | Hush | abilities/Midnight/Hush.js | Unclaimed | —     |            |           |           |
| Midnight | Phantom Retreat | abilities/Midnight/PhantomRetreat.js | Unclaimed | —     |            |           |           |
| Midnight | Dark Whispers | abilities/Midnight/DarkWhispers.js | Unclaimed | —     |            |           |           |
| Midnight | Mass Disguise | abilities/Midnight/MassDisguise.js | Unclaimed | —     |            |           |           |
| Midnight | Midnight-Touched | abilities/Midnight/MidnightTouched.js | Unclaimed | —     |            |           |           |
| Sage | Death Grip | abilities/Sage/DeathGrip.js | Unclaimed | —     |            |           |           |
| Sage | Healing Field | abilities/Sage/HealingField.js | Unclaimed | —     |            |           |           |
| Sage | Thorn Skin | abilities/Sage/ThornSkin.js | Unclaimed | —     |            |           |           |
| Sage | Wild Fortress | abilities/Sage/WildFortress.js | Unclaimed | —     |            |           |           |
| Sage | Conjured Steeds | abilities/Sage/ConjuredSteeds.js | Unclaimed | —     |            |           |           |
| Sage | Forager | abilities/Sage/Forager.js | Unclaimed | —     |            |           |           |
| Sage | Sage-Touched | abilities/Sage/SageTouched.js | Unclaimed | —     |            |           |           |
| Splendor | Divination | abilities/Splendor/Divination.js | Unclaimed | —     |            |           |           |
| Splendor | Life Ward | abilities/Splendor/LifeWard.js | Unclaimed | —     |            |           |           |
| Splendor | Shape Material | abilities/Splendor/ShapeMaterial.js | Unclaimed | —     |            |           |           |
| Splendor | Smite | abilities/Splendor/Smite.js | Unclaimed | —     |            |           |           |
| Splendor | Restoration | abilities/Splendor/Restoration.js | Unclaimed | —     |            |           |           |
| Splendor | Zone of Protection | abilities/Splendor/ZoneOfProtection.js | Unclaimed | —     |            |           |           |
| Splendor | Healing Strike | abilities/Splendor/HealingStrike.js | Unclaimed | —     |            |           |           |
| Valor | Goad Them on | abilities/Valor/GoadThemOn.js | Unclaimed | —     |            |           |           |
| Valor | Support Tank | abilities/Valor/SupportTank.js | Unclaimed | —     |            |           |           |
| Valor | Armorer | abilities/Valor/Armorer.js | Unclaimed | —     |            |           |           |
| Valor | Rousing Strike | abilities/Valor/RousingStrike.js | Unclaimed | —     |            |           |           |
| Valor | Inevitable | abilities/Valor/Inevitable.js | Unclaimed | —     |            |           |           |
| Valor | Rise Up | abilities/Valor/RiseUp.js | Unclaimed | —     |            |           |           |
| Valor | Shrug It Off | abilities/Valor/ShrugItOff.js | Unclaimed | —     |            |           |           |
| Blade | Deadly Focus | abilities/Blade/DeadlyFocus.js | Unclaimed | —     |            |           |           |
| Blade | Fortified Armor | abilities/Blade/FortifiedArmor.js | Unclaimed | —     |            |           |           |
| Blade | Champion's Edge | abilities/Blade/ChampionsEdge.js | Unclaimed | —     |            |           |           |
| Blade | Vitality | abilities/Blade/Vitality.js | Unclaimed | —     |            |           |           |
| Blade | Battle-Hardened | abilities/Blade/BattleHardened.js | Unclaimed | —     |            |           |           |
| Blade | Rage Up | abilities/Blade/RageUp.js | Unclaimed | —     |            |           |           |
| Blade | Blade-Touched | abilities/Blade/BladeTouched.js | Unclaimed | —     |            |           |           |
| Bone | Boost | abilities/Bone/Boost.js | Unclaimed | —     |            |           |           |
| Bone | Redirect | abilities/Bone/Redirect.js | Unclaimed | —     |            |           |           |
| Bone | Know Thy Enemy | abilities/Bone/KnowThyEnemy.js | Unclaimed | —     |            |           |           |
| Bone | Signature Move | abilities/Bone/SignatureMove.js | Unclaimed | —     |            |           |           |
| Bone | Rapid Riposte | abilities/Bone/RapidRiposte.js | Unclaimed | —     |            |           |           |
| Bone | Recovery | abilities/Bone/Recovery.js | Unclaimed | —     |            |           |           |
| Bone | Bone-Touched | abilities/Bone/BoneTouched.js | Unclaimed | —     |            |           |           |

#### Tier 3 — after Tier 2 has no `Unclaimed` or `In Progress` rows (63 abilities)

| Domain   | Feature Name         | Source File                           | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| -------- | -------------------- | ------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Arcana | Cloaking Blast | abilities/Arcana/CloakingBlast.js | Unclaimed | —     |            |           |           |
| Arcana | Arcane Reflection | abilities/Arcana/ArcaneReflection.js | Unclaimed | —     |            |           |           |
| Arcana | Confusing Aura | abilities/Arcana/ConfusingAura.js | Unclaimed | —     |            |           |           |
| Arcana | Earthquake | abilities/Arcana/Earthquake.js | Unclaimed | —     |            |           |           |
| Arcana | Sensory Projection | abilities/Arcana/SensoryProjection.js | Unclaimed | —     |            |           |           |
| Arcana | Adjust Reality | abilities/Arcana/AdjustReality.js | Unclaimed | —     |            |           |           |
| Arcana | Falling Sky | abilities/Arcana/FallingSky.js | Unclaimed | —     |            |           |           |
| Codex | Codex-Touched | abilities/Codex/CodexTouched.js | Unclaimed | —     |            |           |           |
| Codex | Book of Vyola | abilities/Codex/BookOfVyola.js | Unclaimed | —     |            |           |           |
| Codex | Safe Haven | abilities/Codex/SafeHaven.js | Unclaimed | —     |            |           |           |
| Codex | Book of Ronin | abilities/Codex/BookOfRonin.js | Unclaimed | —     |            |           |           |
| Codex | Disintegration Wave | abilities/Codex/DisintegrationWave.js | Unclaimed | —     |            |           |           |
| Codex | Book of Yarrow | abilities/Codex/BookOfYarrow.js | Unclaimed | —     |            |           |           |
| Codex | Transcendent Union | abilities/Codex/TranscendentUnion.js | Unclaimed | —     |            |           |           |
| Grace | Grace-Touched | abilities/Grace/GraceTouched.js | Unclaimed | —     |            |           |           |
| Grace | Astral Projection | abilities/Grace/AstralProjection.js | Unclaimed | —     |            |           |           |
| Grace | Mass Enrapture | abilities/Grace/MassEnrapture.js | Unclaimed | —     |            |           |           |
| Grace | Copycat | abilities/Grace/Copycat.js | Unclaimed | —     |            |           |           |
| Grace | Master of the Craft | abilities/Grace/MasterOfTheCraft.js | Unclaimed | —     |            |           |           |
| Grace | Encore | abilities/Grace/Encore.js | Unclaimed | —     |            |           |           |
| Grace | Notorious | abilities/Grace/Notorious.js | Unclaimed | —     |            |           |           |
| Midnight | Vanishing Dodge | abilities/Midnight/VanishingDodge.js | Unclaimed | —     |            |           |           |
| Midnight | Shadowhunter | abilities/Midnight/Shadowhunter.js | Unclaimed | —     |            |           |           |
| Midnight | Spellcharge | abilities/Midnight/Spellcharge.js | Unclaimed | —     |            |           |           |
| Midnight | Night Terror | abilities/Midnight/NightTerror.js | Unclaimed | —     |            |           |           |
| Midnight | Twilight Toll | abilities/Midnight/TwilightToll.js | Unclaimed | —     |            |           |           |
| Midnight | Eclipse | abilities/Midnight/Eclipse.js | Unclaimed | —     |            |           |           |
| Midnight | Specter of the Dark | abilities/Midnight/SpecterOfTheDark.js | Unclaimed | —     |            |           |           |
| Sage | Wild Surge | abilities/Sage/WildSurge.js | Unclaimed | —     |            |           |           |
| Sage | Forest Sprites | abilities/Sage/ForestSprites.js | Unclaimed | —     |            |           |           |
| Sage | Rejuvenation Barrier | abilities/Sage/RejuvenationBarrier.js | Unclaimed | —     |            |           |           |
| Sage | Fane of the Wilds | abilities/Sage/FaneOfTheWilds.js | Unclaimed | —     |            |           |           |
| Sage | Plant Dominion | abilities/Sage/PlantDominion.js | Unclaimed | —     |            |           |           |
| Sage | Force of Nature | abilities/Sage/ForceOfNature.js | Unclaimed | —     |            |           |           |
| Sage | Tempest | abilities/Sage/Tempest.js | Unclaimed | —     |            |           |           |
| Splendor | Splendor-Touched | abilities/Splendor/SplendorTouched.js | Unclaimed | —     |            |           |           |
| Splendor | Shield Aura | abilities/Splendor/ShieldAura.js | Unclaimed | —     |            |           |           |
| Splendor | Stunning Sunlight | abilities/Splendor/StunningSunlight.js | Unclaimed | —     |            |           |           |
| Splendor | Overwhelming Aura | abilities/Splendor/OverwhelmingAura.js | Unclaimed | —     |            |           |           |
| Splendor | Salvation Beam | abilities/Splendor/SalvationBeam.js | Unclaimed | —     |            |           |           |
| Splendor | Invigoration | abilities/Splendor/Invigoration.js | Unclaimed | —     |            |           |           |
| Splendor | Resurrection | abilities/Splendor/Resurrection.js | Unclaimed | —     |            |           |           |
| Valor | Valor-Touched | abilities/Valor/ValorTouched.js | Unclaimed | —     |            |           |           |
| Valor | Full Surge | abilities/Valor/FullSurge.js | Unclaimed | —     |            |           |           |
| Valor | Ground Pound | abilities/Valor/GroundPound.js | Unclaimed | —     |            |           |           |
| Valor | Hold the Line | abilities/Valor/HoldTheLine.js | Unclaimed | —     |            |           |           |
| Valor | Lead by Example | abilities/Valor/LeadByExample.js | Unclaimed | —     |            |           |           |
| Valor | Unbreakable | abilities/Valor/Unbreakable.js | Unclaimed | —     |            |           |           |
| Valor | Unyielding Armor | abilities/Valor/UnyieldingArmor.js | Unclaimed | —     |            |           |           |
| Blade | Glancing Blow | abilities/Blade/GlancingBlow.js | Unclaimed | —     |            |           |           |
| Blade | Battle Cry | abilities/Blade/BattleCry.js | Unclaimed | —     |            |           |           |
| Blade | Frenzy | abilities/Blade/Frenzy.js | Unclaimed | —     |            |           |           |
| Blade | Gore and Glory | abilities/Blade/GoreAndGlory.js | Unclaimed | —     |            |           |           |
| Blade | Reaper's Strike | abilities/Blade/ReapersStrike.js | Unclaimed | —     |            |           |           |
| Blade | Battle Monster | abilities/Blade/BattleMonster.js | Unclaimed | —     |            |           |           |
| Blade | Onslaught | abilities/Blade/Onslaught.js | Unclaimed | —     |            |           |           |
| Bone | Cruel Precision | abilities/Bone/CruelPrecision.js | Unclaimed | —     |            |           |           |
| Bone | Breaking Blow | abilities/Bone/BreakingBlow.js | Unclaimed | —     |            |           |           |
| Bone | Wrangle | abilities/Bone/Wrangle.js | Unclaimed | —     |            |           |           |
| Bone | On the Brink | abilities/Bone/OnTheBrink.js | Unclaimed | —     |            |           |           |
| Bone | Splintering Strike | abilities/Bone/SplinteringStrike.js | Unclaimed | —     |            |           |           |
| Bone | Deathrun | abilities/Bone/Deathrun.js | Unclaimed | —     |            |           |           |
| Bone | Swift Step | abilities/Bone/SwiftStep.js | Unclaimed | —     |            |           |           |

---

### Beastforms (24)

> Implement in `src/features-v2/beastforms/<BeastformName>.js`.


| Feature Name         | Source File                      | Status     | Agent    | Impl Notes                                                                                                                | Val Notes | Fix Notes                                                                                                                                                                                         |
| -------------------- | -------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agile Scout          | beastforms/AgileScout.js         | Validated  | val-r4nc | SRD-accurate feature rows; shared **Fragile** helper; narrative-only until host can signal damage severity for auto-drop. |           |                                                                                                                                                                                                   |
| Household Friend     | beastforms/HouseholdFriend.js    | Validated  | val-r4nc | Same pattern as Agile Scout.                                                                                              |           |                                                                                                                                                                                                   |
| Nimble Grazer        | beastforms/NimbleGrazer.js       | Validated  | val-r4nc | Same pattern as Agile Scout.                                                                                              |           |                                                                                                                                                                                                   |
| Pack Predator        | beastforms/PackPredator.js       | Validated  | val-r4nc | No **Fragile** on this stat block (SRD).                                                                                  |           |                                                                                                                                                                                                   |
| Aquatic Scout        | beastforms/AquaticScout.js       | Validated  | val-p3wm | `mergeAquaticScoutRow`: Aquatic + shared **Fragile**; registered in `beastforms/index.js`. Tests: `registry.test.js`.     |           |                                                                                                                                                                                                   |
| Stalking Arachnid    | beastforms/StalkingArachnid.js   | Validated  | val-p3wm | Venomous Bite + Webslinger; no Fragile on SRD stat block. Tests: `registry.test.js`.                                      |           |                                                                                                                                                                                                   |
| Armored Sentry       | beastforms/ArmoredSentry.js      | Validated  | val-p3wm | Armored Shell + Cannonball (tier 2). Tests: `registry.test.js`.                                                           |           |                                                                                                                                                                                                   |
| Powerful Beast       | beastforms/PowerfulBeast.js      | Validated  | fix-k3nq | Rampage + Thick Hide. Tests: `registry.test.js`, `beastform-features.test.js`.                                            |           | **Thick Hide:** `passiveStatMods` major/severe +2; regression test in `beastform-features.test.js` (user-approved 2026-03-21).                                                                    |
| Mighty Strider       | beastforms/MightyStrider.js      | Validated  | val-p3wm | Carrier + Trample. Tests: `registry.test.js`.                                                                             |           |                                                                                                                                                                                                   |
| Striking Serpent     | beastforms/StrikingSerpent.js    | Validated  | val-w8kp | Venomous Strike + Warning Hiss; narrative-only sub-features. `registry.test.js`.                                          |           |                                                                                                                                                                                                   |
| Pouncing Predator    | beastforms/PouncingPredator.js   | Validated  | val-w8kp | Fleet + Takedown.                                                                                                         |           |                                                                                                                                                                                                   |
| Winged Beast         | beastforms/WingedBeast.js        | Validated  | fix-m2kq | Bird's-Eye View + Hollow Bones.                                                                                           |           | **Hollow Bones:** `passiveStatMods` major/severe −2; test in `beastform-features.test.js`. **Beastform** / **Evolution** `isDisabled` while `inBeastform` (`Druid.js`, user-approved 2026-03-21). |
| Great Predator       | beastforms/GreatPredator.js      | Validated  | val-w8kp | Carrier + Vicious Maul.                                                                                                   |           |                                                                                                                                                                                                   |
| Mighty Lizard        | beastforms/MightyLizard.js       | Validated  | fix-n8wk | Physical Defense + Snapping Strike.                                                                                       |           | **Physical Defense:** `passiveStatMods` major/severe +3; regression in `beastform-features.test.js` (user-approved 2026-03-21).                                                                   |
| Great Winged Beast   | beastforms/GreatWingedBeast.js   | Validated  | val-m8jq | Bird's-Eye View + Carrier (narrative). `registry.test.js`.                                                                 |           |                                                                                                                                                                                                   |
| Aquatic Predator     | beastforms/AquaticPredator.js    | Validated  | val-m8jq | Aquatic + Vicious Maul (narrative; matches Great Predator pattern). `registry.test.js`.                                     |           |                                                                                                                                                                                                   |
| Legendary Beast      | beastforms/LegendaryBeast.js     | Validated  | val-m8jq | **Evolved:** `passiveStatMods` evasion +2; `onReviewAction` +6 pending damage on attacks. +1 trait from SRD left at table. Tests: `LegendaryBeast.test.js`, `beastform-features.test.js`. |           |                                                                                                                                                                                                   |
| Legendary Hybrid     | beastforms/LegendaryHybrid.js    | Validated  | val-m8jq | Hybrid Features (narrative). `registry.test.js`.                                                                            |           |                                                                                                                                                                                                   |
| Massive Behemoth     | beastforms/MassiveBehemoth.js    | Validated  | val-n2qx | Carrier / Demolish (`card` Hope + `actionLoop`) / **Undaunted** `passiveStatMods` +2 major & severe. Tests: `registry.test.js`.                                                                                         |           |                                                                                                                                                                                                   |
| Terrible Lizard      | beastforms/TerribleLizard.js     | Validated  | val-n2qx | **Devastating Strikes** `reviewOutcome` chip +1 HP when Severe + Melee; **Massive Stride** narrative. Tests: `TerribleLizard.test.js`, `registry.test.js`.                                                              |           |                                                                                                                                                                                                   |
| Mythic Aerial Hunter | beastforms/MythicAerialHunter.js | Validated | fix-r4wp | Carrier narrative; **Deadly Raptor** narrative + `movementModes` fly. Tests: `registry.test.js`.                                                                                                                      |           | **Deadly Raptor:** `reviewAction` chip + `table.rolls.damage.rerollDiceBelow(proficiency)`; charge heuristic via `lastPosition` (close/far/veryFar → melee). Tests: `MythicAerialHunter.test.js`. User-approved 2026-03-22. |
| Epic Aquatic Beast   | beastforms/EpicAquaticBeast.js   | Validated  | fix-b3kw | **Ocean Master** `onResolve` Restrained on melee hit; **Unyielding** `onReviewOutcome` (d6 ≥5: −1 threshold, revoke armor — Resilient pattern). Tests: `registry.test.js`, `EpicAquaticBeast.test.js`.                                                                                    |           | **Unyielding:** same as above; user-approved 2026-03-22.                                                                                                                                          |
| Mythic Beast         | beastforms/MythicBeast.js        | Validated  | val-n2qx | **Evolved** +9 pending damage `onReviewAction` + `evasion` +3; trait/die bump in description. Tests: `MythicBeast.test.js`, `registry.test.js`.                                                                          |           |                                                                                                                                                                                                   |
| Mythic Hybrid        | beastforms/MythicHybrid.js       | Validated  | val-k9wp | **Hybrid Features** narrative (`LegendaryHybrid` pattern; tier 4 SRD text). `registry.test.js`.                                                                                                                           |           |                                                                                                                                                                                                   |


---

### Items (60)

> Implement in `src/features-v2/items/<ItemName>.js`.


| Feature Name                | Source File                       | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------------------- | --------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Premium Bedroll             | items/PremiumBedroll.js           | Unclaimed | —     |            |           |           |
| Piper Whistle               | items/PiperWhistle.js             | Unclaimed | —     |            |           |           |
| Charging Quiver             | items/ChargingQuiver.js           | Unclaimed | —     |            |           |           |
| Alistair's Torch            | items/AlistairsTorch.js           | Unclaimed | —     |            |           |           |
| Speaking Orbs               | items/SpeakingOrbs.js             | Unclaimed | —     |            |           |           |
| Manacles                    | items/Manacles.js                 | Unclaimed | —     |            |           |           |
| Arcane Cloak                | items/ArcaneCloak.js              | Unclaimed | —     |            |           |           |
| Woven Net                   | items/WovenNet.js                 | Unclaimed | —     |            |           |           |
| Fire Jar                    | items/FireJar.js                  | Unclaimed | —     |            |           |           |
| Suspended Rod               | items/SuspendedRod.js             | Unclaimed | —     |            |           |           |
| Glamour Stone               | items/GlamourStone.js             | Unclaimed | —     |            |           |           |
| Empty Chest                 | items/EmptyChest.js               | Unclaimed | —     |            |           |           |
| Companion Case              | items/CompanionCase.js            | Unclaimed | —     |            |           |           |
| Piercing Arrows             | items/PiercingArrows.js           | Unclaimed | —     |            |           |           |
| Valorstone                  | items/Valorstone.js               | Unclaimed | —     |            |           |           |
| Skeleton Key                | items/SkeletonKey.js              | Unclaimed | —     |            |           |           |
| Arcane Prism                | items/ArcanePrism.js              | Unclaimed | —     |            |           |           |
| Minor Stamina Potion Recipe | items/MinorStaminaPotionRecipe.js | Unclaimed | —     |            |           |           |
| Minor Health Potion Recipe  | items/MinorHealthPotionRecipe.js  | Unclaimed | —     |            |           |           |
| Homing Compasses            | items/HomingCompasses.js          | Unclaimed | —     |            |           |           |
| Corrector Sprite            | items/CorrectorSprite.js          | Unclaimed | —     |            |           |           |
| Gecko Gloves                | items/GeckoGloves.js              | Unclaimed | —     |            |           |           |
| Lorekeeper                  | items/Lorekeeper.js               | Unclaimed | —     |            |           |           |
| Vial of Darksmoke Recipe    | items/VialOfDarksmokeRecipe.js    | Unclaimed | —     |            |           |           |
| Bloodstone                  | items/Bloodstone.js               | Unclaimed | —     |            |           |           |
| Greatstone                  | items/Greatstone.js               | Unclaimed | —     |            |           |           |
| Glider                      | items/Glider.js                   | Unclaimed | —     |            |           |           |
| Ring of Silence             | items/RingOfSilence.js            | Unclaimed | —     |            |           |           |
| Calming Pendant             | items/CalmingPendant.js           | Unclaimed | —     |            |           |           |
| Dual Flask                  | items/DualFlask.js                | Unclaimed | —     |            |           |           |
| Bag of Ficklesand           | items/BagOfFicklesand.js          | Unclaimed | —     |            |           |           |
| Ring of Resistance          | items/RingOfResistance.js         | Unclaimed | —     |            |           |           |
| Phoenix Feather             | items/PhoenixFeather.js           | Unclaimed | —     |            |           |           |
| Box of Many Goods           | items/BoxOfManyGoods.js           | Unclaimed | —     |            |           |           |
| Airblade Charm              | items/AirbladeCharm.js            | Unclaimed | —     |            |           |           |
| Portal Seed                 | items/PortalSeed.js               | Unclaimed | —     |            |           |           |
| Paragon's Chain             | items/ParagonsChain.js            | Unclaimed | —     |            |           |           |
| Elusive Amulet              | items/ElusiveAmulet.js            | Unclaimed | —     |            |           |           |
| Hopekeeper Locket           | items/HopekeeperLocket.js         | Unclaimed | —     |            |           |           |
| Infinite Bag                | items/InfiniteBag.js              | Unclaimed | —     |            |           |           |
| Stride Relic                | items/StrideRelic.js              | Unclaimed | —     |            |           |           |
| Bolster Relic               | items/BolsterRelic.js             | Unclaimed | —     |            |           |           |
| Control Relic               | items/ControlRelic.js             | Unclaimed | —     |            |           |           |
| Attune Relic                | items/AttuneRelic.js              | Unclaimed | —     |            |           |           |
| Charm Relic                 | items/CharmRelic.js               | Unclaimed | —     |            |           |           |
| Enlighten Relic             | items/EnlightenRelic.js           | Unclaimed | —     |            |           |           |
| Honing Relic                | items/HoningRelic.js              | Unclaimed | —     |            |           |           |
| Flickerfly Pendant          | items/FlickerflyPendant.js        | Unclaimed | —     |            |           |           |
| Lakestrider Boots           | items/LakestriderBoots.js         | Unclaimed | —     |            |           |           |
| Clay Companion              | items/ClayCompanion.js            | Unclaimed | —     |            |           |           |
| Mythic Dust Recipe          | items/MythicDustRecipe.js         | Unclaimed | —     |            |           |           |
| Shard of Memory             | items/ShardOfMemory.js            | Unclaimed | —     |            |           |           |
| Gem of Alacrity             | items/GemOfAlacrity.js            | Unclaimed | —     |            |           |           |
| Gem of Might                | items/GemOfMight.js               | Unclaimed | —     |            |           |           |
| Gem of Precision            | items/GemOfPrecision.js           | Unclaimed | —     |            |           |           |
| Gem of Insight              | items/GemOfInsight.js             | Unclaimed | —     |            |           |           |
| Gem of Audacity             | items/GemOfAudacity.js            | Unclaimed | —     |            |           |           |
| Gem of Sagacity             | items/GemOfSagacity.js            | Unclaimed | —     |            |           |           |
| Ring of Unbreakable Resolve | items/RingOfUnbreakableResolve.js | Unclaimed | —     |            |           |           |
| Belt of Unity               | items/BeltOfUnity.js              | Unclaimed | —     |            |           |           |


---

### Consumables (60)

> Implement in `src/features-v2/consumables/<ConsumableName>.js`.


| Feature Name                | Source File                              | Status    | Agent | Impl Notes | Val Notes | Fix Notes |
| --------------------------- | ---------------------------------------- | --------- | ----- | ---------- | --------- | --------- |
| Stride Potion               | consumables/StridePotion.js              | Unclaimed | —     |            |           |           |
| Bolster Potion              | consumables/BolsterPotion.js             | Unclaimed | —     |            |           |           |
| Control Potion              | consumables/ControlPotion.js             | Unclaimed | —     |            |           |           |
| Attune Potion               | consumables/AttunePotion.js              | Unclaimed | —     |            |           |           |
| Charm Potion                | consumables/CharmPotion.js               | Unclaimed | —     |            |           |           |
| Enlighten Potion            | consumables/EnlightenPotion.js           | Unclaimed | —     |            |           |           |
| Minor Health Potion         | consumables/MinorHealthPotion.js         | Unclaimed | —     |            |           |           |
| Minor Stamina Potion        | consumables/MinorStaminaPotion.js        | Unclaimed | —     |            |           |           |
| Grindletooth Venom          | consumables/GrindletoothVenom.js         | Unclaimed | —     |            |           |           |
| Varik Leaves                | consumables/VarikLeaves.js               | Unclaimed | —     |            |           |           |
| Vial of Moondrip            | consumables/VialOfMoondrip.js            | Unclaimed | —     |            |           |           |
| Unstable Arcane Shard       | consumables/UnstableArcaneShard.js       | Unclaimed | —     |            |           |           |
| Potion of Stability         | consumables/PotionOfStability.js         | Unclaimed | —     |            |           |           |
| Improved Grindletooth Venom | consumables/ImprovedGrindletoothVenom.js | Unclaimed | —     |            |           |           |
| Morphing Clay               | consumables/MorphingClay.js              | Unclaimed | —     |            |           |           |
| Vial of Darksmoke           | consumables/VialOfDarksmoke.js           | Unclaimed | —     |            |           |           |
| Jumping Root                | consumables/JumpingRoot.js               | Unclaimed | —     |            |           |           |
| Snap Powder                 | consumables/SnapPowder.js                | Unclaimed | —     |            |           |           |
| Health Potion               | consumables/HealthPotion.js              | Unclaimed | —     |            |           |           |
| Stamina Potion              | consumables/StaminaPotion.js             | Unclaimed | —     |            |           |           |
| Armor Stitcher              | consumables/ArmorStitcher.js             | Unclaimed | —     |            |           |           |
| Gill Salve                  | consumables/GillSalve.js                 | Unclaimed | —     |            |           |           |
| Replication Parchment       | consumables/ReplicationParchment.js      | Unclaimed | —     |            |           |           |
| Improved Arcane Shard       | consumables/ImprovedArcaneShard.js       | Unclaimed | —     |            |           |           |
| Major Stride Potion         | consumables/MajorStridePotion.js         | Unclaimed | —     |            |           |           |
| Major Bolster Potion        | consumables/MajorBolsterPotion.js        | Unclaimed | —     |            |           |           |
| Major Control Potion        | consumables/MajorControlPotion.js        | Unclaimed | —     |            |           |           |
| Major Attune Potion         | consumables/MajorAttunePotion.js         | Unclaimed | —     |            |           |           |
| Major Charm Potion          | consumables/MajorCharmPotion.js          | Unclaimed | —     |            |           |           |
| Major Enlighten Potion      | consumables/MajorEnlightenPotion.js      | Unclaimed | —     |            |           |           |
| Blood of the Yorgi          | consumables/BloodOfTheYorgi.js           | Unclaimed | —     |            |           |           |
| Homet's Secret Potion       | consumables/HometsSecretPotion.js        | Unclaimed | —     |            |           |           |
| Redthorn Saliva             | consumables/RedthornSaliva.js            | Unclaimed | —     |            |           |           |
| Channelstone                | consumables/Channelstone.js              | Unclaimed | —     |            |           |           |
| Mythic Dust                 | consumables/MythicDust.js                | Unclaimed | —     |            |           |           |
| Acidpaste                   | consumables/Acidpaste.js                 | Unclaimed | —     |            |           |           |
| Hopehold Flare              | consumables/HopeholdFlare.js             | Unclaimed | —     |            |           |           |
| Major Arcane Shard          | consumables/MajorArcaneShard.js          | Unclaimed | —     |            |           |           |
| Featherbone                 | consumables/Featherbone.js               | Unclaimed | —     |            |           |           |
| Circle of the Void          | consumables/CircleOfTheVoid.js           | Unclaimed | —     |            |           |           |
| Sun Tree Sap                | consumables/SunTreeSap.js                | Unclaimed | —     |            |           |           |
| Dripfang Poison             | consumables/DripfangPoison.js            | Unclaimed | —     |            |           |           |
| Major Health Potion         | consumables/MajorHealthPotion.js         | Unclaimed | —     |            |           |           |
| Major Stamina Potion        | consumables/MajorStaminaPotion.js        | Unclaimed | —     |            |           |           |
| Ogre Musk                   | consumables/OgreMusk.js                  | Unclaimed | —     |            |           |           |
| Wingsprout                  | consumables/Wingsprout.js                | Unclaimed | —     |            |           |           |
| Jar of Lost Voices          | consumables/JarOfLostVoices.js           | Unclaimed | —     |            |           |           |
| Dragonbloom Tea             | consumables/DragonbloomTea.js            | Unclaimed | —     |            |           |           |
| Bridge Seed                 | consumables/BridgeSeed.js                | Unclaimed | —     |            |           |           |
| Sleeping Sap                | consumables/SleepingSap.js               | Unclaimed | —     |            |           |           |
| Feast of Xuria              | consumables/FeastOfXuria.js              | Unclaimed | —     |            |           |           |
| Bonding Honey               | consumables/BondingHoney.js              | Unclaimed | —     |            |           |           |
| Shrinking Potion            | consumables/ShrinkingPotion.js           | Unclaimed | —     |            |           |           |
| Growing Potion              | consumables/GrowingPotion.js             | Unclaimed | —     |            |           |           |
| Knowledge Stone             | consumables/KnowledgeStone.js            | Unclaimed | —     |            |           |           |
| Sweet Moss                  | consumables/SweetMoss.js                 | Unclaimed | —     |            |           |           |
| Blinding Orb                | consumables/BlindingOrb.js               | Unclaimed | —     |            |           |           |
| Death Tea                   | consumables/DeathTea.js                  | Unclaimed | —     |            |           |           |
| Mirror of Marigold          | consumables/MirrorOfMarigold.js          | Unclaimed | —     |            |           |           |
| Stardrop                    | consumables/Stardrop.js                  | Unclaimed | —     |            |           |           |


---

## V2 UI integration backlog

Work to do **when the Game Table consumes `src/features-v2`** (action loop, `collectChips` per phase, mutations) instead of relying only on Phase 1 `src/features/` IoC and ad hoc UI. V2 engine semantics are validated in unit tests; **chip placements** (`intent`, `reviewAction`, `resolve`, …) are action-loop phases, not guaranteed UI surfaces until wired up.

**Phase 0 (persistence) — Done:** `featureState` added to `[CHARACTER_RUNTIME_KEYS](../src/client/lib/table-ops.js)` and `[db.js](../src/db.js)` resolve/strip sets; optional root-level `table_state.featureState` documented via `TABLE_STATE_V2_ROOT_KEYS`. Handoff for Phase 1: `[docs/v2-ui-integration-phase1-handoff.md](v2-ui-integration-phase1-handoff.md)`.

**Phase 2 (action loop `reviewAction` → banner UI) — Done:** `[src/client/lib/v2-action-loop-bridge.js](../src/client/lib/v2-action-loop-bridge.js)` + `GMTableView` / `DiceRoller` wiring; `applyV2BannerMutations` in `table-ops.js`. Handoff for Phase 3: `[docs/v2-ui-integration-phase3-handoff.md](v2-ui-integration-phase3-handoff.md)`.

**Phase 3 (weapon/armor phases on banner + damage hydration) — Done:** `collectPhaseChipsOnly`, multi-phase **`collectV2ReviewActionChips`**, synthetic **`action.effects`**, `DiceRoller` phase groups. Handoff for Phase 4: `[docs/v2-ui-integration-phase4-handoff.md](v2-ui-integration-phase4-handoff.md)`.

**Phase 4 (cross-sheet + lifecycle) — Done (VTT wiring):** `src/client/lib/v2-cross-sheet-lifecycle.js` (`collectV2CrossSheetChips`, `activateV2CrossSheetChip`, `runV2TokenMoveHooks`), `CharacterExperiences` cross-sheet buttons (GM), `BattleMap` `onTokenDragEnd` → `dispatchTokenMoveHooks` + `applyV2LifecycleMutations`, **`table_state.featureState`** load/SSE + `set-table-feature-state` op, Start Session clears **`featureState.Rally`** (partyDice / Maestro) on characters. Optional banner merge for non-owner **`reviewAction`** Rally chips remains future work.


| Item                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Weapon property chips**             | Weapon tags are not character sheet feature cards. Today, weapon automation uses `src/features/weapons/` + roll tags + special UI (e.g. **Startling** “Force Back” action notification in `CharacterDisplay.jsx`). On integration: run `collectChips` for the relevant phases per banner / roll, resolve features attached to the active weapon from the V2 registry, and decide whether IoC paths stay in parallel or are retired. **Example:** V2 Startling uses an `intent`-phase chip; there is no intent-phase control for weapon tags in the shipped UI yet.                                                                                                                                                                                                                                                                                                      |
| **Armor property chips**              | Same pattern: V2 modules may use `reviewOutcome`, `reviewAction`, etc.; confirm banner and damage flows hydrate `table` snapshots (`useArmorByTargetId`, effects) so chips match VTT behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Weapon `isDisabled` from V2**       | Merge `weaponRenderHints` from `applyDeclarativeFeatures` onto library/table character elements so `table.me.primaryWeapon` / `weapons[]` include `isDisabled` / `disabledReason` (see weapon property `**onRender`**). Phase 1 UI still gates Pompous ad hoc in `CharacterDisplay.jsx`; when wiring V2 everywhere, respect `**isDisabled`** on weapon views and retire duplicate name checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `**dispatchTokenMoveHooks**`          | After a token drag in `BattleMap.jsx`, update element `tokenX`/`tokenY`, set `**_previousPositions[moverId]**` to pre-drag coords, then call `**dispatchTokenMoveHooks(resolvedState, flatV2Features, { moverInstanceId })**` and apply returned mutations (e.g. `actionLoop`). Engine contract documented in **CONV-032** / **CONV-033** and the Feature Authoring Guide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Rally + `crossSheetChips` (VTT)**   | **V2 Rally is golden** in engine + tests (`classes/Bard.js`, `**activeModifiers`**, `**partyDice**`, spend action/damage/clear Stress, `**showOnOtherSheets**`). **Game Table still Phase 1** for most flows. Wire: (1) From `**CharacterHoverCard`** / `**GMTableView**`, build `gameState` + shared `**featureState.Rally.partyDice**`, call `**collectChipsForOtherCharacterSheets(viewerId, party PCs, registry, 'card', base)**`, pass result as `**CharacterExperiences**` `**crossSheetChips**`; on click, run `**activateChip**` + `**postTableOp**` / mutations. (2) Action loop: when the **actor** is not the feature owner, merge `**showOnOtherSheets`** `**reviewAction**` chips (Spend Rally Die — Action/Damage) so allies’ banners get the same controls as the Bard. (3) Session-end clear `**partyDice**` + Rally modifiers — see **Tech Debt** row. |
| **Druid Beastform / Evolution (VTT)** | Engine + unit tests cover transform, declarative overlay, registry sub-features, and sheet `**beastformFeatures`** via `**recomputeCharacter**`. **Game Table** still Phase 1 for full parity: apply `**applyDeclarativeFeatures`** result + `**featureState**` to live elements, **Fragile** (Major+ damage), voluntary drop, `**selectedBeastformAdvantage`**, banner/chip flows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |


### Phase A — V1 cutover inventory (done)

**Delivered:** [`docs/v2-v1-cutover.md`](v2-v1-cutover.md) — parity matrix mapping `GMTableView.jsx` Phase 1 behaviors (`wrapEntity`, `wrapRoll`, hooks, registries) to V2 direction (`collectChips`, `activateChip`, `applyV2BannerMutations`, engine hooks). Use it as the checklist for removing Phase 1 imports from the Game Table (parent plan Phases D–E).

### Phase B — Bridge hardening (done)

**Handoff:** [`docs/v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md).

**Delivered:** `partitionV2BannerChipMutations` in [`src/client/lib/table-ops.js`](../src/client/lib/table-ops.js) routes `addDamageRoll` → `postBannerAddDamage` and Hope/Fear `rerollDie` → `postBannerRerollDie` from [`GMTableView.jsx`](../src/client/components/GMTableView.jsx) `handleV2ReviewChip` (other `rerollDie` shapes remain logged as unsupported). [`resolveV2ReviewChipPicker`](../src/client/lib/v2-action-loop-bridge.js) + [`DiceRoller.jsx`](../src/client/components/DiceRoller.jsx) `V2ReviewChipRow` implement `isSelect` / `multiSelect` / `selectTargets` pickers with an **Apply** confirm. Tests: `partitionV2BannerChipMutations` in [`test/unit/table-ops.test.js`](../test/unit/table-ops.test.js).

**Deferred (unchanged):** optional non-owner **Rally** banner merge; session vs scene end for Rally / `partyDice` (see **Tech Debt** and Phase 4 handoff).

**Phase E (done):** Ranger banner dedupe vs V2 review chips — `V2_REVIEW_ACTION_PHASE1_DEDUPE` is empty; `DiceRoller` hides Phase 1 Hold Them Off / Ranger's Focus reroll controls when the V2 declarative sheet flag is on (`shouldUsePhase1RegistryFallback()`). See [`docs/v2-v1-cutover.md`](v2-v1-cutover.md).

Add rows here as you discover integration gaps; link to files or issues in **Notes** when helpful.

---

## Complex Feature Backlog

Features that are purely narrative, require complex interactive UI, or involve spawning temporary entities. These can often be solved with `table.me.actionLoop()` (prefer over `table.top.broadcast` for character-scoped prompts; **CONV-033**), but are tracked here to ensure they are fully supported by the VTT UI.


| Feature Name | Category  | Notes                                                          |
| ------------ | --------- | -------------------------------------------------------------- |
| Ask the GM   | Narrative | Features that say "Ask the GM a question" or "Learn a secret"  |
| Illusions    | Spawning  | Features that create illusions or temporary objects on the map |
| Summons      | Spawning  | Features that summon creatures or companions                   |
| Environment  | VTT       | Features that permanently alter the terrain or map             |


---

## Blocked / API Extension Requests

Features that cannot be fully implemented with the current V2 engine API.

**Active queue only** — rows with `Status: Open` or `In Progress`. When a resolution is **Done**, it is **appended** to `[docs/v2-blocked-resolutions-done.md](v2-blocked-resolutions-done.md)` and removed from here (see that file for agent maintenance rules).

**Table key is Resolution** — the engine change or API extension needed to unblock one or more features. If multiple features need the same resolution, they share one row. If one feature needs multiple resolutions, it appears in multiple rows.

A feature's main tracker row remains `Blocked` while **any active row below** lists that feature. When no active row lists the feature, the Unblocking Agent promotes the feature to `Done` in the main tracker (the agent implemented the feature as part of the resolution).

To work on a resolution: see `docs/agent-prompts/unblocking-agent.md`.


| Resolution | Features | SRD Requirement | Status | Agent | Notes |
| ---------- | -------- | --------------- | ------ | ----- | ----- |
| *(none)*   | —        | —               | —      | —     | Queue empty. |

---

## Tech Debt

Follow-ups that are **not** blocking V2 migration or validation, but should be revisited so the engine stays generic and scalable.


| Item                                                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generalize away from `substituteArmorForHope`                            | Hopeful is implemented with a single boolean merged from `applyDeclarativeFeatures` onto the character (`CONV-029`). Future rules may need **other** Hope-cost su. stitutions (e.g. spend Stress, gold, or a different resource instead of Hope). Replace the one-off flag with a **generic** model—e.g. a small map or ordered list of allowed substitutions for Hope costs on the actor, populated only from declarative feature data—so `spendHope` / `deductChipCosts` stay free of new booleans per mechanic.                                                                                                                                                                                                                                                                                  |
| Generalize away from armorSlotReductionDisallowed                        | Too specific and weird.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Reconsider `hooks.onSceneEnd` / `dispatchSceneEndHooks`                  | **Unstoppable** and any future “scene ends” mechanics use `dispatchSceneEndHooks` + `hooks.onSceneEnd`. Confirm this is the right lifecycle (vs session, encounter object, or GM-only signal) before relying on it in the Game Table; may merge with another dispatcher or rename.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Implement **Camaraderie** fully                                          | **Camaraderie** (Call of the Brave) is narrative-only in V2 (`CallOfTheBrave.js`). Wire `**extraTagTeamInitiationsPerSession`** / `**tagTeamPartnerHopeDiscount**` (engine already supports via `applyDeclarativeFeatures`), `**Initiate Tag Team**` (or equivalent) card chip + `consumeTagTeamInitiation`, Game Table `**type: 'tagTeam'**` flows, and session reset for Tag Team counters. See `table.js` Tag Team API and archived resolution **camaraderie-tag-team** in `v2-blocked-resolutions-done.md`.                                                                                                                                                                                                                                                                                     |
| Session / scene end: clear Rally `**partyDice`** + `**activeModifiers**` | **Rally** (`table.feature.partyDice` under `Rally`) and per-character `**activeModifiers`** (Rally Die tokens) are cleared in engine tests via mutations; **Phase 1** table state does not yet run a V2 **session-end** hook that applies these clears. Until the host dispatches `**sessionEnd`** / scene lifecycle or mirrors SRD “clear unspent Rally Dice at end of session,” stale `**partyDice**` / modifiers can persist in saved table state. Wire `dispatchSceneEndHooks` / session cycle or an explicit table op after GM “End session.”                                                                                                                                                                                                                                                  |
| **Domain loadout / vault + Channel Raw Power on the live table**         | **Channel Raw Power** (V2 `classes/Sorcerer.js`) is covered in unit tests with mocked `**domainLoadout`**. For play, **library + table** character data must expose `**domainLoadout`** (active domain spell cards) and persist `**domainVault**` (or equivalent) so snapshots populate `**table.me.domainLoadout**`. Apply `**domainCardMoveToVault**` when the engine queues it; keep `**featureState['Channel Raw Power'].channelRawPowerDamageBonus**` consistent with long rest and the next qualifying magic attack. **Daggerstack** / builder should populate card `**id`**, `**name**`, and `**level**` (or `**tier**`). Without this, the long-rest card stays empty or mutations do not round-trip. See `**docs/feature-authoring-guide.md**` (`domainLoadout`, `moveDomainCardToVault`). |
| **Pending damage: `table.action` helpers vs mutating `effects`**         | Some features reduce pending `**{ type: 'damage', amount }**` during `**reviewAction**`. Today: **Seraph** **Prayer Dice** uses `**table.action.reducePendingDamageForTarget`** (Far-range guard for non-self + subtract amount); **Stalwart** **Partners-in-Arms** uses a **file-local** loop on `**table.action.effects`**; **Sheltering** mutates amounts in place. **Guardian** / **Iron Will** use `**reduceIncomingPhysicalSeverityBySteps`** (owner-only). Revisit whether to keep thin `**table.js**` helpers, standardize on **local mutations** next to the feature (predicates already scope eligibility), or share one internal utility—so the authoring guide stays consistent.                                                                                                        |
| **Scattered “beastform-aware” framework**                                | `**feature-loader`**, `**table.me**` (`beastformOptions`, `inBeastform`), `**character-calc**` (`beastformFeatures`, `**BEASTFORM_ITEMS**` fallback), and `**classes/Druid.js**` all know about transform state. **Goal:** a generic pattern for “contextual SRD bundles” (or a single merge hook) so future shape-change mechanics do not repeat `beastform` branches across loader, snapshot builder, and client recompute.                                                                                                                                                                                                                                                                                                                                                                           |


---

*Last updated: 2026-03-22 — FIX **fix-ud9k**: Midnight **Uncanny Disguise** → `Validated` (CONV-020 `table.action?.trait === 'presence'` on `advantageTriggers`; `MidnightTier1.test.js`). Summary: Abilities **Validated** +1, **Fixing** −1, **Needs Fix** −1; **TOTAL** **Validated** +1, **Fixing** −1, **Needs Fix** −1. Prior: VAL **val-h3kp**: Midnight Tier 1 **Pick and Pull**, **Rain of Blades**, **Shadowbind** → `Validated`; **Uncanny Disguise** (CONV-020 Presence trait gate), **Midnight Spirit** (SRD: Strike after Summon + rest clear) → `Needs Fix` (`MidnightTier1.test.js`, `npm run validate:v2-preflight` ok). Summary: Abilities **Validated** +3, **Needs Fix** +2, **Validating** −5; **TOTAL** **Validated** +3, **Needs Fix** +2, **Validating** −5. Prior: IMP **impl-g9wz**: Grace Tier 1 **Hypnotic Shimmer**, **Invisibility** → `Done` (`HypnoticShimmer.js`, `Invisibility.js`, `abilities/index.js`, `GraceTier1.test.js`; `npm run validate:v2-preflight` + `vitest run test/unit/features-v2/abilities/GraceTier1.test.js` ok). Summary: Abilities **Done** +2, **In Progress** −2; **TOTAL** **Done** +2, **In Progress** −2. Prior: FIX **fix-n7p9**: Grace **Inspirational Words** → `Validated` (`GraceTier1.test.js` CONV-008 `actionLoop` assertion). Summary: Abilities **Validated** +1, **Fixing** −1; **TOTAL** **Validated** +1, **Fixing** −1. Prior: FIX **fix-h2kc**: Codex **Book of Ava** → `Validated` (`CodexTier1Books.test.js` CONV-008 Tava's Armor assertion). Summary: Abilities **Validated** +1, **Fixing** −1; **TOTAL** **Validated** +1, **Fixing** −1. Prior: FIX **fix-w3qp**: Codex **Book of Tyfar** → `Validated` (Magic Hand chip description matches SRD; `BookOfTyfar.js`). Summary: Abilities **Validated** +1, **Fixing** −1; **TOTAL** **Validated** +1, **Fixing** −1. Prior: VAL **val-r8nq**: Grace Tier 1 **Deft Deceiver**, **Enrapture**, **Tell No Lies**, **Troublemaker** → `Validated` (SRD `docs/srd-abilities-write-methods-analysis.md` + phrase review; `npm run validate:v2-preflight`, `vitest run test/unit/features-v2/abilities/GraceTier1.test.js`). **Inspirational Words** → `Needs Fix` (CONV-008: `GraceTier1.test.js` — "spending a token" uses `m.some(...).toBe(true)` for `actionLoop` instead of `toContainEqual`/`expect.objectContaining`). Summary: Abilities **Validated** +4, **Needs Fix** +1, **Validating** −5; **TOTAL** **Validated** +4, **Needs Fix** +1, **Validating** −5. Prior: VAL **val-m4kt**: Codex **Book of Korvax**, **Book of Norai** → `Validated` (SRD `abilities.json`; preflight + `CodexTier1Books.test.js`). Summary: Abilities **Validated** +2, **Validating** −2; **TOTAL** **Validated** +2, **Validating** −2. Prior: IMP **impl-g5rx**: Grace Tier 1 **Deft Deceiver**, **Enrapture**, **Inspirational Words**, **Tell No Lies**, **Troublemaker** → `Done` (`abilities/Grace/*.js`, `abilities/index.js`, `GraceTier1.test.js`; `npm run validate:v2-preflight` + `npm run test:unit` ok). Summary: Abilities **Done** +5, **Unclaimed** −5; **TOTAL** **Done** +5, **Unclaimed** −5. Prior: VAL **val-z9xq**: Codex **Book of Illiat**, **Book of Sitil**, **Book of Vagras** → `Validated`; **Book of Ava**, **Book of Tyfar** → `Needs Fix` (Val Notes). Summary: Abilities **Validated** +3, **Needs Fix** +2, **Validating** −5; **TOTAL** **Validated** +3, **Needs Fix** +2, **Validating** −5. Prior: IMP **impl-kn2p**: Codex **Book of Korvax** + **Book of Norai** → `Done` (`BookOfKorvax.js`, `BookOfNorai.js`, `abilities/index.js`, `CodexTier1Books.test.js`; full `test:unit` ok). Summary: Abilities **Done** +2, **In Progress** −2; **TOTAL** **Done** +2, **In Progress** −2. Prior: VAL **val-ep42**: Wordsmith **Epic Poetry** → `Validated` (SRD Rally d10 + Tag Team helper d10; `Bard.js`, `Wordsmith.js`, `Wordsmith.test.js`, preflight ok). Summary: Subclasses **Validated** +1, **Done** −1; **TOTAL** **Validated** +1, **Done** −1. Prior: IMP **impl-ep01**: Wordsmith **Epic Poetry** — Tag Team helper **`intent`** chip **`addDie` d10**; tests `Wordsmith.test.js`; `Bard.js` Rally comment. Summary: Subclasses **Unclaimed** −1, **Done** +1; **TOTAL** **Unclaimed** −1, **Done** +1. Prior: IMP **impl-w7kx**: **School of Knowledge** (Prepared, Adept, Accomplished, Perfect Recall, Brilliant, Honed Expertise) + **School of War** (Battlemage, Face Your Fear, Conjure Shield, Fueled by Fear, Thrive in Chaos, Have No Fear) → `Done` (`SchoolOfKnowledge.js`, `SchoolOfWar.js`, tests, registry `srd-sub-school-of-knowledge` / `srd-sub-school-of-war`). Summary: Subclasses **Unclaimed** −12, **Done** +12; **TOTAL** **Unclaimed** −12, **Done** +12. Prior: VAL **val-c2sl**: **Call of the Slayer** (**Slayer**, **Weapon Specialist**, **Martial Preparation**) → `Validated` (`CallOfTheSlayer.js`, `CallOfTheSlayer.test.js`, preflight ok). Summary: Subclasses **Validated** +3 (no `Done` rows remain; **TOTAL** **Done** column aligned to **0**). Prior: **Enchanted Aid** (`PrimalOrigin.test.js`): added `reviewAction` test for **swap Duality** (`swapHopeFearDice` + swapped die values; CONV-008). Summary: Subclasses **Needs Fix** −1, **Validated** +1. Prior: VAL **val-n5kp**: Arcana **Rune Ward** → `Validated` (SRD holder / 1d8 / deplete on 8 / rest; tests). Tracker summary Validating counts corrected. Prior: IMP **impl-s7mx**: **Call of the Slayer** (**Slayer**, **Weapon Specialist**, **Martial Preparation**) → `Done` (`subclasses/CallOfTheSlayer.js`, `CallOfTheSlayer.test.js`, registry `srd-sub-call-of-the-slayer`). Prior: VAL **val-b4wk**: Winged Sentinel (**Wings of Light**, **Ethereal Visage**, **Ascendant**, **Power of the Gods**) → `Validated` (`WingedSentinel.test.js`, preflight ok). Prior: VAL **val-h8rq**: Warden of Renewal **Defender** → `Validated`. Prior: IMP **impl-p7mx**: **Primal Origin** (**Manipulate Magic**, **Enchanted Aid**, **Arcane Charge**) → `Done` (`subclasses/PrimalOrigin.js`, `PrimalOrigin.test.js`, registry `srd-sub-primal-origin`). Prior: IMP **impl-w9sx**: **Winged Sentinel** (Wings of Light, Ethereal Visage, Ascendant, Power of the Gods) → `Done` (`subclasses/WingedSentinel.js`, `WingedSentinel.test.js`, registry `srd-sub-winged-sentinel`). Prior: FIX **fix-m3kp**: Elemental Origin **Natural Evasion** → `Validated` (CONV-008 `rollDie` test). Prior: Rune Ward ally holder + cross-sheet review chips (`RuneWard.js`, `v2-action-loop-bridge.js`, `chip-system.js`). VAL **val-r8kp**: Elemental Origin **Transcendence** → `Validated`; **Elementalist**, **Natural Evasion** → `Needs Fix` (CONV-008: `ElementalOrigin.test.js`). Prior: IMP **impl-w7rk**: Warden of Renewal **Defender** → `Done` (`WardenOfRenewal.js`, `WardenOfRenewal.test.js`). Prior: **Doc:** Phase A V1 cutover matrix [`docs/v2-v1-cutover.md`](v2-v1-cutover.md), Phase B bridge handoff [`docs/v2-ui-integration-phaseB-handoff.md`](v2-ui-integration-phaseB-handoff.md), tracker § V2 UI integration backlog. Prior: IMP **impl-x7kq**: **Elemental Origin** (**Elementalist**, **Natural Evasion**, **Transcendence**) → `Done` (`subclasses/ElementalOrigin.js`, `ElementalOrigin.test.js`, registry `srd-sub-elemental-origin`). Prior: VAL **val-w4np**: Arcana **Flight** → `Validated`; **Counterspell** → `Needs Fix` (chip placement vs `feature-authoring-guide.md` §3.2). Prior: VAL **val-t3wk**: Arcana (`impl-h7wk`) **Unleash Chaos**, **Wall Walk**, **Floating Eye** → `Validated`; **Rune Ward**, **Cinder Grasp** → `Needs Fix` (Val Notes). Prior: IMP **impl-n8qx**: Arcana Tier 1 **Counterspell**, **Flight** → `Done` (`abilities/`, `ArcanaTier1.test.js`). Prior: **Doc:** Cross-collection implementation order (`subclasses → abilities → beastforms → items → consumables`) in `implementation-agent.md`, tracker intro, `README.md`, `project.mdc`. Prior: IMP **impl-h7wk**: Arcana Tier 1 **Rune Ward**, **Unleash Chaos**, **Wall Walk**, **Cinder Grasp**, **Floating Eye** → `Done` (`abilities/`, `ArcanaTier1.test.js`). Prior: VAL **val-k9wp**: **Mythic Hybrid** (`impl-p9wk`) → `Validated` (SRD **Hybrid Features** text; CONV-027 narrative; `registry.test.js` tier-4 merge). Prior: IMP **impl-p9wk**: **Mythic Hybrid** (`MythicHybrid.js`, registry) → `Done`. Prior: FIX **fix-c3wp**: Divine Wielder **Spirit Weapon** / **Sacred Resonance** — `isSpiritWeaponEligibleWeapon` (`table.me.weapons[].baseRange`) on Spirit Weapon stress; tests for Close-only weapon. → `Validated`. Prior: VAL **val-m8jq**: beastforms **Great Winged Beast**, **Aquatic Predator**, **Legendary Beast**, **Legendary Hybrid** (`impl-b7k2`) → `Validated`. Prior: VAL **val-m8wk**: Divine Wielder **Sparing Touch**, **Devout** → `Validated`; **Spirit Weapon**, **Sacred Resonance** → `Needs Fix` (Val Notes: SRD scope — base-range / Spirit Weapon attack gating). Prior: FIX **fix-b3kw**: **Epic Aquatic Beast** (**Unyielding**) → `Validated`. Prior: FIX **fix-r4wp**: **Mythic Aerial Hunter** (**Deadly Raptor**) → `Validated`. Prior: 2026-03-21 — **Doc:** Abilities within each tier: priority domains (Bard / Rogue / Seraph / Druid) before Blade & Bone; `implementation-agent.md` rules updated. Prior: VAL **val-n2qx**: tier-4 beastforms **Massive Behemoth**, **Terrible Lizard**, **Mythic Beast** → `Validated`; **Mythic Aerial Hunter**, **Epic Aquatic Beast** → `Needs Fix` (Val Notes). Prior: **Doc:** Abilities checklist reorganized into Tier 1 / Tier 2 / Tier 3 blocks (spell card tier); `implementation-agent.md` updated for tier-first domain work. Prior: VAL **val-k3wm**: Wayfinder (**Ruthless Predator**, **Path Forward**, **Elusive Predator**, **Apex Predator**) → `Validated`. Prior: IMP **impl-h4qt**: tier-4 beastforms **Massive Behemoth**, **Terrible Lizard**, **Mythic Aerial Hunter**, **Epic Aquatic Beast**, **Mythic Beast** → `Done` (`beastforms/index.js`, tests). Prior: IMP **impl-dw9k**: Divine Wielder (**Spirit Weapon**, **Sparing Touch**, **Devout**, **Sacred Resonance**) → `Done`. Prior: IMP **impl-7wfz**: Wayfinder subclass (Ruthless Predator, Path Forward, Elusive Predator, Apex Predator) → `Done`. Prior: IMP **impl-b7k2**: Great Winged Beast, Aquatic Predator, Legendary Beast, Legendary Hybrid beastforms → `Done`. Prior: VAL **val-t9kx** Beastbound; IMP **impl-b7kx** Beastbound; VAL **val-q9wk** **Reliable Backup**; FIX **fix-p8wk** **Nemesis**; VAL **val-m4wk** Nightwalker; **syndicate-reliable-backup**; IMP **impl-n2wk**; FIX **fix-a7wz** WotE Air; VAL **val-p3mq** **Elemental Dominion**; IMP **impl-w8ek** WotE; VAL **val-n4pq** Maestro / Warden of Renewal; VAL **val-r4nc** beastform; **druid-beastform-registry**; **Beastform** / **Evolution** `Validated`; FIX **fix-n8wk** **Mighty Lizard**; FIX **fix-m2kq** **Winged Beast**; VAL **val-w8kp**; FIX **fix-k3nq** **Powerful Beast**.*