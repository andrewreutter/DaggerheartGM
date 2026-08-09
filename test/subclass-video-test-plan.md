# Subclass Feature Video Test Suite — Coverage Plan

Design doc: `.cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md`. This file tracks
per-subclass coverage status and captures lessons learned from the Bard/Troubadour pilot so
follow-on agents don't have to rediscover them.

## Status

| # | Class | Subclass | Status |
|---|-------|----------|--------|
| 1 | Bard | Troubadour | ✅ Done — Phase 1 P0–P1 hardened (`difficultyMod`, Rally d8 / banner die / Damage / reaction / ally Clear Stress / session-end clear, Gifted Performer long-rest uses) — `bard-troubadour.spec.js` |
| 2 | Bard | Wordsmith | ✅ Done — Phase 1 P0–P1 hardened (`difficultyMod`, Rally banner die + `partyDice` clear, Eloquent ×3 options, Rousing Speech short/long rest) — `bard-wordsmith.spec.js` |
| 3 | Druid | Warden of the Elements | ✅ Done — Phase 1 P0–P2 hardened (Earth/Air/Water matrix, Fire retaliation + Aura Stress, Air Agility adv, Water splash, aura once/rest, Short Rest; Severe clear E2E deferred; Fragile/Evolution trait/Water reposition/Air fly PRODUCT_GAP) — `druid-warden-of-the-elements.spec.js` |
| 4 | Druid | Warden of Renewal | ✅ Done — Phase 1 P0–P1 hardened (Protection/Defender numbers, Very Close Regen, Long Rest frequency; Fragile/last-HP deferred PRODUCT_GAP) — `druid-warden-of-renewal.spec.js` |
| 5 | Guardian | Stalwart | ✅ Done — `test/browser-subclass/guardian-stalwart.spec.js` (Phase 1 P0: +6 threshold bonuses + maxStress 8; sheet bands) |
| 6 | Guardian | Vengeance | ✅ Done — `test/browser-subclass/guardian-vengeance.spec.js` (Phase 1 P1: Unstoppable frequency + Nemesis Long Rest clear; At Ease 9 Stress) |
| 7 | Ranger | Beastbound | ✅ Done — Phase 1 P0–P1 hardened (Focus Stress, End Focus Duality, companion token/XP) — `ranger-beastbound.spec.js` |
| 8 | Ranger | Wayfinder | ✅ Done — Phase 1 P0–P1 hardened (Focus Stress, End Focus Duality, Apex/Ruthless chip) — `ranger-wayfinder.spec.js` |
| 9 | Rogue | Nightwalker | ✅ Done — `test/browser-subclass/rogue-nightwalker.spec.js` |
| 10 | Rogue | Syndicate | ✅ Done — `test/browser-subclass/rogue-syndicate.spec.js` |
| 11 | Seraph | Divine Wielder | ✅ Done — `test/browser-subclass/seraph-divine-wielder.spec.js` |
| 12 | Seraph | Winged Sentinel | ✅ Done — `test/browser-subclass/seraph-winged-sentinel.spec.js` |
| 13 | Sorcerer | Elemental Origin | ✅ Done — Phase 1 P0–P1 hardened (Elementalist +3 Hope + Intent log, Natural Evasion Stress + `naturalEvasionD6`, Volatile Hope) — `sorcerer-elemental-origin.spec.js` |
| 14 | Sorcerer | Primal Origin | ✅ Done — Phase 1 P0–P1 hardened (Channel seeded Hope path, Manipulate Magic +2/extend, Arcane Charge +10, Volatile Hope) — `sorcerer-primal-origin.spec.js` |
| 15 | Warrior | Call of the Brave | ✅ Done — `test/browser-subclass/warrior-call-of-the-brave.spec.js` |
| 16 | Warrior | Call of the Slayer | ✅ Done — `test/browser-subclass/warrior-call-of-the-slayer.spec.js` |
| 17 | Wizard | School of Knowledge | ✅ Done — `test/browser-subclass/wizard-school-of-knowledge.spec.js` (Phase 1 P0/P1: Adept arming, Perfect Recall `featureUsage`, Strange Patterns seed + review chip + long-rest re-pick) |
| 18 | Wizard | School of War | ✅ Done — `test/browser-subclass/wizard-school-of-war.spec.js` (Phase 1: Thrive Stress +1 / HP drop hard asserts; Battlemage/Conjure Shield numbers + V2 NTT deferred) |

For each subclass, verify against `docs/srd-implementation.md` (Status column) which features are
automated vs. display-only **before** writing the spec — narrative/display-only features get a
lighter-touch assertion (see "Narrative-only features" below), not a full mechanical walkthrough.

## How to run

```bash
npm run test:subclasses                      # all specs in test/browser-subclass/ (parallel)
SUBCLASS_WORKERS=4 npm run test:subclasses   # optional: more/fewer parallel walkthroughs
npm run test:subclass -- bard-troubadour     # one subclass (filename substring; serial, 1 worker)
npm run test:subclass -- rogue-nightwalker.spec.js
```

`npm run test:subclasses` sets `SUBCLASS_PARALLEL=1` and runs multiple Playwright workers
(override with `SUBCLASS_WORKERS`). `npm run test:subclass -- <filter>` runs the matching
spec(s) with the default serial worker count — prefer this for authoring a single walkthrough.
You can also pass a filter to the plural script (`npm run test:subclasses -- bard-troubadour`);
it still enables parallel mode. Each worker gets its own GM/player uid namespace via
`TEST_PARALLEL_INDEX` in `test/helpers/multi-auth.js` so pending-banner queues (`dice_rolls`
keyed by `gm_uid`) do not cross-cancel. Specs still share one test `webServer` on port 3457.

**Multi-camera stitch:** only the **active stitch camera** has a CDP screencast running
(switches on `cutTo` / mapped `caption`). Recording every actor page at once wedged headed
parallel runs (3 workers × 3 screencasts × WebGL). `caption('GM'|…|'PLAYER A'|…|'PLAYER B'|…)`
auto-cuts when the role maps to an actor; non-actor roles (e.g. `'Bard / Troubadour'`) update
caption text only. `finish()` concats ordered segment files with system **ffmpeg/ffprobe**
(required on `PATH`) into one director `.webm`. Hard full-frame cuts only (no PiP). Stop /
context close / ffmpeg are timeout-bounded so a hung CDP session cannot block the worker forever.

**3D dice + Acknowledge:** only the **active stitch camera** has dice visible (Show); others stay
Hidden so Acknowledge is not gated on off-camera tumbles. The harness syncs this on every
`cutTo` / mapped `caption`. **Hold the tumble on the roller before cutting to GM:**

```js
await holdForDiceTumble();                         // still on Player A/B in the stitch
await caption('GM', 'Acknowledges the roll', '');  // cuts to GM
await ack(banner, { holdMs: 0 });
```

Or `ackAfterHold(banner)` (hold → cut to banner page → ack with `holdMs: 0`). Use
`ack(banner, { holdMs: 0 })` for Start Session / non-dice banners. Project runs **headed**
(set `SUBCLASS_HEADED=0` for headless — WebGL may be blank) with GPU ANGLE flags +
`preserveDrawingBuffer`.

**Workers:** multi-cam × headed Chromium is heavy. Parallel `test:subclasses` may need a lower
`SUBCLASS_WORKERS` (e.g. 3) or serial runs on smaller machines — measure after a full suite pass
before changing the npm script default.

Videos land in `test-artifacts/subclass-videos/<class>--<subclass>.webm` (gitignored,
most-recent-run-only — reruns overwrite in place). Requires **Playwright ≥1.61** (`@playwright/test`
^1.62.1) for `page.screencast.showActions({ cursor: 'pointer' })` and system **ffmpeg**.
`npm run dev` (esbuild watch) must be producing a current `public/app.js`/`public/styles.css`,
or the Playwright `webServer` will serve a stale client bundle — `npm run build:js` once if in
doubt (the webServer command runs `node server.js` directly, it does **not** rebuild).

## Reusable pieces

- **Harness**: `test/helpers/subclass-video.js` — `startSubclassRun(browser, { className, subclassName, actors })` → `{ gmPage, playerPage, playerBPage, cutTo, caption, ack, ackAfterHold, holdForDiceTumble, ensureSheetOpen, finish }`. `actors` is a subset of `['gm', 'playerA', 'playerB']`; omit `'playerB'` for two-actor (GM + owner) subclasses. Records a screencast on the **active** actor page only (`showActions` cursor overlays, bottom-right); `caption(role, …)` sets the overlay on all pages and cuts when `role` maps to an actor. Stitch helper: `test/helpers/subclass-video-stitch.js` (`stitchOrderedSegmentFiles` + legacy multi-input trim stitch; unit-tested).
- **Character builders**: `test/helpers/subclass-cast.js` — shared factories (`buildAllyCharacterData`, Troubadour, Nightwalker) plus per-class siblings when concurrent agents need isolation (`subclass-cast-druid.js`, `subclass-cast-bard.js`, `subclass-cast-ranger.js`, …). Keep the same shape as `buildBardTroubadourCharacterData` (see below).
- **Table/auth plumbing**: `test/helpers/multi-auth.js` — `ACTOR_GM/PLAYER_A/PLAYER_B`, `createTestTable`, `invitePlayers`, `createLibraryCharacter`/`deleteLibraryCharacter`, `addElementsToTable`, `getTableState`, `cancelAllPendingBanners`, `deleteTestTable`, and **`grantCampaignPassForTable(tableId)`** (see Gotchas below — call this in every spec's `beforeAll`). Playwright **`globalSetup`** (`test/playwright-global-setup.js` → `cleanupOrphanedTestTables` in `test/helpers/cleanup-test-tables.js`) deletes any leftover `table_state` rows owned by `test-user-uid` / `test-user-uid-*` before the suite starts, so a crashed prior run cannot leave nav tabs like **"T12 Test Table"** in subclass video screencasts.

## Lessons learned from the Bard/Troubadour pilot (read before writing a new spec)

1. **Characters must be `isCharacterComplete` before you can click their sidebar card.** An
   incomplete character (missing named experiences, missing advancement picks for `level >= 2`,
   or `ownedIds.length > 5` without a `domainLoadoutIds` pick) auto-opens the full editor instead
   of the normal hover-card sheet when its sidebar card is clicked
   (`src/client/lib/game-table-incomplete-character-auto-editor.js`) — feature chips are
   effectively untestable in that state. **Build every test character at level 8 with fully
   populated `advancements['2'..'8']`** (two picks each + a `domainCardId`), enough named
   `experiences` (`expectedExperienceRowCount(8) === 5`), and a `domainLoadoutIds` array of
   exactly 5 distinct ids when the character owns more than 5 domain cards.
2. **Level 8 requires explicit `subclass_upgrade` picks to unlock Mastery.** With *empty*
   `advancements`, `deriveSubclassUnlockSteps` (`src/client/lib/advancement-rules.js`) falls back
   to `tierFromLevel(level) - 1` (legacy default) and unlocks everything — but the moment any
   advancement row has picks at all (required for completeness, see #1), that legacy fallback is
   disabled and unlock steps come **only** from counting `{ type: 'subclass_upgrade' }` picks.
   Include exactly one `subclass_upgrade` pick in Band B (levels 5–7) and one in Band C (level 8)
   so `deriveSubclassUnlockSteps` returns `2` (Foundation + Specialization + Mastery all active).
   `SLOT_BUDGET_PER_BAND` caps how many picks of each type a band allows — don't just fill every
   slot with `subclass_upgrade`; mix in `traits`/`evasion`/`hp`/`stress`/`experience`/`domain_card`
   for the remaining slots (each level row gets exactly 2 picks).
3. **Don't hand-derive stats — compute them.** `computeMaxHp`/`computeMaxStress`/`computeMaxHope`/
   `computeMaxArmor`/`computeEvasion` (`src/client/lib/character-calc.js`) apply SRD class data
   (`starting_hp`, etc.) and every advancement pick; a raw `maxHp` field on the character JSON is
   informational only and is **not** read by `recomputeCharacter`. Before writing seed `currentHp`/
   `currentStress`/etc. in a spec, write a **throwaway** Node script (delete it when done — do not
   commit it) that imports `getCollection`/`warmCache` from `src/srd/index.js` and
   `recomputeCharacter`/`isCharacterComplete`/`deriveSubclassUnlockSteps` from
   `src/client/lib/character-calc.js` / `advancement-rules.js`, builds the candidate raw character
   JSON, and prints `{ complete, missing }`, unlock steps, and the derived stats — iterate until
   `complete === true` and unlock steps `=== 2`, then paste the verified raw JSON into
   `subclass-cast.js`. See the git history of `test/helpers/subclass-cast.js` /
   `buildBardTroubadourCharacterData` for a worked example and the exact advancement-row shape.
   Ability ids for domain cards must come from the real SRD data (`getCollection('abilities')` —
   raw `daggerheart-srd/.build/03_json/*.json` files have a **BOM** and no `id` field; always go
   through `src/srd/index.js`, never `JSON.parse` the build JSON directly).
4. **The billing gate will block "Start Session" on later specs.** The shared `ACTOR_GM` identity
   gets exactly one lifetime free trial across the whole test DB; whichever spec runs first (in
   whatever order Playwright picks) consumes it, so every subsequent spec's table would otherwise
   show "Campaign Pass expired" and 403 on Start Session. **Every spec must call
   `await grantCampaignPassForTable(tableId)`** in `beforeAll` after `createTestTable` — it writes
   directly to `table_campaign_passes`, bypassing Stripe (no-ops if `DATABASE_URL` is unset).
5. **The character hover sheet auto-dismisses after every action/roll**
   (`dismissAllHoverCards()` in `GMTableView.jsx`). Re-open it (click the sidebar card) before
   every single card-chip interaction, not just once at the top of the walkthrough. Use a
   locator scoped to the stable `div.group\/char` root (`GameTableCharacterListCard`) —
   `text=<Name>` alone can match the Action Log, banner titles, or the open sheet's own header
   and silently no-op instead of (re)opening the sidebar sheet. **Display-only asserts do not
   dismiss the sheet** — a second click on the same sidebar card *toggles it closed*. After any
   step that left the sheet open without an action/roll, press `Escape` (or otherwise close)
   before the next open-click. **Display-only asserts leave
   the sheet open**, and sidebar cards **toggle** — a second click closes it. Prefer
   `Escape` then click (see `openCharSheet` helpers in the Warrior specs) whenever the previous
   step did not dismiss the sheet.
6. **Card-chip button accessible names include a trailing frequency badge**
   (e.g. `"Relaxing Song ○ long"`) — use a substring regex (`/Relaxing Song/i`), not an anchored
   exact match. Card chips also frequently render in **two places at once** (e.g. the sheet's
   "Actions" strip and elsewhere) — `getByRole('button', { name: /.../i })` may resolve to 2+
   elements. Prefer `.first()` for distinct labels; when the Features expand header and the
   Actions-strip chip share the same name+frequency (chips hidden via `hideV2CardChips`), use
   `.last()` so the Actions chip wins (later in DOM) — see Warrior `frequencyChipButton`.
7. **Prefer Player A for owned card chips** (including those that mutate allies/adversaries —
   Make a Scene, Gifted Performer songs, Rousing Speech, Warden's Protection, etc.). Assigned
   players persist via `POST /api/room/:tableId/v2-owned-card-chip` (server recomputes + full
   `update-elements`). GM still owns Start Session, adversary attacks, and banner Acknowledge.
   (Legacy note: an older player path used `postCharacterUpdate` + `mergeUpdatesForInstance` and
   silently dropped non-owner patches — that gap is closed.)
8. **Every trait/weapon roll click routes through a "Before you roll" confirmation panel first**
   (`_intentPanelForActionRoll: true` is set unconditionally by `CharacterHoverCard.jsx` for
   trait and weapon rolls) — after clicking a trait/weapon chip, `expect(page.getByText('Before you
   roll')).toBeVisible()` then click the **Proceed** button before the roll actually posts and a
   banner appears.
9. **The Defense card's "Reaction Rolls" grid shares the same `title`/name text as the main
   Traits grid** (both use `Roll ${TRAIT_FULL[trait]}` / `${trait} +N`). A bare
   `getByTitle('Roll Agility')` or `getByRole('button', { name: 'Agility +2' })` resolves to both
   and `.first()` may pick the **wrong one** (the Reaction cell, which posts `_isReaction: true`
   and produces a reaction-labeled banner instead of a normal action roll). Disambiguate using the
   main grid's verb-hint suffix in the accessible name, e.g.
   `getByRole('button', { name: /Agility.*Sprint/i })` (`TRAIT_VERBS`, `CharacterDisplay.jsx`).
10. **Cross-sheet `isSelect` chips cannot be activated (known gap).**
    `activateV2CrossSheetChip` (`src/client/lib/v2-cross-sheet-lifecycle.js`) doesn't accept
    `selectOpts`, so any cross-sheet chip with `isSelect: true` (e.g. Bard Maestro's "after Rally"
    choice) can only be asserted as *rendered* on the other player's sheet, not actually clicked.
    Caption this explicitly as a known limitation rather than skipping the chip's existence check.
11. **Action-only card-chip mutations don't need a GM Acknowledge step.** When a chip's mutations
    resolve to `actionLoopNotifications` (no dice), the client posts a self-dismissing
    action-only banner automatically — assert element state directly via `getTableState` instead
    of waiting for/acknowledging a banner. Real dice rolls (e.g. a Rally Die spend, or a rolled
    trait/weapon check) DO need `.locator('.dice-result-banner', { hasText: ... })` +
    GM `Acknowledge`.
12. **Range-gated features need tokens placed on the map, all within the required band.** Place
    every character/adversary instance's `tokenX`/`tokenY` within ~10ft of each other (well
    within "Close", ≤30ft) unless the feature specifically requires a different range band —
    `map-range.js` powers all `selectTargets`/`isDisabled` range checks. Prefer map-center
    coords (e.g. 40/43/45) and set `mapId` from `getTableState(tableId).maps[0].id` after
    `createTestTable`. `WeaponCard` drops `role=button` (and Game Table may hide the card via
    `filterOutDisabledWeapons`) when `outOfRangeDisableReason` is set.
13. **Life Support Acknowledge is gated on banner ally selection.** Sheet `selectTargets` posts
    `life-support-select`; do **not** click the ally again on the banner — `sendLifeSupportSelect`
    toggles and a second click deselects, leaving Acknowledge disabled. Dismiss the hover sheet
    (`Escape`) before banner Acknowledge — the pinned sheet (`z-[55]`) intercepts clicks.
14. **Prayer Die review chips render multiple d4 option buttons** (pool size = spellcast). Use
    `.first()` on the option locator to avoid strict-mode violations.
13. **Actions-strip chip vs Features expand toggle.** Guide feature cards in the Features list
    use a `<button>` title row to expand/collapse. That button's accessible name is the feature
    name and appears **earlier in the DOM** than the Actions-strip chip of the same name. Prefer
    `.last()` (or scope under the Actions emphasis card) for chip activation — `.first()` often
    expands the Features card and never runs the chip. Also: do **not** re-click the sidebar
    character card while the sheet is already open (lesson 5 — same-card toggles it closed).
14. **Hope ability chips are the whole amber card** (no separate "Use" button). Click
    `getByRole('button', { name: /Rogue's Dodge/i })` (etc.). Hope spent on duality rolls before
    the ability means assertions should capture `hope` immediately before the click and expect
    `hopeBefore - cost`, not a hard-coded remainder.
13. **When a card chip’s name equals the feature name** (e.g. Wordsmith **Rousing Speech**), a
    page-wide `getByRole('button', { name: /Rousing Speech/i })` also matches the Features-list
    **expand** control (which includes the same frequency badge text in its accessible name).
    Clicking that only expands the card — it does not run `onUse`. Scope the click to the open
    sheet’s **Actions** emphasis card (see `bard-wordsmith.spec.js`), or rely on chip-only labels
    that differ from the parent feature name (Troubadour’s Gifted Performer songs).
15. **Prefer `button.dh-sheet-clickable-chip` inside the Actions card** (Druid Elemental Aura /
    Sorcerer Arcane Charge / Guardian Frontline Tank). Same lesson as #13, but the class selector
    is more reliable than `.last()` when frequency badges / unusable strips confuse role-name
    matching. Class **Hope features** (e.g. Guardian **Frontline Tank**) also render as an amber
    Hope card whose accessible name matches the Actions chip — clicking that posts a deferred
    `_featureUse` banner (costs on GM Ack) and **does not** run V2 `onUse` (so `clearArmor` /
    `setFeatureState` never apply). Always scope Hope-named class features to
    `button.dh-sheet-clickable-chip` under Actions.
22. **Hope features with only root `hopeCost`/`onUse` need three linked fixes** (Frontline Tank):
    (a) `mergeV2DeclarativeSheetOverlay` must append them onto `activeFeatures` (not only rows
    with `chips`/`hooks`); (b) `getOrderedGuideFeatureEntries` must unshift them into the guide
    list for the Actions strip (same root-field predicate); (c) `hopeAbilityRenderedByV2Guide`
    must hide the amber Hope card when those fields are present so clicks hit the Actions chip
    and run V2 `onUse` (`spendHope` + `clearArmor`). Otherwise the Hope card posts `_featureUse`
    without `clearArmor`, and a loose Actions locator can steal that Hope button.
23. **`V2ReviewChipRow` Apply button’s accessible name is the chip description** (`aria-label={label}`),
    not the visible “Apply” text. Use `locator('button', { hasText: /^Apply$/i })`, not
    `getByRole('button', { name: /^Apply$/i })`. Also Escape the hover sheet before banner chip
    clicks — Traits (`z-[55]`) intercept otherwise.
19. **`currentArmor` is marked slots, not remaining.** Armor `CheckboxTrack` uses
    `filled={currentArmor}` with verbs Mark/Clear; V2 `markArmor` increases `currentArmor` and
    `clearArmor` decreases it. Seed “2 marked so Frontline Tank can clear 2” → expect `0` after
    the chip, not `maxArmor`.
20. **Dismiss the hover sheet before GM-Acknowledge on `_featureUse` banners.** Opening a
    character sheet to click an Actions chip leaves the overlay above the dice banner; Acknowledge
    clicks miss the button. `Escape` (then Ack, optionally `{ force: true }`) — same as Seraph
    Life Support.
21. **Scope feature-use banner Ack to the character's rollUser** (e.g. `.filter({ hasText: /Dara/i })`).
    `dice_rolls` pending queues are **per `gm_uid`**, not per table — a prior run's
    `Voss: Frontline Tank` banner can still be pending; Acking it spends hope on a missing
    instance and leaves the current PC unchanged. Also call `cancelAllPendingBanners()` after
    Start Session when reusing a namespaced GM across Guardian specs.
16. **Banner review chips need `addCondition`/`removeCondition` in `applyV2BannerMutations`.**
    Card-chip path uses `applyV2LifecycleMutations` (already handled conditions); GM
    `handleV2ReviewChip` uses `applyV2BannerMutations` — without those cases, Arcane Charge
    discharge’s `removeCondition('Charged')` was skipped even for the GM. Player review-chip
    apply still skips some mutation types (`removeCondition`, `rerollDie`) — drive those from
    the GM banner when asserting clearance / dice follow-ups.
17. **Dualstaff `"mag"` ≠ Primal Origin `weaponDealsMagicDamage` (`/magic/i`).** Manipulate Magic
    intent must use a **Spellcast** roll (`action.type === 'spellcast'`), not the Dualstaff
    weapon card. Volatile Magic / Arcane Charge discharge still see Dualstaff as magic damage
    via synthetic banner effects (`postTagToEngineDamageType('mag')` → `'magic'`).
18. **Portaled Actions `CustomSelect` options (Druid Beastform / Evolution).** The option list is
    `createPortal`’d to `document.body`. Without `data-dh-outside-dismiss-exempt` on that portal
    (honored by `useHoverOverlay`), mousedown on an option dismisses the character sheet before
    `onChange` runs — transform never applies. Prefer scoping option clicks to
    `[data-dh-outside-dismiss-exempt]` when asserting.

## Multi-user coverage plan (per the design doc's registry survey)

- **Bard/Troubadour + Wordsmith**: Rally grant → Player B spends a Rally die on their own roll
  (cross-sheet `reviewAction` chip, M2-style; banner **Rally Die** + `partyDice` clear asserted);
  Troubadour also walks ally Clear Stress, Damage spend, reaction spend, d8 grant, session-end
  clear, and Gifted Performer short/long rest uses. Maestro choice rendered on Player B's sheet
  (Troubadour only — known gap, see lesson 10). Wordsmith walks Eloquent ×3 (End→Start between
  options; no Hope cost), Rousing Speech rest refresh, and Make a Scene `difficultyMod`.
  **Epic Poetry** Tag Team d10 advantage remains a VTT gap (no Game Table Tag Team roll UI).
- **Seraph (both subclasses)**: session start grants Prayer Dice via physical-roll resume; owner
  spends a prayer die on Player B's pending banner (M2 pattern). Factories:
  `buildSeraphDivineWielderCharacterData` / `buildSeraphWingedSentinelCharacterData` in
  `subclass-cast.js` (level 8, unlockSteps 2, Strength spellcast → 4 Prayer Dice). **Phase 1
  hardened asserts:** `prayerDice.pool` length −1 after each spend; Divine Wielder walks Prayer
  Die **Damage** + **gain Hope** + **Action**; Winged Sentinel walks **reduce damage** + **gain
  Hope** + **Action**, Ascendant Severe `≥ 31`, Wings of Light **d12** + Hope, Ethereal Visage
  advantage die (Fear chip when Hope dominates). **Sparing Touch** remains display-asserted only
  (PRODUCT_GAP — `isSelect` before `selectTargets`). Place the adversary in **Melee**
  (`tokenX` ~+3ft) — Spirit Weapon `rangeOverrides` are still PRODUCT_GAP for reach checks.
  Coverage gaps plan: `docs/plans/subclass-video-coverage-gaps.md`.
- **Guardian/Stalwart + Vengeance, Druid/Warden of Renewal, Wizard**: ally-damage intervention
  chips — Player B takes a hit, the owner's `reviewAction` chip (Loyal Protector, Defender,
  Revenge, etc.) fires on that banner. **Sorcerer** (Elemental Origin / Primal Origin) has none
  of that shape — Natural Evasion / Arcane Charge react to the owner being targeted; suite uses
  GM + Player A only (`test/helpers/subclass-cast-sorcerer.js`).
- **Warrior**: Attack of Opportunity via a token move (`onTokenMove`, M6 pattern).
- **Solo-capable subclasses** (Nightwalker, Wayfinder, School of Knowledge, ...): GM + one player
  is sufficient — no `playerB` actor needed, omit it from `startSubclassRun`'s `actors`.

## Narrative-only features

Per the design doc: for features whose mechanical effect is not automated (check
`docs/srd-implementation.md` — `Display` status), the spec should still `caption(...)` the feature
and assert the feature card renders on the sheet (e.g.
`getByText(/Wildtouch/i)` visible) — that is the full extent of automation for those and doubles
as a living gap report. Do not invent mechanical assertions for Display-only features.

## Ranger notes (Beastbound + Wayfinder)

- Cast factories: `test/helpers/subclass-cast-ranger.js` (re-exported from `subclass-cast.js`).
- Shared steps: `test/helpers/subclass-ranger-steps.js` — Focus Stress assert, End Focus Duality
  reroll scene, Beastbound companion token/experiences.
- **Sheet toggle:** click-to-pin sidebar cards close if already open — use an `ensureSheetOpen`
  helper keyed on a visible marker (weapon button / feature title) before each interaction.
- **Companion** (Beastbound): declarative sheet card + experiences + `boardToken` (place near Ranger)
  + shape chip `Take an action` → Companion Act.
- **Ranger's Focus:** after damage ack, assert Focus id **and** Focus target `currentStress ≥ 1`.
- **End Focus to reroll:** raise Focus adversary `difficulty` to force a miss, activate V2 chip,
  assert Focus cleared; restore difficulty before Hold Them Off.
- **Hold Them Off:** assert Hope spend after Apply; `addDamageRoll` currently augments the primary
  banner via `postBannerAddDamage` and does **not** apply HP to the selected extra adversaries
  (PRODUCT_GAP — captioned in the videos).
- **Apex Predator** needs Focus `focusTargetInstanceId` (set on Ranger's Focus damage ack) plus
  intent `onUse` arming `apexPredatorArmed` (via `activateV2IntentChipOnUse` on Proceed) and
  `runOnReviewActionAfterHpApplied` so damage-ack can `spendFear`.
- **Coverage gaps plan:** `docs/plans/subclass-video-coverage-gaps.md` (Ranger + Sorcerer P0–P1
  TEST_GAP done; Ranger PRODUCT_GAP remains: Elusive/Battle-Bonded onIntent persistence, Ruthless
  Severe→Stress `runOnVttDamageApplyReviewOutcome`, Hold Them Off multi-target HP).
- **Adversary Stress fixture:** banner `damageTargets` set `maxStress` from `stress_max`; if omitted
  it becomes `0` and `wrapEntity.markStress` no-ops — seed `stress_max` (+ `maxStress`) when asserting
  Focus Stress.

## Future work (out of scope for this suite, see design doc)

Ancestries (18) and Communities (9) get a lighter-weight sibling suite under
`test/browser-origin/` reusing the same harness — see "Future: Ancestries and Communities" in the
design doc.
