/**
 * Subclass feature video — Bard / Troubadour (pilot).
 *
 * Walks through every Troubadour feature (Gifted Performer's three songs, Maestro,
 * Virtuoso) plus the inherited Bard class feature it modifies (Rally), driven from
 * three real browser contexts (GM, Player A = the Troubadour, Player B = an ally).
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the harness design.
 *
 * Multi-user coverage exercised here (per the plan's "Bard/Troubadour + Wordsmith" row):
 *  - Player A (the Troubadour) runs Make a Scene and Gifted Performer songs (Relaxing /
 *    Epic / Heartbreaking) — these mutate OTHER characters/adversaries via
 *    `POST /api/room/:tableId/v2-owned-card-chip` (lesson 7: prefer Player A for
 *    multi-instance owned card chips).
 *  - Player A also runs "Grant Rally Dice" and "Spend Rally Die — Clear Stress" on
 *    their own sheet, plus "Spend Rally Die — Damage" on a Rapier attack.
 *  - Player B spends Rally via Clear Stress (cross-sheet), Action (trait roll), and
 *    Reaction (Defense grid) review chips; asserts banner "Rally Die" + partyDice clear.
 *  - GM End Session clears leftover partyDice (session-end clear).
 *  - Player B's sheet is shown displaying the Troubadour's "Maestro — after Rally"
 *    cross-sheet chip — a known gap (documented in-line and captioned in the video):
 *    `activateV2CrossSheetChip` (src/client/lib/v2-cross-sheet-lifecycle.js) does not
 *    accept `selectOpts`, so an `isSelect` cross-sheet chip like Maestro's cannot
 *    actually be activated from another player's sheet yet. The test only asserts the
 *    chip renders (proving cross-sheet collection works), not that clicking it works.
 */

import { test, expect } from '@playwright/test';
import {
  ACTOR_GM,
  ACTOR_PLAYER_A,
  ACTOR_PLAYER_B,
  authenticateActor,
  createTestTable,
  deleteTestTable,
  invitePlayers,
  createLibraryCharacter,
  deleteLibraryCharacter,
  addElementsToTable,
  getTableState,
  updateElement,
  cancelAllPendingBanners,
  grantCampaignPassForTable,
  setTableTop,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildBardTroubadourCharacterData, buildAllyCharacterData } from '../helpers/subclass-cast.js';

test.describe('Subclass video — Bard / Troubadour', () => {
  let tableId;
  let bardLibId;
  let allyLibId;
  let bardInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    // The banner queue is keyed by the shared GM uid across every test file — always start clean.
    await cancelAllPendingBanners();

    const table = await createTestTable('Bard Troubadour Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const bardLib = await createLibraryCharacter(ACTOR_GM, buildBardTroubadourCharacterData({ name: 'Brix' }));
    bardLibId = bardLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    bardInstanceId = `char-bard-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-goblin-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: bardInstanceId,
        elementType: 'character',
        id: bardLib.id,
        name: bardLib.name,
        // 2 short of max HP (real maxHp is 6 — see buildBardTroubadourCharacterData) so
        // Relaxing Song visibly changes the tracker (fired twice via Virtuoso); some
        // marked Stress so "Spend Rally Die — Clear Stress" visibly changes too.
        currentHp: 4, currentStress: 3, hope: 3, currentArmor: 0,
        conditions: '',
        tokenX: 100, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: allyInstanceId,
        elementType: 'character',
        id: allyLib.id,
        name: allyLib.name,
        // Stress marked so ally cross-sheet Clear Stress is observable.
        currentHp: 4, currentStress: 3, hope: 3, currentArmor: 0,
        conditions: '',
        // 5ft from the Bard — well within Close range (Melee/Very Close/Close, <=30ft).
        tokenX: 105, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Snarling Goblin',
        tier: 1,
        hp_max: 6,
        currentHp: 6,
        currentStress: 0,
        conditions: '',
        // Melee of Brix (≤5ft) so Rapier is rollable for Rally Damage; still Close for songs.
        tokenX: 103, tokenY: 100,
      },
    ]);

    // Grant a Campaign Pass directly (bypassing Stripe) so the session-start billing gate
    // (T21, server.js) never blocks this table's "Start Session" — the shared ACTOR_GM
    // identity's one-lifetime free trial is very likely already consumed by another test
    // table by the time this suite runs. See grantCampaignPassForTable's doc comment.
    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (bardLibId) await deleteLibraryCharacter(ACTOR_GM, bardLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Brix the Troubadour: Gifted Performer, Maestro, Virtuoso, and Rally', async ({ browser }) => {
    const consoleErrors = [];
    const {
      gmPage,
      playerPage,
      playerBPage,
      caption,
      finish,
      ack,
      holdForDiceTumble,
      ensureSheetOpen,
      selectBannerDamageTarget,
      dismissBannerTargetMenu,
    } = await startSubclassRun(browser, {
      className: 'Bard',
      subclassName: 'Troubadour',
      actors: ['gm', 'playerA', 'playerB'],
    });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage], ['B', playerBPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    /** Reseed Rally partyDice on the Bard element (Grant is once/session). */
    async function reseedRallyDice(partyDice) {
      const state = await getTableState(tableId);
      const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
      await updateElement(tableId, bardInstanceId, {
        featureState: {
          ...(bardEl?.featureState || {}),
          Rally: {
            ...(bardEl?.featureState?.Rally || {}),
            partyDice,
          },
        },
      });
      await expect(async () => {
        const next = await getTableState(tableId);
        const el = (next.elements || []).find((e) => e.instanceId === bardInstanceId);
        for (const [id, entry] of Object.entries(partyDice)) {
          expect(el?.featureState?.Rally?.partyDice?.[id]?.dice).toBe(entry.dice);
        }
      }).toPass({ timeout: 8000 });
    }

    async function ackRestBanner(labelRe) {
      const banner = gmPage.locator('.dice-result-banner', { hasText: labelRe });
      await expect(banner).toBeVisible({ timeout: 15000 });
      await holdForDiceTumble();
      gmPage.once('dialog', (d) => d.accept());
      await caption('GM', 'Acknowledges rest', 'Incomplete rest moves OK');
      await ack(banner, { holdMs: 0 });
      await expect(banner).not.toBeVisible({ timeout: 8000 });
    }

    try {
      await caption('GM', 'Loading the table', 'Brix (Bard/Troubadour), Reya (ally), and a Snarling Goblin');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Brix').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Reya').first()).toBeVisible({ timeout: 15000 });

      // ---------------------------------------------------------------------
      // Start Session — fires onSessionStart hooks: Virtuoso doubles Gifted
      // Performer's per-long-rest cap; Maestro arms `maestroRallyChoices`.
      // ---------------------------------------------------------------------
      await caption('GM', 'Start Session', 'Virtuoso and Maestro both hook onSessionStart');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });
      // Rest / End Session need play allowed — force-start if billing gate swallowed the ack.
      await expect(async () => {
        let state = await getTableState(tableId);
        if (state.top?.sessionStarted !== true) {
          await setTableTop(tableId, { sessionStarted: true, sessionPaused: false });
          state = await getTableState(tableId);
        }
        expect(state.top?.sessionStarted).toBe(true);
      }).toPass({ timeout: 10000 });
      // Encounter chrome swaps ▶ Session → ■ End once the client SSE sees play allowed.
      await expect(gmPage.getByRole('button', { name: '■ End' })).toBeVisible({ timeout: 15000 });

      // ---------------------------------------------------------------------
      // Player A opens Brix's sheet for Make a Scene / Gifted Performer songs —
      // multi-instance mutations apply via `POST .../v2-owned-card-chip` (lesson 7).
      // Sidebar cards *toggle* — owned card chips often leave the sheet open, so use
      // ensureSheetOpen (not a blind re-click). Scope clicks to `group/char` so
      // Action Log / banner "Brix" text does not steal the click.
      // ---------------------------------------------------------------------
      const playerABrixCard = playerPage.locator('div.group\\/char', { hasText: 'Brix' });

      // Make a Scene (Bard base feature): spend 3 Hope to Distract the Goblin.
      await caption('PLAYER A', 'Make a Scene', 'Spends 3 Hope — the Goblin becomes Distracted (-2 Difficulty)');
      const actionsMake = await ensureSheetOpen(playerPage, playerABrixCard);
      const makeASceneGroup = actionsMake.getByRole('group', { name: /Make a Scene targets/i });
      await expect(makeASceneGroup).toBeVisible({ timeout: 8000 });
      await makeASceneGroup.getByRole('button', { name: /Snarling Goblin/i }).click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Make a Scene' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const advEl = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(bardEl?.hope).toBe(0);
        // P0 — Make a Scene difficultyMod
        expect(advEl?.difficultyMod).toBe(-2);
      }).toPass({ timeout: 8000 });

      // Relaxing Song, used twice — Virtuoso doubles the per-long-rest cap from 1 to 2.
      await caption('PLAYER A', 'Relaxing Song (1st use)', 'Clears 1 HP for Brix and Reya (Close range)');
      const actionsRelax1 = await ensureSheetOpen(playerPage, playerABrixCard);
      // Chip labels ≠ feature name (Gifted Performer), so page-wide match is safe; still
      // scope to Actions so Features expand headers cannot steal the click.
      const relaxingBtn = actionsRelax1.getByRole('button', { name: /Relaxing Song/i });
      await expect(relaxingBtn).toBeVisible({ timeout: 8000 });
      await relaxingBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Relaxing Song' })).toHaveCount(0, { timeout: 6000 });

      await caption('PLAYER A', 'Relaxing Song (2nd use)', 'Virtuoso: twice per long rest instead of once');
      const actionsRelax2 = await ensureSheetOpen(playerPage, playerABrixCard);
      const relaxingBtn2 = actionsRelax2.getByRole('button', { name: /Relaxing Song/i });
      await expect(relaxingBtn2).toBeVisible({ timeout: 8000 });
      await relaxingBtn2.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Relaxing Song' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        // Real max HP is 6 — Brix started 2 short (4) and Virtuoso lets Relaxing Song
        // fire twice, so both heals land and Brix reaches max.
        expect(bardEl?.currentHp).toBe(6);
        expect(allyEl?.currentHp).toBe(6);
        // Gifted Performer tracks per-song uses on its featureState bag (not featureUsage).
        const gpBag =
          bardEl?.featureState?.['Gifted Performer'] ||
          Object.values(bardEl?.featureState || {}).find((b) => b && typeof b === 'object' && 'relaxingUses' in b);
        expect(gpBag?.relaxingUses).toBe(2);
      }).toPass({ timeout: 8000 });

      // Epic Song: make the Goblin Vulnerable.
      await caption('PLAYER A', 'Epic Song', 'Applies Vulnerable to a target within Close range');
      const actionsEpic = await ensureSheetOpen(playerPage, playerABrixCard);
      const epicSongGroup = actionsEpic.getByRole('group', { name: /Epic Song targets/i });
      await expect(epicSongGroup).toBeVisible({ timeout: 8000 });
      await epicSongGroup.getByRole('button', { name: /Snarling Goblin/i }).click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Epic Song' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const advEl = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(String(advEl?.conditions || '')).toMatch(/Vulnerable/i);
      }).toPass({ timeout: 8000 });

      // Heartbreaking Song: Brix and Reya each gain 1 Hope.
      await caption('PLAYER A', 'Heartbreaking Song', 'Brix and Reya gain 1 Hope');
      const actionsHeart = await ensureSheetOpen(playerPage, playerABrixCard);
      const heartbreakingBtn = actionsHeart.getByRole('button', { name: /Heartbreaking Song/i });
      await expect(heartbreakingBtn).toBeVisible({ timeout: 8000 });
      await heartbreakingBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Heartbreaking Song' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        expect(bardEl?.hope).toBe(1);
        expect(allyEl?.hope).toBe(4);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // P1 — Long-rest refresh of Gifted Performer song uses (custom featureState).
      // Short Rest must NOT clear; Long Rest clears via GiftedPerformer.hooks.onRest.
      // ---------------------------------------------------------------------
      await caption('GM', 'Short Rest', 'Gifted Performer song uses should NOT refresh');
      await expect(gmPage.getByRole('button', { name: /⏸\s*Short/ })).toBeVisible({ timeout: 8000 });
      await gmPage.getByRole('button', { name: /⏸\s*Short/ }).click();
      await ackRestBanner(/Short Rest/i);

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const gpBag =
          bardEl?.featureState?.['Gifted Performer'] ||
          Object.values(bardEl?.featureState || {}).find((b) => b && typeof b === 'object' && 'relaxingUses' in b);
        expect(gpBag?.relaxingUses).toBe(2);
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Long Rest', 'Gifted Performer song uses refresh on long rest');
      await expect(gmPage.getByRole('button', { name: /⏹\s*Long/ })).toBeVisible({ timeout: 8000 });
      await gmPage.getByRole('button', { name: /⏹\s*Long/ }).click();
      await ackRestBanner(/Long Rest/i);

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const gpBag =
          bardEl?.featureState?.['Gifted Performer'] ||
          Object.values(bardEl?.featureState || {}).find((b) => b && typeof b === 'object' && 'relaxingUses' in b);
        expect(gpBag?.relaxingUses ?? 0).toBe(0);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Player A (Brix) grants Rally Dice (d8 at level ≥5), then spends / allies spend.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Grant Rally Dice', 'Once per session — d8 Rally Die for Brix and Reya (level ≥5)');
      const actionsGrant = await ensureSheetOpen(playerPage, playerABrixCard);
      // Rally chips can render twice in the Actions strip (guide + modifier row) — use .first().
      const grantBtn = actionsGrant.getByRole('button', { name: /Grant Rally Dice/i }).first();
      await expect(grantBtn).toBeVisible({ timeout: 8000 });
      await grantBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const partyDice = bardEl?.featureState?.Rally?.partyDice;
        // P1 — Troubadour Rally d8 (level 8 cast; not Wordsmith d10)
        expect(partyDice?.[bardInstanceId]?.dice).toBe('d8');
        expect(partyDice?.[allyInstanceId]?.dice).toBe('d8');
      }).toPass({ timeout: 8000 });

      // P1 — Ally Clear Stress via Rally (cross-sheet chip on Player B)
      const playerBReyaCard = playerBPage.locator('div.group\\/char', { hasText: 'Reya' });
      await caption('PLAYER B', 'Spend Rally Die — Clear Stress', 'Cross-sheet chip from Brix’s Rally');
      const actionsAllyClear = await ensureSheetOpen(playerBPage, playerBReyaCard);
      const allyClearBtn = actionsAllyClear
        .getByRole('button', { name: /Spend Rally Die — Clear Stress/i })
        .first();
      await expect(allyClearBtn).toBeVisible({ timeout: 8000 });
      await allyClearBtn.click();

      const allyRallyStressBannerText = 'Reya — Rally Die';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: allyRallyStressBannerText })).toBeVisible({ timeout: 8000 });
      }
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Reya’s Rally Die', 'Clears Stress equal to the roll');
      const allyRallyStressBanner = gmPage.locator('.dice-result-banner', { hasText: allyRallyStressBannerText });
      await ack(allyRallyStressBanner, { holdMs: 0 });
      await expect(allyRallyStressBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(allyEl?.currentStress).toBeLessThan(3);
        expect(bardEl?.featureState?.Rally?.partyDice?.[allyInstanceId]).toBeUndefined();
        expect(bardEl?.featureState?.Rally?.partyDice?.[bardInstanceId]?.dice).toBe('d8');
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Spend Rally Die — Clear Stress', 'Rolls the die and clears Stress equal to the result');
      const actionsClear = await ensureSheetOpen(playerPage, playerABrixCard);
      const clearStressBtn = actionsClear
        .getByRole('button', { name: /Spend Rally Die — Clear Stress/i })
        .first();
      await expect(clearStressBtn).toBeVisible({ timeout: 8000 });
      await clearStressBtn.click();

      const rallyStressBannerText = 'Brix — Rally Die';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: rallyStressBannerText })).toBeVisible({ timeout: 8000 });
      }
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges the Rally Die roll', '');
      const rallyStressBanner = gmPage.locator('.dice-result-banner', { hasText: rallyStressBannerText });
      await ack(rallyStressBanner, { holdMs: 0 });
      await expect(rallyStressBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.currentStress).toBeLessThan(3);
        expect(bardEl?.featureState?.Rally?.partyDice?.[bardInstanceId]).toBeUndefined();
      }).toPass({ timeout: 8000 });

      // P1 — Rally Damage spend (reseed Brix die; Rapier attack has a damage pool)
      await reseedRallyDice({ [bardInstanceId]: { dice: 'd8' } });
      await caption('PLAYER A', 'Rapier attack', 'Surfaces Spend Rally Die — Damage on the banner');
      const rapierCard = playerPage.getByRole('button', { name: /^Rapier\b/i }).first();
      await ensureSheetOpen(playerPage, playerABrixCard, rapierCard);
      await rapierCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Snarling Goblin/i }).first().click();
      }
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Brix Rapier';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 8000 });
      }

      const attackBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await selectBannerDamageTarget(playerPage, attackBannerPlayer, /Snarling Goblin/i);
      await dismissBannerTargetMenu(playerPage);

      await caption('PLAYER A', 'Spend Rally Die — Damage', 'Adds Rally Die to the damage pool');
      const spendDamageBtn = playerPage.getByRole('button', { name: /Spend Rally Die — Damage/i }).first();
      await expect(spendDamageBtn).toBeVisible({ timeout: 8000 });
      await spendDamageBtn.click();

      // Damage lands via postBannerAddDamage — subItem pre is "Rally Die <n> damage".
      await expect(
        playerPage.locator('.dice-result-banner').getByText(/Rally Die \d+/i).first()
      ).toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.featureState?.Rally?.partyDice?.[bardInstanceId]).toBeUndefined();
      }).toPass({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Rapier attack', '');
      const attackBannerGm = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await selectBannerDamageTarget(gmPage, attackBannerGm, /Snarling Goblin/i);
      await ack(attackBannerGm, { holdMs: 0 });
      await expect(attackBannerGm).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // P0 — Player B Action spend: banner shows Rally Die; partyDice cleared.
      // ---------------------------------------------------------------------
      await reseedRallyDice({ [allyInstanceId]: { dice: 'd8' } });

      await caption('PLAYER B', 'Opens own sheet, rolls Agility', 'Triggers an action roll banner');
      // The sheet has two "Roll Agility"-titled controls: the main Traits grid chip (action
      // roll) and a "Reaction Rolls" grid cell at the bottom of the Defense card — both share
      // the same `title` attribute. The main chip's accessible name includes its verb hint
      // (`TRAIT_VERBS.agility`, CharacterDisplay.jsx) so it can be targeted unambiguously.
      const agilityBtn = playerBPage.getByRole('button', { name: /Agility.*Sprint/i });
      await ensureSheetOpen(playerBPage, playerBReyaCard, agilityBtn);
      await agilityBtn.click();

      // Every trait roll routes through a "Before you roll" confirmation panel
      // (`_intentPanelForActionRoll`, CharacterHoverCard.jsx) — Proceed to actually post it.
      await expect(playerBPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerBPage.getByRole('button', { name: 'Proceed' }).click();

      const bBannerText = 'Reya Agility';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: bBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER B', 'Spend Rally Die — Action', 'Adds the Rally Die to this action roll (cross-sheet reviewAction chip)');
      const spendActionBtn = playerBPage.getByRole('button', { name: /Spend Rally Die — Action/i }).first();
      await expect(spendActionBtn).toBeVisible({ timeout: 8000 });
      await spendActionBtn.click();

      // P0 — Rally die landed (duality line shows "Rally Die N"); partyDice cleared.
      const bBannerPlayer = playerBPage.locator('.dice-result-banner', { hasText: bBannerText });
      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.featureState?.Rally?.partyDice?.[allyInstanceId]).toBeUndefined();
      }).toPass({ timeout: 8000 });
      await expect(bBannerPlayer.getByText(/Rally Die \d+/i).first()).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Reya’s roll', '');
      const bBanner = gmPage.locator('.dice-result-banner', { hasText: bBannerText });
      await ack(bBanner, { holdMs: 0 });
      await expect(bBanner).not.toBeVisible({ timeout: 5000 });

      // P1 — Rally reaction path (Defense Reaction Rolls grid — not Sprint verb)
      await reseedRallyDice({ [allyInstanceId]: { dice: 'd8' } });
      await caption('PLAYER B', 'Reaction Agility', 'Spend Rally Die on a reaction roll');
      await ensureSheetOpen(playerBPage, playerBReyaCard);
      const reactionAgility = playerBPage
        .getByText('Reaction Rolls', { exact: true })
        .locator('xpath=ancestor::div[1]')
        .getByRole('button', { name: /Agility/i });
      await expect(reactionAgility).toBeVisible({ timeout: 8000 });
      await reactionAgility.click();
      await expect(playerBPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerBPage.getByRole('button', { name: 'Proceed' }).click();

      const reactionBannerText = 'Reya — Reaction (Agility)';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: reactionBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER B', 'Spend Rally Die — Action', 'Same chip works on reaction rolls');
      const spendReactionBtn = playerBPage.getByRole('button', { name: /Spend Rally Die — Action/i }).first();
      await expect(spendReactionBtn).toBeVisible({ timeout: 8000 });
      await spendReactionBtn.click();

      const reactionBannerPlayer = playerBPage.locator('.dice-result-banner', { hasText: reactionBannerText });
      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.featureState?.Rally?.partyDice?.[allyInstanceId]).toBeUndefined();
      }).toPass({ timeout: 8000 });
      await expect(reactionBannerPlayer.getByText(/Rally Die \d+/i).first()).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges reaction roll', '');
      const reactionBanner = gmPage.locator('.dice-result-banner', { hasText: reactionBannerText });
      await ack(reactionBanner, { holdMs: 0 });
      await expect(reactionBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Maestro — after Rally: Player B's sheet shows the cross-sheet chip
      // sourced from Brix's Troubadour feature. Known gap: cross-sheet `isSelect`
      // activation isn't wired yet (see file header), so this only asserts the
      // chip renders — it is not clicked.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER B',
        'Maestro — after Rally',
        'Cross-sheet chip from Brix’s Troubadour feature (choice UI not yet wired for cross-sheet chips)'
      );
      // Own action rolls dismiss the local hover card — reopen without toggling closed.
      const maestroChip = playerBPage.getByText(/Maestro — after Rally/i).first();
      await ensureSheetOpen(playerBPage, playerBReyaCard, maestroChip);
      await expect(maestroChip).toBeVisible({ timeout: 8000 });

      // P1 — Rally session-end clear (seed leftover partyDice, then ■ End)
      await reseedRallyDice({
        [bardInstanceId]: { dice: 'd8' },
        [allyInstanceId]: { dice: 'd8' },
      });
      await caption('GM', 'End Session', 'Clears unspent Rally Dice (partyDice)');
      gmPage.once('dialog', (d) => d.accept());
      await gmPage.getByRole('button', { name: '■ End' }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(state.top?.sessionStarted).toBe(false);
        expect(bardEl?.featureState?.Rally?.partyDice).toBeUndefined();
        expect(bardEl?.featureState?.Rally?.maestroRallyChoices).toBeUndefined();
      }).toPass({ timeout: 8000 });

      await caption('Bard / Troubadour', 'Walkthrough complete', 'Gifted Performer, Maestro, Virtuoso, and Rally');

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
