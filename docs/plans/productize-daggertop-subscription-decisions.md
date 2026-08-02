# Plan: Productize "Daggertop" — Decisions & Action Items

Status: **APPROVED — ready for implementation**
Repo: DaggerheartGM (product name: **Daggertop**)

> This is the condensed, execution-ready version of `productize-daggertop-subscription.md`. It contains only final decisions and the task list. The source document retains the full review history (CEO/Design/Eng review, alternatives considered, rationale, amendment rounds) for anyone who wants the "why" — this document is the "what."

---

## 1. What we're building

Daggertop is a GM-and-player tool for running the *Daggerheart* tabletop RPG (Node.js/Express server + React SPA). This plan takes it from a free, single-group tool to a paid product: billing integration, tier/entitlement gating, a quality bar sufficient to charge money, and a resolved stance on scope (automation depth, AI feature costs). Go-to-market (marketing, launch sequencing) is a separate, later plan.

## 2. Business model (final)

**Free tier:**
- **Table**: 1 owned table, time-boxed as a **1-month free trial**. The trial clock starts at the first moment that table has `sessionStarted === true` with at least one other real (invited/connected) player present — not at signup or table creation. Solo prep time never burns the trial. One lifetime trial activation per user (not reset by deleting the table).
- **Character**: creation and placement onto any table are both **fully uncapped**, forever. A `character_table_placements` ledger records placements as telemetry only — it never gates or caps anything.
- **AI features**: a small starter credit grant on signup.

**Paid SKU — Campaign Pass** (the only required purchase to keep hosting a table beyond the free trial). A one-time, non-subscription purchase (`mode: 'payment'` in Stripe) that extends a specific table's `paid_through_at` date:

| Pass length | Price |
|---|---|
| 3 months | $20 |
| 6 months | $35 |
| 12 months | $60 |

- Buying any length extends that table's paid-through date (consecutive purchases stack from the current expiry, not from today).
- **Anyone can gift a Campaign Pass**: the table's owner/GM, or any invited player, can purchase a pass for that table. Ownership/GM role never changes regardless of who pays — it's an explicit, irrevocable gift.
- Renewal is always a conscious repeat purchase (a low-key reminder banner near expiry) — never an auto-charge.
- Refunds/chargebacks on a Campaign Pass are a logged no-op — access is never clawed back.
- When a trial or pass lapses, the table becomes **read-only** (data is never deleted). Enforcement only ever fires at session-start — never mid-session.

**Optional convenience SKU — "GM Unlimited" pass** (deferred packaging detail, not a blocker): for GMs running multiple concurrent campaigns, a prepaid pass (same one-time `mode: 'payment'` shape, not a subscription) granting unlimited concurrently-active owned tables + a modest AI-credit boost. Exact price/launch timing still open — see §6.

**AI features**: metered per-user via the starter credit grant plus one-time credit top-up packs (`mode: 'payment'`) — never cut, never left unmetered inside any flat fee.

**Non-goals for this model:** no Stripe Subscription object anywhere in the product; no dunning/grace-period/decline-handling logic for core access (nothing recurring to fail); no perpetual "lifetime slot" SKU of any kind, including a pre-launch "Founding" tier.

## 3. Locked decisions

| Topic | Decision |
|---|---|
| Rewrite vs. iterate | Freeze mechanics scope for monetization; keep the V2 feature-engine migration as an independent, unblocked parallel track. |
| Automation depth | Hybrid: keep automation for the core loop (dice, HP/Stress/Hope/Armor, map/range, weapon/armor properties). `Display`-only (card shown, GM adjudicates) is a permanent, deliberate end state for narrative/flavor cards — not a TODO. "GM Acknowledge" already includes automatic resource mutation for anything at `Done`/`Partial` status; that behavior is preserved. |
| Unfinished mechanics ("deactivate unfinished categories") | Global, numeric **released ability tier ceiling** (`RELEASED_ABILITY_TIER_CEILING` in `src/game-constants.js`), enforced generically wherever V2 domain-card chips render. Starts at 0 (no domain-card chips render at all); moves to 1 once Tier 1 is automated across all 9 domains (12 cards remain across Blade/Codex/Grace/Valor). Not per-card labeling, not per-domain hiding. |
| "1 table" free-tier counting | Counts **owned** tables only. Invited-as-player tables never count against it. |
| "1 character" free-tier counting | Character creation and placement are both fully uncapped. `character_table_placements` is tracked as telemetry only (LTV/engagement analytics), never as a billing gate. |
| Downgrade / overage (trial or pass lapses) | Extra/lapsed tables and characters become **read-only, never auto-deleted**. |
| Live-session interruption | **Hard constraint, non-negotiable**: no billing/tier check may interrupt an in-progress session. All enforcement happens at creation-time or session-start-time only, reusing the existing `SessionBlockedBanner` pattern. |
| Entitlement enforcement location | Server-side only, following the existing `postTableOp`/ownership-check pattern. No client-side-only gating. |
| Concurrent creation (TOCTOU) | Prevented via a DB-level unique constraint or advisory lock — never an application-level check-then-write. |
| AI cost | Metered/capped per user before every paid call; never left unmetered inside a flat fee, never cut entirely. |
| Free-tier usage indicator | Renders persistently under the user's name/email inside the **collapsed nav-bar user-menu trigger itself** (not only inside the opened dropdown). |
| Gifting a Campaign Pass | Entitlement is keyed by `table_id`, not the purchaser's `user_id`, so it can be extended by any owner or invited player without touching table ownership. |
| Final Campaign Pass pricing | **$20/3mo, $35/6mo, $60/12mo.** No "Founding" perpetual SKU, in any form. |

## 4. Implementation tasks

P1 blocks ship. P2 should land in the same effort window. P3 is a follow-up.

- [ ] **T1 (P1)** — Stand up a Stripe Payment Link for the 3-month Campaign Pass at its real $20 price (zero app code — `mode: 'payment'`). Confirms real-world willingness-to-pay signal on the already-decided price.
  - Files: none
  - Verify: manual — real purchases/signups collected

- [ ] **T2 (P1)** — Add a GitHub Actions CI workflow running `npm run test:unit` and `npm run test:browser` on every push/PR.
  - Files: `.github/workflows/ci.yml` (new)
  - Verify: CI run passes on a test PR

- [ ] **T3 (P1)** — Add `DELETE /api/my-tables/:id` (owner-only; notifies connected SSE clients before removal).
  - Files: `server.js`
  - Verify: new unit + browser test

- [ ] **T4 (P1)** — Migration: add `user_id` column to `ai_usage_events`; thread `req.uid` through all 6 AI builder call sites (`character-ai-build`, `adversary-ai-build`, `environment-ai-build`, `encounter-ai-build`, `generate-image`, `edit-image`).
  - Files: `migrations/0XX_ai_usage_events_user_id.sql`, `src/ai-usage-log.js`, `server.js`
  - Verify: unit test asserting a call records the correct `user_id`

- [ ] **T5 (P1)** — `billing_customers` table (`user_id` ↔ `stripe_customer_id`). Scope is narrow: (1) the single-lifetime free-trial guard (`free_trial_started_at`/`free_trial_table_id`, used by T21), and (2) the optional GM Unlimited pass. No subscription-shaped columns (`status`/`current_period_end`/etc.) — there is no Stripe Subscription object anywhere in this product.
  - Files: `migrations/0XX_billing_customers.sql`, `server.js`
  - Verify: unit tests

- [ ] **T6 (P1)** — Prevent the table/character-creation TOCTOU race via a DB-level unique constraint or advisory lock (not application-level check-then-write).
  - Files: migration + `server.js`
  - Verify: integration test with real Postgres, concurrent requests, exactly one succeeds

- [ ] **T7 (P1)** — Stripe Checkout + webhook route: exempt the webhook path from the global JSON body-parser middleware, verify signatures against raw bytes, dedup by Stripe event ID (`item_popularity`-style `ON CONFLICT DO NOTHING`). Every purchase in the product (Campaign Pass of any length, GM Unlimited pass, AI credit top-ups) is a `mode: 'payment'` Checkout Session — no subscription object, no dunning, no proration, no cancellation flow. The Campaign Pass webhook branch is keyed by `metadata.targetTableId` (never the purchaser's identity) — build this as a first-class branch in the dispatch, not a bolt-on. Refund/dispute events for Campaign Pass purchases are an explicit logged no-op (irrevocable gift).
  - Files: `server.js`
  - Verify: unit tests against a real (test-mode) Stripe webhook payload fixture

- [ ] **T8 (P1)** — Per-user AI cost cap check before every paid OpenAI/x.ai call, rejecting before the external call is made.
  - Files: `server.js`, `src/ai-usage-log.js`
  - Verify: unit test

- [ ] **T9 (P1)** — Reconciliation cron (Stripe Checkout Sessions vs. local DB records) reusing the `node-cron` pattern from `src/external-sync.js`; change `min_machines_running` from `0` to `1` in `fly.toml`. No subscription status to reconcile — this is a safety-net sweep for missed/failed webhooks; expiry is a plain timestamp comparison, no batch job needed to flip a status flag.
  - Files: `server.js`, `fly.toml`
  - Verify: chaos test — kill mid-webhook, verify self-heal within one cron cycle

- [ ] **T10 (P1)** — Build the UI surfaces: pricing page, upgrade prompt, tier-limit modal, billing management, **plus** a shared "Support this table" gift/support button + modal in the `GMTableView` Characters panel, reachable by both the GM and every connected player. All using `FullPageOverlay` and existing `dh-` theme conventions — no stock/unstyled Stripe-Checkout-template UI. The support modal: (1) states clearly who/what is being paid for before any payment UI ("Gift a Campaign Pass to **{gmDisplayName}**'s table: **{tableName}**"); (2) shows current status ("Free trial ends in 12 days" / "Covered through Oct 14, 2026"); (3) offers the 3/6/12-month picker at $20/$35/$60 and redirects to Stripe Checkout. It always targets whichever table the current `GMTableView` is open on — no separate table-picker widget needed.
  - Files: `src/client/components/` (new), `src/client/lib/api.js`, `GMTableView.jsx`
  - Verify: browser test confirming each surface renders in the correct states

- [ ] **T11 (P1)** — Implement the "never interrupt a live session" constraint: entitlement checks fire only at creation-time or session-start-time, never during an open session; reuse `SessionBlockedBanner` for session-start-time gating messages.
  - Files: `src/client/app.jsx`, `GMTableView.jsx`
  - Verify: browser test — trial/pass expires mid-session → session unaffected (the single most important test in the whole plan)

- [ ] **T12 (P1)** — Multi-actor action-loop test suite: build multi-context Playwright infrastructure (2+ concurrently authenticated browser contexts against the real server, real SSE, real test Postgres — not `page.route()`-mocked) and automate the six canonical sequences in the Multi-Actor Action-Loop Test Catalog (§5 below).
  - Files: `test/browser/action-loop-*.spec.js` (new), `test/helpers/auth.js` (extend for a second concurrent authenticated context), `playwright.config.js` / CI env (real test-Postgres wiring)
  - Verify: each of M1-M6 has a passing multi-context test exercising the real server and real SSE propagation. Complementary to, not a replacement for, T16 (human playtesting).

- [ ] **T13 (P1)** — In-session bug capture: a GM-only, non-interrupting "Report a problem" control (never a blocking modal) that on click captures recent action-log/roll history plus a client state snapshot (active elements, current route, recent console errors) and posts it to a new lightweight, append-only server endpoint for later triage — no typed reproduction required.
  - Files: `server.js` (new endpoint, e.g. `POST /api/room/my/bug-report`), new `BugReportButton.jsx`, possibly a new `bug_reports` table/migration
  - Verify: manual QA — trigger mid-session, confirm the table is never interrupted and the captured payload alone contains enough context to reproduce; unit test for GM-only auth gating

- [ ] **T14 (P2)** — Downgrade/overage UX: read-only banner + manual delete-down-to-limit flow (uses T3).
  - Files: `GMTableView.jsx` or a nav-level banner component
  - Verify: manual QA + browser test

- [ ] **T15 (P2)** — Ambient plan/usage indicator. Renders persistently under the user's name/email inside the collapsed nav-bar user-menu **trigger button itself** — not only inside the opened dropdown. Add a small, muted third line (e.g. "Free plan" / trial countdown) inside the existing `<div className="flex flex-col items-end">` block in `src/client/app.jsx` (~line 1737-1740) that already renders `user.displayName || user.email` and `user.email`.
  - Files: `src/client/app.jsx`
  - Verify: manual QA — indicator visible with the dropdown both closed and open, updates live

- [ ] **T16 (P2)** — Structured multi-group playtesting pass (beyond the maintainer's own group), targeting bug classes ad-hoc single-group testing structurally cannot catch (multiplayer race conditions, cross-browser, real network latency, varied GM styles). Complementary to T12, not redundant with it.
  - Files: none (process)
  - Verify: a tracked bug list from at least 2 independent groups before broad launch

- [ ] **T17 (P2)** — Write and communicate the automation-scope policy: which mechanics must stay `Done` (core loop) vs. which are fine at `Display` (narrative/flavor), to redirect V2 migration prioritization.
  - Files: `docs/v2-migration-tracker-snapshot.md` or a new short policy doc
  - Verify: policy doc exists and is referenced by the next V2 migration agent run

- [ ] **T18 (P3)** — Bring the new billing surfaces up to the same touch-target/keyboard-nav bar as the rest of the app.
  - Files: same components as T10
  - Verify: manual keyboard-nav + touch-target audit

- [ ] **T19 (P1)** — Character-table-placement tracking, **telemetry only**: new `character_table_placements` table (`(app_id, user_id, character_id, table_id)` composite PK, `item_popularity`-style `ON CONFLICT DO NOTHING` inserts) plus `recordCharacterTablePlacement` / `countCharacterTablePlacements` / `removeCharacterTablePlacementsForTable` in `src/db.js`. Wire the add-path inside `applyOpToTableState` (both the GM `add-elements` op and the player `POST /api/room/:tableId/add-character` route) to resolve character owners via `getItemsByIds` and record placements; wire T3's delete endpoint to call `removeCharacterTablePlacementsForTable`. Placements are never decremented by `remove-element`. **Never gated or capped** — the only gate on adding a character to a table is whether the *target table* is currently live (T21's `checkTableIsLive(tableId)`), never a per-character-owner cap.
  - Files: `migrations/0XX_character_table_placements.sql` (new), `src/db.js`, `server.js`
  - Verify: unit tests — (1) placing a character on any table succeeds regardless of the owner's existing placement count, blocked only when the target table itself is not live; (2) re-adding to an already-placed table is a no-op; (3) deleting a table frees its placements; (4) removing a character from a still-existing table does not free a placement

- [ ] **T20 (P1)** — Released ability tier ceiling: add `RELEASED_ABILITY_TIER_CEILING = 0` to `src/game-constants.js`; in `buildFeatureCardModel` (`src/client/lib/build-feature-card-model.js`), short-circuit `cardChips` to `[]` whenever `row._source === 'ability'` and `tierFromLevel(Number(row.level))` exceeds the ceiling, before the registry chip lookup runs — generic, numeric-only, no per-card/per-domain branching. Gate mechanism only — does not include implementing the 12 remaining Tier 1 cards across Blade/Codex/Grace/Valor (separate, ongoing V2 migration work).
  - Files: `src/game-constants.js`, `src/client/lib/build-feature-card-model.js`
  - Verify: unit test — a domain-card row with `level: 1` and a real registry `cards` entry renders zero `cardChips` while the ceiling is 0, and renders the chip once the ceiling constant is set to 1

- [ ] **T21 (P1)** — Table Campaign Pass entitlement (the core of the business model). New `table_campaign_passes` table (`app_id`+`table_id` composite PK; `paid_through_at` — the single source of truth for whether a table's pass is active, extended by `max(now(), current paid_through_at) + N months` per purchase so consecutive purchases stack; `lifetime_cents_total` for LTV telemetry) plus an append-only `table_campaign_pass_purchases` history table (`table_id`, `purchased_by_user_id` — recorded for gift attribution/receipts only, never read by any entitlement check —, `stripe_checkout_session_id` unique for webhook dedup, `months`, `amount_cents`, `created_at`). Add `free_trial_started_at` + `free_trial_table_id` to `billing_customers`. Hook the trial-clock start to the existing session-liveness signals (`table_state.top.sessionStarted` transitioning to `true` while `connectedPlayers.length > 0`) to stamp the trial window once, ever, per user. Add a single reusable `checkTableIsLive(tableId)` (trial window OR `paid_through_at` in the future), used both at session-start (via `SessionBlockedBanner`) and as the sole gate on new character placements (T19). New endpoint `POST /api/campaign-pass/checkout` (`{ tableId, months }`) validates the requester has a relationship to that table (owner, or invited player via the existing `resolveTableAccess` check) before creating a `mode: 'payment'` Stripe Checkout Session with `metadata: { targetTableId: tableId, months, purchasedByUserId: req.uid }`. The `checkout.session.completed` webhook branch for this purchase type reads `metadata.targetTableId` — never the purchaser's identity — and extends that table's `paid_through_at`. Refund/dispute events are an explicit logged no-op. Also covers the optional GM Unlimited pass's own `mode: 'payment'` Checkout Session and webhook branch (price/timing TBD per §6 — not a blocker to this task's core scope).
  - Files: `migrations/0XX_table_campaign_passes.sql` (new, two tables), `migrations/0XX_billing_customers.sql` (trial-guard columns), `server.js` (`applyOpToTableState` session-start check, `POST /api/campaign-pass/checkout`, webhook route alongside T7), new client component (extends T10)
  - Verify: unit tests — (1) a brand-new table is live for exactly 1 month of wall-clock time starting from first `sessionStarted`+player-present, not from table creation; (2) a second free table created by the same user after their one lifetime trial was already spent starts already-expired; (3) an active Campaign Pass keeps a table live past trial expiry, and stacks correctly on a second purchase; (4) a Campaign Pass purchased by a user other than the table's owner still extends that table's `paid_through_at` without altering ownership; (5) the live-check never fires mid-session

## 5. Multi-Actor Action-Loop Test Catalog (for T12)

These are the canonical multi-step, multi-actor (GM + N players) sequences that must be automated in Playwright with 2+ real concurrent authenticated browser contexts before this ships for money. None exist in the test suite today.

| ID | Name | Sequence | Roles involved |
|---|---|---|---|
| M1 | Attack → target → damage → resolve | Player A initiates a weapon attack in range → roll banner appears for GM + Player A → GM picks a target (and optionally "Use armor") and Acknowledges → HP/Stress/Armor changes propagate via SSE to **every** connected client (GM, Player A, and an uninvolved Player B) | GM + Player A + Player B (observer) |
| M2 | Cross-player reaction chip mid-banner (e.g. Seraph Prayer Die) | Player A's attack roll banner is pending → Player B activates a V2 review-action chip on that same pending banner → the banner's dice/total recompute in place and propagate to GM's and Player A's clients without a reload → GM Acknowledges the augmented roll | GM + Player A (initiator) + Player B (reactor) |
| M3 | Rest cycle with concurrent multi-player move selection | GM triggers Short/Long Rest → the rest banner opens for all connected clients → Player A and Player B each independently pick their two downtime moves concurrently → GM Acknowledges once all moves are chosen → Fear is added and rest-scoped feature usage cleared consistently across every client | GM + Player A + Player B (concurrent) |
| M4 | GM banner-cancel mid-flight while a player has an open reaction chip | Player A's attack banner is pending; Player B has a review-chip UI open but hasn't activated it → GM cancels the banner before Player B acts → Player B's client cleanly removes the banner/chip UI (no orphaned chip, no crash) | GM + Player A + Player B |
| M5 | Cross-sheet chip affecting another player's sheet in realtime | Player A's character has a feature that shows a chip on Player B's sheet → Player B activates it from their own client → the mutation applies to Player B's character and Player A sees the state change via SSE, without refreshing | Player A + Player B |
| M6 | Token move + range-gated targeting across two clients | Player A drags their token into weapon range of an adversary → Player B sees the move propagate live via SSE → Player A initiates an attack and only sees valid targets within range, confirming range-gating is enforced server-side, not just locally cached | Player A + Player B (observer) |

## 6. Deferred / out of scope

- Full observability/alerting stack (Sentry-equivalent, status page, on-call rotation). Interim substitute: T13 (in-session bug capture) + T9 (reconciliation cron logging).
- BYO-API-key as a complementary AI-cost escape valve (alongside metering, not instead of it).
- Multi-region/multi-machine redundancy — architecturally free later given the existing SSE/LISTEN-NOTIFY design, not needed yet.
- Finishing the V2 migration to 100% SRD coverage — continues on its own independent track (see T17's policy doc).
- Go-to-market plan (marketing, launch sequencing, pricing experiments) — separate plan.
- Mobile-native app / offline support.

## 7. Remaining open item

- **The optional "GM Unlimited" pass's exact price and launch timing.** Illustrative pricing (~$75/6mo) has been floated but is not finalized. This does not block shipping the core Campaign Pass (T21), which has no open item of its own.
