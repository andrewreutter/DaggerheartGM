# Subclass Video Coverage Gaps — Plan

**Status:** Draft — ready for follow-on agents  
**Repo:** DaggerheartGM  
**Audience:** Spec-hardening agents (Phase 1), product/V2 agents (Phase 2), then deferred E2E (Phase 3)  
**Related:** [`test/subclass-video-test-plan.md`](../../test/subclass-video-test-plan.md), `test/browser-subclass/*.spec.js`

> Synthesized from nine parallel class coverage reports (2026-08-06). Specs walk most subclass features on video; many paths are soft/optional clicks or narrative captions only. This plan separates **TEST_GAP** (product already supports E2E — harden or add Playwright steps) from **PRODUCT_GAP** (needs VTT/engine/UI work — do not fake coverage in specs).

---

## Status

| Track | State |
|-------|--------|
| Subclass video suite (18 specs) | ✅ Specs exist for all 9 classes × 2 subclasses |
| Phase 1 — Spec hardening | ⬜ Not started (this plan’s primary backlog) |
| Phase 2 — Product gap fixes | ⬜ Reported only; owned by V2/engine/UI work |
| Phase 3 — Deferred E2E after product | ⬜ Blocked on Phase 2 |
| Tracker / SRD doc drift | ⬜ Update when specs or product land |

---

## Summary

All eighteen subclass video specs exist and produce walkthrough videos, but coverage quality is uneven: many mechanical outcomes are narrated or optionally clicked rather than hard-asserted, and several high-value spend paths (Rally variants, Prayer Die modes, Sneak Attack ally path, etc.) are skipped even though the VTT already wires them. Cross-cutting **TEST_GAP** work is mostly cheap asserts on already-walked paths plus a second tier of missing spend/lifecycle steps. Cross-cutting **PRODUCT_GAP** work clusters around incomplete chip UI (`isSelect` / `multiSelect` / `selectTargets`), Tag Team Game Table affordances, and banner-bridge limitations (`collectPhaseChipsOnly`, `engineRollDisplayOnly`, unsupported `rerollDie` types, Ack persistence for severity/Hope–Fear swaps). Specs must not paper over product gaps with soft captions.

**Rough inventory (themes, not every row):** ~12 cross-cutting TEST_GAP themes and ~40+ per-class TEST backlog rows; ~10 PRODUCT_GAP theme clusters spanning ~35+ named feature gaps. Prefer **P0** hard asserts first (difficultyMod, die landed, pool shrink, evasion/threshold deltas), then **P1** new spend paths, then **P2** breadth/optional matrices.

---

## Goals

1. Make subclass videos **evidence of automation**, not just narration — hard asserts where product already works.
2. Give follow-on agents a **prioritized, per-class backlog** mapped to concrete spec files.
3. **Surface product gaps clearly** so V2/UI work can unblock Phase 3 tests without agents inventing E2E for unfinished surfaces.
4. Keep `test/subclass-video-test-plan.md` and (where drifted) `docs/srd-implementation.md` honest.

## Non-goals

- Editing subclass specs in the same change that only publishes this plan (plan-only task).
- Pretending PRODUCT_GAP items are TEST_GAP (no “click if visible” soft paths as a substitute for missing UI).
- Expanding into full domain-card / ability-tier automation (out of subclass video scope except where a subclass feature depends on loadout hydration).
- Changing the video harness architecture unless a Phase 1 item explicitly needs a shared helper (prefer harness helpers over copy-paste asserts).

---

## Phase 1 — Spec hardening (TEST_GAP only)

Work only where the Game Table / V2 bridge **already** supports the path. Prefer extending existing walkthrough steps with `expect(...)` over adding long new scenes. Soft/optional clicks (`if (await btn.isVisible()) await btn.click()`) should become hard asserts when the feature is marked Done/Partial and the cast character can afford the cost.

### Cross-cutting checklist

- [ ] **P0 — Outcome asserts on walked paths**
  - [ ] `difficultyMod` / Make a Scene style difficulty changes persist and are readable from table state or UI
  - [ ] Banner die landed (size/face) after Rally / Prayer Die / similar `addRollDie` / static adds
  - [ ] Resource pool shrink (Prayer Dice pool length, Rally die consumed, Slayer bank, etc.)
  - [ ] Passive numeric deltas: evasion, thresholds, maxStress, Armor, Hope — compare before/after via `getTableState` or visible tracks
- [ ] **P1 — Missing spend paths already wired**
  - [ ] Rally: Damage, reaction, ally Clear Stress, session-end clear, d8 path, banner die
  - [ ] Prayer Die: Damage, reduce, Hope modes + pool shrink
  - [ ] Hold Them Off / multi-target only where product already applies HP (do not assert dropped targets — see PRODUCT_GAP)
  - [ ] Sneak Attack dice + ally path; Contacts multi-use options that already mutate
  - [ ] Channel Raw Power **seeded** loadout path; Manipulate Magic modes that exist; Elementalist +3 / Natural Evasion depth
- [ ] **P1 — Rest / session lifecycle**
  - [ ] Frequency refresh (once/rest, once/session)
  - [ ] Clear flags: Nemesis, No Mercy, rest-gated beastform/elemental state, Strange Patterns re-pick, Unstoppable frequency
  - [ ] Session-start Hope / banked resources (Slayer)
- [ ] **P1 — Alternate chip options**
  - [ ] Eloquent 2 Hope / 3 Hope options
  - [ ] Contacts option matrix (where product applies)
  - [ ] Manipulate Magic mode variants
- [ ] **P2 — Combat / matrix breadth**
  - [ ] Druid elemental combat matrix (Incarnation / Aura / Dominion) — product largely supports; specs under-exercise
  - [ ] Beastform combat, Fragile, last-HP drop
  - [ ] Virtuoso / domain breadth only if cheap
- [ ] **Harness hygiene**
  - [ ] Replace soft optional clicks with hard expects + failure messages naming the feature
  - [ ] Prefer `getTableState` numeric checks over caption-only narration for Done features
  - [ ] Keep videos watchable: assert quietly; avoid doubling scene length for P2 breadth

### Per-class backlog

Priority: **P0** = small assert on already-walked path · **P1** = new spend/lifecycle path · **P2** = optional breadth.

#### Bard

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Bard | `bard-troubadour.spec.js` | Make a Scene `difficultyMod` not hard-asserted | After chip resolve, `getTableState` / UI expect target `difficultyMod` (or equivalent) changed | P0 |
| Bard | `bard-troubadour.spec.js` | Rally die on banner not asserted | After Rally add-die path, expect banner sub-item / die size present | P0 |
| Bard | `bard-troubadour.spec.js` | Rally Damage spend path missing | Walk Rally → Damage option; assert damage sub-item or stress/hope costs | P1 |
| Bard | `bard-troubadour.spec.js` | Rally reaction path missing | Trigger reaction-eligible roll; activate Rally reaction chip; assert | P1 |
| Bard | `bard-troubadour.spec.js` | Ally Clear Stress via Rally missing | Player B / ally sheet cross-chip; assert stress cleared | P1 |
| Bard | `bard-troubadour.spec.js` | Rally session-end clear missing | End scene/session hook path; assert party dice / modifiers cleared | P1 |
| Bard | `bard-troubadour.spec.js` | Rally d8 path missing | Exercise d8 variant if cast/level allows; assert die notation | P1 |
| Bard | `bard-wordsmith.spec.js` | Eloquent 2/3 Hope options incomplete | Click each option; assert Hope spent + effect | P1 |
| Bard | both | Virtuoso breadth thin | Optional second domain/card interaction if cheap | P2 |
| Bard | both | Long-rest refresh of once/rest features | Short vs long rest; assert frequency cleared | P1 |

#### Druid

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Druid | `druid-warden-of-renewal.spec.js` | Protection / Defender asserts soft | Hard-assert threshold / armor / stress numbers after use | P0 |
| Druid | `druid-warden-of-renewal.spec.js` | Regeneration Very Close untested | Place tokens in range; use Regeneration; assert HP | P1 |
| Druid | `druid-warden-of-the-elements.spec.js` | Elemental Incarnation/Aura/Dominion matrix mostly untested | Matrix table: pick 2–3 element×mode combos with VTT support; assert state + combat effect | P1 |
| Druid | both | Beastform combat / Fragile / last-HP drop | Enter beastform; deal damage to Fragile; assert drop; last-HP exit | P1 |
| Druid | both | Rest clear of beastform / channel state | Rest cycle; assert `featureState` cleared | P1 |

#### Guardian

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Guardian | `guardian-stalwart.spec.js` | Threshold / maxStress numbers soft | Assert concrete threshold and maxStress values from sheet/state | P0 |
| Guardian | `guardian-vengeance.spec.js` | Unstoppable frequency not asserted | Use once; expect disabled; rest/session refresh path | P1 |
| Guardian | `guardian-vengeance.spec.js` | Nemesis rest clear missing | Set Nemesis; rest; assert cleared | P1 |
| Guardian | `guardian-stalwart.spec.js` | Ack-based HP after severity product fix | **Phase 3** — do not add until Iron Will etc. persist (see Phase 2) | — |

#### Ranger

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Ranger | `ranger-wayfinder.spec.js` | Battle-Bonded / Elusive `onIntent` soft | Pre-roll intent chips; assert modifiers on roll skeleton / banner | P1 |
| Ranger | both | Focus Stress cost not asserted | Mark Focus; assert Stress spent | P0 |
| Ranger | both | End Focus reroll path missing | End Focus → reroll chip; assert new banner / die | P1 |
| Ranger | `ranger-wayfinder.spec.js` | Ruthless Severe→Stress missing | Force Severe hit; assert Stress path | P1 |
| Ranger | `ranger-beastbound.spec.js` | Companion experience / token thin | Assert companion stress/token placement or experience chip | P1 |

#### Rogue

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Rogue | `rogue-nightwalker.spec.js` | Evasion deltas soft | Before/after evasion number assert | P0 |
| Rogue | both | Rest clears missing | Rest; assert cloaked/temp flags cleared where product clears | P1 |
| Rogue | `rogue-nightwalker.spec.js` | Restrained clear path | Apply Restrained; use clear feature; assert condition gone | P1 |
| Rogue | both | Sneak Attack dice + ally path | With ally in Melee; assert Sneak Attack die on banner | P1 |
| Rogue | `rogue-syndicate.spec.js` | Contacts 3× uses + other options | Exhaust uses; try alternate options that already mutate | P1 |

#### Seraph

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Seraph | both | Prayer Die pool shrink not asserted | After spend, expect `prayerDice.pool` length −1 | P0 |
| Seraph | both | Prayer Die Damage / reduce / Hope modes missing | One scene per mode; assert banner mutation + cost | P1 |
| Seraph | `seraph-winged-sentinel.spec.js` | Wings d12 path | Toggle/ack Wings d8/d12 path per product; assert Hope + die | P1 |
| Seraph | `seraph-winged-sentinel.spec.js` | Ascendant +4 soft | Assert numeric bonus on roll/banner | P0 |
| Seraph | `seraph-divine-wielder.spec.js` | Ethereal Visage advantage / Fear | Assert advantage die or Fear interaction | P1 |

#### Sorcerer

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Sorcerer | `sorcerer-elemental-origin.spec.js` | Elementalist +3 soft | Assert +3 on qualifying roll | P0 |
| Sorcerer | `sorcerer-elemental-origin.spec.js` | Natural Evasion depth thin | Assert evasion delta + any stress/hope side effect product applies | P1 |
| Sorcerer | `sorcerer-primal-origin.spec.js` | Channel Raw Power seeded loadout path | Seed loadout in cast factory; walk Channel; assert | P1 |
| Sorcerer | both | Charge from magic damage / +3 reaction discharge | Take magic damage; discharge; assert | P1 |
| Sorcerer | `sorcerer-primal-origin.spec.js` | Manipulate Magic modes incomplete | Walk each available mode chip; assert distinct outcomes | P1 |
| Sorcerer | `sorcerer-primal-origin.spec.js` | Volatile on Primal (where product works) | Trigger Volatile; assert stress/damage product already applies — skip `damageDie` partition until Phase 2 | P1 |

#### Warrior

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Warrior | `warrior-call-of-the-slayer.spec.js` | Slayer bank / session-start Hope soft | Assert banked value; Start Session Hope grant | P0 |
| Warrior | `warrior-call-of-the-brave.spec.js` | Weapon Specialist hard assert missing | Assert damage/trait rewrite or chip effect numerically | P0 |
| Warrior | `warrior-call-of-the-brave.spec.js` | No Mercy rest clear missing | Arm No Mercy; rest; assert cleared | P1 |

#### Wizard

| Class | Spec file | Gap | Suggested step | Priority |
|-------|-----------|-----|----------------|----------|
| Wizard | `wizard-school-of-knowledge.spec.js` | Perfect Recall assert soft | Hard-assert resource / card effect product applies | P0 |
| Wizard | `wizard-school-of-war.spec.js` | Adept arming assert soft | Assert armed state flag / chip disabled after arm | P0 |
| Wizard | `wizard-school-of-knowledge.spec.js` | Strange Patterns seed + chips + rest re-pick | Seed pattern in factory; activate chips; rest → re-pick UI if present | P1 |
| Wizard | `wizard-school-of-war.spec.js` | Battlemage / Conjure Shield numbers | **Phase 3** after sheet-merge product fix | — |
| Wizard | both | V2 Not This Time path | **Phase 3** after `gmDie`/`damageDie` support | — |

---

## Phase 2 — Product gaps report (no spec work until fixed)

Do **not** add Playwright coverage that depends on missing UI or bridge behavior. Track these as V2/engine/Game Table work. When a row ships, move its tests to Phase 3.

### Theme clusters (affected classes)

| Theme | Classes affected | Notes |
|-------|------------------|--------|
| **Cross-sheet / Actions `isSelect` incomplete** | Bard (Maestro), Seraph (Sparing Touch `selectTargets`+`isSelect`), Warrior (Slayer intent) | Chip collects but picker UX incomplete or non-functional end-to-end |
| **Tag Team Game Table UI missing** | Bard (Epic Poetry), Sorcerer (Enchanted Aid), Warrior (Camaraderie) | Feature/engine may declare Tag Team; no GM/player table affordance to exercise |
| **Banner bridge: phase collection gaps** | Wizard (Adept/Honed/Face Your Fear `onReviewAction`), others using hooks skipped by `collectPhaseChipsOnly` | Many `onReviewAction` / `onResolve` hooks never surface as chips |
| **Banner bridge: `engineRollDisplayOnly`** | Guardian (Nemesis Hope/Fear), Wizard (die swaps), similar | `swapHopeFear`, `setDie`, etc. display-only — not persisted on Ack |
| **Unsupported `rerollDie` types** | Wizard (Not This Time `gmDie`/`damageDie`), Sorcerer (Volatile `damageDie`) | Partitioner / API rejects or no-ops non-Hope/Fear/Duality |
| **Severity / redirect mutations not persisted on Ack** | Guardian (Iron Will, Partners, Loyal Protector, Act of Reprisal) | Stalwart/Vengeance severity steps need Ack persistence |
| **Hold Them Off `addDamageRoll` targets dropped** | Ranger | `postBannerAddDamage` drops extra-target HP application |
| **`rangeOverrides` unused by reach checks** | Seraph (Spirit Weapon) | Reach/range still uses weapon defaults |
| **Prayer Dice / Sacred Resonance conflicts** | Seraph (Devout overwrite, Sacred Resonance VTT, session-end clear) | Pool overwrite + incomplete Resonance automation |
| **Warrior VTT combat suite** | Warrior (AoO outcomes, Rise d20, Courage `onResolve`, Combat Training, No Mercy +1 intent, Martial Preparation party dice) | Large intentional Display / unfinished bridge surface |
| **Sorcerer UI / hydration** | Sorcerer (Transcendence `multiSelect`, Channel Raw Power loadout hydration, Dualstaff `mag` vs Manipulate Magic) | Sheet/loadout/predicate gaps |
| **Druid Evolution / elemental edge cases** | Druid (Evolution +1 trait picker; Clarity stress share; Water aura reposition; Air fly/hover; Agile Far Hope move) | Partial VTT; missing pickers / map behaviors |
| **Rogue resolve / teleport / Contacts depth** | Rogue (Cloaked auto-clear, Adrenaline, Dodge/Vanishing `onResolve`, Dark Cloud spellcast, Shadow Stepper teleport, Contacts HP shield/d20/+3/2d8) | Mix of missing hooks and Contacts option automation |
| **Wizard sheet merge / pattern create** | Wizard (Battlemage/Conjure Shield merge, Strange Patterns create UI) | Numbers wrong or create flow missing until merge/UI |
| **GM `actionLoop`-only narrative handoffs** | Ranger (Loyal Friend / Expert / Advanced Training), various | Intentional Display — GM adjudicates; not a bug. Specs should keep light narrative captions only |

### Per-gap rows

| Gap | Classes | Evidence (from agent reports) | Unblocks which tests |
|-----|---------|-------------------------------|----------------------|
| Maestro Actions `isSelect` incomplete | Bard | Wordsmith/Maestro chip needs select UX | Maestro E2E select + apply |
| Epic Poetry Tag Team UI | Bard | No Tag Team table control | Epic Poetry partner flow video |
| Sparing Touch `isSelect` + `selectTargets` | Seraph | Target picker incomplete | Sparing Touch heal/target E2E |
| Spirit Weapon `rangeOverrides` unused | Seraph | Reach checks ignore overrides | Far/Melee Spirit Weapon range asserts |
| Spirit Weapon multi-target Stress | Seraph | Stress on extra targets incomplete | Multi-target Spirit Weapon E2E |
| Sacred Resonance VTT incomplete | Seraph | Automation missing/partial | Resonance combat video |
| Devout vs Prayer Dice overwrite | Seraph | Devout overwrites shared pool | Devout + Prayer coexistence asserts |
| Prayer Dice session-end clear | Seraph | Pool not cleared on session end | Session lifecycle Prayer assert |
| Evolution +1 trait picker UI | Druid | No trait picker for Evolution bonus | Evolution trait-select E2E |
| Clarity stress share | Druid | Share path incomplete | Clarity ally stress E2E |
| Water aura reposition | Druid | Map/aura move incomplete | Water Dominion reposition |
| Air fly/hover | Druid | Fly/hover token behavior missing | Air elemental movement |
| Agile Far Hope move | Druid | Far-range Hope move incomplete | Agile hope-move E2E |
| Iron Will / Partners / Loyal Protector severity persistence | Guardian | Severity mutations not Ack-persisted | Ack HP/threshold asserts (Stalwart) |
| Unstoppable ongoing hooks | Guardian | Ongoing effect hooks incomplete | Mid-scene Unstoppable E2E |
| Act of Reprisal | Guardian | Bridge/UI incomplete | Reprisal retaliate E2E |
| Nemesis Hope/Fear swap persistence | Guardian | `engineRollDisplayOnly` / Ack drop | Nemesis duality swap assert |
| Hold Them Off extra-target HP | Ranger | `postBannerAddDamage` drops targets | Multi-target HTO damage E2E |
| Loyal Friend / Expert / Advanced Training | Ranger | GM actionLoop narrative only | Keep Display-only captions (no Phase 3 mech tests) |
| Cloaked auto-clear | Rogue | Auto-clear on attack/etc. missing | Cloaked clear-on-act E2E |
| Adrenaline VTT | Rogue | Not automated | Adrenaline combat E2E |
| Dodge / Vanishing `onResolve` | Rogue | Resolve hooks not wired to banner | Dodge/Vanishing chip E2E |
| Dark Cloud spellcast | Rogue | Spellcast path incomplete | Dark Cloud cast E2E |
| Shadow Stepper teleport | Rogue | Token teleport missing | Teleport position assert |
| Contacts HP shield / d20 / +3 / 2d8 | Rogue | Option automation incomplete | Full Contacts option matrix |
| Transcendence `multiSelect` UI | Sorcerer | multiSelect not in chip UI | Transcendence multi-pick E2E |
| Channel Raw Power loadout hydration | Sorcerer | Loadout not hydrated for Channel | Channel from real loadout (beyond seeded factory hacks) |
| Dualstaff `mag` vs Manipulate Magic | Sorcerer | Predicate / damage type mismatch | Dualstaff + Manipulate Magic E2E |
| Volatile Magic `damageDie` partitioner | Sorcerer | Unsupported damageDie reroll | Volatile damage die E2E |
| Enchanted Aid Tag Team | Sorcerer | Tag Team UI missing | Enchanted Aid partner flow |
| AoO outcomes | Warrior | Opportunity attack outcomes not VTT | AoO resolve E2E |
| Slayer intent `isSelect` | Warrior | Intent select incomplete | Slayer target/mode select |
| Courage `onResolve` | Warrior | Resolve hook not bridged | Courage banner E2E |
| Rise d20 | Warrior | d20 path unsupported/incomplete | Rise d20 E2E |
| No Mercy +1 intent | Warrior | Intent +1 missing | No Mercy intent assert |
| Combat Training damage/burden | Warrior | VTT incomplete | Combat Training E2E |
| Martial Preparation party dice | Warrior | Party dice handoff incomplete | Prep party-dice E2E |
| Camaraderie Tag Team | Warrior | Tag Team UI missing | Camaraderie partner flow |
| Adept / Honed / Face Your Fear `onReviewAction` VTT | Wizard | `collectPhaseChipsOnly` skips hooks | Review-chip E2E for School of War/Knowledge |
| Battlemage / Conjure Shield sheet merge | Wizard | Declarative merge wrong/missing | Numeric shield/evasion asserts |
| Strange Patterns create UI | Wizard | Create/pick UI incomplete | Full Strange Patterns authoring E2E |
| Not This Time `gmDie` / `damageDie` | Wizard | Unsupported reroll types | V2 Not This Time full E2E |

---

## Phase 3 — After product fixes (deferred TEST work)

When a Phase 2 row ships, add the corresponding hard E2E to the listed spec(s). Do not start these while still PRODUCT_GAP.

| After product fix | Spec(s) | Deferred test |
|-------------------|---------|---------------|
| Maestro `isSelect` | `bard-wordsmith.spec.js` | Select target/option; assert Make-a-Scene-adjacent or Maestro effect |
| Epic Poetry Tag Team | `bard-wordsmith.spec.js` | Tag Team partner flow with Player B |
| Sparing Touch select | `seraph-divine-wielder.spec.js` | Target select + heal/stress assert |
| Spirit Weapon range + multi Stress | `seraph-divine-wielder.spec.js` | Range gate + multi-target Stress |
| Sacred Resonance + Devout pool + session clear | Seraph specs | Resonance combat; Devout coexistence; session-end pool empty |
| Evolution trait picker | `druid-warden-of-the-elements.spec.js` (or Renewal if Evolution lives there) | Pick trait; assert +1 on rolls |
| Clarity / Water / Air / Agile map | Druid specs | Stress share; aura reposition; fly; Far Hope move |
| Guardian severity Ack persistence | `guardian-stalwart.spec.js` | Ack → HP/threshold match reduced severity |
| Unstoppable ongoing + Act of Reprisal + Nemesis swap | `guardian-vengeance.spec.js` | Full Vengeance combat loop |
| Hold Them Off multi HP | `ranger-wayfinder.spec.js` | 2–3 targets all take damage; Hope cost |
| Rogue resolve/teleport/Contacts depth | Rogue specs | Cloaked clear; Adrenaline; Dodge/Vanishing; Dark Cloud; Shadow Stepper; Contacts matrix |
| Sorcerer Transcendence / Channel hydration / Dualstaff / Volatile die / Enchanted Aid | Sorcerer specs | Full Primal/Elemental product paths |
| Warrior AoO / Slayer select / Courage / Rise / Combat Training / Prep / Camaraderie | Warrior specs | Full Brave/Slayer combat suite |
| Wizard review chips / shield merge / Strange Patterns create / Not This Time dies | Wizard specs | School of War + Knowledge completion |

**Still Display-only (no Phase 3 mechanical tests):** Ranger Loyal Friend / Expert / Advanced Training and other intentional GM `actionLoop` narrative handoffs — keep caption-only.

---

## Recommended sequencing

```text
1. Phase 1 P0 across all 9 classes (1–2 hours/class typical)
      → difficultyMod, die landed, pool shrink, evasion/threshold/Hope numbers
2. Phase 1 P1 spend paths that share harness patterns
      → Rally family, Prayer Die family, rest/session clears (copy patterns across specs)
3. Phase 1 P1 class-unique paths (Sneak Attack ally, Channel seeded, Focus/End Focus, etc.)
4. Phase 1 P2 matrices (Druid elemental, Virtuoso) only if P0/P1 green
5. Phase 2 product work — prioritize by “unblocks most tests”:
      a. Banner Ack persistence (severity, swapHopeFear) — Guardian + others
      b. Hold Them Off addDamageRoll targets — Ranger
      c. isSelect / multiSelect / selectTargets chip UI — Bard, Seraph, Warrior, Sorcerer
      d. Tag Team Game Table UI — Bard, Sorcerer, Warrior (one shared affordance)
      e. collectPhaseChipsOnly / rerollDie type support — Wizard, Sorcerer Volatile
      f. Remaining per-class VTT (Druid Evolution picker, Spirit Weapon range, etc.)
6. Phase 3 — add deferred E2E immediately after each product PR merges
```

**Agent ownership suggestion**

| Agent mode | Owns |
|------------|------|
| Spec / QA follow-on | Phase 1 only; file PRs per class or per theme (Rally asserts, Prayer asserts) |
| V2 implementation / fix | Phase 2 rows; update tracker Issues; do not “fix” by weakening specs |
| Validation | After Phase 1 or 3 spec PRs: run `npm run test:subclass -- <filter>` headed; confirm video + asserts |

---

## Tracking updates

When work lands:

- [ ] Update [`test/subclass-video-test-plan.md`](../../test/subclass-video-test-plan.md) — note hardened asserts / new scenes per subclass; add a short “Coverage gaps” pointer back to this plan until Phase 1 is largely done.
- [ ] Note **`docs/srd-implementation.md` drift** called out by agents (reconcile Status vs actual automation):
  - **Guardian** — severity / Unstoppable / Nemesis persistence may be overstated vs bridge reality
  - **Syndicate** (Rogue) — Contacts option depth / HP shield paths
  - **Divine Wielder** (Seraph) — Spirit Weapon range, Sparing Touch select, Sacred Resonance
  - **Primal Origin** (Sorcerer) — Volatile damageDie, Transcendence multiSelect, Channel hydration
  - **Call of the Slayer** (Warrior) — Slayer intent select, Combat Training, Tag Team/Camaraderie
- [ ] Do **not** mark SRD rows Done based on video narration alone — require Phase 1 hard asserts or honest Partial/Display.

---

## Appendix — Agent report links

Parallel coverage reports (Cursor agent transcripts):

| Class | Report |
|-------|--------|
| Bard | [Bard](4df35456-9459-4101-883f-d039425c3778) |
| Druid | [Druid](37cfbb19-c919-41cf-878d-c06ddcb7eb5d) |
| Guardian | [Guardian](a0b91ac3-0915-411a-9884-760a92fae3b0) |
| Ranger | [Ranger](8a5209e7-303e-4609-8acf-f8bf2d1f0840) |
| Rogue | [Rogue](7dbc771a-53da-42c4-8458-a6a81f6707ec) |
| Seraph | [Seraph](f3fbe785-cac5-4397-80fd-fc06c5c14a25) |
| Sorcerer | [Sorcerer](8d8141bd-55b6-4df6-846d-70b8e14e5ecc) |
| Warrior | [Warrior](cffb2a21-6600-4885-96a4-252e375efea7) |
| Wizard | [Wizard](7d9b0230-24de-4108-ae42-214592b30eb7) |

### Spec file index (all 18)

| Class | Subclass | Spec |
|-------|----------|------|
| Bard | Troubadour | `test/browser-subclass/bard-troubadour.spec.js` |
| Bard | Wordsmith | `test/browser-subclass/bard-wordsmith.spec.js` |
| Druid | Warden of the Elements | `test/browser-subclass/druid-warden-of-the-elements.spec.js` |
| Druid | Warden of Renewal | `test/browser-subclass/druid-warden-of-renewal.spec.js` |
| Guardian | Stalwart | `test/browser-subclass/guardian-stalwart.spec.js` |
| Guardian | Vengeance | `test/browser-subclass/guardian-vengeance.spec.js` |
| Ranger | Beastbound | `test/browser-subclass/ranger-beastbound.spec.js` |
| Ranger | Wayfinder | `test/browser-subclass/ranger-wayfinder.spec.js` |
| Rogue | Nightwalker | `test/browser-subclass/rogue-nightwalker.spec.js` |
| Rogue | Syndicate | `test/browser-subclass/rogue-syndicate.spec.js` |
| Seraph | Divine Wielder | `test/browser-subclass/seraph-divine-wielder.spec.js` |
| Seraph | Winged Sentinel | `test/browser-subclass/seraph-winged-sentinel.spec.js` |
| Sorcerer | Elemental Origin | `test/browser-subclass/sorcerer-elemental-origin.spec.js` |
| Sorcerer | Primal Origin | `test/browser-subclass/sorcerer-primal-origin.spec.js` |
| Warrior | Call of the Brave | `test/browser-subclass/warrior-call-of-the-brave.spec.js` |
| Warrior | Call of the Slayer | `test/browser-subclass/warrior-call-of-the-slayer.spec.js` |
| Wizard | School of Knowledge | `test/browser-subclass/wizard-school-of-knowledge.spec.js` |
| Wizard | School of War | `test/browser-subclass/wizard-school-of-war.spec.js` |
