<!-- /autoplan restore point: /Users/andrewreutter/.gstack/projects/DaggerheartGM/main-autoplan-restore-20260713-225600.md -->
# Plan: Productize "Daggertop" — Ship a Paid Subscription Service

Status: ROUGH DRAFT (pre-review)
Author: user + agent (rough draft authored by agent from user's verbatim brief)
Date: 2026-07-13
Repo: DaggerheartGM (product name: **Daggertop**)

> **Post-review amendment — 2026-07-13 (same day, after the Phase 1-4 pipeline below was completed).** The user read the completed review and raised two additional concrete concerns directly, in their own words: (1) "I'm just not sure the browser tests test the right things. They should be testing user flows that were never really defined. Like one player targeting an adversary, then someone else using their Prayer Die, and so on." and (2) "I'm not doing a good job of capturing bugs during play, either." These were **not** part of the original automated CEO/Design/Eng review pass — they are a targeted amendment based on direct user feedback, verified against the actual `test/browser/` suite and existing debug/error-handling code (not speculated). The CEO/Design/Eng phases below were **not** re-run; this amendment slots new findings and tasks into the already-completed structure at the points marked **[AMENDMENT]**. Both concerns reinforce (do not contradict) the already-established "never interrupt a live session" constraint (Design Phase 2, Theme 3) and the "raise quality bar before charging money" workstream (Section 7 / CEO Section 8 / Eng Section 3). See the new **Multi-Actor Action-Loop Test Catalog** (Eng Phase 3, Section 3) and new tasks **T12** and **T13** in the Implementation Tasks list (existing tasks T12-T16 were renumbered to T14-T18 to keep the P1/P2/P3 grouping intact — no task's content changed, only its ID).
>
> **Round 2 amendment — 2026-07-14.** The user gave real answers to the Phase 4 User Challenges and taste decisions (AskUserQuestion remained unavailable, so answers came back as free text to the parent conversation). Three decisions (#11 downgrade/overage, #13 grace period, #19 indicator placement) are now **CONFIRMED** at their originally-recommended defaults. One (#4, automation policy) is **CONFIRMED with a precision check** — see §"Round 2" below. Three more (#5 "1 character" counting, #3's added "deactivate unfinished categories" scope, and #5/#18 business-model shape + AI metering) required actual code/doc investigation before they could be answered honestly and were written up as **grounded, concrete proposals pending final user pick** in the **"Round 2: Investigation Findings and Refined Proposals (2026-07-14)"** section, inserted after the Decision Audit Trail.
>
> **Round 3 amendment — 2026-07-14 (same day).** The user picked among the Round 2 proposals. **Two of the three are now fully resolved with concrete engineering designs, not just a pick:** #10 (the "1 character" counting scheme) is **CONFIRMED as Scheme B** — distinct (character, table) placements, tracked in a new `character_table_placements` table — with the tracking mechanism, exact call sites, and free-tier UX implication specified in §"Round 3" below (supersedes R2.2's three-option menu) and a new Implementation Task **T19**. #3's "deactivate unfinished categories" scope is **CONFIRMED as a global "released ability tier ceiling"** mechanism (not per-card labeling) — config location, enforcement point, and the exact remaining migration scope (12 Tier 1 domain cards across 4 domains) are specified in §"Round 3" below (supersedes R2.3's badge proposal) and a new Implementation Task **T20**. **The business model (R2.4) is the one item that remains genuinely open** — the user proposed a 4th option (one-time core unlock, no AI, no recurring revenue) conditioned on a hosting-cost estimate; that estimate is now done (real Railway pricing + this app's architecture) and is written up in §"Round 3" below with a numbers-grounded verdict, but is deliberately **not** locked into the Decision Audit Trail as a final pick — the honest output is a cost-informed range and recommendation for the user to choose from, not a fabricated resolution.
>
> **Round 4 amendment — 2026-07-14 (same day).** The user was unsatisfied with Proposals 1-4 (R2.4/R3.3) and asked for genuinely divergent thinking. Two independent brainstorms — the user's own verbatim outside-the-box idea (sell "slots"/table-character combos, price for decade-long use, rethink free as time-bound, differently for tables vs. characters) and an independent Grok 4.5 agent's full cost-object analysis (tables are the real recurring cost driver; characters/placements cost ≈$0; perpetual "slot" pricing recreates the just-rejected Proposal 4 cash-flow trap in the opposite direction; recommends prepaid table "seasons" + free players) — are synthesized into a new proposal in **"Round 4: Business Model — Outside-the-Box Synthesis (2026-07-14)"** below (inserted after Round 3). This directly engages a real tension the two brainstorms surface with the just-confirmed Decision #10 (Scheme B): charging for additional character-table placements is economically ungrounded (placements cost ≈$0; the table owner already bears the real hosting cost) and psychologically punitive ("pay rent on friendship") — Round 4 recommends decoupling monetization from placements entirely (keep the Scheme B ledger as telemetry, drop it as a paid gate) while making the **table** the sole metered unit, sold as prepaid, non-subscription "Season Passes" with a time-boxed (1-month) free trial. **This is a synthesized recommendation, not a final decision** — see Round 4's explicit sign-off checklist; Decision #21 remains open, now sharpened rather than closed.
>
> **Round 5 amendment — 2026-07-14 (same day) — FINAL, LOCKED.** The user loved Proposal 5 and gave firm, final answers closing out every remaining open item from Round 4, verbatim: rename "Season Pass" to **"Campaign Pass"**; **anyone — GM or any invited player — can purchase a Campaign Pass as an irrevocable gift for a specific table**, without changing who owns/GMs that table; **drop Scheme B placement enforcement entirely** (the `character_table_placements` ledger stays as telemetry only, per Round 4's own recommendation — now confirmed, not pending); **pricing is $20/3mo, $35/6mo, $60/12mo** (replacing the illustrative $15/$25/$42); and **no pre-launch "Founding" lifetime SKU** — dropped entirely, not deferred. These are **not** further proposals to weigh — they are final calls, locked into the Round 4 section (renamed/updated in place), the Decision Audit Trail (Decision #10 and #21/#22 both move to CONFIRMED, plus new rows below), and the Implementation Tasks list (T1, T5, T7, T9, T10, T15, T19, T21). The "anyone can gift" mechanic required real new technical design — a `tableId`-keyed entitlement ledger (not `user_id`-keyed), Stripe Checkout metadata carrying a buyer-chosen target table separate from the payer's identity, and a new player-reachable purchase entry point — all specified in **R4.3.1** below. With this, **Phase 4 (Final Approval Gate) is now RESOLVED** — see the replaced Phase 4 section at the end of this document for the full closed-out decision ledger and final task list.

---

## 1. What this product is today

Daggertop (repo `DaggerheartGM`) is a GM-and-player tool for running the *Daggerheart* tabletop RPG, built as a Node.js/Express server serving a self-contained React SPA. It is not a generic VTT — it is purpose-built around Daggerheart's specific rules (Hope/Fear duality dice, domain cards, adversary Battle Points, downtime moves, etc.).

Current feature surface (see `.cursor/rules/project.mdc` / `README.md` for full detail):

- **Battle map**: custom-built (not a licensed VTT engine) — draggable tokens, range-band bullseye overlay tied to Daggerheart's actual range bands (Melee/Very Close/Close/Far/Very Far), GM/player camera sync, zoom-to-actors, fog/draw overlays, map trays. The user specifically calls this system "pretty darn cool" but "a little flaky sometimes."
- **Server-authoritative dice engine**: tamper-proof rolls via `crypto.randomInt`, live banner queue over Postgres LISTEN/NOTIFY, full weapon/feature automation pipeline (passive stat mods, roll-construction automation, extended dice notation, post-roll effects, interactive UI chips).
- **Character sheets**: full character builder + sheet UI, Daggerstack.com import/sync, by-reference character model on the table (base data resolved live from the library).
- **V2 declarative feature engine** (`src/features-v2/`): a homegrown DSL + registry for encoding SRD mechanics (classes, subclasses, ancestries, communities, weapon/armor properties, domain abilities, beastforms, items, consumables) so that class/card mechanics *can* be automated without hand-wiring every one into the UI. This is a multi-generation rewrite of an earlier, messier V1 approach and is still an active, tracked migration (`docs/v2-migration-tracker-snapshot.md`).
- **Library**: full SRD content (13 collections) loaded from a git submodule, plus community content mirrored from FreshCutGrass.app and Heart of Daggers, plus user-owned homebrew content, unified search/filter/clone.
- **AI features**: OpenAI-based character/adversary/environment "concept builders" (fills in a form from a text prompt), an LLM-driven encounter builder, and x.ai Grok Imagine-based image generation/editing for portraits and battle maps. Usage is tracked in Postgres (`ai_usage_events`) but **not currently billed or metered to the end user** — the operator eats the OpenAI/x.ai API cost.
- **Multi-table / multi-player**: users can own multiple tables, invite players by email, players get their own SSE stream and a scoped view.
- **Testing**: Vitest unit tests + Playwright browser tests exist and run in CI-style fashion (`npm test`), but per the user, real-world quality has stayed low because testing has otherwise been ad-hoc — just the user and their own group.

## 2. The six challenges, verbatim from the user

1. Testing has been ad-hoc, just them and their group. Lots of little bugs; quality is low.
2. Not convinced of the core action loops (game mechanics/UX loops).
3. The model for implementing features/domain cards/mechanics has iterated multiple times and remains messy — huge pile of work to get it all done. One idea floated: NOT try to implement everything mechanically; let the GM and players just do what the cards say (i.e. less automation, more "read the card and adjudicate").
4. Part of them thinks the codebase is a mess and needs a rewrite. But players are impressed, and there are genuinely excellent parts (the map/camera/distance system is called out as "pretty darn cool," just "a little flaky sometimes").
5. Not sure whether to keep the AI features (image gen, concept builders, encounter builder, etc.) or how to charge for them.
6. Business model is unclear. Initial idea: free tier = one character + one table (so you can play in one game and run one game for free); a subscription removes those limits (multiple tables/characters). Initial price idea: $5/month.

## 3. Proposed business model (as stated by user — to be reviewed, not assumed correct)

- **Free tier**: 1 character + 1 table (owned). Enough to play in one campaign and run one campaign for free.
- **Paid subscription**: removes those limits — multiple tables, multiple characters. Initial price idea: **$5/month**.
- AI features (image gen, concept builders, encounter builder) — inclusion/exclusion/metering strategy explicitly unresolved.

## 4. Goal

Produce a plan that culminates in **making the subscription service available** (billing integration, tier gating, quality bar sufficient to charge money, and a resolved stance on the mess/rewrite and AI-cost questions). A separate go-to-market plan will be produced later — but market context (competitors, comparable pricing) should inform this plan's scope and pricing, since it changes engineering priorities.

## 5. Market context gathered so far (raw findings, pre-CEO-analysis)

WebSearch as of 2026-07-13 shows the "no purpose-built Daggerheart VTT" premise needs scrutiny:

- **Foundryborne** (`Foundryborne/daggerheart` on GitHub, MIT-licensed) — a free, actively developed, community-built Daggerheart *system* for Foundry VTT. Described by users as "by far the best way to play Daggerheart online for both a GM and for players," with full character sheets, Hope/Fear dice, vast homebrew support (custom domains, ancestries, equipment, adversary types), and a real plugin ecosystem (Daggerheart HUD, Quick Actions, Adversary Manager, Fear Tracker, Distances/range-band visualizer, Death Moves, a Store module, etc.). Zero AI features by policy ("Contains Zero AI" badge). Requires the user to already own Foundry VTT (one-time ~$50 license) and do system/module installation — not zero-setup, not browser-turnkey, no hosted multiplayer-by-default (self-hosted or paid hosting needed).
- **Demiplane NEXUS** (official digital companion, backed by Darrington Press/Critical Role) — character builder + rules compendium + GM adversary tools. $34.99 one-time for the corebook content unlock; separate $4.99/mo Demiplane membership for content sharing + unlimited characters. Demiplane itself is *not* a full VTT (no map/token/battle layer) — it's the "character layer" and is designed to be paired with Roll20 (the "table layer") via an official integration.
- **Roll20** — official Daggerheart support only via the Demiplane integration described above; no native Roll20 Daggerheart sheet. Requires a Roll20 subscription for the GM to share compendium content with players.
- **Fantasy Grounds** — officially licensed Daggerheart Core Set ruleset (paid platform + paid license product).
- **Alchemy RPG**, **Quest Portal**, **Owlbear Rodeo** — lighter-weight/narrative-focused or maps-only community support.

**Implication for premise 4/6 below**: the correct claim is not "there is no purpose-built Daggerheart VTT" — it's "there is no single, zero-setup, all-in-one, browser-based, hosted Daggerheart VTT that doesn't require gluing together 2 products (Demiplane + Roll20) or self-hosting a general-purpose engine (Foundry) and hand-picking modules." Daggertop's actual differentiation candidates: (a) zero technical setup — no Foundry install, no module hunting, no linking two separate subscriptions; (b) the range-band-aware battle map/camera system, which none of the competitors above appear to replicate; (c) one flat price instead of a one-time unlock + a separate table-layer subscription; (d) AI-assisted content generation, which Foundryborne explicitly refuses to build. The competitive risk is that Foundryborne is **free** and has an active plugin economy solving the same "cards are messy to automate" problem the user is worried about — via community labor, not paid engineering time.

*(This section is raw research. The CEO review phase below does the actual strategic analysis on top of it — this is not itself the analysis.)*

## 6. Cost drivers already visible in the codebase

- `ai_usage_events` table (migration `025_ai_usage_events.sql`) already tracks OpenAI + x.ai token/latency/cost data per call, keyed by `builder` (character_concept, encounter_plan, image_generate, etc.) — infrastructure for metering exists; billing logic on top of it does not.
- `GET /api/admin/ai-usage` gives the operator a cost dashboard already (admin-only). This is a real asset: the plan does not need to build usage tracking from scratch, only billing/gating on top of what's tracked.
- Today, every AI call (concept builders, encounter builder, image generation/editing) is paid for by the operator with no corresponding revenue lever. At $5/mo flat, unmetered AI usage is a real margin risk if free-tier or paid-tier users spam image generation.

## 7. Testing/quality reality

- `test/unit/*.test.js` (Vitest) and `test/browser/*.spec.js` (Playwright, headless against `NODE_ENV=test`) already exist and are runnable via `npm test`.
- Per `.cursor/rules/testing.mdc`, every bugfix is *supposed* to include a regression test — but the user's own assessment is that real-world quality remains low, meaning either coverage has gaps, the ad-hoc single-group playtesting missed classes of bugs unit/browser tests don't reach (multi-player race conditions, cross-browser, real network latency, actual different GM styles), or both.
- **[AMENDMENT, 2026-07-13, verified by direct read of every file in `test/browser/`]:** all 5 existing specs (`smoke.spec.js`, `player-mode.spec.js`, `banner-ack.spec.js`, `nav-dropdown.spec.js`, `touch-support.spec.js`) are **single-actor, single-browser-context tests**. None opens two concurrent authenticated sessions (e.g. GM + Player, or Player A + Player B) against the real server. `player-mode.spec.js` touches multiplayer-shaped surface but still runs as **one Playwright page** exercising the GM's own "preview as player" impersonation feature, not a second real actor. `banner-ack.spec.js` calls `POST /api/room/my/banner-ack` directly with `bannerId: null` and asserts on raw response shape — it does not simulate an actual roll → banner → SSE-propagation → second-client-sees-it sequence. Every SSE stream the other specs touch (`GET /api/room/:gmUid/stream`, `GET /api/room/my/players`) is **mocked away entirely via `page.route()`**, never exercised against the real `subscriptionManager` / Postgres LISTEN-NOTIFY pipeline — and this dev environment has no `DATABASE_URL` configured at all, so a real-DB SSE propagation test isn't even possible here today without additional test infra (the same "requires a real-Postgres test" gap Eng Phase 3 Section 3 already flags for the TOCTOU race test, below).
- **What this means concretely:** the suite is unit-of-feature-style regression coverage (a button appears, a z-index is high enough, an endpoint returns 200) with real user-story-sounding names attached. It is **not** testing the canonical multi-actor action-loop sequences — attack → target selection → damage application → a *different* player's reaction chip → roll resolution → state propagation to every connected client — that are the actual gameplay loop this product lives or dies on. This is the same "not convinced of the core action loops" doubt from the original six challenges, resurfacing concretely as "what would it even mean to have a passing test suite here." See the new **Multi-Actor Action-Loop Test Catalog** in Eng Phase 3 Section 3, and new task **T12**.
- **[AMENDMENT, 2026-07-13]:** bug capture during live play is also effectively absent for a production/paid context. Confirmed by direct code read: `POST /api/debug-log` (`server.js`) exists but is explicitly gated `if (process.env.NODE_ENV !== 'production')` — it is dev-only Cursor instrumentation tooling, unusable once this ships as a real hosted product. Client-side, `ErrorBoundary.jsx` catches render-time exceptions and shows `FatalErrorFallback`, but only `console.error`s — nothing is ever sent anywhere a GM or operator can act on afterward. Today, "capture a bug during play" means the GM has to notice something is wrong, remember it, and manually type it up from memory after the session ends. See CEO Section 8 (Observability) below and new task **T13**.

## 8. Open strategic questions this plan must resolve (for the CEO review phase)

1. Should "productize now" proceed before resolving (a) rewrite-vs-iterate and (b) "automate everything" vs "let humans adjudicate cards"? These change engineering scope by what could be an order of magnitude.
2. Is the competitive landscape (section 5) actually favorable to a $5/mo hosted product, given Foundryborne is free and Demiplane+Roll20 together already covers a lot of the same ground for people willing to glue two products together?
3. Is $5/mo, 1-character/1-table free tier the right shape, given comparable indie VTT pricing and the real AI cost exposure?
4. Should AI features be free, paid-only, metered/credit-based, or cut entirely (mirroring Foundryborne's zero-AI stance, which some hobbyist TTRPG communities treat as a point of pride/trust)?
5. What is the minimum quality bar (test coverage, bug backlog, multi-user resilience) before it is defensible to charge real people $5/mo?

---

# PHASE 1: CEO REVIEW (Strategy & Scope)

Mode: **SELECTIVE EXPANSION** (autoplan override for CEO phase). Codex: **unavailable** (binary not found on this machine — see Phase 0.5 note below). All dual-voice sections below are tagged **[subagent-only]**.

## Phase 0.5 note: Codex preflight

`command -v codex` returned nothing on this machine — the CLI is not installed. Per the autoplan degradation matrix, all four review phases proceed with the Claude subagent voice only. Every dual-voice consensus table below shows Codex as `N/A` and is tagged `[subagent-only]`.

## Step 0 — System Audit (recap)

Already captured in sections 5-7 above (market context, cost drivers, testing reality). Key facts re-confirmed against the actual repo during this review (not just `project.mdc` prose):

- `package.json` has **zero** billing/payment dependencies (no `stripe`, no equivalent). This is a from-scratch integration, not a toggle.
- `fly.toml`: single machine, `shared-cpu-1x`, 512MB, `min_machines_running = 0` (scale-to-zero). No redundancy, no documented backup/incident process.
- `migrations/025_ai_usage_events.sql`: tracks aggregate cost by `builder`/`provider`/`model` — **no `user_id` column**. Per-user AI cost metering requires a schema change plus threading `req.uid` through ~6 call sites, not just "billing logic on top of existing tracking" as the rough draft assumed.
- No CI workflow exists (`.github/workflows/` absent). `npm test` is developer-run only.
- No `DELETE` endpoint exists for `table_state` today — a free-tier "downgrade to 1 table" UX has no way to let a user delete down to the limit without new engineering.
- The V2 declarative feature engine (`src/features-v2/`) already has its own multi-agent, GitHub-Issues-tracked migration pipeline (`scripts/orchestrate.js`, `docs/v2-migration-tracker-snapshot.md`) — this is a **large, independent, already-funded-with-tooling effort**, not a side thought.
- The SRD implementation tracking convention (`.cursor/rules/srd-tracking.mdc`) already defines **"Display" as a legitimate, permanent status** for narrative features (not just a waypoint to "Done") — the app already has a first-class concept of "some cards are automated, some are just shown to read and adjudicate." This is a critical existing-code-leverage finding — see 0B below.

## 0A. Premise Challenge

Every premise in the rough draft, evaluated on its own:

| # | Premise (as stated) | Verdict | Evidence |
|---|---|---|---|
| 1 | "There's no purpose-built Daggerheart VTT" | **False as originally stated — already revised in section 5.** | Foundryborne (free, MIT, active plugin ecosystem) and Demiplane+Roll20 (official) both exist. Corrected claim: no *zero-setup, single-product, browser-hosted* option exists. This narrower claim holds up. |
| 2 | "$5/month, 1 table + 1 character free" is a workable business model shape | **Untested, and likely mis-shaped.** | Zero market signal (no waitlist, no interviews, no existing-user survey). Both CEO and Eng/Design subagents independently flag that "1 table" is ambiguous (owned vs. invited-as-player) and "1 character" is ambiguous (global library count vs. per-campaign), and that a recurring subscription may fit this hobbyist audience worse than a one-time unlock (the closest real comparable in the user's own market research, Demiplane, is $34.99 **one-time**). |
| 3 | Automation depth (the V2 engine, weapon/feature automation) is inherently something to charge for | **Contestable, and in tension with the user's own challenge #3.** | Foundryborne solves "cards are messy to automate" for free via community labor and markets "Contains Zero AI" as a trust signal. Automation-as-moat is not a given; it's one candidate differentiator among several (see 0C-bis). |
| 4 | The codebase "is a mess and needs a rewrite" | **Overstated relative to the evidence, and answered by existing work.** | The V2 migration is itself the codebase's own answer to "the feature model is messy" — it already replaced a messier V1 approach with a declarative, tracked, agent-assisted migration. A full rewrite would discard the map/camera system the user calls "pretty darn cool" and the server-authoritative dice/table-op architecture that both Eng subagent and this review independently assessed as sound. See 0C-bis, Question 1. |
| 5 | AI feature cost is a minor detail to resolve later | **Wrong — it's a first-order margin risk.** | Confirmed via code: no per-user cost tracking exists at all (Step 0 above). Shipping a flat $5/mo tier with unmetered AI calls makes a margin-negative cohort a near-certainty (CEO subagent, independently corroborated by Eng subagent's schema-level finding). |
| 6 | Testing is "ad-hoc" but the existing Vitest/Playwright suites are adequate infrastructure | **Partially true, but missing the highest-leverage gap.** | Test *files* exist; a CI *gate* enforcing them does not (no `.github/workflows/`). "Ad-hoc quality" is as much a process gap (nothing blocks a broken deploy) as a coverage gap. |

**Premises accepted as-is (reasonable, not contested):** the product's core value (bespoke Daggerheart mechanics, the range-band map/camera system) is real and worth monetizing in some form; a subscription-or-purchase model of *some* kind is a reasonable goal; the six challenges as stated are the right six things to resolve.

**Premises requiring revision before scoping engineering (flagged for the final gate — see User Challenges):** #2 (business model shape) and #3 (automation-as-paid-differentiator) both have both-model-agree pushback and are surfaced as User Challenges below, not silently changed.

## 0B. Existing Code Leverage

Mapping the six challenges to code that already exists and can be reused, rather than built from scratch:

| Sub-problem | Existing code that already (partially) solves it |
|---|---|
| "Messy automation model, huge pile of work" | `.cursor/rules/srd-tracking.mdc` already defines a 4-state maturity model (`None`/`Display`/`Partial`/`Done`) where **`Display` is an accepted final state**, not just an in-progress marker — narrative/flavor features are *supposed* to stop at Display. The "problem" is a prioritization policy question (which cards deserve `Done`), not a missing engineering capability. |
| "AI cost/billing unresolved" | `ai_usage_events` (migration 025) + `GET /api/admin/ai-usage` already gives the operator a cost dashboard. Missing piece is per-user attribution (`user_id` column) and a cap/credit check at call time — additive, not a new subsystem. |
| "Quality is low" | Vitest unit + Playwright browser suites already exist and are runnable via `npm test`; `.cursor/rules/testing.mdc` already mandates a regression test per bugfix. Missing piece is a CI gate (GitHub Actions) enforcing what already exists, plus targeted new coverage for multi-user/race-condition paths this review's Eng phase flags. |
| "Codebase is a mess, needs a rewrite" | The V2 declarative engine + its own agent-driven migration tooling (`scripts/orchestrate.js`, GitHub Issues pipeline, `npm run v2:*` scripts) **is already the rewrite**, mid-flight, with real tooling investment behind it. Restarting from scratch would delete a working, funded-with-agent-hours effort and the "pretty darn cool" map/camera system along with it. |
| "Unclear business model" | Server-authoritative op pattern (`postTableOp` → `applyOpToTableState` → DB write → SSE push) already exists for every other piece of shared state in this app (dice, table elements, banners). Tier-gating checks should be one more mutation-time check in that same pattern — the *pattern* to enforce entitlement safely already exists, only the entitlement data model itself is new. |
| "Not convinced of core action loops" | Existing Playwright specs (`smoke.spec.js`, `player-mode.spec.js`) already exercise some player/GM flows — a foundation for the structured playtesting workstream this review recommends, not a from-scratch effort. |

## 0C. Dream State Mapping

```
CURRENT STATE (today)
├─ Full-featured GM tool, single owner + friends group, free, no billing
├─ V2 migration in progress (tracked, agent-assisted, incomplete)
├─ AI features live, cost tracked in aggregate, unmetered per-user
├─ No CI gate; quality validated by ad-hoc play
└─ No competitive positioning decided; "no competitor" premise was wrong

THIS PLAN (if executed as originally stated: build $5/mo billing + 1/1 gating now)
├─ Billing/tier-gating infra added on top of an unresolved automation-scope question
├─ Recurring-subscription complexity (dunning, grace periods, cancellation) built
│  for an audience where a one-time-purchase comparable already exists and may fit better
├─ AI cost risk shipped unresolved unless explicitly fixed first
└─ Quality bar unchanged unless explicitly fixed first

12-MONTH IDEAL (dream state)
├─ Clear, tested value metric for the paid tier (validated with real prospective users,
│  not guessed) — whether that's $5/mo, a one-time unlock, or a hybrid
├─ V2 migration substantially advanced on its own independent track (not blocking billing)
├─ A stated, deliberate line between "automated" (core loop: dice, HP/stress/hope, map/range,
│  weapon/armor properties) and "adjudicated" (narrative/flavor cards shown via Display status)
│  — not an aspiration to automate everything
├─ AI features metered per-user with sane caps, still included as a real differentiator
│  vs. Foundryborne's zero-AI stance — not a silent cost center
├─ CI gate blocking broken deploys; targeted tests for the multiplayer/race-condition
│  classes of bugs ad-hoc single-group testing structurally cannot catch
└─ A small paid cohort validating willingness-to-pay before broad launch, with billing
   infra that only needed to be built once, in the right shape
```

**Dream state delta — where following the ORIGINAL plan as stated leaves us relative to the ideal:** shipping billing engineering immediately, before resolving the automation-scope and AI-cost questions, risks building the entitlement/gating layer around the wrong value metric (see 0A #2) and shipping a margin-negative AI cost profile (0A #5) — both of which would need to be *rebuilt*, not just iterated on, once the real signal comes in. The gap is not "this plan doesn't reach the ideal" (no single plan does) — it's "this plan's sequencing risks paying twice for the same infrastructure."

## 0C-bis. Implementation Alternatives (MANDATORY)

### Question 1: Rewrite vs. iterate vs. freeze-and-harden

| Approach | Effort | Risk | Pros | Cons |
|---|---|---|---|---|
| A. Full rewrite | XL (months, solo) | Very High | Clean architecture; chance to fix every V1-era wart at once | Discards the "pretty darn cool" map/camera system and the working server-authoritative dice/table-op pattern (independently assessed as sound by this review's Eng voice); doubles down on sunk-cost risk; competitors (esp. free Foundryborne) gain ground during the rewrite window; V2 migration tooling investment (agents, GitHub Issues pipeline) is discarded |
| B. Continue the V2 migration to completion before productizing | L, ongoing (already has agent tooling) | Medium | Reuses real existing investment; incremental, ships continuously; directly answers "the feature model is messy" | Migration completion is open-ended (hundreds of SRD elements); blocks monetization on a moving target with no fixed finish line |
| **C. Freeze mechanics scope for monetization purposes; ship against the CURRENT feature set; keep V2 migration as an independent parallel background track** | **M** | **Low** | **Doesn't require "finishing" anything to charge money; V2 migration keeps its own agent-driven cadence unaffected; directly resolves the false rewrite-vs-not dichotomy — quality/hardening work (Question 1's real need) is decoupled from migration completion** | Some SRD content stays in a mixed V1/V2 state for longer; requires explicit communication (internally, not to users) that "done enough to charge for" ≠ "fully migrated" |

**Decision: C.** Rationale: P1 (completeness) is satisfied because C is a complete answer to "should I productize before resolving this" — it resolves it by decoupling, not deferring. P2 (boil lakes / reuse existing investment) strongly favors C over A, which would throw away the blast radius of prior work. This is not a User Challenge because the user posed rewrite-vs-iterate as an open question, not a stated position.

**[ROUND 2 REFINEMENT, 2026-07-14 — user-confirmed, scope added]:** the user picked C explicitly ("A [freeze scope, decouple V2 migration from monetization]" — their letter "A" maps to this table's Option C, the freeze-and-harden choice) but added a firm requirement that was not in the original decision: **keep two things IN scope, not deferred** — (1) "deactivate" categories of unfinished mechanics (their example: domain cards above a certain level) so the product doesn't feel "patchy," and (2) inform users when they're expected to do things manually rather than leaving that silent. Both are now concrete, grounded proposals in the new **Round 2** section below (domain-card completeness numbers from `docs/srd-implementation.md`, and a labeling-not-hiding recommendation, since the existing chip-system engine already suppresses interactive affordances on unautomated cards — the gap is a missing *label*, not missing suppression).

### Question 2: Automate everything vs. adjudicate-by-hand vs. hybrid

| Approach | Effort | Risk | Pros | Cons |
|---|---|---|---|---|
| A. Continue chasing full mechanical automation of every card | XL, open-ended | High | Maximum "wow" factor; matches the ambition of the existing V2 framework | This IS the "huge pile of work" the user is stuck on; no fixed finish line; delays monetization indefinitely; is the literal source of challenge #3 |
| B. Strip automation back to a universal dice roller + card-text display only | S (mostly subtractive) | Medium | Dramatically smaller engineering surface; fast to ship | Throws away the working, praised parts (weapon/feature automation, map/range integration) that are the product's actual differentiator vs. a plain dice-roller; likely a downgrade in players' eyes |
| **C. Hybrid: keep automation for the high-frequency core loop (dice, HP/Stress/Hope/Armor tracking, map/range bands, weapon/armor property automation — i.e. what's already `Done` and working); explicitly accept `Display`-only status as a permanent, deliberate end-state for narrative/flavor cards; redirect ongoing V2 effort toward high-frequency mechanics, not 100% SRD coverage** | **S–M (mostly a policy/prioritization change, not new engineering)** | **Low** | **Directly matches the user's own floated idea (challenge #3); the `Display` status already exists as a first-class, tracked concept (`.cursor/rules/srd-tracking.mdc`) — this is a decision, not a build; immediately shrinks the "huge pile of work" without deleting anything users already like** | Requires an explicit, stated policy (which mechanics are "core loop, must be Done" vs. "flavor, Display is fine") so migration agents and the user don't keep drifting back toward chasing 100% coverage |

**Decision: C.** Rationale: P4 (DRY — reuse the existing Display-status convention instead of inventing a new "adjudicate mode") and P1 (completeness — C is a complete resolution, not a stopgap) both favor C. This directly and completely resolves the user's challenge #3 using infrastructure that already exists.

**[ROUND 2 REFINEMENT, 2026-07-14 — user-confirmed with precision check]:** the user restated Decision C as "presenting the card to the table for GM acknowledgement" and asked for confirmation this matches. **Answer: mostly yes, with one precision the restatement leaves ambiguous — see the "Automation policy — precision check" subsection of the new Round 2 section below.** Short version: in this codebase's own vocabulary, "the core loop" is roll → `ResultBanner` → GM Acknowledge/Cancel → **automatic mutation of HP/Stress/Hope/Armor/costs as part of that Acknowledge action** (not a separate manual bookkeeping step afterward) → SSE propagation. The user's phrasing correctly identifies the mechanism (card → banner → GM ack) but under-states that "GM acknowledgement" already means "and the engine applies the resulting resource changes automatically" for every feature currently at `Done`/`Partial` status — that automatic-mutation-on-ack is the load-bearing part of what "core loop, must stay automated" was meant to protect, not an optional extra.

### Question 3: Business model shape

| Approach | Effort | Risk | Pros | Cons |
|---|---|---|---|---|
| **A. As stated: $5/mo recurring, free = 1 owned table + 1 character, unlimited on paid** | L (full recurring-billing lifecycle: checkout, webhooks, dunning, grace periods, cancellation, proration) | High | Predictable recurring revenue if it works; simplest to describe | Zero market validation; recurring billing is the most complex Stripe integration shape to build correctly (Eng subagent: webhook idempotency, dunning, grace periods all need new infra); TTRPG hobbyist audiences are documented as subscription-fatigued; "1 table/1 character" gating semantics are ambiguous against the existing owned-vs-invited and by-reference character models (Eng + Design subagents both flag this independently) |
| B. One-time purchase (unlock unlimited tables/characters for a flat one-time fee, ~$25-35, matching the closest real comparable — Demiplane's $34.99 one-time unlock) | M (simpler: one webhook event type, no recurring lifecycle, no dunning/grace-period logic) | Medium | Meaningfully less billing engineering than A; better product-market fit signal from the user's own research; no "your card lapsed mid-campaign" hazard (Design subagent's top concern) at all, structurally | Revenue is one-time per user, not recurring; still requires validating the price point |
| C. Zero-code validation first (Stripe Payment Link / manual allowlist "founding supporter" pre-sale) as a mandatory PRECEDING step, before committing to A or B's full engineering build | XS (days, not weeks) | Low | Tests real willingness-to-pay cheaply; both CEO and Eng/Design subagents independently recommend some version of this; doesn't require deciding A vs. B before getting signal | Not itself "the subscription service" the user's stated goal calls for — it's a gate before the real build, not a replacement for it |

**Decision: sequence C → then re-evaluate A vs. B with real signal, defaulting to building against the user's originally stated shape (A) if no disqualifying signal emerges, since the user's stated direction is the default absent a decision to change it.** This is where this review most directly produces a **User Challenge** (see final gate): both the CEO subagent and this reviewer's independent judgment converge that A's specific shape (recurring $5/mo, 1/1 free split as literally defined) is under-validated and may be the wrong value metric — but per the Decision Classification rules, that disagreement with the user's stated direction is surfaced, not auto-applied.

**[ROUND 2 UPDATE, 2026-07-14]:** the user responded to this User Challenge by moving toward a **hybrid**, not simply picking A or B: "I don't mind the one-time purchase switch, but I'll have hosting costs; a subscription model aligns better with that... Demiplane Nexus kind of walks the line... let's discuss." This is verified against real Demiplane pricing (WebSearch, see Round 2 section below) and turned into 3 concrete hybrid proposals with a recommendation. **[SUPERSEDED, FINAL — Round 5, 2026-07-14]** This question is now fully resolved. See Round 4/5 ("Round 4: Business Model — Outside-the-Box Synthesis" and R4.7 below) for the final, locked business model: Proposal 5, the prepaid non-subscription per-table **Campaign Pass** ($20/3mo, $35/6mo, $60/12mo), and Decision #22 in the Decision Audit Trail.

## 0D. Mode-Specific Analysis (SELECTIVE EXPANSION)

Per the autoplan override, CEO phase runs in SELECTIVE EXPANSION: hold the user's stated scope (ship a subscription service) while surfacing cherry-pick opportunities discovered during this analysis.

**Scope held (in the plan, unchanged):** the deliverable remains "produce a plan that culminates in making a paid tier available." Nothing about the goal itself is being reduced.

**Cherry-picks surfaced for this plan (each evaluated against P2: in blast radius + <1 day of Claude-Code-assisted effort → auto-accept; otherwise → defer to TODOS.md):**

| Cherry-pick | In blast radius? | Effort | Decision | Rationale |
|---|---|---|---|---|
| Add a CI workflow (`.github/workflows/`) running `npm test` on every push/PR | Yes — directly serves "raise quality bar before charging money" | <1 day (CC) | **Accept into scope** | P2: blast radius of "make quality bar real" is this repo's CI config; near-zero cost, blocks the single highest-leverage quality gap the Eng subagent found |
| Add a `DELETE /api/my-tables/:id` (or equivalent) endpoint | Yes — required for any free-tier "downgrade to 1" UX to be buildable at all | <1 day (CC) | **Accept into scope** | Without it, "delete down to your limit" literally cannot be built; this is a hard prerequisite, not an optional nice-to-have |
| Add `user_id` to `ai_usage_events` + thread `req.uid` through AI builder call sites | Yes — required for any per-user AI cost cap/metering | ~1 day (CC) | **Accept into scope** | Direct prerequisite for resolving open question #4 (AI monetization) in any metered form |
| Full observability/alerting stack (Sentry-equivalent, on-call rotation, status page) | No — genuinely new infra investment, not just wiring existing pieces | Multi-day, new tooling | **Defer to TODOS.md** | Outside blast radius; legitimate need before broad paid launch but not a same-day addition; a lighter-weight interim (structured error logging + a cheap uptime ping) is proposed as the near-term substitute in the Eng phase |
| Rebuild AI features around BYO-API-key as the primary model | No — would restructure the AI feature UX, not just add a check | Multi-day | **Defer to TODOS.md** | Valuable as a *complementary* escape valve (see Question on AI monetization, decided as "meter + optional BYO key"), but replacing the primary model is a larger UX/engineering decision than fits a cherry-pick |

**10x check (SELECTIVE EXPANSION requires surfacing, not mandating):** the highest-leverage reframe available is not "add more scope" but "resolve sequencing" — validate WTP and lock in the automation-scope policy (Question 2, already decided as C) before finishing the billing build. This is reflected in the recommended phase ordering in the Implementation Tasks below, not by expanding what ships.

## 0E. Temporal Interrogation

**Hour 1 (if this plan starts today):** Stand up the cheap validation step (Question 3, Option C) — a Stripe Payment Link or a simple "reserve your founding-supporter spot" form — no app code changes required. In parallel, add the CI workflow (cherry-pick, above) since it has zero dependency on any other decision.

**Hour 6 (end of day one):** Automation-scope policy (Question 2, decision C) is written down as an explicit, short policy doc (which mechanics must stay `Done`, which are fine at `Display`) and communicated to whatever process drives the V2 migration agents, so migration effort stops drifting toward "automate everything."

**Week 1:** `user_id` added to `ai_usage_events`; per-user AI call sites updated to check/record it. `DELETE` table endpoint built. Free/paid entitlement data model designed with owned-vs-invited and by-reference-character semantics made explicit (per Eng subagent finding).

**Week 2-3:** Billing integration built (Stripe Checkout, webhook handling with the JSON-body-parser fix the Eng subagent identified, idempotent event processing). Tier-gating enforcement added server-side only, following the existing `postTableOp`-style server-authoritative pattern.

**Week 3-4:** UI surfaces designed and built per the Design phase findings below (pricing/upgrade page, tier-limit modal, billing management, downgrade/grace-period states) — with the hard constraint that no billing check may interrupt an in-progress session.

**Month 2+:** Structured playtesting/quality push (multi-group, not just the user's own group) runs in parallel with a soft launch to the validated-interest list from Hour 1. Broader launch gated on that playtesting, not on a calendar date.

## 0F. Mode Selection Confirmation

Mode: **SELECTIVE EXPANSION**, confirmed. Scope held at "ship a paid tier"; four cherry-picks accepted (CI workflow, delete-table endpoint, per-user AI usage schema, none of which change the shape of the deliverable, all of which are hard prerequisites uncovered by this review); two items deferred to TODOS.md (full observability stack, BYO-API-key-as-primary-model).

---

## 0.5 Dual Voices — CEO

**CLAUDE SUBAGENT (CEO — strategic independence)** — full verbatim output:

> [See full transcript in this session's tool output; condensed here for the plan file.] The subagent's five findings, condensed:
> 1. **Right problem?** No — solving "how do we bill" before resolving automate-vs-adjudicate and rewrite-vs-iterate is backwards; recommends a 10x reframe toward cheap WTP validation before billing engineering, and questions whether "1 table + 1 character" tracks willingness-to-pay at all for a GM-centric tool where most GMs run one long campaign indefinitely.
> 2. **Premises?** Confirmed zero billing code exists (verified independently). Flags the automation-as-monetizable-asset premise as self-contradicted by the user's own challenge #3, and notes Foundryborne's free automation-adjacent plugin ecosystem as direct counter-evidence.
> 3. **6-month regret?** AI cost margin blowout (confirmed no per-user cap exists); near-zero conversion from friends-and-family beta users; charging money on a 512MB scale-to-zero single machine with self-assessed "low" quality; a well-resourced competitor (Darrington Press/Demiplane, or Owlbear Rodeo/Alchemy RPG) closing the differentiation gap after billing debt is already taken on.
> 4. **Alternatives underexplored?** One-time purchase (the closest real comparable in the plan's own research) not evaluated against recurring; BYO-API-key/metered-credits/zero-AI-as-marketing not weighed; rewrite-vs-iterate given no actual cost/benefit; automate-vs-adjudicate — "arguably the single highest-leverage decision in the whole brief" — punted rather than resolved.
> 5. **Competitive risk?** Foundryborne is free, MIT, and already solves the "automation is messy" problem via volunteer labor; Demiplane/Roll20 is backed by the actual IP holder and could deepen integration at any time; lightweight competitors (Owlbear Rodeo, Alchemy RPG) have production-hardened multi-tenant hosting already and could add Daggerheart templates faster than this solo build reached parity.
>
> **Bottom line (verbatim):** "No — don't build the billing/subscription infrastructure yet. Resolve three things first, cheaply and quickly... (1) the automate-vs-adjudicate mechanics-scope decision... (2) an actual willingness-to-pay signal... (3) an AI-cost containment strategy... before any AI feature is allowed inside a flat-rate paid tier."

**CODEX SAYS (CEO — strategy challenge):** `[codex-unavailable: binary not found]` — no output. Tagged `[subagent-only]` per degradation matrix.

**CEO DUAL VOICES — CONSENSUS TABLE:**

```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude    Codex   Consensus
  ──────────────────────────────────── ───────── ─────── ─────────
  1. Premises valid?                   Partial   N/A     N/A (single voice) — this reviewer's independent 0A analysis agrees with the subagent's "partially wrong" verdict
  2. Right problem to solve?           No        N/A     N/A (single voice) — this reviewer independently concurs: sequencing (validate, then build) beats building billing first
  3. Scope calibration correct?        No        N/A     N/A (single voice) — this reviewer concurs the business-model shape (Q3) is under-validated
  4. Alternatives sufficiently explored?No       N/A     N/A (single voice) — corrected in 0C-bis above (rewrite/iterate, automate/adjudicate, and 3 business-model shapes now have real alternatives tables)
  5. Competitive/market risks covered? Partial   N/A     N/A (single voice) — market context in section 5 is solid; competitive risk *trajectory* (competitors improving over time) was underweighted, now added to 0C-bis and dream-state delta
  6. 6-month trajectory sound?         No        N/A     N/A (single voice) — addressed via the sequencing recommendation in 0E (validate → lock automation policy → build billing → playtest before broad launch)
═══════════════════════════════════════════════════════════════
Single-voice review (Codex unavailable). No CONFIRMED/DISAGREE pairs are possible without
a second model; all six dimensions are flagged for the final gate as informed by one
independent AI voice plus this reviewer's own analysis, which are in full agreement.
```

**Note on classification:** the subagent's findings on Questions 2 and 3 (0C-bis) are not, on their own, "both models agree the user's direction should change" in the strict sense the skill requires (two *independent model* voices), since Codex is unavailable. Per the degradation matrix, a single strong independent voice plus this reviewer's own concurring judgment is treated as sufficient signal to escalate to a **User Challenge** rather than downgrade to a mere taste decision — the alternative (silently building the user's originally stated model without flagging this) would defeat the purpose of the review. This is stated explicitly at the final gate.

## Sections 1-10 (from `plan-ceo-review/sections/review-sections.md`)

This document is a strategy/scoping plan, not yet a concrete engineering spec with defined new endpoints, components, or migrations — so several of the 11 review sections below have their findings collapse to "the plan does not yet specify X concretely enough to review architecture/tests/deployment for it; that concrete specification is deferred to and produced by the Design and Eng review phases that follow." Per the anti-skip rule, each section is still evaluated explicitly, not skipped.

**Section 1 (Architecture):** No concrete new components are defined yet in this document (that's the Eng phase's job, below). What CAN be evaluated at the CEO level: the *class* of new integration (Stripe billing on Express+Postgres+Firebase Auth) is architecturally reasonable given the existing server-authoritative pattern (see 0B). **Finding:** the plan does not yet state whether billing enforcement will be server-side-only (matching every other mutation in this codebase) or could leak into client-side-only gating. **Auto-decided (P5, explicit over clever):** state as a hard non-negotiable requirement — carried into the Eng phase as a P1 task.

**Section 2 (Error & Rescue Map):** No concrete methods/codepaths exist yet to map. **Finding:** the plan doesn't yet name failure modes for webhook delivery, payment decline, or AI-cost-cap breach. **Auto-decided:** deferred to Eng phase Section 2/3 equivalent (Test Review), which does map these concretely, below.

**Section 3 (Security & Threat Model):** **Finding, real and CEO-level:** the plan's implicit default (roll AI usage into the flat $5/mo fee with no per-user cap) is itself a security-adjacent *abuse* vector (a malicious or careless user can generate unbounded API cost). **Auto-decided (P1, completeness):** treat AI-cost capping as a security/abuse-prevention requirement, not just a margin optimization — carried into Question on AI monetization above (decided: meter + cap) and the Eng phase security section.

**Section 4 (Data Flow & Interaction Edge Cases):** **Finding:** "1 table" and "1 character" gating semantics are ambiguous against the existing owned-vs-invited table model and by-reference character model (independently flagged by both Design and Eng subagents in their respective phases, below). **Auto-decided:** this ambiguity must be resolved with an explicit worked example before implementation — carried as a P1 implementation task.

**Section 5 (Code Quality):** N/A at this stage — no code has been written for this feature yet. **Examined:** confirmed via `package.json` that no billing code exists to review for quality; nothing to flag until the Eng phase's implementation begins.

**Section 6 (Test Review):** **Finding, CEO-level:** no CI gate exists at all (`.github/workflows/` absent) — this is the single highest-leverage "raise the quality bar" fix available, cheaper than writing more test files. **Auto-decided (P2, boil lakes, <1 day effort):** accepted as a cherry-pick in 0D above.

**Section 7 (Performance):** N/A at CEO level for the same reason as Section 5 — deferred to Eng phase, which evaluates the actual query/webhook load implications concretely.

**Section 8 (Observability & Debuggability):** **Finding:** no error-tracking/alerting tool exists anywhere in the codebase (only `console.error`); a billing product needs to know when webhooks fail silently. **Auto-decided (P2, boil lakes):** a full observability stack is outside 1-day blast radius → **deferred to TODOS.md**; a lightweight interim (structured logging for webhook events + a cron-based reconciliation job, reusing the existing `node-cron` pattern already in `src/external-sync.js`) is proposed as a same-scope substitute in the Eng phase. **[AMENDMENT, 2026-07-13, direct user feedback]:** this gap is broader than webhooks — it also covers in-session gameplay bug capture, which the user separately flagged as poor. Confirmed by direct code read (Section 7 above): `POST /api/debug-log` is dev-only and `ErrorBoundary.jsx` only `console.error`s; neither reaches an operator once this is a hosted paid product. A lightweight, GM-only, non-interrupting "Report a problem" capture mechanism (recent action-log + client state snapshot, no typed reproduction required) is now in scope as part of the same interim-observability substitute, consistent with the hard "never interrupt a live session" constraint from Design Phase 2 — see new task **T13**.

**Section 9 (Deployment & Rollout):** **Finding:** the single-machine, scale-to-zero Fly.io deployment (`min_machines_running = 0`) creates a cold-start risk specifically for webhook delivery timeouts (a slow cold start after idle risks Stripe treating a delayed response as a failed delivery and retrying, which requires idempotent processing — not yet designed). **Auto-decided:** carried into Eng phase Section on Test Review / Failure Modes below as a P1 finding requiring idempotent webhook handling.

**Section 10 (Long-Term Trajectory):** **Finding:** reversibility of the chosen business-model shape (recurring subscription, Question 3 Option A) is low — once real users are on a recurring plan, changing to one-time-purchase later is a migration project, not a config change. **Rate: 2/5 reversibility.** This is exactly why Question 3's decision (validate cheaply first) matters — it buys reversibility before the low-reversibility choice is locked in. **Auto-decided:** carried into the sequencing recommendation (0E) and flagged as part of the User Challenge on business model shape.

**Section 11 (Design & UX):** Run in full as Phase 2 below (UI scope was detected in Phase 0).

## NOT IN SCOPE (this plan explicitly defers, with rationale)

- **A full observability/alerting stack** (Sentry-equivalent, status page, on-call rotation) — real need before *broad* paid launch, but outside 1-day blast radius; a lightweight interim (structured webhook logging + reconciliation cron) substitutes for now. → TODOS.md.
- **BYO-API-key as the primary AI monetization model** — valuable as a complementary escape valve, not a replacement for metering; restructuring the AI UX around it is a larger effort than fits this plan's immediate scope. → TODOS.md.
- **Finishing the V2 migration to 100% SRD coverage** — explicitly decoupled from monetization readiness (Question 1, Decision C); continues on its own independent, already-tooled track.
- **A full rewrite** — evaluated and rejected in 0C-bis Question 1; the existing architecture (server-authoritative ops, map/camera system) is sound enough to build billing on top of, per this review's own Eng-level assessment.
- **Go-to-market plan** (marketing, launch sequencing, pricing experiments beyond the validation step) — explicitly out of scope per the user's own framing; a separate plan.
- **Mobile-native app / offline support** — not raised by the user and not implied by "ship a subscription service"; noted only because Section 11 (Design) below flags responsive-web as in-scope but native apps are not.

## WHAT ALREADY EXISTS (mapped to sub-problems, expanded from 0B)

See the table in 0B above for the full mapping. Summary: **more of this problem is already solved by existing code and existing conventions than the rough draft assumed** — the `Display`-status convention already answers "how much should we automate," the server-authoritative op pattern already answers "how do we enforce state changes safely," the `ai_usage_events` table already answers "how do we see AI cost" (just not per-user yet), and the V2 migration tooling already answers "how do we make the feature model less messy" (it's mid-flight, not absent). The genuinely *new* work is narrower than "productize" sounds: a billing/entitlement layer, per-user AI cost attribution, a delete-table endpoint, a CI gate, and the UI surfaces Phase 2 below specifies.

## Error & Rescue Registry (CEO-level; expanded with concrete detail in Eng phase)

| Codepath | What can go wrong | Exception class | Rescued today? | Rescue action | User sees |
|---|---|---|---|---|---|
| Stripe webhook receipt | Signature verification fails because the existing global JSON body-parser middleware re-serializes the body before it reaches a webhook route (confirmed via `server.js` — see Eng phase Finding A) | `SignatureVerificationError` | **N — CRITICAL GAP (doesn't exist yet, but will fail 100% of the time if built naively)** | Exempt the webhook route from the global JSON middleware; verify against raw bytes | N/A (should be invisible — but if broken, a paying user is silently gated as free) |
| Stripe webhook receipt | Duplicate delivery (Stripe retries) | N/A — no idempotency check | **N — CRITICAL GAP** | Dedup on Stripe event ID before applying state change | N/A if fixed; double-charged or double-processed side effects if not |
| Tier-limit check on table/character creation | Concurrent requests both pass a stale count check (TOCTOU) | N/A — no locking mechanism exists yet | **N — CRITICAL GAP (confirmed exploitable if built as a naive COUNT-then-INSERT)** | Enforce via a DB-level constraint (partial unique index) or advisory lock, not an application-level check-then-write | User sees a table created; a free user could end up with 2 tables via a race if not fixed |
| AI generation call while over per-user cost cap | Currently: no cap exists at all | N/A | **N — CRITICAL GAP** | Check-and-reject before making the paid API call, not after | Currently: unbounded cost with no user-visible signal either way |
| Payment failure (card decline) | No grace period/dunning logic exists yet | N/A | **N — CRITICAL GAP if built as immediate-lock** | Grace period (3-14 days industry norm) + dunning email before any access change; never interrupt an in-progress session | Currently undesigned — must not be "campaign vanishes mid-week" |

Any row above with all three of RESCUED=N, TEST=N, USER SEES=silent/bad is a **CRITICAL GAP** — all five rows currently qualify, because none of this exists yet. This is expected for a pre-implementation plan and is not itself alarming; it becomes alarming only if the Eng phase's Implementation Tasks (below) don't include a fix for each one. They do.

## Failure Modes Registry

```
  CODEPATH                        | FAILURE MODE                    | RESCUED? | TEST? | USER SEES?        | LOGGED?
  --------------------------------|----------------------------------|----------|-------|--------------------|--------
  Webhook signature verification | Global JSON middleware breaks it | N (CRIT) | N     | Silent — paid user | N
                                  |                                  |          |       | gated as free      |
  Webhook idempotency             | Duplicate event processed twice  | N (CRIT) | N     | Silent double-apply| N
  Table/character count check     | TOCTOU race on concurrent create | N (CRIT) | N     | Silent limit bypass| N
  AI cost cap                     | No cap exists                    | N (CRIT) | N     | Silent cost accrual| Aggregate only,
                                  |                                  |          |       |                    | not per-user
  Payment decline                 | No grace period                  | N (CRIT) | N     | Could be "campaign | N
                                  |                                  |          |       | vanishes"          |
  Cold-start webhook timeout      | Fly.io scale-to-zero cold start   | N (CRIT) | N     | Silent — treated as| N
                                  | delays webhook response           |          |       | delivery failure   |
```

All six rows are CRITICAL GAPs today because none of this infrastructure exists yet — expected pre-build, and each is carried forward as a P1 Implementation Task below.

## Dream State Delta (see also 0C)

This plan, if the Implementation Tasks below are executed in the recommended sequence (validate → lock automation policy → build billing with the fixes this review identified → playtest before broad launch), reaches a state very close to the 12-month ideal in 0C — the main gap remaining after execution is the AI-cost-metering UX (initially capped/metered but not yet offering a polished credit-purchase or BYO-key flow) and the full observability stack (interim-only). Both are explicitly deferred to TODOS.md with rationale, not silently dropped.

## Completion Summary — Phase 1 (CEO)

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY (CEO)             |
  +====================================================================+
  | Mode selected        | SELECTIVE EXPANSION                         |
  | System Audit         | Confirmed: no billing code, no CI, no       |
  |                       | per-user AI cost tracking, no delete-table  |
  |                       | endpoint, single-machine scale-to-zero infra|
  | Step 0               | 0A-0F complete; 3 alternatives tables       |
  |                       | produced (rewrite/iterate, automate/       |
  |                       | adjudicate, business model shape)          |
  | Section 1  (Arch)     | 1 finding (server-side-only enforcement    |
  |                       | must be explicit) — carried to Eng phase   |
  | Section 2  (Errors)   | Deferred to Eng phase (no concrete code    |
  |                       | yet); registry above is CEO-level draft    |
  | Section 3  (Security) | 1 finding (AI cost cap is abuse-prevention,|
  |                       | not just margin) — High severity           |
  | Section 4  (Data/UX)  | 1 finding (table/character gating semantics|
  |                       | ambiguous) — Critical, carried to Design + |
  |                       | Eng phases                                  |
  | Section 5  (Quality)  | N/A — no code written yet                  |
  | Section 6  (Tests)    | 1 finding (no CI gate) — accepted as       |
  |                       | cherry-pick                                 |
  | Section 7  (Perf)     | N/A at CEO level — deferred to Eng phase   |
  | Section 8  (Observ)   | 1 finding (no alerting/error tracking) —   |
  |                       | deferred to TODOS.md, interim proposed     |
  | Section 9  (Deploy)   | 1 finding (cold-start webhook risk) —      |
  |                       | carried to Eng phase                        |
  | Section 10 (Future)   | Reversibility of recurring-subscription    |
  |                       | choice: 2/5 — informs Question 3 sequencing|
  | Section 11 (Design)   | Run in full as Phase 2, below              |
  +--------------------------------------------------------------------+
  | NOT in scope          | written (6 items)                           |
  | What already exists   | written (6 sub-problems mapped)             |
  | Dream state delta     | written                                     |
  | Error/rescue registry | 5 methods, 5 CRITICAL GAPS (expected —      |
  |                       | pre-implementation)                         |
  | Failure modes         | 6 total, 6 CRITICAL GAPS (expected —        |
  |                       | pre-implementation)                         |
  | TODOS.md updates      | 2 items proposed                            |
  | Scope proposals       | 5 proposed, 3 accepted, 2 deferred          |
  | Outside voice         | Codex unavailable — Claude subagent only    |
  |                        | [subagent-only]                            |
  | Unresolved decisions  | 2 (see User Challenges at final gate)       |
  +====================================================================+
```

**Phase 1 complete.** Codex: unavailable [subagent-only]. Claude subagent: 5 major findings across right-problem/premises/regret/alternatives/competitive-risk. Consensus: 0/6 CONFIRMED (single voice, no cross-model pair possible) — all 6 dimensions flagged for final gate, informed by subagent + this reviewer's independent concurring analysis. Passing to Phase 2.

---

# PHASE 2: DESIGN REVIEW (UI scope detected — running in full)

UI scope detection: **confirmed** (this plan implies pricing/upgrade pages, tier-limit modals, billing management UI, all layered onto an existing heavy React SPA — battle map, character sheets, nav — per Phase 0 grep heuristic and manual confirmation).

## Step 0: Design Scope Assessment

**0A. Initial Design Rating: 1/10.** This plan currently contains **zero** UI/UX content for the new subscription surfaces — no pricing page, no upgrade-prompt copy/placement, no tier-limit modal, no billing management screen, no payment-failure or cancellation state, not even a placeholder wireframe description. Section 3 states the tier *numbers* but never how a user encounters them. A 10/10 for this plan would specify, for each of the four new surfaces (pricing page, upgrade prompt, tier-limit-hit modal, billing management), an explicit information hierarchy, every interaction state, and at least one fully-specified worked example (real copy, real placement) — plus a named, load-bearing design constraint about never interrupting a live session, given this product's unique "played live, GM's screen watched by an audience" context.

**0B. DESIGN.md Status:** No `DESIGN.md` found in the repo. Proceeding with universal design principles plus this app's own existing conventions (the `dh-` theme system, `FullPageOverlay`/`SessionBlockedBanner` patterns documented in `.cursor/rules/project.mdc`) as the closest available design-system reference.

**0C. Existing Design Leverage:** Real, reusable patterns already in the codebase that the new billing UI should adopt rather than reinvent:
- **`SessionBlockedBanner`** (portaled to `document.body`, `z-[52]`, shown while play is blocked for prep/pause reasons) — this is the *exact* precedent for "don't hard-block a live session, show a passive banner instead," and should be the template for any billing-lapse-during-play state.
- **`FullPageOverlay` / `FullPageOverlayHeader`** — the existing centered modal shell (used by `FeatureAuthoringGuideModal`, `FeatureSourceModal`) is the right shell for a pricing/upgrade page, rather than inventing a new modal pattern.
- **User menu (nav bar, click name/email)** — already the home for account-level actions (Theme, Export, Sign Out, admin links); billing management should live here, not a net-new nav concept, per the existing pattern of "account stuff lives in the user menu."
- **`dh-` theme tokens / `.dh-badge-*` / `.dh-tint-*`** — any new UI (pricing page, tier badges) must use these, not ad hoc Stripe-Checkout-template styling, to avoid looking bolted-on (both this reviewer and the Design subagent flag generic-SaaS-paywall aesthetics as a real risk given the product's bespoke-fantasy-chrome differentiation).

**0D. Focus Areas (auto-decided per SELECTIVE EXPANSION / autoplan override — all 7 passes run, no narrowing):** proceeding with all 7 dimensions, since the plan currently has zero UI content and every dimension has real findings.

## Step 0.5: Dual Voices — Design

**CLAUDE SUBAGENT (design — independent review)** — full findings (condensed from this session's subagent dispatch; verbatim severity ratings preserved):

> 1. **Information hierarchy** — Critical. No pricing page, upgrade-prompt placement, tier-limit modal, or billing-management screen is specified anywhere. Recommends: pricing page primary = single price + "unlimited," secondary = what's already free, tertiary = FAQ (no feature-matrix grid — overkill for a 2-tier product); upgrade prompt primary = what just happened, secondary = unlock action, tertiary = a non-destructive dismiss path; tier-limit modal must NOT look like a stock Stripe-checkout modal next to a themed battle map/dice roller; billing management location (user menu vs. dedicated route) is undecided.
> 2. **Missing states** — Critical. Checkout loading/error, payment failure/dunning, cancellation (immediate vs. period-end), **downgrade data fate** (hidden/read-only/deleted extra tables — flagged as the single highest-stakes unanswered question, given campaign data is emotionally loaded), trial period (unspecified, changes the entire upgrade-prompt framing), existing beta/tester grandfathering (unaddressed — retroactively enforcing limits on people who already have 3 tables is a distinct problem from a new signup hitting a wall), and cross-account interaction (owned vs. invited tables, global vs. per-campaign character count — both totally undisambiguated).
> 3. **User journey** — Critical across all three personas walked: (a) brand-new free user gets no proactive "1 of 1 used" signal before hitting a wall; (b) a free user hitting the limit **mid-session** is unaddressed anywhere in the plan, despite this codebase already having explicit precedent (`sessionStarted`/`sessionPaused` gating) for "don't interrupt live play" — a hard modal stealing focus from the battle map in front of a GM's players is uniquely humiliating for this product category; (c) a lapsed paid subscriber's payment failing mid-active-campaign is entirely undesigned, and the worst-case naive implementation (immediate lock on decline) would silently make a live campaign inaccessible.
> 4. **Specificity vs. generic patterns** — High. The plan doesn't even reach generic-boilerplate level (phrases like "add a paywall" don't even appear) — there is literally nothing for an implementer to react to, which the subagent calls "more dangerous than boilerplate" for a product whose differentiator is bespoke polish, not a bolted-on generic checkout box.
> 5. **Ambiguities that will haunt the implementer** — 7 named, Critical/High: (1) "1 character" total-ever vs. currently-in-use; (2) enforcement point (creation-time vs. continuous vs. session-start — continuous risks firing mid-session); (3) downgrade data fate; (4) cross-account gating (whose tier gates what when GM and players differ); (5) grace period/dunning; (6) grandfathering existing testers; (7) sequencing risk if the underlying data model changes later (per Phase 1's rewrite/automation decisions) after gating UI is already built around it.
>
> **Explicit live-session-interruption callout (requested):** confirmed not addressed anywhere in the plan — zero mentions of "session," "live," "mid-game," or equivalent. Called "the single most important product-specific risk for this category of app."
>
> **Design readiness score: 1/10.** Bottom line (verbatim): "this document is a legitimate and well-done piece of business/market strategy... but as a design plan for the actual subscription/billing UI, it is not a rough draft with gaps — it is pre-draft... Nothing here is ready to hand to an implementer without inventing the entire experience from scratch under time pressure."

**CODEX SAYS (design — UX challenge):** `[codex-unavailable: binary not found]` — no output. Tagged `[subagent-only]`.

**Design litmus scorecard (consensus table):**

```
═══════════════════════════════════════════════════════════════
  Dimension                              Claude   Codex   Consensus
  ───────────────────────────────────── ──────── ─────── ─────────
  1. Information architecture specified? 1/10     N/A     N/A (single voice) — this reviewer independently confirms zero content
  2. Interaction states covered?         1/10     N/A     N/A (single voice) — confirmed: no loading/error/success/partial states for any new surface
  3. User journey coherent?              1/10     N/A     N/A (single voice) — confirmed: mid-session interruption risk entirely unaddressed
  4. AI-slop / generic-pattern risk?     High      N/A     N/A (single voice) — confirmed: below even generic-boilerplate level (nothing to react to)
  5. DESIGN.md alignment?                N/A       N/A     N/A — no DESIGN.md exists; existing component conventions identified in 0C above instead
  6. Responsive/accessibility intention? 0/10      N/A     N/A (single voice) — neither this reviewer nor the subagent found any mention of mobile/responsive/a11y for the new surfaces
  7. Design decisions resolved (not left ambiguous)? 1/10 N/A N/A (single voice) — 7 named ambiguities, all Critical/High
═══════════════════════════════════════════════════════════════
Single-voice review (Codex unavailable). All 7 dimensions flagged for final gate.
```

## Pass 1: Information Architecture

Confirmed zero specification (see subagent findings above). **Auto-decided (P5 explicit + P1 completeness, design-phase tiebreak):** the plan is amended with a concrete, minimal hierarchy for each of the four surfaces (pricing page, upgrade prompt, tier-limit modal, billing management), building on the existing `FullPageOverlay` and user-menu patterns (0C) rather than inventing new ones. This is carried into the Implementation Tasks below as a P1 task (produce the actual copy/wireframe before engineering starts, not during).

## Pass 2: Interaction State Coverage

```
  FEATURE                    | LOADING | EMPTY              | ERROR                  | SUCCESS            | PARTIAL
  ---------------------------|---------|---------------------|-------------------------|---------------------|--------------------
  Checkout (Stripe Checkout) | Spinner on redirect | N/A     | Card declined at signup | Redirect back, tier upgraded | N/A
  Tier-limit-hit (creation)  | N/A     | N/A                 | N/A (this IS the state)| N/A (blocks create) | N/A
  Payment failure (dunning)  | N/A     | N/A                 | Grace-period banner, NOT a hard block | Retry succeeds, banner clears | Grace period active, N days remaining shown
  Cancellation               | Confirm dialog loading | N/A  | Cancel API call fails  | Access continues until period end (decided below) | N/A
  Downgrade overage (tables/chars over new limit) | N/A | N/A | N/A | N/A | **Read-only, not deleted** (decided below) — partial state is the norm, not an edge case, for any downgrade
  Billing management screen | Spinner while fetching Stripe customer portal session | New user, no payment method yet — show "Free plan" state, not an error | Stripe portal unreachable | Portal loaded | N/A
```

**Auto-decided design defaults (P5 explicit, matching the "downgrade data fate" and "grace period" ambiguities the subagent flagged as most critical):**
- **Downgrade/overage:** extra tables/characters beyond the new limit become **read-only, never deleted automatically**, with a persistent (non-modal) banner offering to either resubscribe or manually delete down to the limit (using the delete-table endpoint accepted as a cherry-pick in Phase 1). This is the only option that doesn't risk the "we deleted your campaign because your card expired" trust catastrophe the subagent named as the highest-stakes ambiguity.
- **Cancellation:** access continues until the current billing period ends (industry-standard, avoids an abrupt mid-cycle lockout).
- **Payment failure:** a **generous grace period (10 days, with dunning emails at day 1/5/9)** before any access change; the account is never locked mid-session — entitlement is checked at session-start only (ties directly to the hard constraint below).

## Pass 3: User Journey & Emotional Arc

Storyboard for the three personas (per the subagent's structure, now resolved with explicit decisions rather than left open):

1. **Brand-new free user:** signs up → sees a small, persistent "Free plan — 1 table, 1 character" indicator somewhere low-key in the nav (not a nag, just ambient awareness) from minute one, so the limit is never a surprise. → *Design decision, auto-added as a task.*
2. **Free user hits the limit mid-session:** **cannot happen by construction** — enforcement is creation-time only (attempting to add a 2nd table/character), never a continuous re-check during an open session. This is stated as a hard, non-negotiable design constraint (below), directly resolving the subagent's top concern.
3. **Lapsed paid subscriber, payment fails during an active campaign:** grace period (Pass 2) means the live session is never interrupted; entitlement is only re-evaluated the next time a session is *started*, not while one is running. If the grace period fully expires, the account downgrades per the read-only-overage rule (Pass 2) — the GM keeps their data, just can't add more, and their one remaining table (their choice which) stays fully playable.

**Hard constraint, stated explicitly (carried to Eng phase as a P1 requirement):** *No billing or tier-limit check may interrupt an in-progress session (`sessionStarted && !sessionPaused`) with a blocking UI. All enforcement happens at creation-time (new table/character) or session-start-time only — never mid-session.* This directly reuses the existing `SessionBlockedBanner` precedent (0C) rather than inventing new interruption UX.

## Pass 4: AI Slop Risk

**Confirmed High risk, as both this reviewer and the subagent found:** the plan currently has *less* than generic-SaaS-boilerplate content (not even placeholder copy), which risks an implementer defaulting to a stock Stripe-Checkout-example aesthetic that clashes with this app's bespoke `dh-` theme chrome. **Auto-decided (P5):** the Implementation Tasks below require at least one fully worked example (exact copy, exact component, exact placement) for the tier-limit modal specifically, using `FullPageOverlay` conventions, before any billing engineering starts — this sets the bar the rest of the surfaces follow.

## Pass 5: Design System Alignment

No `DESIGN.md` exists (0B). **Auto-decided:** align to the closest real precedent instead — `dh-` theme tokens, `.dh-badge-*`/`.dh-tint-*` conventions, `FullPageOverlay`, and the user-menu account-actions pattern, all cited in 0C. Carried as an explicit non-negotiable in Implementation Tasks (no stock component libraries or unstyled Stripe defaults in user-visible surfaces).

## Pass 6: Responsive & Accessibility

**Finding (High severity, examined and confirmed absent):** the rough draft plan makes no mention of mobile/responsive behavior or accessibility (keyboard nav, contrast, touch targets) for any of the new billing surfaces. Given the existing app already has some responsive consideration for its map/token touch targets (per `project.mdc`, tokens sized for touch), the new billing UI should meet the same bar, not regress it. **Auto-decided (P1 completeness):** carried as a P2 Implementation Task (not P1, since it doesn't block a first ship, but must not be silently dropped) — new billing surfaces must meet the same touch-target and keyboard-nav bar as the rest of the app.

## Pass 7: Unresolved Design Decisions

Two decisions remain genuinely open even after this review's auto-decisions, because they depend on the business-model User Challenge at the final gate (recurring vs. one-time purchase, Phase 1 Question 3):
1. If the business model shape changes from recurring subscription to one-time purchase (per the User Challenge), the "grace period/dunning" states in Pass 2 become moot (no recurring payment to fail) — this pass would need a lighter re-run, not a full redo, since the tier-limit/downgrade decisions (read-only overage, session-never-interrupted) hold regardless of billing shape.
2. Exact placement of the "1 of 1 used" ambient indicator (nav bar vs. user menu vs. table-list view) is a genuine taste decision with no clearly-superior answer from the codebase's existing conventions — flagged as a taste decision at the final gate, not auto-decided.

**[ROUND 2 UPDATE, 2026-07-14]:** Item 2 is **CONFIRMED** — the user picked "User menu, but even when collapsed — like under their email address," i.e. the indicator must render persistently as part of the collapsed nav-bar user-menu trigger itself (name/email button), not hidden inside the opened dropdown. See Implementation Task T15 (updated) for the concrete component target. **[SUPERSEDED, FINAL — Round 5, 2026-07-14]** Item 1 is now fully resolved, and more decisively than this pass anticipated: the final, locked business model (Proposal 5 — see R4.7 and Decision #22) has **no recurring/subscription billing anywhere in the product**, not even for the optional GM Unlimited pass (R4.5/R4.6 — every SKU is prepaid, `mode: 'payment'`). So the "grace period/dunning" states from Design Pass 2 don't just shrink to an optional perk layer — they have no live target left to apply to at all. The tier-limit/downgrade decisions this pass correctly noted hold regardless (read-only overage, session-never-interrupted — Decisions #11/#14), now triggered by trial/Campaign-Pass expiry rather than payment decline.

## Design Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY (DESIGN)          |
  +====================================================================+
  | Mode selected         | SELECTIVE EXPANSION (autoplan override)    |
  | Initial rating        | 1/10 — zero UI content specified            |
  | DESIGN.md             | Not found — existing component conventions |
  |                        | (dh- theme, FullPageOverlay, user menu)    |
  |                        | used as substitute                          |
  | Pass 1 (Info arch)     | 1 finding, Critical — 4 surfaces need       |
  |                        | explicit hierarchy — now specified above    |
  | Pass 2 (States)        | 6 states/decisions resolved above           |
  | Pass 3 (Journey)       | 3 personas walked; hard "never interrupt    |
  |                        | a live session" constraint added            |
  | Pass 4 (AI slop)       | High risk confirmed; worked-example          |
  |                        | requirement added                            |
  | Pass 5 (Design system) | No DESIGN.md; existing conventions cited    |
  | Pass 6 (Responsive/a11y)| 1 finding, High — carried as P2 task       |
  | Pass 7 (Unresolved)    | 2 items — 1 conditional on Phase 1 User     |
  |                        | Challenge, 1 pure taste decision            |
  | Outside voice          | Codex unavailable — Claude subagent only    |
  |                        | [subagent-only]                             |
  +====================================================================+
```

**Phase 2 complete.** Codex: unavailable [subagent-only]. Claude subagent: 5 major findings, design readiness 1/10. Consensus: 0/7 CONFIRMED (single voice). Passing to Phase 3.

---

# PHASE 3: ENG REVIEW + DUAL VOICES

## Step 0: Scope Challenge (actual code read, not summarized from memory)

Confirmed via direct inspection of the repo during this review (not just `project.mdc` prose):

- `package.json` — no `stripe` or any payment SDK dependency exists.
- `server.js` — global body-parser middleware (lines ~153-169) manually reads and `JSON.parse`s the raw request body for any `application/json` content type, **before any route runs**, and discards the raw buffer. This will break Stripe webhook signature verification, which requires the exact raw bytes.
- `server.js` — `POST /api/my-tables` (lines ~2257-2273) creates a new `table_state` row with a fresh `randomUUID()` and zero limit-checking of any kind.
- `server.js` — `GET /api/data/:collection` auto-creates a primary `table_state` row on first load when `tableId === req.uid` and no row exists yet (lines ~1237-1241) — a second, easily-missed table-creation site that any gating logic must also cover.
- No `DELETE` endpoint exists anywhere for `table_state` / `my-tables`.
- `migrations/025_ai_usage_events.sql` — the `ai_usage_events` table has **no `user_id` column**; `src/ai-usage-log.js` call sites never receive or pass a user id. Per-user AI cost capping requires a migration plus threading `req.uid` through ~6 builder call sites (`character-ai-build`, `adversary-ai-build`, `environment-ai-build`, `encounter-ai-build`, `generate-image`, `edit-image`).
- `fly.toml` — single machine, `min_machines_running = 0` (scale-to-zero), 512MB shared-cpu.
- No `.github/workflows/` directory exists — `npm test` (Vitest + Playwright) is developer-run only, not CI-gated.
- Identity model is Firebase UID only (`req.uid`, verified per-request via `firebase-admin`) — no local `users` table exists to hang a `stripe_customer_id` mapping off of; the closest existing precedent is `user_preferences` (migration 024).
- The existing dominant mutation pattern (`postTableOp` → `applyOpToTableState` → DB write → `notifyChange` → SSE push) is fully server-authoritative for every other piece of shared state (dice rolls via `crypto.randomInt`, table ops, banners) — a strong, consistent precedent this review recommends billing/gating extend, not deviate from.
- Multi-table model already distinguishes **owned** tables (`myTables` via `listTableStates`, `user_id = uid`) from **invited-as-player** tables (`myRooms` via `getTableStatesByPlayerEmail`, matched by email in someone else's `playerEmails`) — this distinction is not optional context, it is the exact ambiguity both Design and Eng subagents flagged for "1 table" gating.
- Characters are stored by-reference (`characters` collection, placed onto tables via `CHARACTER_RUNTIME_KEYS`) — the same character can appear on multiple tables; "1 character" as a global count is architecturally simple to query but has two separate creation entry points (Library "New" and Game Table's `ItemPickerModal` "Create new character," the latter reachable by players on someone else's table) that both need the same gate.

**Complexity check:** "add tier gating" reads as small in the rough draft but is not, specifically because of the owned-vs-invited and by-reference-character semantics above — this is the single largest hidden-complexity finding of the whole review and is treated as a P1 blocking task, not a nice-to-have clarification.

## Step 0.5: Dual Voices — Eng

**CLAUDE SUBAGENT (eng — independent review)** — full findings (condensed from this session's subagent dispatch):

> 1. **Architecture** — the global JSON body-parser middleware will silently break Stripe webhook signature verification (confirmed via direct code citation, `server.js` lines ~153-169) — **Critical**, one-line-fix-once-known (exempt the webhook path, use `express.raw()` for that route only). Auth-to-billing-identity mapping needs a new table (no `users` table exists) — **High**, small addition. Tier-limit enforcement vs. SSE-pushed state is architecturally sound *if* done server-side (the existing pattern supports it cleanly) but the plan doesn't say where — **Medium, contingent**. Race conditions between webhook-driven subscription writes and user-initiated creation are genuinely new terrain for this codebase (no existing "check invariant + write atomically" pattern) — **High**.
> 2. **Edge cases** — table-count TOCTOU race is **confirmed exploitable** if gating is added as a naive count-then-insert (cited the exact `POST /api/my-tables` code) — **High**. No delete-table endpoint exists at all, meaning "delete down to your limit" is currently unbuildable without new scope — **High**. Webhook retry/failure has no reconciliation path — **Critical**. The auto-create-primary-table-on-first-load path (`GET /api/data/:collection`) is a second, easily-missed gating site — **Medium**.
> 3. **Tests** — no CI workflow exists at all; this is called "the single highest-leverage quality fix," ahead of writing more test files. Webhook idempotency (dedup by Stripe event ID) has no existing pattern to copy in this codebase. Concurrent-creation race "can't be meaningfully tested with Vitest's single-process mocking" — needs a real-Postgres test or an explicit unique-constraint-based design argument. No rate limiting exists anywhere (`express-rate-limit` absent) — AI cost abuse is possible today regardless of billing tier.
> 4. **Security** — webhook signature verification is the primary new attack surface (ties to Architecture finding 1). Event-id idempotency needed (new pattern for this codebase). IDOR risk is low if billing checks reuse the existing `req.uid`-based ownership pattern (good existing discipline) but must be stated as a requirement, not assumed. Client-trust risk is low structurally (dominant pattern is server-authoritative) but the SPA has real precedent for *client-visible* feature flags (`imageGenEnabled`, `conceptAiEnabled`) that could be mistaken for enforcement if a developer isn't careful — flagged explicitly. Stripe integration mode (Checkout vs. Elements) isn't specified — Checkout recommended to avoid PCI scope entirely.
> 5. **Hidden complexity** — owned-vs-invited table semantics "is completely unaddressed, and it's the single biggest gap." By-reference character model means the "1 character" gate has two separate creation entry points needing the same check, one of them player-reachable on someone else's table. Downgrade/overage handling is undesigned and not even buildable today (no delete endpoint). The `ai_usage_events` schema "is less useful for metering than the plan implies" — no `user_id` column at all, confirmed via the actual migration file, meaning this is real additive work, not "billing logic on top of existing tracking" as the rough draft assumed.
>
> **Infra adequacy:** the scale-to-zero single-machine deployment is fine for game traffic (durable state lives in Postgres; SSE/LISTEN-NOTIFY is already multi-machine-safe by design) but is **not** adequate for billing SLA expectations as-is: cold starts risk webhook timeout/retry-as-duplicate (ties to idempotency finding), and zero redundancy means one crash takes down gameplay AND webhook receipt simultaneously. No backup/incident-response/alerting strategy exists anywhere in the repo.
>
> **Bottom line (verbatim):** "the architecture is sound to build on top of... the specific gotcha I found... is a one-line fix once known, not a structural flaw. But this document is a pre-engineering scoping memo dressed as a plan, and before anyone estimates or starts building, it needs a real pass that (a) explicitly defines 'table' and 'character' quota semantics... (b) enumerates the not-yet-built prerequisites... as first-class scope, (c) commits to server-side-only enforcement as an explicit non-negotiable..., and (d) picks an answer for what happens to a paid user's extra tables/characters on downgrade."

**CODEX SAYS (eng — architecture challenge):** `[codex-unavailable: binary not found]` — no output. Tagged `[subagent-only]`.

**ENG DUAL VOICES — CONSENSUS TABLE:**

```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude    Codex   Consensus
  ──────────────────────────────────── ───────── ─────── ─────────
  1. Architecture sound?               Yes*      N/A     N/A (single voice) — *sound to build ON, contingent on the webhook-middleware fix and server-side-only enforcement being explicit; this reviewer independently confirms via direct code reading
  2. Test coverage sufficient?         No        N/A     N/A (single voice) — no CI gate exists at all; confirmed independently
  3. Performance risks addressed?      Partial   N/A     N/A (single voice) — SSE/LISTEN-NOTIFY multi-machine story is a genuine strength; cold-start webhook timing is a real gap
  4. Security threats covered?         No        N/A     N/A (single voice) — webhook signature verification bug confirmed independently by re-reading server.js
  5. Error paths handled?              No        N/A     N/A (single voice) — none of the 6 failure modes in Phase 1's registry have any handling today (expected pre-build)
  6. Deployment risk manageable?       Partial   N/A     N/A (single voice) — infra fine for gameplay, thin for billing SLA; no backup/alerting exists
═══════════════════════════════════════════════════════════════
Single-voice review (Codex unavailable). All 6 dimensions flagged for final gate.
```

## Section 1: Architecture Review

**ASCII architecture diagram — new components and relationships to existing ones:**

```
                         ┌─────────────────────────┐
                         │   Firebase Auth (existing)│
                         │   req.uid, req.email       │
                         └──────────────┬────────────┘
                                        │
                    ┌───────────────────┼───────────────────────┐
                    │                   │                       │
          ┌─────────▼─────────┐  ┌──────▼───────────┐  ┌────────▼─────────┐
          │  billing_customers │  │  Existing routes  │  │  NEW: entitlement │
          │  (NEW table)       │  │  POST /api/my-    │  │  check middleware │
          │  user_id ↔         │  │  tables, PUT /api/│  │  (server-side     │
          │  stripe_customer_id│  │  data/characters  │  │  only — hard      │
          │  status, period_end│  │  (existing)       │  │  non-negotiable)  │
          └─────────┬──────────┘  └─────────┬─────────┘  └────────┬─────────┘
                    │                        │                     │
                    │              ┌─────────▼─────────┐           │
                    │              │ NEW: DELETE table  │◄──────────┘
                    │              │ endpoint            │  (gate reads this
                    │              │ (prerequisite)      │   table before every
                    │              └─────────┬───────────┘   create-table/
                    │                        │                create-character
          ┌─────────▼──────────┐   ┌─────────▼─────────┐       mutation)
          │  Stripe (external)  │   │  Postgres: table_  │
          │  Checkout + webhooks│   │  state, characters  │
          └─────────┬───────────┘   │  (existing, unmodi- │
                    │               │  fied schema)        │
          ┌─────────▼───────────┐   └──────────────────────┘
          │ NEW: webhook route   │
          │ (raw body parser —   │   ┌──────────────────────┐
          │ EXEMPT from global   │   │ ai_usage_events        │
          │ JSON middleware,     │   │ + NEW user_id column   │
          │ signature-verified,  │   │ (existing table,       │
          │ event-id deduped)    │   │ additive migration)    │
          └───────────────────────┘   └──────────┬─────────────┘
                                                  │
                                       ┌──────────▼─────────────┐
                                       │ NEW: per-user AI cost   │
                                       │ cap check (before every │
                                       │ paid OpenAI/x.ai call)  │
                                       └─────────────────────────┘
```

**Data flow — happy/nil/empty/error paths for the two new critical flows:**

```
FLOW A: Table/character creation under tier gate
  INPUT (create request) ──▶ VALIDATION (auth) ──▶ ENTITLEMENT CHECK ──▶ ATOMIC INSERT ──▶ OUTPUT
    │                            │                      │                    │               │
    ▼                            ▼                      ▼                    ▼               ▼
  [missing tableName?]      [expired token?]      [billing_customers    [unique constraint  [row created,
   → 400                     → 401                  row missing =        or advisory lock    or 403 with
                                                     free tier, default]  prevents TOCTOU     "limit reached"
                                                     [count query fails   race — see Section 4]  + upgrade CTA]
                                                     → fail closed (deny),
                                                     never fail open]

FLOW B: Stripe webhook receipt
  INPUT (POST /webhook) ──▶ RAW BODY CAPTURE ──▶ SIGNATURE VERIFY ──▶ EVENT DEDUP ──▶ APPLY STATE CHANGE
    │                          │                      │                    │                │
    ▼                          ▼                      ▼                    ▼                ▼
  [malformed body?]      [global JSON middleware   [invalid/missing    [duplicate event    [DB write fails?
   → 400, logged           MUST be exempted for      signature? → 400,   ID already seen?    → 500, Stripe
   (not silently           this route, or this        never 200 —        → 200 immediately,   retries — must
   swallowed]              step silently fails]        Stripe retries]    skip re-apply]       be idempotent
                                                                                                 on retry]
```

**State machine — subscription/entitlement status:**

```
  [FREE] ──checkout success──▶ [ACTIVE] ──payment fails──▶ [GRACE PERIOD, 10d] ──resolves──▶ [ACTIVE]
    ▲                              │                              │
    │                       cancel (period-end)             grace expires
    │                              │                              │
    └──────────────────────[CANCELED, read-only overage]◄─────────┘
                                    │
                          user deletes down to limit
                                    │
                                    ▼
                                 [FREE]
```
Impossible/invalid transitions explicitly prevented: `[FREE] → [GRACE PERIOD]` directly (must pass through `[ACTIVE]` first — a free user has no payment to fail); `[CANCELED] → [ACTIVE]` without a new checkout (re-subscription is a new Checkout session, not a state flip).

**[ROUND 4/5 CROSS-REFERENCE, 2026-07-14 — FINAL]:** this diagram models a recurring-subscription-shaped entitlement (`ACTIVE`/`GRACE PERIOD`/`CANCELED`), consistent with the business-model shape live at the time this Eng section was written. That shape is superseded, FINAL: the locked business model (Round 4/5, R4.7) is a **non-subscription, per-table prepaid Campaign Pass** (no Stripe Subscription object, no dunning/grace-period lifecycle for core access). This state machine is superseded by the simpler one in Round 4 (`[FREE TRIAL, time-boxed] → [CAMPAIGN PASS ACTIVE] → [PASS EXPIRED, read-only overage] → [CAMPAIGN PASS ACTIVE]` on renewal or gift purchase) — left here unedited as the historical record of the earlier recurring-model design, per the instruction not to rewrite already-locked sections, only cross-reference them.

**Coupling:** the new entitlement check couples every table/character-creation codepath to a new `billing_customers` table read. This is justified — it's the smallest coupling that satisfies "server-side-only enforcement," and it follows the existing pattern of ownership checks (`row.userId === req.uid`) already present throughout `server.js`.

**Scaling:** at 10x load, the entitlement check adds one indexed lookup per creation request — negligible. At 100x, webhook volume could exceed the single-machine's cold-start-recovery capacity; this is why Section 4 (Performance) below recommends `min_machines_running: 1` once billing ships, not zero.

**Single points of failure:** the single Fly.io machine is already a SPOF for gameplay (pre-existing, not new); the new SPOF is the webhook endpoint during a cold start — mitigated by idempotent processing (a delayed-then-retried webhook is safe to reprocess) rather than by adding redundancy immediately.

**Rollback posture:** the entitlement check can be feature-flagged off (`ENTITLEMENT_ENFORCEMENT_ENABLED` env var, checked before denying any creation) so a bad gating rule can be disabled via a Fly.io secret update, without a full redeploy or DB rollback.

## Section 2: Code Quality Review

N/A for existing code — no billing code has been written yet. **Forward-looking requirement, auto-decided (P5 explicit):** the entitlement check must be a single, named, reusable function (e.g. `checkTableCreationEntitlement(uid)` / `checkCharacterCreationEntitlement(uid)`), not inlined ad hoc into each route — both current creation sites (`POST /api/my-tables` and the auto-create path in `GET /api/data/:collection`) must call the same function, per DRY (P4), specifically because the Eng subagent found two separate creation sites that both need the identical check.

## Section 3: Test Review (never skipped or compressed)

**Complete diagram of everything this plan introduces:**

```
  NEW UX FLOWS:
    - Checkout (upgrade to paid)
    - Tier-limit-hit at table creation
    - Tier-limit-hit at character creation (2 entry points: Library New, Game Table picker)
    - Billing management (view/cancel/update payment method)
    - Grace-period banner display
    - Downgrade/overage read-only banner

  NEW DATA FLOWS:
    - Firebase UID → Stripe customer ID mapping
    - Webhook event → subscription status update
    - Creation request → entitlement check → atomic insert-or-deny
    - AI builder call → per-user cost check → allow/deny

  NEW CODEPATHS:
    - Entitlement check function (2 call sites minimum)
    - Webhook signature verification + event dedup
    - Delete-table endpoint (new)
    - Per-user AI usage recording (6 call sites)

  NEW BACKGROUND JOBS / ASYNC WORK:
    - Reconciliation cron (Stripe subscription status vs. local DB, safety net for missed webhooks — reuses existing node-cron pattern from src/external-sync.js)

  NEW INTEGRATIONS / EXTERNAL CALLS:
    - Stripe Checkout, Stripe Customer Portal, Stripe webhooks

  NEW ERROR/RESCUE PATHS:
    - All 6 rows in Phase 1's Failure Modes Registry
```

**Per-item test coverage (type / exists? / happy / failure / edge):**

| Item | Test type | Exists today? | Happy path test | Failure path test | Edge case test |
|---|---|---|---|---|---|
| Webhook signature verification | Unit | No | Valid signature → event processed | Invalid signature → 400, never 200 | Replayed timestamp outside Stripe's 5-min tolerance → rejected |
| Webhook idempotency | Unit + integration | No | New event ID → applied once | Duplicate event ID (Stripe retry) → 200, not re-applied | Two webhooks for the same customer arrive out of order |
| Entitlement check (table) | Unit | No | Under limit → allowed | At limit → denied with upgrade CTA | **Concurrent requests at the limit boundary — requires a real-Postgres test (unique constraint / advisory lock), not mockable in Vitest's single-process model** per the subagent's explicit finding |
| Entitlement check (character) | Unit | No | Under limit → allowed | At limit, both entry points (Library + Game Table picker) → denied consistently | Player hits limit while joining someone else's table mid-invite flow |
| Delete-table endpoint | Unit + browser | No (endpoint doesn't exist yet) | Owner deletes own table → removed, slot freed | Non-owner attempts delete → 403 | Delete the table an active SSE session is connected to — verify connected clients are notified, not silently dropped |
| Per-user AI cost cap | Unit | No | Under cap → call proceeds | At cap → call rejected before hitting OpenAI/x.ai (never bill for a call that shouldn't happen) | Cap reached mid-request (race between two simultaneous generate-image calls) |
| Grace period / no-mid-session-interruption | Browser (Playwright) | No | Session started before card decline → session remains fully playable through decline | Grace period expires while no session is active → next session-start is gated | Grace period expires *while a session is actively running* — must NOT interrupt (this is the single most important test in the whole plan, directly verifying Phase 2's hard constraint) |
| **[AMENDMENT] Multi-actor action-loop sequences (M1-M6 below)** | Browser (Playwright, multi-context) | **No — this test *shape* does not exist in the suite at all today** | Each named sequence completes with all actors seeing consistent final state | An actor's step is rejected/invalid mid-sequence (e.g. targeting out of range, chip activated after banner cancelled) → no crash, no orphaned UI, no divergent state between clients | A second actor's action arrives while the first actor's UI still shows the pre-update state (real SSE-propagation race, not a mocked one) |

**[AMENDMENT] Multi-Actor Action-Loop Test Catalog — canonical sequences that must be named and automated before this ships for money**

Direct user feedback (2026-07-13): "They should be testing user flows that were never really defined. Like one player targeting an adversary, then someone else using their Prayer Die, and so on." Verified against `.cursor/rules/project.mdc` and the real mechanics it documents (dice roll flow, banner queue, V2 review/cross-sheet chips, rest moves) — these are not invented generic examples, they are the actual multi-step, multi-actor, multi-role (GM + N players) sequences the current suite has zero coverage of:

| ID | Name | Sequence (grounded in documented mechanics) | Roles involved |
|---|---|---|---|
| M1 | Attack → target → damage → resolve | Player A initiates a weapon attack (`CharacterHoverCard` target-selection menu when in range) → `postRoll` → banner appears for GM + Player A via the `banners` subscription channel → GM's `ResultBanner` shows target selector chips, GM picks a target and optionally toggles "Use armor" → GM Acknowledges → `handleApplyDamage` applies HP/Stress/Armor changes (incl. armor-slot-triggered features) → the `table_state` SSE snapshot propagates the new HP/Stress/Armor to **every** connected client (GM, Player A, and an uninvolved Player B), not just the initiator | GM + Player A + Player B (observer) |
| M2 | Cross-player reaction chip mid-banner (e.g. Seraph Prayer Die) | Player A's attack roll banner is pending → Player B (a different connected client, e.g. holding Prayer Dice) activates a V2 review-action chip on that same pending banner (`POST /api/room/:tableId/v2-review-chip`, e.g. `postBannerActionAddStatic`) → the banner's dice/total recompute **in place** and propagate to the GM's and Player A's clients without a page reload → GM Acknowledges the augmented roll | GM + Player A (initiator) + Player B (reactor) |
| M3 | Rest cycle with concurrent multi-player move selection | GM triggers Short Rest or Long Rest → `RestBanner` opens simultaneously for all connected clients → Player A and Player B each independently pick their two downtime moves via their own `CustomSelect`s, editable only for their own assigned character's column, submitted **concurrently** (`rest-move-select` op) → GM Acknowledges once all moves are chosen → Fear is added and rest-scoped feature usage cleared for all characters at once, consistently across every client | GM + Player A + Player B (concurrent) |
| M4 | GM banner-cancel mid-flight while a player has an open reaction chip | Player A's attack banner is pending; Player B has a review-chip UI open but has **not yet activated it** → GM cancels the banner (`banner-ack` action `cancel`, or bulk "Cancel all pending banners") before Player B acts → verify Player B's client cleanly removes the banner/chip UI (no orphaned chip trying to act against a banner ID that no longer exists, no crash/hang) | GM + Player A + Player B |
| M5 | Cross-sheet chip affecting another player's sheet in realtime | Player A's character has a feature that shows a chip on Player B's sheet (`showOnOtherSheets`, `collectV2CrossSheetChips`) → Player B activates it from their **own** client (`POST /api/room/:tableId/v2-cross-sheet-chip`, server validates the requester is assigned to `viewerInstanceId`) → the resulting mutation applies to Player B's character element and Player A also sees the state change reflected via the `table_state` SSE snapshot, without either player refreshing | Player A + Player B |
| M6 | Token move + range-gated targeting across two clients | Player A drags their token on the shared battle map into weapon range of an adversary → Player B, an independently-rendering client, sees the token move propagate live via the `table_state` SSE sync → Player A then initiates an attack and only sees valid targets within range (`getTargetsForRoll` / `map-range.js`) → confirms range-gating is consistent server-side, not just locally cached on Player A's own client | Player A + Player B (observer) |

None of M1-M6 exist today, in any form. Automating them requires a test *shape* the current harness does not have: **2+ concurrent authenticated Playwright browser contexts** (not one page mocking a second actor) running against the **real** server with SSE actually flowing (not `page.route()`-mocked), which in turn requires a real test Postgres (this dev machine currently has no `DATABASE_URL` configured — same infra gap already flagged for the TOCTOU race integration test above). This is new test infrastructure, not just new test files — carried as new task **T12**.

**Relationship to human playtesting (T16, formerly T14 — not redundant, both needed):** M1-M6 as automated multi-context Playwright tests catch *regressions* cheaply and repeatably on every push once T2's CI gate exists — e.g. "did the last refactor of the banner queue silently break cross-sheet chip propagation." They cannot catch what only humans catch: real network latency, a GM improvising a move the test catalog didn't anticipate, UX friction that technically "works" but feels bad at the table, or a bug that only appears with 4 real players' devices/browsers simultaneously. Structured multi-group playtesting (T16) is the complementary, not overlapping, mechanism for that. Ship-readiness requires both: M1-M6 passing in CI *and* a clean bug list from at least 2 independent playtest groups.

**Test ambition check:**
- **2am Friday confidence test:** the webhook idempotency + signature verification tests, run against a real (test-mode) Stripe webhook payload fixture, not a hand-rolled mock — this is the test that prevents "silently gated as free forever" from ever reaching production undetected.
- **Hostile QA test:** fire two concurrent `POST /api/my-tables` requests from the same free account and assert exactly one succeeds — this is the TOCTOU race the subagent confirmed exploitable.
- **Chaos test:** kill the server process mid-webhook-processing (simulating a Fly.io cold-start-triggered restart) and verify the reconciliation cron self-heals the subscription status within one cron cycle.
- **[AMENDMENT] Multi-actor confidence test:** run M2 (cross-player Prayer Die chip) and M4 (banner-cancel while a reaction is pending) back-to-back in the same test file, asserting the *second* player's client state after the *first* player's or GM's action — this is the concrete "does the core action loop actually hold up with real concurrent actors" test the user's original "not convinced of the core action loops" doubt was asking for.

**Test pyramid:** mostly unit (entitlement checks, webhook parsing) + a handful of integration tests requiring a real test Postgres (the concurrency race, specifically) + a small number of Playwright browser tests (the no-mid-session-interruption flow, which is fundamentally a UI-behavior test, not a unit-testable one) + **[AMENDMENT]** a new multi-context Playwright layer (M1-M6) that sits alongside the existing single-actor browser specs, not replacing them — this is a genuinely new tier in the pyramid, not a resizing of an existing one, because no existing tier exercises 2+ real concurrent actors against the real server.

**Flakiness risk:** the concurrency race test depends on precise timing; recommend using a DB-level unique constraint (deterministic) rather than an application-level lock (timing-sensitive) specifically so the *feature* doesn't rely on timing, even though the *test* verifying it necessarily does.

**Test plan artifact:** written to disk (see `~/.gstack/projects/DaggerheartGM/` note below — path adjusted since `gstack-slug` binary is unavailable on this machine; written directly instead).

## Section 4: Performance Review

- **N+1 / indexes:** the entitlement check is a single indexed `COUNT` query (`WHERE user_id = $1`) — no N+1 risk. Requires an index on `table_state(user_id)` and `characters(user_id)` if one doesn't already exist implicitly via the primary key `(app_id, user_id, collection, id)` — it does, since `user_id` is a PK prefix column, so this is already covered.
- **Memory:** negligible new memory footprint — billing state is small rows, not large blobs.
- **Caching:** entitlement status must NOT be cached in application memory beyond a single request's lifetime (ties to Phase 1's finding that a cached value would miss a webhook-driven downgrade on a warm long-running instance) — always a fresh DB read at check time.
- **Background job sizing:** the reconciliation cron is O(active-subscriptions) — trivially small at this product's likely scale (hundreds to low thousands of users, not millions).
- **Slow paths:** the Stripe Checkout redirect round-trip is the slowest new user-facing path (typically 1-3s, external to this app, not optimizable here).
- **Connection pool pressure:** negligible — billing adds a handful of new queries per user action, not a new connection-heavy subsystem.
- **Infra recommendation (ties to Architecture SPOF finding):** once billing ships, change `min_machines_running` from `0` to `1` to avoid cold-start webhook timeout/retry-as-duplicate risk — this is a one-line `fly.toml` change, appropriately small, but must not be forgotten (carried as a P1 task).

## NOT IN SCOPE (Eng phase)

- **Redis/queue-based webhook processing** — Postgres-backed idempotency (an event-id dedup table, following the `item_popularity` `ON CONFLICT DO NOTHING` precedent already in this codebase) is sufficient at this scale; a queue is premature infrastructure. → Not deferred, just rejected (DRY/simplicity, P5).
- **Multi-region / multi-machine redundancy** — architecturally free later (SSE/LISTEN-NOTIFY already supports it) but not needed at `min_machines_running: 1` scale; revisit if usage grows. → TODOS.md.
- **A full Sentry-equivalent error-tracking integration** — carried forward from Phase 1's same deferral; the reconciliation cron + structured webhook logging is the interim substitute in scope now.

## What Already Exists (Eng phase)

- `item_popularity`'s `ON CONFLICT DO NOTHING` pattern — direct template for the webhook event-id dedup table.
- `node-cron` + the existing 3am/4am job pattern in `src/external-sync.js` — direct template for the reconciliation cron.
- The `req.uid`-based ownership-check pattern used throughout `server.js` — direct template for entitlement-check authorization (avoids IDOR by construction if followed consistently).
- `user_preferences` (migration 024) — closest existing precedent for a small, user-keyed settings/status table, informing the shape of the new `billing_customers` table.

## Failure Modes Registry (Eng phase — expanded with test coverage column)

```
  CODEPATH                        | FAILURE MODE                    | RESCUED? | TEST?  | USER SEES?          | LOGGED?
  --------------------------------|----------------------------------|----------|--------|---------------------|--------
  Webhook signature verification  | Global JSON middleware breaks it | Y (fix   | Y (unit)| N/A if fixed        | Y
                                   |                                  | planned) |         |                     |
  Webhook idempotency              | Duplicate event processed twice  | Y (dedup | Y (unit+| N/A if fixed        | Y
                                   |                                  | planned) | integ.) |                     |
  Table/character count check      | TOCTOU race on concurrent create | Y (uniq  | Y (integ| N/A if fixed        | Y
                                   |                                  | constr.  | -ration,|                     |
                                   |                                  | planned) | real DB)|                     |
  AI cost cap                      | No cap exists                    | Y (cap   | Y (unit)| Clear "cap reached" | Y (per-user,
                                   |                                  | planned) |         | message             | not just aggregate)
  Payment decline                  | No grace period                  | Y (10-day| Y       | Dunning email +     | Y
                                   |                                  | grace    | (browser)| non-blocking banner |
                                   |                                  | planned) |         |                     |
  Cold-start webhook timeout       | Fly.io scale-to-zero cold start   | Y (min_  | Y       | N/A if fixed        | Y
                                   | delays webhook response           | machines=| (chaos) |                     |
                                   |                                  | 1 planned)|        |                     |
```

All six rows now show a planned rescue + planned test — this is the delta from Phase 1's registry (where all six were unaddressed CRITICAL GAPs). Zero rows remain unaddressed in the plan as revised by this review.

## Eng Completion Summary

```
  +====================================================================+
  |            MEGA PLAN REVIEW — COMPLETION SUMMARY (ENG)             |
  +====================================================================+
  | Scope challenge        | Read actual code: server.js, package.json,|
  |                         | fly.toml, migrations/025; confirmed 2      |
  |                         | creation entry points per resource, no CI,|
  |                         | no delete endpoint, no user_id on AI table|
  | Dual voices             | Claude subagent [subagent-only] — 5       |
  |                         | findings; Codex unavailable                |
  | Eng consensus table     | 0/6 CONFIRMED (single voice) — all 6      |
  |                         | flagged for gate                           |
  | Section 1 (Architecture)| Diagram produced (components, data flow,  |
  |                         | state machine); 1 SPOF flagged, mitigated |
  |                         | via idempotency not immediate redundancy  |
  | Section 2 (Code Quality)| N/A — forward-looking DRY requirement set |
  | Section 3 (Tests)       | Full diagram + per-item coverage table    |
  |                         | produced; test plan artifact written      |
  | Section 4 (Performance) | 1 infra recommendation (min_machines: 1)  |
  | NOT in scope            | 3 items, with rationale                    |
  | What already exists     | 4 direct code templates identified         |
  | Failure modes            | 6 total, 0 remaining unaddressed (all 6   |
  |                         | now have a planned rescue + test)          |
  +====================================================================+
```

**Phase 3 complete.** Codex: unavailable [subagent-only]. Claude subagent: 5 major findings across architecture/edge-cases/tests/security/hidden-complexity. Consensus: 0/6 CONFIRMED (single voice). No developer-facing/DX scope detected (this product is GM/player-facing, not a developer tool or API/SDK product) — **Phase 3.5 (DX Review) is skipped**, per the autoplan skip condition. Passing to Decision Audit Trail and Final Gate.

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected alternative |
|---|-------|----------|-----------------|-----------|-----------|----------------------|
| 1 | Preflight | Codex CLI unavailable — proceed Claude-subagent-only for all 4 phases | Mechanical | P6 (dual voices, degraded) | Binary not found on this machine; degradation matrix applies | Blocking the whole pipeline on Codex availability |
| 2 | CEO 0A | Revise "no purpose-built Daggerheart VTT" to "no zero-setup, single-product, browser-hosted option" | Mechanical | P1 completeness | WebSearch confirmed Foundryborne, Demiplane+Roll20, Fantasy Grounds exist; narrower claim holds | Leaving the original overbroad claim unexamined |
| 3 | CEO 0C-bis Q1 | Reject full rewrite; decouple V2 migration completion from monetization readiness (freeze-and-harden) | **Taste — CONFIRMED by user (2026-07-14), scope added** | P1 + P2 | V2 migration already has tooling investment; rewrite would discard working map/camera system. User confirmed C and added: keep "deactivate unfinished categories" + "inform users of manual expectations" IN scope (not deferred) — see Round 2 section for the grounded domain-card-completeness proposal | Full rewrite (A); "finish V2 migration first" (B) — both viable, rejected by user |
| 4 | CEO 0C-bis Q2 | Hybrid automation: keep core-loop automation, formalize `Display` status as a permanent acceptable end-state for narrative cards | **Taste — CONFIRMED by user (2026-07-14) with a precision check** | P4 DRY + P1 | Reuses existing tracked convention; directly matches user's own floated idea. User restated as "presenting the card to the table for GM acknowledgement" — confirmed as matching *provided* GM-acknowledgement is understood to include automatic HP/Stress/Hope/Armor/cost mutation on Ack (not just banner display) — see Round 2 section | Full automation (A); strip automation to bare roller (B) — rejected by user |
| 5 | CEO 0C-bis Q3 | Sequence a cheap WTP-validation step before committing to the full recurring-billing build; default remains the user's stated shape pending signal | **User Challenge — user responded 2026-07-14, fully resolved by Round 5 (2026-07-14) — see Decision #22** | P6 (user default), P2 | Both subagent voice + this reviewer's independent analysis agree the specific shape is under-validated. User's response moved toward a hybrid, then through Rounds 3-4 to a final pick: prepaid, non-subscription per-table **Campaign Passes** (Proposal 5, Decision #22) — see Round 2-5 sections. T1's validation task now confirms real-world signal on this already-decided, FINAL shape and pricing, rather than helping choose between shapes | Silently substituting one-time-purchase for the user's stated recurring model without flagging it |
| 6 | CEO 0D | Accept 3 cherry-picks (CI workflow, delete-table endpoint, `ai_usage_events.user_id` migration) into scope | Mechanical | P2 boil lakes, <1 day CC effort each | All three are hard prerequisites uncovered by this review, not optional scope creep | Deferring them and discovering mid-build they block everything else |
| 7 | CEO 0D | Defer full observability stack and BYO-API-key-as-primary-model to TODOS.md | Mechanical | P2 (outside 1-day blast radius) | Legitimate future needs, not same-day additions | Building either now and delaying ship |
| 8 | CEO Section 3 | Treat AI cost capping as abuse-prevention (security), not just margin optimization | Mechanical | P1 completeness | Unbounded API cost is an availability/cost-abuse vector regardless of framing | Treating it as a "nice to have" margin fix |
| 9 | CEO Section 4 / Eng Step 0 | "1 table" free-tier limit counts **owned** tables only; invited-as-player tables never count against it | Mechanical | P1 (fills a gap the user's stated model left undefined, doesn't change it) | Codebase already distinguishes `myTables` (owned) from `myRooms` (invited); the free-tier framing ("play in one game, run one game") only makes sense this way | Counting invited tables (would silently break the free tier's own stated purpose) |
| 10 | Eng Step 0 | ~~"1 character" free-tier limit counts **distinct (character, table) placements** (Scheme B)~~ — **SUPERSEDED, FINAL (2026-07-14): placement is uncapped, never metered.** The `character_table_placements` table remains, but as telemetry only; library-character creation itself stays uncapped, as it always was | **Taste — CONFIRMED by user (2026-07-14) as Scheme B, then formally superseded by the maintainer's own final answer (2026-07-14): "We can drop placement enforcement."** | P1 completeness (value-accuracy over query-simplicity) → superseded by P6 (user default) once the table-side Campaign Pass model made a second, cost-disconnected meter redundant | User originally chose Scheme B over this review's simplicity-favoring recommendation (library-row counting), with a clear rationale: "It's not about cost, it's about value. Each character↔table relation is a whole gaming experience." Round 4 (R4.4) flagged that a *paid* placement gate is cost-disconnected (placements cost ≈$0) and psychologically punitive once the table itself is separately metered by the Campaign Pass model, and recommended dropping enforcement pending the maintainer's sign-off. **The maintainer has now given that sign-off directly and unconditionally** — placement enforcement is dropped, FINAL, not a partial or pending reversal. The ledger, call-site wiring, and table-delete cleanup from Round 3 (T19) are still built, now purely as product telemetry (see R4.4/R4.7) | Counting library `characters` rows regardless of placement count (Scheme A, this review's original recommendation); Scheme B *with* paid enforcement (the user's own original 2026-07-14 pick, formally superseded by their own later final answer, same day) |
| 11 | Design Pass 2 | Downgrade/overage: extra tables/characters become **read-only, never auto-deleted** | **Taste — CONFIRMED by user (2026-07-14)** | P5 explicit (safest default) | Avoids the "we deleted your campaign because your card expired" trust catastrophe both design and eng voices flagged as highest-stakes | Hiding from list view (ambiguous, feels like data loss); auto-delete (real data loss risk) — rejected by user |
| 12 | Design Pass 2 | Cancellation: access continues until current billing period ends | Mechanical | P1 completeness (industry standard) | Not genuinely contested — abrupt mid-cycle lockout is a known anti-pattern | Immediate lockout on cancel |
| 13 | Design Pass 2 | Payment failure: 10-day grace period with dunning emails at day 1/5/9 | **Taste — CONFIRMED by user (2026-07-14)** | P5 explicit | Reasonable default; exact duration/cadence is arguable. Note (Round 2): if the business model shifts to a one-time core unlock, this grace period only ever applies to an optional non-critical recurring perk layer, never to core table/character access | 3-day grace (too short given weekly play cadence); 14-day (longer than needed) — rejected by user |
| 14 | Design Pass 3 | Hard constraint: no billing/tier check may interrupt an in-progress session; enforcement is creation-time or session-start-time only | Mechanical | P1 completeness | Both design and eng voices independently and strongly flag this as the single most important product-specific risk; directly reuses existing `SessionBlockedBanner` precedent | Continuous/live re-checking of entitlement during an open session |
| 15 | Eng Section 1 | Entitlement enforcement is server-side-only, following the existing `postTableOp`/ownership-check pattern | Mechanical | P5 explicit, matches existing codebase convention | Client-side-only gating would be a client-trust bug in a codebase that is otherwise fully server-authoritative | Client-side-only or client-displayed-but-not-enforced gating |
| 16 | Eng Section 4 | Change `min_machines_running` from 0 to 1 once billing ships | Mechanical | P1 completeness | Mitigates cold-start webhook timeout/duplicate-retry risk; one-line config change | Leaving scale-to-zero and relying solely on webhook idempotency to absorb the risk |
| 17 | Eng Section 3 | Concurrent table-creation race is prevented via a DB-level unique constraint / advisory lock, not an application-level check-then-write | Mechanical | P5 explicit, deterministic over timing-sensitive | Confirmed exploitable otherwise (subagent traced the exact vulnerable code path) | Application-level count-then-insert (confirmed race-prone) |
| 18 | CEO/Design/Eng (cross-phase) | AI features are metered/capped per-user, not cut, not left unmetered inside any flat fee | **Taste — CONFIRMED by user (2026-07-14) as part of adopting Proposal 5 in full ("I love Proposal 5")** | P1 completeness + P2 (reuses `ai_usage_events` infra, additive not new) | Both voices flag unmetered AI as critical margin risk; cutting AI entirely would discard a real differentiator vs. Foundryborne's zero-AI stance. Metering survives as a small starter credit grant on signup plus **consumable AI credit packs** sold as one-time top-ups (`mode: 'payment'`, same non-subscription shape as the Campaign Pass) — this piece of the model was unchanged across Proposals 2/3 and Round 4's Proposal 5 (R4.3), and the maintainer's full endorsement of Proposal 5 confirms it along with everything else in that proposal | Cutting AI features entirely; leaving them unmetered inside any flat fee — rejected by user |
| 19 | Design Pass 7 | Placement of the ambient "1 of 1 used" indicator (nav vs. user menu vs. table list) | **Taste — CONFIRMED by user (2026-07-14)** | N/A | User: "User menu, but even when collapsed. Like under their email address" — must render persistently in the collapsed nav-bar user-menu trigger itself (`src/client/app.jsx`), not only inside the opened dropdown | Nav bar top-level (separate from user menu); table-list view only — rejected by user |
| 20 | Round 3 (Decision #3 addendum) | "Deactivate unfinished categories" is a single global **released ability tier ceiling** (numeric, `game-constants.js`), enforced generically wherever V2 card chips render — not per-card labeling, not per-domain hiding | **Taste — CONFIRMED by user (2026-07-14)** | P1 completeness + V2 framework-agnostic boundary rule | User: "we should go Display for all domain cards... bump an 'if tier ≤ 0' clause up to 1... Maybe that's config." Ceiling starts at 0 (nothing released — every domain-card chip suppressed regardless of registry implementation status) and bumps to 1 once Tier 1 is automated across all 9 domains (currently 5/9; 12 Tier 1 cards remain across Blade/Codex/Grace/Valor). See Round 3 section for exact config key, enforcement point, and card count | Per-card "Read & adjudicate" badge with no suppression (this review's original R2.3 proposal) — superseded by user's request for an actual gate, not just a label |
| 21 | Round 3 (Decision #5/#18, business model) | Business model: hosting-cost estimate delivered, no final pick made yet at this point in the review | **User Challenge — investigated 2026-07-14, superseded by Round 4 (row #22), then fully resolved FINAL by Round 5 (row #22/#23/#24)** | P6 (user default pending real signal) | User proposed a 4th option (one-time core unlock, no AI, no recurring revenue at all) conditioned on a Railway hosting-cost estimate. Real Railway pricing + this app's architecture were used to estimate baseline (~$20-35/mo for the user's current single-group usage) and scaling cost; verdict: a *pure* zero-recurring model is not structurally sound at sustained scale (hosting is a perpetual recurring liability; one-time revenue is not), so Proposal 4 as stated is not recommended. At the time this row was written, Proposal 3 (one-time core unlock + optional recurring supporter tier) was the standing recommendation — **superseded by the Round 4 synthesis (row #22)**, which the maintainer then confirmed as FINAL in Round 5; Proposals 1-4 remain below as historical record, not deleted | Silently keeping the prior recommendation unchanged without running the numbers the user explicitly asked for; silently adopting Proposal 4 without flagging the cost-solvency gap |
| 22 | Round 4 (business-model outside-the-box synthesis), **CONFIRMED FINAL by Round 5** | Business model: synthesizing the maintainer's own outside-the-box brainstorm with an independent Grok 4.5 brainstorm produced a new recommendation, **Proposal 5: prepaid, non-subscription per-table "Campaign Passes"** (final pricing **$20/3mo, $35/6mo, $60/12mo**) + free players/characters + a **time-boxed 1-month free table trial** (clock from first real multiplayer session, one lifetime trial per user) — superseding Proposal 3. The maintainer confirmed this in full ("I love Proposal 5") and, together with **Decision #10**, **dropping Scheme B's placement-count *enforcement*** entirely (keep the ledger as telemetry only), since a paid placement gate is cost-disconnected and punitive under this new model (Grok's critique, independently corroborated) | **Taste — CONFIRMED FINAL by the maintainer (2026-07-14, Round 5) — see R4.7** | P6 (user default, now with real signal and a real maintainer pick), P1 completeness (closes the cash-flow-timing gap Proposal 4 had and the perpetual-slot gap the maintainer's own initial framing would have had) | See full reasoning in "Round 4: Business Model — Outside-the-Box Synthesis" and R4.7: both brainstorms independently converged on the same time-boxed-trial mechanism (strong signal); perpetual per-table "slots" priced honestly for decade-long use are unmarketably expensive (~$100-750) and priced marketably they recreate Proposal 4's cash-flow trap in mirror image; the table (not the character) is the only unit whose real hosting cost justifies being the metered SKU. The maintainer's own final pricing pick ($20/$35/$60, replacing the earlier illustrative $15/$25/$42) clears R3.3's marginal per-table cost with healthy margin (R4.3) | Sticking with Proposal 3 unchanged (would have left the maintainer's explicit request for divergent thinking unanswered); adopting the maintainer's literal first-draft "sell perpetual slots" idea as-is (fails the decade-pricing math — see R4.2); adopting Grok's literal ranking unmodified (this synthesis disagrees with 2 of Grok's specifics — see R4.5) |
| 23 | Round 5 (maintainer's extension, R4.3.1) | "Anyone can gift a Campaign Pass": any user with a relationship to a table (owner GM or any invited player) can purchase a Campaign Pass for that specific table as an irrevocable gift; the table's owner/GM never changes regardless of who pays. Requires a `table_id`-keyed entitlement ledger (`table_campaign_passes`/`table_campaign_pass_purchases`, R4.3.1), Stripe Checkout metadata carrying a buyer-chosen `targetTableId` distinct from the purchaser's identity, and a new player-reachable purchase UI surface (Characters panel) | **Taste — CONFIRMED FINAL by the maintainer (2026-07-14, Round 5), verbatim** | P1 completeness, P5 explicit (ownership untouched by construction, not by an added safeguard) | Maintainer's own words: "anyone, player or GM, should be able to pay for the season pass ('campaign pass'?) for a table. The GM remains the owner/GM no matter who pays; it is explicitly a gift to the GM and can't be taken back." Fully specified in R4.3.1: table-keyed (not user-keyed) entitlement, purchaser recorded separately for receipts/attribution only, refund/dispute events are a logged no-op (never a clawback) | A user-keyed entitlement model (T5's original design) — cannot express "anyone can gift any table they have a relationship to," rejected by construction once the gifting requirement was stated |
| 24 | Round 5 (maintainer's final pricing + SKU lock-in, R4.7) | Campaign Pass pricing locked at **$20/3mo, $35/6mo, $60/12mo** (replacing the illustrative $15/$25/$42 everywhere in this plan); the "Founding" perpetual pre-launch SKU floated in R4.2 is rejected outright, not deferred | **Taste — CONFIRMED FINAL by the maintainer (2026-07-14, Round 5), verbatim** | P5 explicit, P1 completeness | Maintainer's own words: "For pricing, I think we should go with 20/35/60. $20 for three months of a virtual table is totally worth it, and it scales down from there. No weird pre-launch, keep it simple." Every paid SKU in the product is repeatable/time-boxed/consumable and `mode: 'payment'` — there is no perpetual-purchase SKU anywhere (R4.2) | The earlier illustrative $15/$25/$42 figures; a capped-quantity "Founding" perpetual-slot SKU (considered in an earlier draft of R4.2, explicitly rejected by the maintainer) |

## Pre-Gate Verification

- [x] Premise challenge with specific premises named — 0A, 6 premises individually evaluated
- [x] All applicable review sections have findings OR explicit "examined X, nothing flagged" — Sections 1-11 (CEO), Passes 1-7 (Design), Sections 1-4 (Eng) all addressed
- [x] Error & Rescue Registry table produced — Phase 1 and expanded in Phase 3
- [x] Failure Modes Registry table produced — Phase 1 and expanded in Phase 3 (0 remaining unaddressed after Eng phase's planned rescues)
- [x] "NOT in scope" section written — Phase 1 and Phase 3
- [x] "What already exists" section written — Phase 1 (0B) and Phase 3
- [x] Dream state delta written — Phase 1 (0C)
- [x] Completion Summary produced — all 3 phases
- [x] Dual voices ran (Claude subagent; Codex noted unavailable throughout) — all 3 phases
- [x] CEO/Design/Eng consensus tables produced — all 3 phases
- [x] All 7 Design dimensions evaluated with scores — Passes 1-7
- [x] Design litmus scorecard produced
- [x] Scope challenge with actual code analysis (not "scope is fine") — Eng Step 0, direct citations from `server.js`, `package.json`, `fly.toml`, `migrations/025`
- [x] Architecture ASCII diagram produced — Eng Section 1 (3 diagrams: components, data flow, state machine)
- [x] Test diagram mapping codepaths to coverage — Eng Section 3
- [x] Test plan artifact written to disk — `~/.gstack/projects/DaggerheartGM/andrewreutter-main-test-plan-20260713-230000.md`
- [x] Cross-phase themes section — see below
- [x] Decision Audit Trail has at least one row per auto-decision — 24 rows above (19 through Round 3; #22 added by Round 4, confirmed FINAL by Round 5; #23/#24 added by Round 5)

All required outputs verified present. No retry needed.

## Cross-Phase Themes

**Theme: unmetered AI cost is a first-order risk, not a footnote** — flagged independently in Phase 1 (CEO, both the premise challenge and Section 3 security finding) and Phase 3 (Eng, hidden-complexity finding on the `ai_usage_events` schema gap). High-confidence signal — this appeared in every phase that touched it.

**Theme: "1 table / 1 character" gating semantics are more ambiguous than the rough draft assumed** — flagged independently in Phase 1 (CEO Section 4), Phase 2 (Design, missing-states finding), and Phase 3 (Eng, hidden-complexity finding, with the most technical depth: owned-vs-invited and by-reference-character specifics). High-confidence signal across all three phases.

**Theme: never interrupt a live session** — flagged independently in Phase 2 (Design, explicitly requested callout, most fully developed) and Phase 3 (Eng, carried forward as the top-priority test case). High-confidence signal.

**Theme: the codebase has more usable existing infrastructure than the rough draft gave it credit for** — flagged in Phase 1 (0B existing-code-leverage map), Phase 2 (0C design leverage — `SessionBlockedBanner`, `FullPageOverlay`), and Phase 3 (What Already Exists — `item_popularity` dedup pattern, `node-cron`, ownership-check pattern). This is a consistently positive theme across all three phases: the architecture is sound to build on, the main gap is specification and sequencing, not a need to rebuild.

## Deferred to TODOS.md

1. **Full observability/alerting stack** (Sentry-equivalent, status page, on-call rotation). Why: real need before *broad* paid launch; not a same-day addition. Interim substitute now in scope: structured webhook logging + reconciliation cron.
2. **BYO-API-key as a complementary AI-cost escape valve** (alongside metering, not instead of it). Why: valuable for power users, but restructuring the AI UX around it is a larger effort than fits this plan's immediate scope.
3. **Multi-region / multi-machine redundancy.** Why: architecturally free later given the existing SSE/LISTEN-NOTIFY design, but not needed at `min_machines_running: 1` scale yet.

---

## Round 2: Investigation Findings and Refined Proposals (2026-07-14)

The user gave real answers to the Phase 4 items. Decisions #11 (downgrade/overage), #13 (grace period), and #19 (indicator placement) are now CONFIRMED — see their updated Decision Audit Trail rows above and Implementation Task T15. Decision #4 (automation policy) is CONFIRMED with a precision check below. The remaining four items (#3's added scope, #5, and #1/#2/#18 folded together) required direct investigation before an honest answer was possible; findings and concrete proposals are below, **not yet locked into the Decision Audit Trail as final** — each ends in a specific recommendation for the user to pick from.

### R2.1 — Automation policy: precision check on "presenting the card for GM acknowledgement" (Decision #4)

**In this codebase's own vocabulary, the actual pipeline behind "the core loop" is:** a card/weapon/feature triggers a roll → the server rolls dice (`crypto.randomInt`) and writes a `dice_rolls` row → the `banners` Postgres LISTEN/NOTIFY channel pushes it to every connected client → `DiceRoller` renders a `ResultBanner` for that roll → the GM clicks **Acknowledge** or **Cancel** (`POST /api/room/my/banner-ack`) → **on Acknowledge, for every feature currently at `Done`/`Partial` status, the engine applies the mechanical consequences automatically as part of that same click** — HP/Stress/Hope/Armor changes, `featureUsage`/`activeModifiers` bookkeeping, cost deduction — confirmed by direct code read: `applyFeatureResources` in `src/client/components/GMTableView.jsx` runs on banner dismiss/acknowledge, and `docs/srd-implementation.md`'s own Classes-section language is explicit that "Resource costs (Hope/Stress/Armor) are applied on banner dismiss," not typed in by hand afterward.

**Precise answer to the user's restated definition:** "presenting the card to the table for GM acknowledgement" **correctly identifies the mechanism** (a card surfaces as a roll+banner, and the GM's Acknowledge is the trigger point) but, read literally, is ambiguous about whether *acknowledgement itself* includes the automatic resource mutation or whether that's a separate manual step. **It is not separate — it's the same click.** If the user's intent was narrower than that (e.g., "just show the card and banner, let humans do all the HP/Stress/cost bookkeeping by hand even for what's already `Done`"), that would be a real scope *cut* from what's currently built and working (and liked) — not a restatement of Decision C, and should be said explicitly rather than assumed. Absent that explicit correction, this review treats the user's answer as **confirming Decision C as originally written**: automate the roll-to-mutation pipeline for core-loop mechanics (dice, HP/Stress/Hope/Armor, map/range, weapon/armor properties); accept `Display`-only (banner-free, mutation-free, pure text) as the deliberate permanent end state for narrative/flavor cards.

### R2.2 — Character state storage: where does play state actually live? (Decision #10 / the "1 character" question)

**Direct code findings, with citations:**

- `src/client/lib/table-ops.js` lines 36-76 define `CHARACTER_RUNTIME_KEYS` — the exhaustive list of fields treated as per-placement runtime state: `currentHp`, `currentStress`, `hope`, `currentArmor`, `conditions`, `featureUsage`, `activeModifiers`, `companion` (incl. companion stress), `activeBeastform`, `prayerDice`, `featureState`/`featureStateDeclared`, `focusTargetId`, and every other in-session tracker the user asked about.
- `server.js` line 933: `CHARACTER_PERSIST_KEYS = new Set([...CHARACTER_RUNTIME_KEYS, 'id', 'name'])` — this is *exactly and only* what gets written to a `table_state` row's `elements` array for a character element (line 2182-2184: every `table_state` save strips characters down to this set before hitting the DB).
- `src/db.js` lines 1086-1105 (`resolveCharacterElements`) is the read-time proof: for each character element, it fetches the **library** `characters` row (`lib`) and merges `{ ...lib, ...runtime }`, where `runtime` is pulled *from that specific table's stored element*, not from the library row. The library row supplies name/class/subclass/traits/weapons/etc.; the **table's own copy of the element** supplies the actual play state.
- `src/db.js` lines 1110-1120 (`stripCharacterElementsForDb`) confirms the inverse: writes only ever persist the runtime-key subset back into that one table's row.

**Confirmed answer: (b).** Character play state is stored **independently per (character, table) placement**, inside that table's own `table_state.elements` JSONB array — not once per library character. If the same library character (one `characters` row) is placed onto 3 different tables (e.g. a player who plays the same PC concept as a guest in 3 different friends' campaigns), it accrues **3 fully independent HP/Stress/Hope/Armor/featureUsage/etc. blobs**, one embedded in each of those 3 tables' own state rows. Editing the library original only ever refreshes the shared *base data* (name, class, weapons, etc., via the `characters`-save side effect at `server.js` lines 2193-2199, which triggers a `table_state` re-resolve for every room the saving user is in) — it never touches or overwrites any table's own runtime blob.

**Does this matter for the "1 character" free-tier question? Three concrete counting schemes:**

| Scheme | What it counts | Simplicity to build | Cost/fairness accuracy |
|---|---|---|---|
| **A. Library rows** — `COUNT(*) FROM characters WHERE user_id = uid` | How many distinct heroes you've built, regardless of how many tables they're placed on | **Trivial** — this is exactly today's `characters` collection semantics, zero schema change, one query | Slightly undercounts total runtime-state storage (N placements = N small JSON blobs, one per table), but see fairness note below |
| B. Distinct (character, table) placements | Every table a character has ever been added to, counted separately even for the same library row | Non-trivial — no existing index/query answers "which tables is character X on" without scanning every `table_state.elements` array app-wide; would need a new join table | Most "precise" proxy for storage, but punishes exactly the prosocial multi-table-guesting behavior common in this hobby |
| C. Treat this as a non-issue: table count already bounds real hosting cost | N/A — don't count characters differently at all | Trivial (same as A) | **Correct**, because the actual per-table hosting unit (a `table_state` row + its SSE stream + subscription channel) is already capped by the *table owner's* own tier (Decision #9: owned tables only). A guest character placed on someone else's table adds negligible marginal JSON, and that table's cost is already billed/gated to its owner, not to the guest |

**Recommendation: A, understood through the lens of C.** Count library `characters` rows only (zero schema change — literally what's implemented today), and don't treat the "N tables it's placed on" dimension as a billing concern at all, because table count — already separately gated per owner (Decision #9) — is the actual proxy for hosting/compute load, not character count. A single free player's one character joining 10 different friends' tables costs those 10 table owners (each already capped or paying), not this player, and each placement's storage footprint is a few KB of JSON inside a row that already exists. Character count is best understood as a **feature-access gate** ("how many heroes can you build/save"), not a cost-control lever — the cost-control lever is table count, which is separate and already decided. The only place this *could* become a real concern is aggregate server load at 10x-100x scale (more total SSE connections/subscription channels across the whole app) — but that is a capacity-planning question already flagged in Eng Section 1 (`min_machines_running` change), not a reason to change how "1 character" is counted.

### R2.3 — Deactivating unfinished categories + informing users of manual expectations (Decision #3 addendum)

**Real numbers from `docs/srd-implementation.md`** (the domain-cards/abilities section is the clearest test case, since it's the largest single collection at 189 elements across 9 domains × 21 cards):

| Domain | V2 automation status |
|---|---|
| Arcana | Partial — Tier 1 **and** Tier 2 cards automated in `features-v2/abilities/Arcana/` |
| Bone | Partial — several Tier 1 cards automated (Untouchable, Ferocity, Strategic Approach, Brace, Tactician, Deft Maneuvers, I See It Coming) |
| Midnight | Partial — Tier 1 cards automated |
| Sage | Partial — Tier 1 cards automated |
| Splendor | Partial — Tier 1 cards automated (e.g. Mending Touch) |
| **Blade** | **Display — 0 of 21 automated** |
| **Codex** | **Display — 0 of 21 automated** |
| **Grace** | **Display — 0 of 21 automated** |
| **Valor** | **Display — 0 of 21 automated** |

**This does not cleanly support a single level-based cutoff across the board** — the actual shape is *per-domain*, not a uniform "everything above level N is unfinished." 4 of 9 domains (Blade, Codex, Grace, Valor) have zero mechanical automation at any level; the other 5 have automation concentrated at low character-tier levels (mostly Tier 1, i.e. level 1) with higher levels in those same domains still Display-only. So the concrete, data-grounded scheme is **per-domain + per-card completeness labeling, not a single level cutoff**.

**What "deactivate" should concretely mean — and one important correction:** the engine already does the more damaging half of this by construction. Direct code read of `src/client/components/features/GuideFeatureCard.jsx` (the shared renderer used by `CharacterAbilityList`, i.e. every domain card on the sheet) confirms: a card only gets an interactive chip/Use-button/roll-icon if its V2 registry module defines a `cards`/chip entry; if not, it renders as **plain markdown text with no clickable affordance at all** — there is no "button that does nothing" bug to fix. So literally *disabling selection* of Blade/Codex/Grace/Valor cards (or high-level cards in the partial domains) would be a **worse** experience, not a better one — it would make SRD-legal character options unpickable for a paid product, actively fighting the game's own rules (a level-6 character legitimately needs to be able to take a level-6 domain card in any of their class's domains). **The actual gap is a missing label, not missing suppression:** today, a Display-only card and an intentionally-narrative-forever card (e.g. ancestry features `docs/srd-implementation.md` already marks "Yes — should be display-only by design") render **identically** — plain text, no chip — so a player has no way to tell "this is a permanent read-and-adjudicate card" from "this hasn't been automated yet but might be." Confirmed via grep: **no player-facing implementation-status badge exists anywhere in `src/client` today** — the `Done`/`Partial`/`Display`/`None` maturity model lives only in the maintainer-facing `docs/srd-implementation.md`.

**Concrete proposal:** add one small, consistent visual label (reusing the existing `.dh-badge-*` chrome convention) on every card/feature/domain-ability row that has no interactive chip — something like a muted "Read & adjudicate" or "GM calls it" tag — sourced from a small new per-domain/per-card completeness map derived from the same data already tracked in `docs/srd-implementation.md` (this doc would need to become partially machine-readable, e.g. a generated JSON alongside it, rather than purely prose, to drive the client badge — a small, contained, one-file addition, not a new subsystem). This is the concrete translation of "inform users when they're expected to do things manually," built on the existing chip-suppression behavior rather than adding a new mechanism, and it applies uniformly regardless of which domains/tiers end up automated next (no need to hardcode "Blade is bad" anywhere — the badge just reflects whatever the registry currently supports, always accurate as V2 migration progresses).

### R2.4 — Business model: research on Demiplane Nexus + 3 concrete hybrid proposals (Decisions #5/#18, folded together)

**Demiplane Nexus, verified via WebSearch (not assumed):** Demiplane's Daggerheart offering is a **$34.99 one-time purchase** that unlocks the digital rulebook, character builder/sheets, and GM tools (encounter builder, journal, Hope/Fear trackers) — permanently, no recurring payment required to keep that access. A **separate, genuinely optional** ~$4.99/mo subscription exists, and it does exactly two things: removes the cap on how many characters you can build, and lets you **share** your purchased content with up to 24 other people (so your players don't each need their own $34.99 unlock). Crucially, **Demiplane does not host live multiplayer tables at all** — no maps, no tokens, no realtime sync; it's the "character layer" only, explicitly paired with Roll20 (which has its own separate subscription) for the "table layer." One real risk signal surfaced directly in a Roll20 forum thread found during this search: a user complaining about paying "$34.99 plus $4.99 a month" and being unclear what the ongoing subscription even buys them — a concrete cautionary data point about combining a one-time price with an unclear-value recurring add-on.

**This matters for "walking the line" the way Demiplane does:** Demiplane's subscription isn't recovering *hosting* cost (they don't host tables) — it's a feature/seat unlock. Daggertop's situation is genuinely different: this app **does** host live multiplayer tables (real Postgres + SSE + compute cost per active table), so a literal copy of Demiplane's shape wouldn't actually solve the hosting-cost problem the user raised. The proposals below adapt the *spirit* (one-time core + optional recurring perk layer) to Daggertop's actual cost structure.

**Proposal 1 — One-time core unlock + separate recurring "hosting" tier, with self-hosting as the free-tier alternative: NOT RECOMMENDED, sanity-checked against the architecture.** This app requires Postgres, Firebase Auth configuration, Node.js, and (optionally) Supabase Storage — the `README`/`project.mdc` "Running the App" instructions are maintainer-oriented (nvm, submodules, migrations), not something the target audience (hobbyist Daggerheart GMs, not developers) could realistically self-host. Making self-hosting a real second pillar of the business model would fragment support and serve only a tiny technical minority. **Rejected as a primary mechanism** — at most, a far-future BYO-infra escape valve for power users (already noted as deferred in the TODOS list), not a serious axis for this plan.

**Proposal 2 — One-time core unlock + consumable AI credit packs as the primary ongoing revenue mechanism.** Removes the 1-table/1-character cap for a one-time price (ballpark comparable to Demiplane's $34.99, though exact pricing is its own validation step, same as today's T1). Free tier still needs the hard 1-table/1-character cap — unchanged from today's design, just now removed by a one-time purchase instead of a monthly fee. New users get a small starter AI-credit grant (satisfies the user's "come with some credits so they can try it out"); more credits are sold in one-time top-up packs. Hosting/infra opex is treated as a fixed cost absorbed by the one-time price plus credit-pack margin, not something with its own dedicated revenue line. **This is the most reversible option** — there is no recurring commitment anywhere in the model, which directly and fully resolves the Section 10 reversibility concern (rated 2/5 for the original recurring-only Option A) rather than just softening it.

**Proposal 3 — One-time core unlock + a light, genuinely optional recurring "supporter" tier (extra/faster AI credits, early SRD content access) — closest real analog to Demiplane's actual shape, and this review's recommendation.** Same one-time core unlock as Proposal 2 (same free-tier cap logic, same removal mechanism). Layered on top: an optional monthly tier bundling a larger monthly AI-credit allotment + generation priority/speed + early access to newly-migrated V2 content — reusing the *same* credit ledger as the one-time top-up packs (one build, two ways to acquire credits: monthly grant or one-time purchase), so this doesn't require a second parallel system. This most literally matches what the user pointed at in Demiplane (one-time content unlock + optional recurring perk subscription) while fixing the part of Demiplane's shape that doesn't map to Daggertop (Demiplane's subscription isn't for hosting cost; this one explicitly is, cast as "support ongoing hosting + get more/faster AI"). It reintroduces a *bounded* amount of the original reversibility risk — only for the optional perk layer, never for core table/character access — so if the supporter tier turns out mispriced or unpopular, killing or changing it never threatens anyone's access to their actual game, unlike the original all-recurring Option A. Free tier cap logic is unchanged from Proposal 2.

**Recommendation (superseded by Round 3 below for the hosting-cost-informed version): Proposal 3**, with Proposal 2 as the immediately-simpler fallback if the team wants to ship faster and add the supporter layer later (the credit-ledger work is shared between both, so this isn't a fork — Proposal 2 is strictly a subset of Proposal 3's build). Both proposals substantially **de-risk** the engineering plan versus the original Option A: T7 (Stripe webhook/Checkout) becomes simpler for the core purchase (`mode: 'payment'`, no subscription lifecycle) with the recurring-lifecycle complexity (dunning, grace periods, Decision #13) now scoped *only* to the optional non-critical supporter layer; and the entire "downgrade data fate" anxiety that Design Phase 2/3 rated as the plan's single highest-stakes ambiguity (2/5 reversibility) is structurally defused for the core product, since core access, once purchased, is never at risk of payment-failure lockout.

---

## Round 3: Concrete Designs for the Round 2 Picks (2026-07-14)

The user responded to all three Round 2 proposal sets. Two are now fully engineered and CONFIRMED (Decisions #10 and #20 above); the business model remains the one genuinely open item, now with real cost data attached.

### R3.1 — Character-table-placement tracking (Decision #10, Scheme B)

**New table**, mirroring the exact `item_popularity` `ON CONFLICT DO NOTHING` idempotent-insert pattern (`migrations/006_create_item_popularity.sql`, `src/db.js` `recordClone`/`recordPlay`):

```sql
-- migrations/0XX_character_table_placements.sql
CREATE TABLE IF NOT EXISTS character_table_placements (
  app_id       TEXT NOT NULL,
  user_id      TEXT NOT NULL,   -- owner of the `characters` library row (whose free-tier cap this counts against)
  character_id TEXT NOT NULL,   -- characters.id (library row, items.collection='characters')
  table_id     TEXT NOT NULL,   -- table_state.id (items.collection='table_state')
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, user_id, character_id, table_id)
);

CREATE INDEX IF NOT EXISTS character_table_placements_user_idx
  ON character_table_placements (app_id, user_id);
```

`user_id` is **not** necessarily the caller (`req.uid`) — it must be the `characters` row's actual owning `user_id`, looked up via the existing `getItemsByIds(appId, 'characters', ids)` helper (`src/db.js` lines 401-421, already returns `user_id` per row without needing it as an input — `items`' primary key is `(app_id, collection, id)`, not `user_id`-scoped, so this lookup works regardless of who is placing the character). This matters because both entry points below can be invoked by someone other than the character's owner in principle, and the cap must always attach to the actual library owner.

**Two new `src/db.js` exports**, same style as `recordClone`/`recordPlay`:
- `recordCharacterTablePlacement(appId, ownerUserId, characterId, tableId)` — `INSERT ... ON CONFLICT (app_id, user_id, character_id, table_id) DO NOTHING`.
- `countCharacterTablePlacements(appId, ownerUserId)` — `SELECT COUNT(*) FROM character_table_placements WHERE app_id=$1 AND user_id=$2`, used by the new `checkCharacterPlacementEntitlement(uid)` (this **replaces**, not supplements, the "character creation entitlement" concept sketched in T5 — see the ledger-semantics note below for why creating a library character is uncapped and only *placing* one is metered).
- `removeCharacterTablePlacementsForTable(appId, tableId)` — plain `DELETE ... WHERE app_id=$1 AND table_id=$2`, used only by the table-deletion endpoint (T3) so a deleted table's placements don't permanently occupy a former owner's cap.

**Exact call sites (single funnel, both confirmed by direct code read):**

Both the GM path (`GMTableView` → `postTableOp` → `POST /api/room/my/op`, `server.js` line 3266) and the player path (`POST /api/room/:tableId/add-character`, `server.js` lines 3686-3739, which itself calls `applyOpToTableState(tableId, { op: 'add-elements', elements: [character] })` at line 3733) funnel through the **same** function: `applyOpToTableState(tableId, op)` (`server.js`, starts line 961). This is the single correct interception point — no duplicate logic needed at either route.

- **Add path**: inside `applyOpToTableState`, immediately after `const changes = applyTableOp(op, stateForOp);` (line 980) and *before* entitlement would block it (see enforcement note below): when `op.op === 'add-elements'`, filter `op.elements` for `el.elementType === 'character' && el.id` (every character element is by-reference per the existing `CHARACTER_RUNTIME_KEYS` model, so `el.id` — the library reference — is always present). Batch-resolve owners via `getItemsByIds(APP_ID, 'characters', ids)`, then call `recordCharacterTablePlacement(APP_ID, ownerUserId, el.id, tableId)` per character (idempotent — re-adding the same character to the same table it's already on is a no-op, not a new placement).
- **Enforcement point (same spot, gate *before* the DB write)**: for each character being newly added, if a placement row for `(ownerUserId, el.id, tableId)` does **not** already exist, check `countCharacterTablePlacements(APP_ID, ownerUserId)` against that owner's entitlement (1 for free tier, unbounded for paid); if at/over the cap, throw the same `err.statusCode = 400` pattern already used by `gateTableOpForPrepMode` (lines 970-976) so both call sites surface it as a normal 400 the client already knows how to render, before `applyTableOp` mutates anything.
- **Remove path — deliberately a no-op.** `remove-element` (`table-ops.js` lines 167-182) and `clear-table` (lines 183-194, which explicitly **keeps** all character elements — "Characters survive Clear Table" is existing, confirmed behavior) never touch `character_table_placements`. This is a considered design choice, not an oversight — see the ledger-semantics note immediately below.
- **Table deletion (T3, `DELETE /api/my-tables/:id`)**: must additionally call `removeCharacterTablePlacementsForTable(APP_ID, tableId)` so deleting a table frees up every placement it held — the only path by which a placement is ever removed.

**Ledger semantics — a deliberate design decision, not an ambiguity left open:** a placement, once recorded, is **never decremented by removing the character from that table** — only by deleting the table outright. This directly follows the user's own rationale ("each character↔table relation is a whole gaming experience") more literally than a live decrementing count would: the experience already happened, so being benched or leaving a still-running campaign doesn't retroactively un-spend it. The alternative (decrement on `remove-element`, symmetric with how table deletion frees up the table cap) was considered and rejected here because it would let a free user cycle the same character on and off a table indefinitely to dodge the cap, defeating the "one experience" framing entirely — a live-count design has no way to distinguish "removed because the campaign ended" from "removed and re-added seconds later to reset the meter." If this reading of the ledger's permanence is wrong, it is cheap to change later (the removal-path no-op is one `if` branch), but it should not be treated as still-undecided — it is the design being shipped.

**Free-tier UX implication, stated plainly (per the request not to bury it):** under Scheme B, a free user's one character used as a one-time guest in a second friend's campaign — even if they never touch that second table again — permanently consumes their placement cap. A free account effectively gets **one game experience total per library character**, not "unlimited guesting with your one hero" and not even "one game at a time." This is a real, meaningfully more restrictive shape than Scheme A would have given (Scheme A would have let that same free user guest anywhere, unlimited, as long as they kept it to one *library row*). This is stated here as a confirmed, intended product behavior matching the user's own value-based rationale — not something to soften or walk back silently.

### R3.2 — Released ability tier ceiling (Decision #3 addendum / #20)

**Confirmed reading restated precisely:** a single global numeric value — the "released ability tier ceiling" — starts at **0** (nothing released: every domain-card chip is suppressed regardless of whether its V2 registry module actually implements it, so all 189 domain cards render as plain Display text for every user, uniformly). It bumps to **1** only once Tier 1 (character-tier 1, i.e. card `level === 1`) is automated across **all 9 domains** — at which moment every Tier 1 card becomes interactive for every user in one deploy, not gradually per-domain. This is confirmed as the intended reading.

**Where the ceiling lives — recommendation: a plain exported constant in `src/game-constants.js`.**

```js
// src/game-constants.js
export const RELEASED_ABILITY_TIER_CEILING = 0; // bump to 1 only once Tier 1 automation ships for all 9 domains
```

Rejected alternatives, with reasons:
- **Env var** — worse than a constant here: it needs to be set consistently across every deploy target and isn't directly importable by client code the way `game-constants.js` already is (per `project.mdc`, this file is the documented single source of truth for shared server+client constants, re-exported via `src/client/lib/constants.js`); using an env var would need extra plumbing through `GET /api/config` for no benefit over a constant that's already shared by construction.
- **DB-backed admin-toggleable value** — over-engineered for this specific lever: the ceiling can only *correctly* move in lockstep with an actual code deploy (the Tier-1-for-all-9-domains V2 modules merging), so a live-toggle would just create a foot-gun (an admin could flip the flag with the shipping code not actually present yet, silently misrepresenting automation status to every user). A code constant that changes exactly once per genuine migration milestone is the right cadence, not a live dial.

**Enforcement point — confirmed by direct code read, generic and framework-boundary-compliant.** `GuideFeatureCardChips` (`src/client/components/features/GuideFeatureCard.jsx` line 591: `if (!model.cardChips?.length) return null;`) and `GuideFeatureCard` (line 1347: `hasVisibleCardChips = model.cardChips.length > 0 && !hideV2CardChips`) are both driven entirely by `model.cardChips`, which is computed once, upstream, in `buildFeatureCardModel` (`src/client/lib/build-feature-card-model.js` lines 343-358, via `collectChips`/`buildChipsForFeature`). This is the single correct choke point: every consumer (character sheet, hover card, Actions strip, Game Table) already renders Display-only (no button, no chip) whenever `cardChips` is empty — no new suppression UI needs to be built, only a new reason for `cardChips` to come back empty.

The check to add, at the top of `buildFeatureCardModel`, before `cardChips` is computed: if `row._source === 'ability'` (the **generic** tag `feature-loader.js` line 329 already assigns to *every* domain-card row, regardless of which domain or card — not a per-card or per-domain name check, so this stays compliant with the V2 framework-agnostic boundary rule) **and** `row.level` is present, compute `tierFromLevel(Number(row.level))` — reusing the existing, already-shared `tierFromLevel` helper (`src/client/lib/character-calc.js` line 126, currently used for character-level → character-tier; domain card levels use the identical 1/2-4/5-7/8-10 tier bands per the SRD's own rules, so this is a legitimate reuse, not a new concept) — and if that tier exceeds `RELEASED_ABILITY_TIER_CEILING`, short-circuit `cardChips` to `[]` before the registry lookup runs, regardless of what that card's actual `features-v2/abilities/**` module would otherwise return. Purely numeric, purely structural (`_source` tag + `level` field every ability row already carries), zero per-card or per-domain branching — compliant with `.cursor/rules/v2-framework-boundaries.mdc`.

**Remaining migration scope, counted directly from the SRD data (`daggerheart-srd/.build/03_json/abilities.json`, not estimated):** every domain has exactly **3** level-1 (Tier 1) cards (21 cards × 9 domains = 189 total, verified). 5 of 9 domains (Arcana, Bone, Midnight, Sage, Splendor) already have their 3 Tier-1 cards automated in V2. The 4 domains at 0% automation — **Blade** (Get Back Up, Not Good Enough, Whirlwind), **Codex** (Book of Ava, Book of Illiat, Book of Tyfar), **Grace** (Deft Deceiver, Enrapture, Inspirational Words), **Valor** (Bare Bones, Forceful Push, I Am Your Shield) — contribute **12 total Tier 1 cards** that need V2 implementation before the ceiling can move from 0 to 1. This is a real scheduling input: at whatever per-card V2 implementation pace the ongoing migration runs, "all domain cards ship as Display-only" is the product's state for as long as those 12 cards remain unclaimed, independent of and parallel to the billing/monetization build — the whole point of the ceiling design is that this migration work does not block or gate the subscription launch.

**This is a distinct, smaller task from the migration work it gates** — Implementation Task T20 below is "build the ceiling mechanism" (one constant + one generic check in `build-feature-card-model.js`), not "implement the 12 remaining Tier 1 cards" (which is ordinary, ongoing V2 migration work tracked the normal way via GitHub Issues / `docs/v2-migration-tracker-snapshot.md`, sequenced by the existing "Work features" agent dispatch, not by this plan).

### R3.3 — Business model: hosting-cost estimate and Proposal 4 (Decision #21, historical — superseded by Round 4/5, see R4.7)

**Railway pricing, verified via WebSearch against Railway's own docs (not assumed from memory):** Hobby plan is $5/month, including $5 of usage credit; Pro is $20/month per seat, including $20 of usage credit. Usage-based rates beyond the included credit: **RAM $10/GB-month, CPU $20/vCPU-month, network egress $0.05/GB, volume storage $0.15/GB-month** — all billed per-second/per-minute for actual consumption, not a fixed reservation. Postgres and other databases run as ordinary services billed at those same per-resource rates, not a separate line item.

**(a) Baseline cost for the user's current single-weekly-group pattern:** this app's Node process is single, always-on (SSE connections + the dedicated `subscriptions.js` LISTEN `pg.Client` both require it to stay resident, not scale-to-zero), with a modest memory footprint (SRD collections cached in memory at startup, per-connection buffers) — likely a few hundred MB resident, so **$3-6/month in RAM** at the $10/GB-month rate; CPU usage is genuinely bursty and cheap for a single lightly-used group (mostly idle except during the weekly ~3-hour session), likely **$1-3/month**. Egress for JSON snapshots + occasional images (map images go to Supabase Storage, not Railway, per `project.mdc`) is well under 1GB/month, **negligible**. The dominant cost is **Postgres**: a small always-on instance for `table_state`/`dice_rolls`/`items` plus the constant LISTEN/NOTIFY connection commonly runs **$15-25/month** in real-world Railway usage reports for a minimal always-on database service (this is a documented pattern independent of this specific app — small Postgres instances on Railway routinely cost more than the bare compute math suggests once the managed-service overhead is included). **Total baseline estimate for the user's current one-group usage: roughly $20-35/month** — plausibly *above* the $5 Hobby-plan included credit already, which matches "I've been hosting on Railway" as a real out-of-pocket line item, not a rounding error.

**(b) Marginal cost per additional concurrently-active table:** the architecture genuinely favors low marginal cost here — SSE fan-out means each additional simultaneous table adds N more idle-but-open connections (cheap: tens of KB of memory per connection, not CPU) plus small, targeted JSON snapshot pushes only when that specific table's state actually changes (a roll, a token move) — not continuous per-table compute. The single dedicated LISTEN `pg.Client` (`subscriptions.js`) does not multiply per table; it is one connection regardless of concurrency. Realistic estimate: on the order of **$0.50-$2/month in marginal usage-metered cost per additional table that runs one weekly multi-hour session**, dominated by the DB query bursts during actual play, not by holding the connection open.

**Sanity-checking "50 one-time customers, weekly 3-hour sessions each":** because Railway bills actual per-second consumption (not per-seat), what matters is **peak concurrency**, not raw customer count. If those 50 tables' sessions are staggered through the week (realistic — different groups, different schedules), the aggregate incremental draw stays modest: roughly **$40-80/month total**, i.e. the ~$20-35/month single-group baseline plus a few dollars of marginal draw per additional typically-concurrent table. Worst case — most groups clustering into the same Friday/Saturday-night window, pushing peak concurrency toward all 50 at once for a few hours weekly — could push toward **$100-150/month**, still governed by the same per-resource rates, not a runaway cost curve. Either way, this is a real, non-zero, **permanently recurring** monthly line item, not a one-time cost that disappears.

**Honest verdict on Proposal 4's core dependency:** "one-time purchase, zero recurring revenue, no AI" is **not structurally sound at sustained scale**, and the reason is not that the per-session hosting number is scary (it isn't — $40-150/month for 50 active groups is modest) — it's a **cash-flow-timing mismatch**: a one-time payment is a single inflow at the moment of purchase; hosting cost is a **perpetual monthly outflow** that continues for as long as that customer's table(s) stay active, which for a TTRPG campaign can be months to years. Every new cohort of one-time customers adds *permanent* recurring hosting liability with *zero* matching recurring inflow to offset it. This works fine short-term (funded out of the float from earlier one-time sales) and is *exactly* why the user's current single-group setup is a non-issue (it's a hobby cost they already absorb) — but it does not scale, because cumulative recurring cost keeps climbing with the *installed base* of ever-created tables while one-time revenue growth inevitably decelerates once the addressable market saturates (a real risk for a niche TTRPG tool, not a hypothetical one). At some point the two lines cross, and a pure one-time model has no lever to pull when they do.

**Honest caveat on Proposals 2 and 3, now that real hosting numbers are on the table:** neither actually *guarantees* hosting-cost coverage the way a strict "pay for what you host" model would — both make the recurring/consumable revenue mechanism (AI credits, or the optional supporter tier) **orthogonal** to the actual cost driver (active table count). A customer could buy the one-time core unlock, host several tables for years, and never spend a dollar on AI credits or the supporter tier — consuming real, ongoing hosting cost while contributing zero further revenue after the initial purchase. Proposal 3's supporter tier is still the better of the two on this specific point (it exists as *a* recurring-revenue mechanism at all, and its pitch — "support ongoing hosting + get more/faster AI" — is at least framed around hosting cost even if not strictly metered to it), whereas Proposal 2's AI-credit-pack revenue has no causal link to hosting cost whatsoever. Proposal 4 has no mechanism in this direction at all, which is the more fundamental gap.

**Recommendation, unchanged in ranking but sharpened by the data: Proposal 3**, specifically *because* it is the only one of the three real options (2/3/4) with a recurring-revenue mechanism that exists at all, even though its link to actual hosting cost is a framing choice rather than a strict metering — Proposal 4 has none, and Proposal 2's link is coincidental. This is not a locked decision — it is the numbers-grounded case for keeping Proposal 3 over the newly-proposed Proposal 4, presented for the user to make the final call with real cost data in hand rather than a hand-wave. A refinement worth flagging (not deciding here): if hosting-cost coverage specifically is the priority, the supporter tier's value proposition could later be widened to include hosting-adjacent perks tied more directly to table count (e.g., extra hosted tables beyond the one-time unlock's baseline) rather than purely AI-credit perks — but that is a pricing/packaging refinement for a later pass, not a blocker on picking among 2/3/4 now.

---

## Round 4: Business Model — Outside-the-Box Synthesis (2026-07-14)

The user was unsatisfied with Proposals 1-4 above and asked for genuinely divergent brainstorming, outside the "recurring vs. one-time vs. hybrid" frame those four proposals were confined to. Two independent brainstorms were produced (the user's own verbatim idea, and a full independent Grok 4.5 agent analysis) and are synthesized here into a new, concrete recommendation. **Proposals 1-4 and R2.4/R3.3 remain in the historical record below — this section supersedes them as the live recommendation, it does not delete them.**

### R4.0 — What both brainstorms agree on, and why that agreement is significant

Two independently-produced brainstorms — one from the user reasoning from first principles about LTV/LTC, one from a separate AI agent reasoning from Railway's actual per-resource billing model — converged, unprompted, on the **same specific mechanism**: a time-boxed free table trial whose clock starts at the *first real multiplayer session* (not at signup, not at table creation), rather than a perpetual free table. The user's own phrasing: "a free table for a month only (counting from the first time you start a session with other players in it or that join it)." Grok's independent framing: "Table free clock starts at first `sessionStarted` with ≥1 invited player connected... matches your instinct." Two independent reasoning processes landing on the identical mechanism (not just the identical *goal*) is a strong signal this is the right lever, and it anchors the recommendation below.

### R4.1 — Cost objects recap (grounded in the already-locked R3.3 hosting research, not re-derived)

R3.3 already established the real numbers this synthesis builds on — restated here only as an anchor, not redone:

| Cost object | R3.3 finding | Round 4 use |
|---|---|---|
| Baseline always-on infra (Postgres + LISTEN client + resident Node process) | ~$20-35/mo regardless of usage | Fixed overhead a paid cohort must cover in aggregate, not per-unit |
| Marginal cost per additional weekly-active table | ~$0.50-2/mo | The real per-table cost the Campaign Pass price (R4.3) must clear with margin |
| Marginal cost per additional *character* (library row, not placed) | Effectively **$0** (a few KB of JSON) | Confirms character creation should stay uncapped — already true today per R3.1/T19's own note |
| Marginal cost per additional character *placement* on a table | **Lands on the table's own hosting cost, not a separate line item** — SSE fan-out is cheap per connection (R3.3(b): the single dedicated LISTEN client does not multiply per table or per connection) | This is the crux of the Scheme B interaction below (R4.4) |
| Aggregate at ~50 concurrently-typical active tables | $40-80/mo staggered, $100-150/mo worst-case clustered | The scale at which a bounded, non-perpetual free-tier cost matters |

Grok's independent brainstorm re-derived compatible numbers from Railway's public per-resource rates (its own $1.25/mo weekly-use midpoint, ~$5/mo daily-heavy-use estimate, and a 10-year NPV of ~$77 per $1/mo of perpetual liability at an 8% discount rate) — these corroborate R3.3 rather than contradict it, and are used below only where R3.3 didn't already produce a number (e.g., NPV of a *perpetual* per-table price, which R3.3 didn't need to compute since it was evaluating a *one-time-core-unlock*, not a *per-table lifetime slot*).

### R4.2 — Developing the maintainer's "sell slots, priced for a decade of daily use" idea, and why it's rejected as the *primary* mechanism

Running the maintainer's own instinct through the numbers (using R3.3/Grok's cost figures): a **perpetual** per-table "slot" priced to stay profitable even under **daily** use for **10 years** needs to clear roughly $380-750 one-time (10-year NPV of $5/mo daily-use cost, at 50%+ gross margin) to be economically honest; priced only for **realistic weekly** use it still needs **~$100-200** one-time to clear R3.3's own $0.50-2/mo marginal figure over a decade with margin. Both numbers are far outside what a hobbyist TTRPG tool can charge for a single table slot (compare: Demiplane's entire content unlock is $34.99; Foundry's entire VTT license is ~$50) — and pricing it low enough to be marketable (e.g., $30-50, matching those comparables) reintroduces **exactly the cash-flow-timing mismatch Round 3 already rejected for Proposal 4**: one bounded inflow at purchase time, against an *unbounded, perpetual* monthly hosting outflow for as long as that table stays active, which for a real campaign is measured in years. This is worth stating plainly because it's a genuinely elegant symmetry: **the maintainer's own new idea (perpetual paid slots) and the already-rejected Proposal 4 (perpetual free access) fail for mirror-image reasons — both try to fund an unbounded recurring liability with a single bounded transaction, just on opposite sides of the ledger (Proposal 4: bounded revenue via a one-time purchase, but the customer still gets unbounded free hosting after; perpetual slots: the customer pays once, but Daggertop still owes unbounded hosting after).** **[FINAL, 2026-07-14]** A capped-quantity, feature-frozen pre-launch "Founding" perpetual-slot SKU was noted in the original draft of this section as one context where perpetual pricing could theoretically work — the maintainer explicitly rejected this: "No weird pre-launch, keep it simple." It is **not** part of this plan, in any form — not as a launch tactic, not deferred to `TODOS.md`. Every paid SKU in this product (the Campaign Pass, the optional GM Unlimited pass, AI credit top-ups) shares the same one shape: repeatable, time-boxed or consumable, non-subscription, `mode: 'payment'` (R4.3/R4.6) — there is no perpetual-purchase SKU anywhere in the product.

The maintainer's own brainstorm anticipated this outcome and pre-emptively proposed the fix ("we might want a way to 'recover' the ongoing cost of the initial free character/table by ameliorating it across their paid ones in the pricing model") — that is precisely what R4.3's Campaign Pass margin does, just applied to a **repeatable, time-boxed** purchase instead of a **single, perpetual** one, which is the change that makes the amortization arithmetic actually close (a bounded liability can be amortized; an unbounded one cannot, no matter the margin).

### R4.3 — FINAL, 2026-07-14: prepaid, non-subscription "Campaign Passes" + free players, time-boxed free table trial

**The maintainer confirmed: "I love Proposal 5."** This is now the locked business model — call it **Proposal 5**, and its paid SKU is the **Campaign Pass** (renamed by the maintainer from this section's original "Season Pass" working name — adopted throughout this plan). It adopts the spirit of Grok's top recommendation (prepaid hosting seasons sold to GMs, players free) but is not a straight copy of Grok's ranking — see R4.5 for where this synthesis disagreed with Grok's specifics (disagreements unaffected by this lock-in).

**Free tier (final):**
- **Table**: 1 owned table (unchanged — Decision #9), but now **time-boxed**: a single lifetime free-trial activation per user (not per table — see the abuse note below), running for **1 month of wall-clock time**, with the clock starting at the first moment that table has `sessionStarted === true` **and** at least one other real (invited/connected) player present — exactly the mechanism both brainstorms independently converged on (R4.0). Solo prep time before that moment never burns the trial. When the trial expires without an active Campaign Pass, the table becomes **read-only** — reusing the already-confirmed Decision #11 downgrade semantics verbatim, just with a new trigger (time expiry instead of tier-limit-at-creation or payment-decline). Enforcement fires only at session-start time, per the already-locked Decision #14 ("never interrupt a live session") — a trial expiring mid-session has zero effect on that session.
- **Character**: creation stays uncapped (already true today). **Placement is now uncapped too, FINAL** — the maintainer explicitly confirmed dropping Scheme B's placement enforcement ("We can drop placement enforcement"); see R4.4, which this lock-in moves from "pending sign-off" to **CONFIRMED**.
- **AI**: unchanged in shape from Proposals 2/3 — a small starter credit grant on signup, more sold in one-time top-up packs (R4.3 doesn't change this piece, only the core table/character gating around it).

**Paid SKU — Campaign Pass (the only required purchase to keep hosting a table beyond the free trial), FINAL pricing:**

| Pass length | Price | Effective $/mo | Margin over R3.3's $0.50-2/mo marginal cost |
|---|---|---|---|
| 3 months | $20 | ~$6.67/mo | ~3.3-13x |
| 6 months | $35 | ~$5.83/mo | ~2.9-11.7x |
| 12 months | $60 | $5.00/mo | ~2.5-10x |

Sanity check on the curve (per the maintainer's own framing, "$20 for three months... totally worth it, and it scales down from there"): $20/3mo ≈ $6.67/mo → $35/6mo ≈ $5.83/mo → $60/12mo = $5.00/mo is a normal declining-per-month-with-commitment-length curve, and every tier clears R3.3's $0.50-2/mo marginal per-table cost with healthy (2.5x-13x) margin — this pricing does not contradict anything already locked in the plan; it replaces the earlier illustrative $15/$25/$42 figures everywhere they appeared.

Buying any length simply sets/extends that specific table's paid-through date (see R4.3.1 for the exact ledger design — it is **not** the buyer's own account that gets extended, see below). Renewal is a conscious repeat purchase (a low-key reminder banner near expiry, reusing the existing non-interrupting banner pattern — never an auto-charge by default, matching Grok's "auto-renew optional not default" point and directly honoring "folks are subscription-shy"). The margin over marginal per-table cost is exactly the mechanism that funds (a) the bounded 1-month free-trial cohort's cost, and (b) a share of the ~$20-35/mo fixed baseline overhead, spread across the paying installed base — this is the maintainer's own "ameliorate the free cost across paid ones" idea, now applied to a bounded, non-perpetual unit so the arithmetic actually closes (R4.2).

**Optional convenience SKU — "GM Unlimited" pass (power-user perk, never required, not part of this lock-in — still illustrative/deferred packaging):** for GMs running multiple concurrent campaigns, an alternative prepaid pass (e.g., ~$75 / 6 months, priced above 2x a single 6-month Campaign Pass to reflect covering multiple tables) grants unlimited concurrently-active *owned* tables + a modest AI-credit boost, in the **same prepaid/expiry shape** as the Campaign Pass — not a second product shape, not a Stripe Subscription. This directly replaces what Proposal 3's "supporter tier" and Grok's "GM Unlimited sub" were both reaching for, without introducing a second kind of Stripe object into the codebase (see R4.5 for why this is a deliberate departure from Grok's literal recommendation). Unlike the Campaign Pass itself and its gifting mechanic (R4.3.1), this specific SKU's exact price and launch timing were not part of the maintainer's final answer and remain an open packaging question, not a blocker to shipping the core Campaign Pass.

**Illustrative LTV/LTC (using R3.3's own marginal-cost figures, not re-invented numbers):** a GM running one weekly table for 18 months, buying one 12-month Campaign Pass plus one 6-month renewal ($60 + $35 = $95 total) against ~18 months × $1.25/mo marginal cost (~$22.50): contribution ~$72.50 before baseline-overhead allocation. A GM running 2 concurrent tables for 3 years via the GM Unlimited pass (6 renewals × ~$75 = $450) against ~36 months × ~$2.50/mo (2 tables' marginal cost, ~$90): contribution ~$360. Both are healthy, and — critically — **the free-trial cohort's cost is now bounded** (at most 1 month × $0.50-2 per trial-taker, ever, per the lifetime-single-trial rule below) instead of an open-ended perpetual subsidy, which is what actually makes the "amortize the free cost across paid ones" arithmetic solvent (Round 3 already showed it is *not* solvent against a perpetual free table).

**Abuse-resistance note (new, not covered by either brainstorm verbatim, this reviewer's own addition):** because the trial is time-boxed rather than tier-capped-at-creation, a user could otherwise delete an expired trial table (via T3's delete endpoint) and create a fresh one to reset the clock indefinitely. The fix is the same permanence principle the user already embraced for Scheme B ("each character-table relation is a whole gaming experience," never decremented): the free trial is a **single lifetime activation per user**, tracked as a timestamp on that user's billing/entitlement row (extending T5's `billing_customers` table — or its Round-4-adjusted replacement, see T21 below), not reset by deleting the table it was spent on. This is a direct, symmetric reuse of a design principle the user has already confirmed elsewhere in this plan, not a new one being introduced.

### R4.3.1 — FINAL, 2026-07-14: "Anyone can gift a Campaign Pass" — table-keyed ledger, Stripe metadata, and player-reachable UI

The maintainer's extension to Proposal 5, verbatim: **"anyone, player or GM, should be able to pay for the... campaign pass for a table. The GM remains the owner/GM no matter who pays; it is explicitly a gift to the GM and can't be taken back."** This is a real design surface, not a small tweak — worked out precisely below, not hand-waved.

**Why this forces a different ledger shape than T5's original `billing_customers` design.** T5's original entitlement table was keyed by `user_id` (one row per buyer, tracking *their* subscription status). A Campaign Pass purchased by *anyone* for a *chosen table* cannot live there: the same table might be extended once by its GM and, months later, again by a player who never buys anything else — there is no single "buyer" whose `user_id` row the entitlement can hang off of. **The entitlement must be keyed by `table_id`, full stop**, decoupled from whichever human's payment method funded any given extension.

**New table: `table_campaign_passes` (entitlement, one row per table, table-keyed):**
- `app_id`, `table_id` — composite PK (one row per table, created lazily on first purchase).
- `paid_through_at` — timestamp; the single source of truth for "is this table's Campaign Pass currently active." A purchase sets it to `max(now(), current paid_through_at) + N months` (stacking consecutive purchases rather than overwriting, so a mid-pass top-up correctly extends from the *current* expiry, not from today).
- `lifetime_cents_total` — running sum of every purchase ever applied to this table, for the LTV/telemetry use the maintainer's own opening question asked about ("what's the LTV... of each... table?") — this is the direct table-side answer, parallel to what T19's placement ledger answers on the character side.

**New table: `table_campaign_pass_purchases` (append-only purchase history, one row per Checkout Session, still table-keyed but records the buyer separately):**
- `app_id`, `id` (serial PK), `table_id` (FK-by-convention to the row above, **not** the entitlement key itself), `purchased_by_user_id` (who actually paid — recorded for gift attribution, receipts, and "thank the player who gifted this" UI copy; **never** read by any entitlement check), `stripe_checkout_session_id` (unique, for webhook dedup — same pattern as T7's existing dedup design), `months` (3/6/12), `amount_cents`, `created_at`.

This two-table split is deliberate: **entitlement lives entirely on `table_campaign_passes.paid_through_at`, keyed only by `table_id`** — every "is this table live" check reads that one row and never needs to know or care who paid. `table_campaign_pass_purchases` exists purely for history, receipts, and analytics, and is never in the entitlement-check code path. This is what makes "GM pays month 1, a player gifts month 7" work correctly with zero special-casing: both purchases just extend the same `table_campaign_passes` row.

**`billing_customers` (T5) is not deleted, but its job shrinks to two genuinely per-user things** that are *not* about table access: (1) the single-lifetime-free-trial guard (`free_trial_started_at` / `free_trial_table_id`, per T21 — this is legitimately per-user, since it's "has *this person* ever used their one lifetime trial," not "is a table paid for"), and (2) the optional GM Unlimited pass, which *is* legitimately user-keyed (it grants a perk to *that GM's account* across all their owned tables, unlike a Campaign Pass which is scoped to one specific table by design). Core table access — the thing that actually gates play — never reads `billing_customers` at all after this change; it reads `table_campaign_passes` plus the trial-window fields.

**Stripe Checkout Session metadata and the webhook handler:** the buyer picks a target table *before* Checkout is created — a new endpoint (e.g. `POST /api/campaign-pass/checkout`, body `{ tableId, months }`) validates the requester currently has a relationship to that table (owns it, per `myTables`, **or** is an invited player on it, per `playerEmails`/`myRooms` — exactly the existing GM-or-invited-player check `resolveTableAccess` already performs for room routes) before creating the Session with `metadata: { targetTableId: tableId, months, purchasedByUserId: req.uid }`. The critical point: **`targetTableId` is a distinct metadata field from the Stripe customer/payment identity** — the webhook handler's `checkout.session.completed` branch for Campaign Pass purchases reads `session.metadata.targetTableId` (never `session.customer` or any `req.uid` from the original request context, since webhooks are unauthenticated server-to-server calls with no request context at all) and applies the extension to `table_campaign_passes` for **that** table id, regardless of whose Stripe customer object or card was actually charged. This is a one-line-of-reasoning but real implementation difference from T7's other purchase types (AI credit top-ups, the GM Unlimited pass) which *are* correctly keyed by the purchasing `userId` in their own metadata — Campaign Pass is the one purchase type in the whole product whose metadata target is a table, not the buyer.
- **Ownership is untouched, by construction, not by added safeguard.** The table's GM/owner (`items.user_id` / `table_state` ownership) is a completely separate field that no Campaign Pass code path ever reads or writes. There is no "protect ownership from the payer" logic to build — ownership was never wired to billing in the first place, and this design keeps it that way. This is worth stating explicitly so it's clear the maintainer's "GM remains owner no matter who pays" requirement is satisfied by *omission* (nothing connects the two), not by some new access-control check.
- **Irrevocable, matching the already-locked downgrade philosophy.** No code path ever decrements `paid_through_at` or `lifetime_cents_total`. If a Stripe refund or chargeback webhook is ever received for a Campaign Pass purchase, it is logged for support visibility only — it does **not** claw back table access. This is the same "never delete, read-only on lapse" principle (Decision #11) applied one step further: not only does access never regress below a prior paid state on payment *failure*, it also never regresses on a *reversed* payment for a gift already given. This needs one explicit line in the webhook handler (an early return / no-op on refund/dispute events for this purchase type) rather than being an accidental side effect of "there's no code to do it" — worth calling out as a deliberate design choice, not an oversight.

**UI entry point — reachable by invited players, not just the GM.** The existing 4 GM-facing surfaces from Design Phase 2 (pricing page, upgrade prompt, tier-limit modal, billing management) are extended with one new shared component reachable by **both** roles, placed concretely in the **Characters panel** (`GMTableView.jsx`'s left sidebar, `w-56` — per `project.mdc`, this panel already renders for players as well as the GM, unlike the Encounter panel which is GM-only and therefore cannot host this): a small persistent "Support this table" / gift icon-button next to the existing "+ Add Character" button, visible to the GM and every connected player equally. Clicking it opens a compact modal (reusing the `FullPageOverlay` shell per Design 0C's existing-leverage convention) that:
1. States unambiguously who and what is being paid for before any payment UI appears — e.g. *"Gift a Campaign Pass to **{gmDisplayName}**'s table: **{tableName}**"* — directly satisfying the "showing clearly which table/GM they're buying for before confirming payment, to prevent misclicks" requirement.
2. Shows current status plainly (e.g. "Free trial ends in 12 days" or "Covered through Oct 14, 2026") so the buyer knows what they're extending and from what baseline.
3. Offers the 3/6/12-month picker at $20/$35/$60 and redirects to Stripe Checkout on confirm.
- **No separate table-picker widget is needed**, and this is an elegant consequence of where the button lives rather than something that had to be separately built: the modal always targets **whichever table's `GMTableView` it was opened from** (`route.tableId` from the existing router). A player invited to multiple tables naturally scopes their gift correctly just by navigating to the right table first (via the nav bar's existing owned/invited table list) and clicking the button there — the "must support choosing any table they're a GM of or invited to as a player" requirement is satisfied by reusing navigation that already exists, not by building a new picker. A GM with exactly one table has zero ambiguity for the same structural reason.
- The same button/modal is shown to the GM too (not player-exclusive) — its copy adapts by role (GM sees upgrade-style framing when their own table needs a pass; a player sees gift/support-style framing), but it is **one shared component**, not two, extending T10's existing 4-surface set rather than adding a parallel one.

**Net effect on T5/T7/T10/T21** (exact task text updated below): T5's core-access entitlement design is superseded by this table-keyed model, not merely adjusted. T7's webhook handler gets one new branch keyed by `targetTableId` metadata instead of the purchaser. T10 gains one new shared, dual-role UI surface. T21 (Round 4's Campaign Pass engineering task) absorbs all of the above as its primary scope.

### R4.4 — FINAL, 2026-07-14: Resolving the Scheme B tension Grok flagged (the interaction with the already-locked Decision #10)

This is the specific interaction the task calls out, and it deserves a direct answer rather than a hand-wave.

**The tension, stated precisely:** Decision #10 (CONFIRMED) meters "1 character" as **1 free lifetime (character, table) placement**, enforced today by the T19-designed `checkCharacterPlacementEntitlement(uid)` check — i.e., a free user placing their one hero as a one-time guest on a second friend's table permanently spends their entire character allowance. Grok's independent critique: a placement's *marginal hosting cost is ≈$0* (R3.3(b)/R4.1 above — SSE fan-out is cheap per connection, and the cost that does exist lands on the *table*, which is already separately gated to its owner under Decision #9). Charging — or even just *rationing as if charging* — for something that costs nothing to provide, framed as "how many friends' games can you ever join," reads as "pay rent on friendship," and is a real risk to the free-to-paid *funnel* specifically: a friend of a paying, actively-recruiting GM who gets blocked from joining that GM's table because they'd already spent their one lifetime placement on an unrelated one-shot months earlier is a bad first impression of the product at the exact moment it should be converting well (word-of-mouth invites), not a bad impression of a genuinely scarce resource.

**Independent confirmation this is a real, not hypothetical, product effect:** Decision #10's own row already states the consequence plainly ("a free user gets one game experience total per character... not unlimited guesting with one hero") — this was accepted deliberately for *value*-based reasons ("it's not about cost, it's about value") at the time, before the table-centric Campaign Pass model existed as an alternative frame. Under the *new* model, the table side already carries its own value-based scarcity (the 1-month trial, then a purchase) — so Scheme B's placement cap is no longer the *only* thing standing between "free" and "paid," and keeping it as a *second*, cost-disconnected scarcity mechanism on top of the table-side one compounds the "punished for being social" effect without funding anything the table-side mechanism doesn't already fund.

**FINAL, 2026-07-14: keep the `character_table_placements` ledger (T19's tracking infrastructure), drop its use as a paid enforcement gate entirely.** The maintainer confirmed this directly and unconditionally ("We can drop placement enforcement") — this is no longer a recommendation pending sign-off, it is locked. Concretely:
- The `character_table_placements` table, `recordCharacterTablePlacement`, and the funnel-point wiring inside `applyOpToTableState` (all of T19's actual database/plumbing work) remain **unchanged and still built** — they are genuinely useful as **product telemetry**, which is a direct, elegant answer to the maintainer's own opening question in Brainstorm 1 ("What's the LTV and LTC of each customer, and each character-table combo?"). This ledger *is* the instrumentation needed to eventually answer that empirically (e.g., "how many distinct game-experiences is a typical paying vs. free user generating") — it is telemetry only, never a billing gate.
- `checkCharacterPlacementEntitlement(uid)` — the specific enforcement function T19 originally designed — is **not built**. Placing a character onto *any* table (as owner or as guest) is always allowed, gated only by whether that specific **table** is currently live (inside its free trial window or covered by an active Campaign Pass, per R4.3.1/T21) — a check that already has to exist for the table itself, so this isn't new surface area, it's the removal of a redundant, cost-disconnected one.
- This is **more decisive** than either brainstorm's literal suggestion (the user's original outside-the-box brainstorm proposed a 1-year time bound for characters specifically, distinct from tables; Grok suggested leaving placements "free forever" without explicitly revisiting whether the enforcement function should be built at all) — the maintainer's final answer went further than either, confirming placements are never metered at all, on the reasoning that once the table side is properly metered, a second cost-disconnected meter on the character side has no remaining cost-recovery job to do and only retains a downside (funnel friction). **Decision #10 is formally superseded by this decision** (Decision Audit Trail updated below) — this is not a partial reversal pending further input, it is the final, confirmed behavior.

### R4.5 — Where this synthesis agrees and disagrees with Grok's ranking

**Agree:** Grok's central thesis (tables are the real cost object, characters are not; sell prepaid hosting to GMs, not perpetual slots; keep players free; time-box the free table trial) is correct and is the spine of R4.3 above. Grok's critique of copying Demiplane's numbers literally (they don't host live tables, so their P&L doesn't transfer) is also correct and consistent with what R2.4 already found independently before Grok's brainstorm existed.

**Disagree, with reasoning:**
1. **Grok's Recommendation 2 ("optional cheap 'GM Unlimited' sub, ~$5/mo") as a literal recurring Stripe Subscription** — this synthesis instead recommends building it in the **same prepaid/expiry shape** as the core Campaign Pass (R4.3's "GM Unlimited pass"), not as a second product/billing shape. Reasoning: introducing even one optional true subscription object reintroduces the entire recurring-billing lifecycle (dunning, `invoice.payment_failed` handling, proration, cancellation semantics) that this whole synthesis exists to avoid, for a perk that doesn't need it — a prepaid multi-table pass with an expiry date delivers the identical user-facing value (unlimited concurrent tables until some date) with zero of that complexity, and keeps a genuinely appealing promise: **there is no subscription anywhere in this product, full stop** — which is a stronger, cleaner answer to "folks are subscription-shy" than "we have one cheap optional subscription."
2. **Grok's Model 4 (DDB-style generous perpetual free table, idle-evicted after 60 days)** — not adopted. Idle-eviction of a perpetual free table is a weaker, more fragile bound than a hard 1-month-from-first-real-session trial: "idle" has to be defined and monitored continuously (what counts as idle? does prep-only time count? does a GM who plays monthly get evicted between sessions?), whereas a one-time trial-window check is a single timestamp comparison, done once, at session-start. The time-boxed trial is simpler to build and impossible to game via "log in every 59 days to reset the idle clock," which idle-eviction is not.
3. **Grok's "Party Pack" SKU (table + guaranteed guest placements bundled)** — not adopted as a separate SKU, because under R4.4's recommendation guest placements are already unconditionally free; bundling them into a paid pack would be selling something that costs nothing and is already given away, which is the exact anti-pattern Grok's own critique (R4.4) argues against elsewhere in the same brainstorm. This is flagged as a place where this synthesis is arguably *more* consistent with Grok's own stated principle than Grok's own proposal list was.
4. **Grok's convention/one-shot 72-hour pass and referral-credit ideas** — plausible future packaging refinements, not adopted now; they don't change the core free/paid shape and are better suited to a later go-to-market pass (already out of scope per this plan's own goal statement) than this business-model decision.

### R4.6 — FINAL, 2026-07-14: confirming the Stripe integration reading (for T7), including the gifting nuance

The task's proposed reading — that prepaid seasons are a *simpler* Stripe integration than either pure recurring or pure one-time-forever — is **confirmed correct, with two precise nuances (one already flagged, one new from the gifting mechanic)**: a Campaign Pass purchase is a **Stripe Checkout Session in `mode: 'payment'`** (not `mode: 'subscription'`); on the `checkout.session.completed` webhook, the server reads `metadata.targetTableId` (see R4.3.1 — **not** the purchaser's identity) and sets/extends that table's `paid_through_at` timestamp in the new `table_campaign_passes` row. There is no Stripe Subscription object, no recurring invoice, no `invoice.payment_failed` event to handle, no proration, and no cancellation flow to build — renewal (by the same person or a different one) is simply another one-time Checkout Session later (prompted by a non-interrupting low-key banner near expiry, per R4.3). This is genuinely simpler than T7's originally-scoped recurring-subscription shape, and simpler still than even Proposals 2/3's one-time-forever-unlock shape, because a forever-unlock still has to handle *some* long-tail state (refunds, chargebacks reversing permanent access) whereas a short, cheap, repeatable pass purchase has much lower stakes per transaction — and per R4.3.1, refund/dispute events are explicitly a no-op for entitlement here, not even that long-tail state needs handling beyond a logged no-op.

**Nuance 1 (already flagged): auto-renew is explicitly out of scope by default.** If a future "auto-renew" convenience option is ever added (charging a saved payment method automatically at expiry, off-session), that specific opt-in feature *does* reintroduce a slice of recurring-billing complexity (decline handling, SCA/3DS re-authentication risk on off-session charges) — but only for users who explicitly opt into it, and it is explicitly **not** part of this recommendation's default (R4.3 treats renewal as always a conscious repeat purchase).

**Nuance 2 (new, from the gifting mechanic, R4.3.1): the webhook's entitlement target and the Stripe customer are deliberately decoupled.** Every other purchase type in this product (AI credit top-ups, the optional GM Unlimited pass) keys its webhook-side entitlement update by the purchasing `userId`. The Campaign Pass is the **one** purchase type whose webhook branch must ignore the purchaser's identity for entitlement purposes and act on `metadata.targetTableId` instead (while still recording the purchaser separately, in `table_campaign_pass_purchases`, for history/receipts — never for entitlement). This is a real branch in the webhook handler's purchase-type dispatch, not an edge case; T7/T21 must build it as a first-class case, not bolt it on.

This confirms the task's reading is correct for the recommended, now-locked default shape.

### R4.7 — FINAL, 2026-07-14: maintainer's confirmation and full lock-in

The maintainer's own words, verbatim, closing out every item this section had previously left open: **"I love Proposal 5. An extension: anyone, player or GM, should be able to pay for the season pass ('campaign pass'?) for a table. The GM remains the owner/GM no matter who pays; it is explicitly a gift to the GM and can't be taken back. We can drop placement enforcement. For pricing, I think we should go with 20/35/60. $20 for three months of a virtual table is totally worth it, and it scales down from there. No weird pre-launch, keep it simple."**

Every item R4.7 previously listed as "not resolved" is now resolved, FINAL, and locked:

1. **The core pick itself.** Decision #21 moves to **CONFIRMED** (Decision Audit Trail updated below). Proposal 5 — prepaid, non-subscription per-table Campaign Passes, gift-purchasable by anyone with a relationship to the table, plus a time-boxed free trial — is the business model. T1's willingness-to-pay validation experiment (below) now runs to *confirm real-world signal on already-decided pricing*, not to help choose between competing shapes — a meaningfully different (and cheaper-to-be-wrong-about) job than before.
2. **Scheme B placement enforcement.** Dropped entirely, FINAL, confirmed directly by the maintainer ("We can drop placement enforcement") — not loosened to a lighter bound, not deferred. Decision #10 is formally superseded (Decision Audit Trail updated below); the `character_table_placements` ledger ships as telemetry-only, as R4.4 already recommended.
3. **Campaign Pass pricing.** $20/3mo, $35/6mo, $60/12mo — FINAL, replacing every prior illustrative figure ($15/$25/$42, and the earlier one-time-unlock/recurring numbers from Proposals 1-4) everywhere they appear in this plan. The maintainer's own sanity-check framing ("$20 for three months... totally worth it, and it scales down from there") is confirmed consistent with R3.3's hosting-cost figures (R4.3) — no contradiction with anything already locked.
4. **The "Founding" perpetual-slot SKU.** Rejected outright, FINAL, not deferred to `TODOS.md` ("No weird pre-launch, keep it simple") — removed from R4.2 above as an active option.
5. **The gifting mechanic.** Fully specified in **R4.3.1** above: `table_campaign_passes` (entitlement, keyed by `table_id`) + `table_campaign_pass_purchases` (history, records the buyer separately), Stripe Checkout metadata carrying `targetTableId` distinct from the purchaser, a new player-reachable UI surface in the Characters panel, and an explicit non-clawback rule on refund/dispute events. Table ownership is untouched by construction — no code path connects billing to the owner field.

**What remains genuinely open (packaging detail, not a blocker):** the optional "GM Unlimited" pass's exact price and launch timing (R4.3) were not part of the maintainer's final answer and are noted as a deferred packaging question — this does not block shipping the core Campaign Pass, which has no such open item. See Phase 4 (end of document) for the full closed-out decision ledger.

---

## Implementation Tasks (aggregated across all 3 phases)

Synthesized from every finding above. Each task derives from a specific finding — no padding. P1 blocks ship; P2 should land same effort-window; P3 is a follow-up.

**[AMENDMENT, 2026-07-13]:** T12 and T13 below are new, added after direct user feedback on the completed review (see header note). They are inserted into the P1 block (not appended at the end) because both derive from findings as load-bearing as the rest of P1 — "core action loop confidence" and "raise the quality bar before charging money" are two of the plan's foundational workstreams, not afterthoughts. Former T12-T16 are renumbered to T14-T18 below; no task's content changed, only its ID (no other section of this document references task IDs, so this renumbering is safe).

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** — validation — Stand up a zero-code willingness-to-pay signal (Stripe Payment Link or a "founding supporter" waitlist form) before building any billing engineering. **[UPDATED, 2026-07-14]** Test the shape from Round 2's business-model pick (one-time core unlock, e.g. via a Stripe Payment Link in `mode: payment`), not the original recurring $5/mo — a one-time Payment Link is also simpler to stand up with zero code than a recurring one. **[ROUND 5 FINAL, 2026-07-14]** Superseded by the now-locked Campaign Pass model: stand up a Stripe Payment Link for the **3-month Campaign Pass at its FINAL $20 price** (not the earlier ~$15 placeholder). Pricing and shape are FINAL and locked (R4.3/R4.7), so this task's job is narrower than the earlier drafts above — it confirms real-world signal on an already-decided price, it does not help choose between competing shapes. A Campaign Pass Payment Link is exactly as zero-code as any other one-time-purchase Payment Link (both are `mode: payment`).
  - Surfaced by: CEO 0C-bis Q3, User Challenge 1; shape updated by Round 2 section R2.4; FINAL shape and pricing locked by Round 4/5 sections R4.3/R4.7
  - Files: none (no-code / landing-page only)
  - Verify: manual — real signups/reservations collected
- [ ] **T2 (P1, human: ~30min / CC: ~5min)** — process — Add a GitHub Actions CI workflow running `npm run test:unit` and `npm run test:browser` on every push/PR.
  - Surfaced by: CEO Section 6, Eng Section 3 ("single highest-leverage quality fix")
  - Files: `.github/workflows/ci.yml` (new)
  - Verify: CI run passes on a test PR
- [ ] **T3 (P1, human: ~3h / CC: ~30min)** — server — Add `DELETE /api/my-tables/:id` (owner-only, notifies connected SSE clients before removal).
  - Surfaced by: Eng Step 0 (no delete endpoint exists; hard prerequisite for downgrade UX)
  - Files: `server.js`
  - Verify: new unit + browser test per Test Plan artifact item 4
- [ ] **T4 (P1, human: ~2h / CC: ~20min)** — db — Migration: add `user_id` column to `ai_usage_events`; thread `req.uid` through all 6 AI builder call sites (`character-ai-build`, `adversary-ai-build`, `environment-ai-build`, `encounter-ai-build`, `generate-image`, `edit-image`).
  - Surfaced by: Eng Step 0, CEO 0D cherry-pick
  - Files: `migrations/0XX_ai_usage_events_user_id.sql`, `src/ai-usage-log.js`, `server.js`
  - Verify: new unit test asserting a call records the correct `user_id`
- [ ] **T5 (P1, human: ~4h / CC: ~45min)** — server — Build the entitlement data model: new `billing_customers` table (`user_id` ↔ `stripe_customer_id`, `status`, `current_period_end`, `cancel_at_period_end`), a single reusable `checkTableCreationEntitlement(uid)` / `checkCharacterCreationEntitlement(uid)` function used at both creation entry points per resource. **[ROUND 5 FINAL, 2026-07-14 — superseded by T21]** This original per-user, recurring-subscription-shaped design is superseded for core table/character access: under the now-locked Campaign Pass model (R4.3/R4.3.1), table liveness is table-keyed (`table_campaign_passes`, checked via T21's `checkTableIsLive(tableId)`), and character placement is never gated at all (R4.4). `checkTableCreationEntitlement`/`checkCharacterCreationEntitlement` as originally scoped here are **not built**. `billing_customers` still ships, but its job shrinks to exactly two genuinely per-user things that are not about table access (per R4.3.1): (1) the single-lifetime free-trial guard (`free_trial_started_at`/`free_trial_table_id`), and (2) the optional "GM Unlimited" pass, which is legitimately user-keyed since it grants a cross-table perk to one GM's account. The subscription-shaped columns (`status`/`current_period_end`/`cancel_at_period_end`) are dropped from this table's design — there is no Stripe Subscription object anywhere in this product.
  - Surfaced by: Eng Architecture Finding B/C, Section 2 (DRY requirement); superseded for core access, FINAL, by Round 4/5 sections R4.3/R4.3.1/R4.7 (see T21)
  - Files: `migrations/0XX_billing_customers.sql`, `server.js`
  - Verify: unit tests per Test Plan items 1-2, 7
- [ ] **T6 (P1, human: ~3h / CC: ~30min)** — server — Prevent the table/character-creation TOCTOU race via a DB-level unique constraint or advisory lock (not application-level check-then-write).
  - Surfaced by: Eng Section 3/4 (confirmed exploitable via direct code citation)
  - Files: migration + `server.js`
  - Verify: integration test with real Postgres, concurrent requests, exactly one succeeds (Test Plan item 3)
- [ ] **T7 (P1, human: ~4h / CC: ~40min)** — server — Stripe Checkout + webhook route: exempt the webhook path from the global JSON body-parser middleware, verify signatures against raw bytes, dedup by Stripe event ID (following the `item_popularity` `ON CONFLICT DO NOTHING` pattern). **[SUPERSEDED, 2026-07-14]** The original Round 2 one-time-purchase-anchored reading (R2.4) is superseded by the FINAL shape below. **[ROUND 5 FINAL, 2026-07-14]** Under the now-locked Proposal 5 (R4.3/R4.6/R4.7), every purchase in this product — a Campaign Pass of any length, the optional "GM Unlimited" pass, and AI credit top-ups — is a `mode: 'payment'` Checkout Session; there is no `mode: 'subscription'` object anywhere in the product. Each webhook handler extends an expiry timestamp (keyed by `tableId` for Campaign Passes, `userId` for the GM Unlimited pass and AI credits) or credits an AI-credit balance. **Campaign Pass purchases are the one purchase type keyed by `metadata.targetTableId` rather than the purchaser's `userId`** (R4.3.1/R4.6 nuance 2) — this must be built as a first-class branch in the webhook dispatch, not bolted on, and refund/dispute events for Campaign Pass purchases are an explicit logged no-op (never a clawback — the gift is irrevocable). No dunning, no `invoice.payment_failed`, no proration, and no cancellation-flow logic is needed anywhere in this route for core access. (An optional future auto-renew feature would reintroduce a slice of that complexity for users who explicitly opt in, but that is explicitly out of the default scope — R4.6 nuance 1.)
  - Surfaced by: Eng Architecture Finding A (confirmed via direct code citation — Critical); FINAL shape locked by Round 4/5 sections R4.3/R4.3.1/R4.6/R4.7
  - Files: `server.js`
  - Verify: unit tests per Test Plan items 8-9
- [ ] **T8 (P1, human: ~2h / CC: ~20min)** — server — Per-user AI cost cap check before every paid OpenAI/x.ai call, rejecting before the external call is made.
  - Surfaced by: CEO Section 3, Eng hidden-complexity finding
  - Files: `server.js`, `src/ai-usage-log.js`
  - Verify: unit test per Test Plan item 10
- [ ] **T9 (P1, human: ~2h / CC: ~20min)** — infra — Reconciliation cron (Stripe Checkout Session records vs. local DB), reusing the `node-cron` pattern from `src/external-sync.js`; change `min_machines_running` to `1`. **[ROUND 5 FINAL, 2026-07-14]** Under the now-locked Proposal 5 there is no Stripe *subscription* status to reconcile for core table access — no subscription object exists anywhere in this product (R4.6). This cron's job is: (a) a safety-net sweep for missed/failed Campaign-Pass-purchase or AI-credit-purchase webhooks (comparing recent Stripe Checkout Sessions to local `table_campaign_passes`/credit records), and (b) nothing further to actively "expire" — a passed `paid_through_at` timestamp is simply no longer live at check time, with no batch job needed to flip a status flag. The `min_machines_running: 1` recommendation is unchanged — it mitigates webhook cold-start risk regardless of which purchase shape triggers the webhook.
  - Surfaced by: Eng Section 4, Architecture SPOF finding; FINAL scope locked by Round 4/5 R4.6/R4.7
  - Files: `server.js`, `fly.toml`
  - Verify: chaos test per Test Plan (kill mid-webhook, verify self-heal within one cron cycle)
- [ ] **T10 (P1, human: ~6h / CC: ~1h)** — client — Build the 4 new UI surfaces (pricing page, upgrade prompt, tier-limit modal, billing management) using `FullPageOverlay` and existing `dh-` theme conventions, with the worked-example copy/placement specified in Design Phase 2.
  - Surfaced by: Design Pass 1/4 (Critical — zero content existed; worked examples now specified)
  - Files: `src/client/components/` (new components), `src/client/lib/api.js`
  - Verify: browser test confirming each surface renders in the correct states (Design Pass 2)
- [ ] **T11 (P1, human: ~3h / CC: ~30min)** — client — Implement the hard "never interrupt a live session" constraint: entitlement checks fire only at creation-time or session-start-time, never during an open session; reuse `SessionBlockedBanner` for any session-start-time gating message.
  - Surfaced by: Design Pass 3 (Critical, explicitly requested callout), Eng Section 3 (top-priority test case)
  - Files: `src/client/app.jsx`, `src/client/components/GMTableView.jsx`
  - Verify: the single most important browser test in the Test Plan artifact (grace period expires mid-session → session unaffected)
- [ ] **T12 (P1, human: ~8h / CC: ~1.5h)** — test — **[AMENDMENT]** Multi-actor action-loop test suite: build the multi-context Playwright infrastructure (2+ concurrently authenticated browser contexts against the real server, real SSE, real test Postgres — not `page.route()`-mocked) and automate the six named canonical sequences (M1-M6) in the Multi-Actor Action-Loop Test Catalog: attack→target→damage→resolve; cross-player Prayer Die-style reaction chip mid-banner; concurrent multi-player rest-move selection; GM banner-cancel while a player has an open reaction chip; cross-sheet chip propagation between two players; token move + range-gated targeting across two clients.
  - Surfaced by: direct user feedback (2026-07-13 amendment), grounded in a direct read of every file in `test/browser/` confirming today's 5 specs are single-actor and/or SSE-mocked — this is the concrete mechanism for resolving "not convinced of the core action loops" (original challenge #2), distinct from CEO 0B's narrower observation that existing specs are "a foundation" for playtesting
  - Files: `test/browser/action-loop-*.spec.js` (new), `test/helpers/auth.js` (extend to support a second concurrent authenticated context), `playwright.config.js` / CI env (real test-Postgres wiring)
  - Verify: each of M1-M6 has a passing multi-context test exercising the real server and real SSE propagation; explicitly does **not** replace T16 (human playtesting) — automated flow tests catch regressions cheaply on every push once T2's CI gate exists, human playtesting catches what automation structurally can't (real latency, varied GM improvisation, device/browser variety); ship-readiness needs both green
- [ ] **T13 (P1, human: ~4h / CC: ~40min)** — client+server — **[AMENDMENT]** In-session bug capture: add a GM-only, non-interrupting "Report a problem" affordance (small persistent control, never a blocking modal — same non-interruption bar as T11) that on click automatically captures recent action-log/roll history plus a client state snapshot (active elements, current route, recent console errors) and posts it to a new lightweight, append-only server endpoint for later triage — no typed reproduction-from-memory required.
  - Surfaced by: direct user feedback (2026-07-13 amendment) — "I'm not doing a good job of capturing bugs during play, either"; ties directly to CEO Section 8 (Observability) and the "raise quality bar before charging money" workstream; confirmed via direct code read that `POST /api/debug-log` is dev-only (`NODE_ENV !== 'production'` guard in `server.js`) and `ErrorBoundary.jsx` only `console.error`s, so no production-usable capture path exists today
  - Files: `server.js` (new GM-only endpoint, e.g. `POST /api/room/my/bug-report`), new small client component (e.g. `BugReportButton.jsx`), possibly a new `bug_reports` table/migration
  - Verify: manual QA — trigger mid-session, confirm the table is never interrupted (same pattern as `SessionBlockedBanner`/T11) and the captured payload alone (no follow-up questions to the GM) contains enough context to reproduce; unit test for GM-only auth gating on the new endpoint
- [ ] **T14 (P2, human: ~2h / CC: ~20min)** — client — Downgrade/overage UX: read-only banner + manual delete-down-to-limit flow (uses T3).
  - Surfaced by: Design Pass 2, Decision #11
  - Files: `src/client/components/GMTableView.jsx` or nav-level banner component
  - Verify: manual QA + browser test
- [ ] **T15 (P2, human: ~1h / CC: ~10min)** — client — Ambient "1 of N used" free-tier indicator. **[CONFIRMED placement, 2026-07-14]** Renders persistently under the user's name/email in the collapsed nav-bar user-menu **trigger button itself** — not only inside the opened dropdown. Add a third line (small, muted, e.g. `1/1 tables · 1/1 characters` or `Free plan`) inside the existing `<div className="flex flex-col items-end">` block that already renders `user.displayName || user.email` and `user.email` (`src/client/app.jsx` ~line 1737-1740), so it is visible whenever the nav bar is visible, independent of `userMenuOpen` state.
  - Surfaced by: Design Pass 3 (persona 1 journey); placement confirmed by user (Decision #19) — see Round 2 section
  - Files: `src/client/app.jsx` (user-menu trigger button JSX)
  - Verify: manual QA — indicator visible with the dropdown both closed and open, updates live as tables/characters are created
- [ ] **T16 (P2, human: ~4h / CC: ~40min)** — process — Structured multi-group playtesting pass (beyond the user's own group) targeting the classes of bugs ad-hoc single-group testing structurally cannot catch (multiplayer race conditions, cross-browser, real network latency, varied GM styles). **[AMENDMENT]** Complementary to, not redundant with, T12: T12 is automated multi-actor regression coverage; this is human-only judgment/feel/latency coverage automation cannot provide.
  - Surfaced by: CEO Step 0 / testing reality (section 7 of the original rough draft)
  - Files: none (process, not code)
  - Verify: a tracked bug list from at least 2 independent groups before broad launch
- [ ] **T17 (P2, human: ~1h / CC: ~10min)** — policy — Write and communicate the automation-scope policy (Question 2, Decision C): which mechanics must stay `Done` (core loop: dice, HP/Stress/Hope/Armor, map/range, weapon/armor properties) vs. which are fine at `Display` (narrative/flavor cards), to redirect V2 migration prioritization.
  - Surfaced by: CEO 0C-bis Q2
  - Files: `docs/v2-migration-tracker-snapshot.md` or a new short policy doc
  - Verify: policy doc exists and is referenced by the next V2 migration agent run
- [ ] **T18 (P3, human: ~2h / CC: ~20min)** — accessibility — Bring new billing surfaces up to the same touch-target/keyboard-nav bar as the rest of the app.
  - Surfaced by: Design Pass 6
  - Files: new billing components (same as T10)
  - Verify: manual keyboard-nav + touch-target audit
- [ ] **T19 (P1, human: ~4h / CC: ~40min)** — **[ROUND 5 FINAL, 2026-07-14]** db+server — Character-table-placement tracking, **telemetry only** (see Decision #10, R4.4/R4.7): new `character_table_placements` table (`(app_id, user_id, character_id, table_id)` composite PK, `item_popularity`-style `ON CONFLICT DO NOTHING` inserts) plus `recordCharacterTablePlacement`/`countCharacterTablePlacements`/`removeCharacterTablePlacementsForTable` in `src/db.js`. Wire the add-path inside `applyOpToTableState` (single funnel for both the GM `add-elements` op and the player `POST /api/room/:tableId/add-character` route) to resolve character owners via `getItemsByIds` and record placements; wire T3's table-delete endpoint to call `removeCharacterTablePlacementsForTable`. Placements are never decremented by `remove-element` (deliberate ledger semantics — see R3.1). **Placement is never gated or capped, FINAL:** the maintainer confirmed dropping Scheme B's placement-count enforcement entirely ("We can drop placement enforcement") — `checkCharacterPlacementEntitlement(uid)` is **not built**. The only gate on adding a character to a table is whether the **target table** itself is currently live (inside its free trial or covered by an active Campaign Pass — T21's `checkTableIsLive(tableId)`), never a separate per-character-owner cap. This ledger exists purely as product telemetry (it directly answers the maintainer's own LTV/LTC question from Round 4), never as a billing gate. *(Historical note: an earlier Round 3/4 draft of this task also specified building `checkCharacterPlacementEntitlement(uid)` as a 1-per-free-tier enforcement gate; that enforcement half is dropped, FINAL, and is not built.)*
  - Surfaced by: Decision #10 (Scheme B tracking mechanism, user-confirmed 2026-07-14; enforcement dropped FINAL 2026-07-14 — see R4.4/R4.7); supersedes the character half of T5's originally-sketched "creation entitlement" (library-character creation itself stays uncapped under this design — placement is tracked but never gated)
  - Files: `migrations/0XX_character_table_placements.sql` (new), `src/db.js`, `server.js` (`applyOpToTableState`, `POST /api/room/:tableId/add-character`, T3's delete endpoint)
  - Verify: unit test asserting (1) placing a character on any table succeeds regardless of the owner's existing placement count, and is instead blocked only when the target table itself is not currently live (T21's `checkTableIsLive`); (2) re-adding to an already-placed table is a no-op (not a new count); (3) deleting a table frees its placements; (4) removing a character from a still-existing table does **not** free a placement
- [ ] **T20 (P1, human: ~3h / CC: ~30min)** — **[ROUND 3, 2026-07-14]** client — Released ability tier ceiling: add `RELEASED_ABILITY_TIER_CEILING = 0` to `src/game-constants.js`; in `buildFeatureCardModel` (`src/client/lib/build-feature-card-model.js`), short-circuit `cardChips` to `[]` whenever `row._source === 'ability'` and `tierFromLevel(Number(row.level))` exceeds the ceiling, before the registry chip lookup runs — generic, numeric-only, no per-card/per-domain branching (compliant with `.cursor/rules/v2-framework-boundaries.mdc`). This is the gate mechanism only; it does **not** include implementing the 12 remaining Tier 1 cards across Blade/Codex/Grace/Valor, which is separate, ongoing V2 migration work tracked normally via GitHub Issues.
  - Surfaced by: Decision #3 addendum / #20 (user-confirmed 2026-07-14) — "release by tier... at a higher code level, so migration can continue in the background without affecting UX"
  - Files: `src/game-constants.js`, `src/client/lib/build-feature-card-model.js`
  - Verify: unit test asserting a domain-card row with `level: 1` and a real registry `cards` entry still renders zero `cardChips` while the ceiling is 0, and renders the chip once the ceiling constant is set to 1 (no behavior change needed elsewhere — `GuideFeatureCard`/`GuideFeatureCardChips` already fall back to Display-only text whenever `cardChips` is empty)
- [ ] **T21 (P1, human: ~7h / CC: ~1.2h)** — **[ROUND 5 FINAL, 2026-07-14]** db+server — Table Campaign Pass entitlement (the FINAL replacement for T5's core-access half; also supersedes T19's originally-sketched enforcement half — see R4.3/R4.3.1/R4.4/R4.7): new `table_campaign_passes` table (`app_id`+`table_id` composite PK; `paid_through_at` timestamp — the single source of truth for whether this table's Campaign Pass is currently active, extended by `max(now(), current paid_through_at) + N months` per purchase so consecutive purchases stack rather than overwrite; `lifetime_cents_total` for LTV telemetry) plus an append-only `table_campaign_pass_purchases` history table (`table_id`, `purchased_by_user_id` — recorded for gift attribution/receipts only, never read by any entitlement check —, `stripe_checkout_session_id` unique for webhook dedup, `months`, `amount_cents`, `created_at`). Add `free_trial_started_at` + `free_trial_table_id` to `billing_customers` for the single-lifetime-trial abuse guard (R4.3). Hook the trial-clock start into the existing session-liveness signals (`table_state.top.sessionStarted` transition to `true` while `connectedPlayers.length > 0`, or a player connecting while already `true`) to stamp `free_trial_started_at`/set that table's effective trial window once, ever, per user — never reset by deleting and recreating a table. Add a single reusable `checkTableIsLive(tableId)` (trial window OR `paid_through_at` in the future) used both at session-start (reusing the `SessionBlockedBanner`/Decision #14 non-interruption pattern) and as the sole gate on new character placements (T19's FINAL telemetry-only scope). New endpoint `POST /api/campaign-pass/checkout` (body `{ tableId, months }`) validates the requester has a relationship to that table (owner, or invited player via the existing `resolveTableAccess` check) before creating a `mode: 'payment'` Stripe Checkout Session with `metadata: { targetTableId: tableId, months, purchasedByUserId: req.uid }`; the `checkout.session.completed` webhook branch for this purchase type reads `metadata.targetTableId` (never the purchaser's identity) and extends that table's `paid_through_at` — a first-class webhook branch (T7's FINAL shape). Refund/dispute events for this purchase type are an explicit logged no-op (never a clawback — the gift is irrevocable, per the maintainer's own words). Also covers the optional "GM Unlimited" pass's own `mode: 'payment'` Checkout Session and webhook branch (that specific SKU's exact price/launch timing remains an open packaging detail per R4.7 — not a blocker to this task's core scope).
  - Surfaced by: Round 4/5 sections R4.3/R4.3.1/R4.4/R4.6/R4.7 (business-model synthesis, FINAL lock-in); supersedes the core-access half of T5 and the enforcement half of T19
  - Files: `migrations/0XX_table_campaign_passes.sql` (new, two tables), `migrations/0XX_billing_customers.sql` (trial-guard columns + GM Unlimited pass fields), `server.js` (`applyOpToTableState` session-start check, `POST /api/campaign-pass/checkout`, webhook route alongside T7), new client component (Characters-panel gift/support button + modal per R4.3.1's UI spec — extends T10)
  - Verify: unit tests asserting (1) a brand-new table is live for exactly 1 month of wall-clock time starting from first `sessionStarted`+player-present, not from table creation; (2) a second free table created by the same user after their one lifetime trial was already spent starts already-expired, not with a fresh trial; (3) an active Campaign Pass keeps a table live past trial expiry, and stacks correctly on a second purchase (extends from the current `paid_through_at`, not from `now()`); (4) a Campaign Pass purchased by a user other than the table's owner still extends that table's `paid_through_at` (gifting) without altering table ownership; (5) the live-check never fires mid-session (only at session-start), per Decision #14

---

# PHASE 4: FINAL APPROVAL GATE — RESOLVED (2026-07-14)

**AskUserQuestion was never available as a tool, in any phase of this review.** Per the degradation matrix, every decision that would normally have gone through that tool was instead resolved through direct, verbatim back-and-forth with the maintainer in the parent conversation, across five rounds of amendment layered on top of the original Phase 1-3 pipeline: **Round 2** secured real answers to most of the original taste decisions and User Challenges; **Round 3** turned two of those answers into concrete engineering designs (Scheme B tracking, the released-ability tier ceiling); **Round 4** produced a synthesized business-model recommendation from two independent brainstorms (the maintainer's own idea and an independent Grok 4.5 analysis); **Round 5** is the maintainer's final, verbatim sign-off, closing out every item Round 4 had left open. Obtaining and acting on real maintainer answers for every open item, across these rounds, is treated as functionally equivalent to a completed AskUserQuestion approval gate for this review — nothing below was silently auto-decided.

## Closed-out decision ledger

Every **User Challenge** and **taste decision** from the Decision Audit Trail (Phase 3, above), with its final resolution. Mechanical (non-taste, non-challenge) rows are omitted here since they were never open questions; see the Decision Audit Trail itself for the full 24-row list.

| # | Decision | Final Answer | Round Resolved |
|---|---|---|---|
| 3 | Rewrite vs. iterate vs. freeze-and-harden | **Freeze mechanics scope for monetization; keep the V2 migration as an independent parallel track** — plus keep "deactivate unfinished categories" and "inform users of manual expectations" IN scope, not deferred | Round 2 (pick); Round 3 (concrete design → T20) |
| 4 | Automate everything vs. adjudicate-by-hand vs. hybrid | **Hybrid**: automate the core loop (dice, HP/Stress/Hope/Armor, map/range, weapon/armor properties); `Display`-only is a deliberate, permanent end state for narrative/flavor cards — confirmed to include automatic resource mutation on GM Acknowledge, not just banner display | Round 2 |
| 5 | Sequence a willingness-to-pay validation step before building recurring billing | Superseded by the final business-model pick itself (row 22) — T1 now validates real-world signal on an already-decided, FINAL price, not a choice between competing shapes | Round 5 (via #22) |
| 10 | "1 character" free-tier counting scheme | ~~Scheme B, paid-capped~~ → **FINAL: distinct (character, table) placements are tracked (`character_table_placements`) but purely as telemetry — never gated or capped.** Character creation and placement are both fully uncapped | Round 3 (Scheme B picked); Round 5 (enforcement dropped, FINAL) |
| 11 | Downgrade/overage on losing entitlement | Extra tables/characters become **read-only, never auto-deleted** | Round 2 |
| 13 | Payment-failure grace period | 10-day grace period + dunning at day 1/5/9, confirmed as a default — see the housekeeping note below on its applicability under the model that ultimately locked in | Round 2 |
| 18 | AI feature monetization | Metered/capped per-user via a starter credit grant + one-time credit top-up packs (`mode: 'payment'`) — never cut, never left unmetered in a flat fee | Round 2 (shape); Round 5 (full endorsement as part of Proposal 5) |
| 19 | Placement of the free-tier "N of M used" indicator | Renders persistently under the user's name/email in the **collapsed nav-bar user-menu trigger itself**, not only inside the opened dropdown | Round 2 |
| 20 | "Deactivate unfinished categories" scope | Global numeric **released ability tier ceiling** (`RELEASED_ABILITY_TIER_CEILING`), enforced generically wherever V2 card chips render; starts at 0, moves to 1 once Tier 1 is automated across all 9 domains (12 cards remaining) | Round 3 |
| 21 | Business model — hosting-cost-informed pick among Proposals 1-4 | Superseded by Round 4's Proposal 5 synthesis (row 22), which the maintainer confirmed FINAL in Round 5 | Round 3 (investigated); Round 4/5 (superseded, then FINAL) |
| 22 | Business model — final shape | **Proposal 5: prepaid, non-subscription per-table Campaign Passes** ($20/3mo, $35/6mo, $60/12mo) + free players/characters + a time-boxed 1-month free table trial (clock from first real multiplayer session, one lifetime trial per user); Scheme B placement enforcement dropped entirely | Round 4 (synthesized); Round 5 (maintainer CONFIRMED, verbatim: "I love Proposal 5") |
| 23 | "Anyone can gift a Campaign Pass" | Any user with a relationship to a table (owner GM or any invited player) can purchase a Campaign Pass for that table as an irrevocable gift; table-keyed entitlement ledger, decoupled from the buyer's identity; ownership/GM role never changes | Round 5 (maintainer's verbatim extension) |
| 24 | Final Campaign Pass pricing + "Founding" SKU | **$20/3mo, $35/6mo, $60/12mo**, FINAL; no pre-launch "Founding" perpetual SKU, in any form | Round 5 (maintainer's verbatim final call) |

## Remaining open items

Checking every row of the Decision Audit Trail above (not assuming), exactly **one** genuinely open item survives this review:

- **The optional "GM Unlimited" pass's exact price and launch timing** (R4.3, R4.7). This is a power-user convenience SKU (unlimited concurrently-active owned tables, for GMs running multiple campaigns) — illustrative pricing (~$75/6mo) was floated but was not part of the maintainer's final answer. This does **not** block shipping the core Campaign Pass (T21), which has no open item of its own.

One non-blocking **housekeeping note**, surfaced while re-checking the ledger, not a new open question: Decision #13 (payment-failure grace period/dunning) was a real, confirmed answer in Round 2 — but the business model that ultimately locked in (Round 5) has no recurring/subscription billing anywhere in the product (R4.6: every SKU, including the optional GM Unlimited pass, is prepaid/`mode: 'payment'`). There is therefore no "payment failure" event left for that mechanism to ever fire against. Nothing needs to be decided here, and the Implementation Tasks already reflect this correctly (T7 and T9 both state plainly that no dunning/decline-handling logic is needed for core access) — it's noted here only so the Decision Audit Trail's own row #13 isn't mistaken for still-live scope.

## Overall plan status

This plan is genuinely feature-complete and ready to hand to implementation. Every User Challenge and taste decision in the Decision Audit Trail now has a final, non-hedged resolution; the Implementation Tasks (T1-T21) are internally consistent with the locked Proposal 5 / Campaign Pass business model (no task still forks on "if adopted"/"pending sign-off" language); and the one remaining item — the optional GM Unlimited pass's price and launch timing — is a deliberately deferred packaging detail for a non-required convenience SKU, not a gap in the core Campaign Pass build (T21) or any other P1 task. Implementation can begin against the task list as written.
