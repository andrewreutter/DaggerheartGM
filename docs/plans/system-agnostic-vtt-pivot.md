# Plan: Pivot Daggertop to a System-Agnostic VTT (the "Engine, not the Content" pivot)

Status: **DRAFT — for review (/autoplan)**
Repo: DaggerheartGM (current product name: **Daggertop**)

> This is a pre-review strategy + engineering plan. It exists because Darrington Press (DRP) declined to whitelist Daggertop as a Daggerheart VTT, and — separately and more importantly — the Darrington Press Community Gaming License (DPCGL) forbids *monetized public* use of Daggerheart SRD content on **any** VTT, whitelisted or not. The current product, in a *paid, public* form built on SRD content, therefore has no license-compliant shape. The strongest asset we own is not Daggerheart content; it is the declarative feature engine (`src/features-v2/`). This plan repositions the product around that engine and treats all game *content* as user-supplied system packs the platform neither ships nor endorses.

---

## 0. Handoff status (read first)

- **Compliance is not an open emergency.** An interim mitigation is live: public signups are disabled (the instance now serves only the maintainer's private gaming group) and Daggerheart marketing copy was removed from the homepage. Per DPCGL §1.8, private non-commercial play among a personal gaming group is not "Sharing" and the license does not reach it — so the current private instance is compliant, not merely hidden. **The compliance clock is therefore off.** The strategic decision below can be made deliberately, not under duress.
- **What the interim mitigation does *not* settle:** it is a pause, not a resolution. Reopening to the public, or monetizing SRD-derived content for other people, re-enters the non-compliant zone. This plan is about the durable answer.
- **Decision this plan asks the reviewer to pressure-test:** commit to the system-agnostic pivot (§4–§6) vs. two standing alternatives the CEO phase must weigh honestly — **(A)** remain a private, non-commercial hobby instance indefinitely (fully compliant, zero business), and **(B)** pursue a DRP commercial partnership / engine-B2B path (§3 Phase 3, §8) instead of, or before, the full pivot.
- **Not yet done:** IP-attorney sign-off on the *public/commercial* posture (§7, premise P4). Not required for the current private instance; required before any public relaunch.

---

## 1. The forcing facts (why this plan exists)

1. **The refusal is a moratorium, not a quality judgment.** DRP: "we're not approving, whitelisting, or licensing additional VTTs… beyond the currently approved tools." Roll20, Demiplane, Foundry, Alchemy, Fantasy Grounds are the closed set.
2. **Even whitelisting would not have legalized our business model.** DPCGL §1.9.1: sharing on whitelisted VTTs is "solely for non-commercial purposes and may not be monetized in any form… including… charging subscription fees, paywalling content." Our Campaign Pass is exactly this. The only commercial digital path DRP offers is a curated *partnership* (Demiplane, Alchemy, and Foundry/Metamorphic — modules Q4 2026), not an open license.
3. **The SRD *text* is copyrighted; only the *mechanics* are free.** DPCGL §1.3 licenses "game rules (**but not a copy/paste of rulebook content**), mechanics, systems… and the names and attributes of… classes, subclasses, and races." Idea/expression: we may reimplement the *system* with original text; we may not redistribute the SRD's literal text/stat-block wording, and the class/ancestry *names* only come with the license we are declining.
4. **We now have written notice.** Continuing to run the SRD-dependent, monetized *public* product unchanged would convert "arguable" into "willful," and the license we would otherwise invoke carries an indemnification + fee-shifting release (§5, §7.2, §8). The interim private-mode mitigation (§0) neutralizes this exposure for now; it re-arms the moment the product goes public or monetizes SRD content for others.
5. **The engine is genuinely system-agnostic already; the content and the sheet model are not.** `src/features-v2/engine/` is feature-agnostic by rule (`.cursor/rules/v2-framework-boundaries.mdc`). But the *registry*, the character/resource model (Hope/Fear/Stress/Armor/thresholds/traits/domains), the dice model (Duality), the range bands, the Battle Points economy, and every loader are Daggerheart-shaped.
6. **Private, non-commercial play is entirely outside the license.** DPCGL §1.8: "'public' does not include private, non-commercial play among friends, family, or gaming groups in a personal setting (in-person or online). Content used exclusively within such private settings is not considered Shared under this License." This is why the current locked-down instance is compliant, and why "remain private" is a genuine (if zero-revenue) alternative the review must weigh, not a euphemism for giving up.

## 2. Premises (explicit — for the CEO-review gate; do not auto-accept)

- **P1.** The declarative engine is a defensible, transferable moat with value independent of Daggerheart. *(If false, the whole pivot collapses and the right move is a partnership pitch or a wind-down, not this plan.)*
- **P2.** A meaningful fraction of current Daggerheart users will stay if Daggerheart returns as a user-loaded community pack, even without day-one first-party Daggerheart polish. *(This is the biggest retention risk; it may be false.)*
- **P3.** "System-agnostic VTT" is a viable market to *enter* despite Foundry + Roll20 incumbency, because our edge is modern declarative automation authoring, not raw map/token features. *(Contestable — the generic VTT market is crowded and cold compared to our current warm niche.)*
- **P4.** A neutral, general-purpose import + community-pack model materially reduces legal exposure vs. today, provided we do not ship, host, feature, endorse, or document any Daggerheart pack. *(Needs an IP attorney's sign-off before we rely on it — see §7.)*
- **P5.** The compliance move (stop monetizing SRD content) and the product move (go agnostic) are separable, and the compliance move is more urgent than the product move is complete.

## 3. Goals / Non-goals

**Goals**
- Reach a **license-compliant posture** for the monetized product on a short clock.
- Extract the value of `src/features-v2/` into a **System Pack** abstraction so any TTRPG can be defined declaratively (dice model, resource tracks, character schema, content collections, ranges, GM economy, automation).
- Ship an **original, first-party demo system** ("house system") that gives the platform standalone day-one value with zero third-party IP.
- Preserve as much existing code (BattleMap, ops/SSE, billing, import pipeline, library) as possible.

**Non-goals**
- Shipping, hosting, featuring, or documenting a Daggerheart system pack. The community may create/share one; we are content-neutral infrastructure.
- Finishing the V2 Daggerheart migration to 100% coverage (that track is now, at most, a *reference pack the community owns*, not a first-party deliverable).
- Any attempt to pressure DRP or to litigate. Community goodwill is our only real asset with this audience; an adversarial posture destroys it. (See §8.)
- A ground-up rewrite. This is an abstraction + repositioning of existing systems.

## 4. Architecture: the System Pack abstraction

The core deliverable is a declarative **System Pack** that the current Daggerheart-specific pieces become one instance of. A pack defines:

| Pack layer | Today (hard-coded Daggerheart) | Target (pack-defined) |
|---|---|---|
| **Resolution / dice model** | Duality (Hope/Fear d12s), crit = matching dice, adversary d20 | Declarative dice engine: named dice groups, success/crit predicates, hope/fear-style dual economies as *config*, d20/2d6/dice-pool presets |
| **Resource tracks** | HP/Stress/Hope/Armor + thresholds, Fear counter | Declarative track definitions (name, max formula, pips, threshold bands, table-level "GM economy" trackers) |
| **Character schema** | traits (agi/str/fin/ins/pre/kno), evasion, domains, sheet layout | JSON-Schema-driven sheet (reuse the existing declarative `cards` / `shape.jsonSchema` pipeline) |
| **Content collections** | 13 SRD collections + scenes/maps/characters | Pack declares its own collection types + card layouts |
| **Range / map model** | Melee/Very Close/Close/Far/Very Far bands | Pack-defined range bands (or "gridless/metric/grid" presets); BattleMap already stores feet + altitude generically |
| **Encounter economy** | Battle Points (`ROLE_BP_COST`), adversary roles, tiers | Pack-defined budget model + adversary/threat schema |
| **Automation** | `src/features-v2/` registry (Daggerheart modules) | Pack-supplied registry modules using the *unchanged* engine contract |

**Coupling points to abstract (the real work list):**
- `src/game-constants.js` — `ROLES`, `ROLE_BP_COST`, `ENV_TYPES`, `TIERS`, `RELEASED_ABILITY_TIER_CEILING` → move into a pack manifest.
- `src/srd/`, `src/srd-loader.js`, `src/dt-scenes-loader.js`, `src/dt-maps-loader.js`, `daggerheart-srd` submodule → replaced by a generic **pack loader** (`external_item_cache` becomes per-pack; drop the submodule from the shipped/loaded default).
- `src/features-v2/registry.js` + all class/subclass/ancestry/community/ability/beastform modules → **move to a community pack**; keep `src/features-v2/engine/` as the platform runtime.
- `character-calc.js`, Duality dice in `DiceRoller.jsx`, spotlight/fear/countdowns in `GMTableView.jsx`/`table_state`, range bands in `map-range.js`, Battle Points in `battle-points.js` → parameterize from the active pack.
- `daggerstack-sync.js` → becomes a pack-specific importer plugin, not a core route.

**First-party "house system":** a small, original, clean-room generic fantasy/narrative system (all-original names + text) that exercises every pack layer, so the platform is demonstrably valuable with zero third-party content and serves as the authoring reference.

## 5. Phasing

**Phase 0 — Compliance triage. INTERIM MITIGATION DONE; permanent steps pending the strategic decision.**
- ✅ **Done (interim):** public signups disabled (private gaming group only) + Daggerheart homepage copy removed. Under DPCGL §1.8 the instance is now compliant private play, so the compliance clock is off. This holds only while the instance stays private and non-commercial.
- ⏳ **Required before any public/commercial relaunch (not before):** IP-attorney sign-off on §7 guardrails.
- ⏳ Stop monetizing SRD-derived content for other people: either (a) suspend Campaign Pass on SRD-dependent tables, or (b) fastest-path convert first-party Daggerheart content to non-shipped/user-supplied. Decide with counsel.
- ⏳ Remove first-party Daggerheart content from the shipped/default-loaded path; stop auto-loading the SRD submodule.
- ⏳ Scrub "Daggerheart" from all marketing/branding/endorsement copy; evaluate a product rename away from Dagger-evocative branding (trademark hygiene — DAGGERHEART is a registered Name Mark).

**Phase 1 — System Pack runtime.** Define the pack manifest schema; build the pack loader; parameterize dice/resource/range/encounter models from the active pack; ship the original house system as pack #1. Existing Daggerheart modules kept out-of-tree as the community reference pack.

**Phase 2 — Authoring + neutral import.** Pack authoring UI (build on existing declarative `cards`/JSON-Schema tooling); a genuinely neutral importer (any text/zip/JSON, for any system — not "import the SRD"); community pack sharing with clear content-ownership ToS.

**Phase 3 — GTM + engine B2B (optional parallel).** Reposition ("the VTT where the community builds any system"); explore licensing the engine to Foundry/Metamorphic module builders or pitching DRP business development a curated partnership (the Foundry deal proves they will do commercial digital deals — a different door than the license inbox).

## 6. Migration / retention path

- Existing users keep their tables (data never deleted).
- Daggerheart returns as a **user-loaded** community pack that Daggertop does not ship or host. This is the P2 bet: measure retention explicitly after the pack model lands.
- Provide a one-time export so a GM's current table state survives the transition to pack-based tables.

## 7. Legal guardrails (first-class product constraints, pending counsel — P4)

- **Zero first-party Daggerheart content** shipped, hosted, featured, endorsed, or documented.
- **No "Daggerheart" in branding, domain, marketing, or default UX.** Evaluate renaming the product.
- **Neutral general-purpose import** for any system; no "load the Daggerheart SRD" affordance, docs, tutorial, or template. (Marketed single-system import is inducement/contributory exposure; a neutral file importer with substantial non-infringing use is defensible.)
- **User-content ToS:** uploaders are solely responsible for content they add; clear takedown process.
- **Do not accept the DPCGL** for the platform itself (we rely on mechanics-are-free, not on the license), and correspondingly **use zero licensed names/attributes/marks** in first-party surfaces.

## 8. On "pressuring DRP" — explicitly out of scope

We have no legal leverage ("publisher won't license its IP to me" is not an antitrust claim), and public pressure against a Critical Role-backed brand converts our single strongest asset (community affection) into a liability. The only constructive "pressure" is a partnership pitch (Phase 3), which the refusal does not foreclose.

## 9. Key risks (for the review to interrogate)

- **R1 (retention).** P2 may be false — Daggerheart users may leave rather than self-host a pack. This is existential; instrument it early.
- **R2 (cold TAM).** P3 — entering the generic VTT market against Foundry/Roll20 is materially harder than owning a warm Daggerheart niche.
- **R3 (scope).** Abstracting dice/resource/range/encounter/content models is a large undertaking touching most of the app; the estimate must be honest.
- **R4 (legal residual).** Even a neutral importer + community pack has residual inducement/contributory risk if Daggerheart becomes the de facto flagship use; counsel sign-off (P4) is a gate, not a formality.
- **R5 (compliance vs. product speed mismatch).** The compliance clock (§Phase 0) is faster than the product build (Phases 1–2); we may ship a temporarily degraded product to stay compliant.

## 10. Open questions

- Suspend monetization on SRD tables immediately, or race a compliant house-system replacement first? (Counsel-dependent.)
- Rename the product now, or after the house system ships?
- House-system scope: minimum viable to prove all pack layers vs. something players actually want to run.
- Is a DRP partnership/engine-B2B pitch worth pursuing in parallel now, or only after the agnostic product proves itself?
