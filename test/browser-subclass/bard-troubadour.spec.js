/**
 * Subclass feature video — Bard / Troubadour (pilot).
 *
 * Walks through every Troubadour feature (Gifted Performer's three songs, Maestro,
 * Virtuoso) plus the inherited Bard class feature it modifies (Rally), driven from
 * three real browser contexts (GM, Player A = the Troubadour, Player B = an ally).
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the harness design.
 *
 * Multi-user coverage exercised here (per the plan's "Bard/Troubadour + Wordsmith" row):
 *  - GM-driven Gifted Performer songs (Relaxing / Epic / Heartbreaking) — these mutate
 *    OTHER characters/adversaries, so they are run from the GM's client (`postTableOp`
 *    applies multi-instance mutations); a player-owned card chip would have those
 *    mutations silently dropped by `mergeUpdatesForInstance` (see
 *    src/client/lib/v2-merge-element-updates.js).
 *  - Player A (the Troubadour) runs "Grant Rally Dice" and "Spend Rally Die — Clear
 *    Stress" on their own sheet — both only mutate the Bard's own instance/featureState.
 *  - Player B rolls a trait (real action roll banner) and spends the granted Rally Die
 *    on it via the "Spend Rally Die — Action" `reviewAction` chip (cross-player, mid-
 *    banner — same pattern as M2 in test/browser/action-loop-multi-actor.spec.js).
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
  cancelAllPendingBanners,
  grantCampaignPassForTable,
} from '../helpers/multi-auth.js';
import { startSubclassRun } from '../helpers/subclass-video.js';
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
        currentHp: 4, currentStress: 0, hope: 3, currentArmor: 0,
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
        // 10ft from the Bard — also within Close range.
        tokenX: 110, tokenY: 100,
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
    const { gmPage, playerPage, playerBPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Bard',
      subclassName: 'Troubadour',
      actors: ['gm', 'playerA', 'playerB'],
    });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage], ['B', playerBPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
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

      // Hide the 3D dice canvas on all three clients so every banner in this walkthrough
      // resolves immediately instead of racing a tumbling-dice animation (established
      // pattern — see test/browser/action-loop-multi-actor.spec.js M2/M4/M5).
      for (const p of [gmPage, playerPage, playerBPage]) {
        await p.getByLabel('Hide dice').click();
      }

      // ---------------------------------------------------------------------
      // Start Session — fires onSessionStart hooks: Virtuoso doubles Gifted
      // Performer's per-long-rest cap; Maestro arms `maestroRallyChoices`.
      // ---------------------------------------------------------------------
      await caption('GM', 'Start Session', 'Virtuoso and Maestro both hook onSessionStart');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // GM opens Brix's sheet to run the Gifted Performer / Make a Scene cards —
      // these mutate the ally and the adversary, so they must go through the GM's
      // `postTableOp` path, not a player-owned card chip (see file header).
      // NOTE: the character hover sheet auto-dismisses after every action/roll
      // (`dismissAllHoverCards`, GMTableView.jsx), so it is re-opened before each
      // of the following card interactions. The sidebar card root has a stable
      // `group/char` class (GameTableCharacterListCard) — scoping the click to it
      // (rather than a bare `text=Brix` substring match) avoids accidentally
      // matching "Brix" text elsewhere on the page (Action Log entries, banner
      // titles, the open sheet's own header), which would silently no-op instead
      // of (re)opening the sidebar sheet.
      // ---------------------------------------------------------------------
      const gmBrixCard = gmPage.locator('div.group\\/char', { hasText: 'Brix' });

      // Make a Scene (Bard base feature): spend 3 Hope to Distract the Goblin.
      await caption('GM', 'Make a Scene', 'Spends 3 Hope — the Goblin becomes Distracted (-2 Difficulty)');
      await gmBrixCard.click();
      const makeASceneGroup = gmPage.getByRole('group', { name: /Make a Scene targets/i });
      await expect(makeASceneGroup).toBeVisible({ timeout: 8000 });
      await makeASceneGroup.getByRole('button', { name: /Snarling Goblin/i }).click();
      await expect(gmPage.locator('.dice-result-banner', { hasText: 'Make a Scene' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.hope).toBe(0);
      }).toPass({ timeout: 8000 });

      // Relaxing Song, used twice — Virtuoso doubles the per-long-rest cap from 1 to 2.
      await caption('GM', 'Relaxing Song (1st use)', 'Clears 1 HP for Brix and Reya (Close range)');
      await gmBrixCard.click();
      // Card chip buttons render with a trailing frequency badge (e.g. "Relaxing Song ○ long"),
      // so the accessible name isn't an exact match — use a substring regex, not anchored.
      const relaxingBtn = gmPage.getByRole('button', { name: /Relaxing Song/i }).first();
      await expect(relaxingBtn).toBeVisible({ timeout: 8000 });
      await relaxingBtn.click();
      await expect(gmPage.locator('.dice-result-banner', { hasText: 'Relaxing Song' })).toHaveCount(0, { timeout: 6000 });

      await caption('GM', 'Relaxing Song (2nd use)', 'Virtuoso: twice per long rest instead of once');
      await gmBrixCard.click();
      await expect(relaxingBtn).toBeVisible({ timeout: 8000 });
      await relaxingBtn.click();
      await expect(gmPage.locator('.dice-result-banner', { hasText: 'Relaxing Song' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        // Real max HP is 6 — Brix started 2 short (4) and Virtuoso lets Relaxing Song
        // fire twice, so both heals land and Brix reaches max.
        expect(bardEl?.currentHp).toBe(6);
        expect(allyEl?.currentHp).toBe(6);
      }).toPass({ timeout: 8000 });

      // Epic Song: make the Goblin Vulnerable.
      await caption('GM', 'Epic Song', 'Applies Vulnerable to a target within Close range');
      await gmBrixCard.click();
      const epicSongGroup = gmPage.getByRole('group', { name: /Epic Song targets/i });
      await expect(epicSongGroup).toBeVisible({ timeout: 8000 });
      await epicSongGroup.getByRole('button', { name: /Snarling Goblin/i }).click();
      await expect(gmPage.locator('.dice-result-banner', { hasText: 'Epic Song' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const advEl = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(String(advEl?.conditions || '')).toMatch(/Vulnerable/i);
      }).toPass({ timeout: 8000 });

      // Heartbreaking Song: Brix and Reya each gain 1 Hope.
      await caption('GM', 'Heartbreaking Song', 'Brix and Reya gain 1 Hope');
      await gmBrixCard.click();
      const heartbreakingBtn = gmPage.getByRole('button', { name: /Heartbreaking Song/i }).first();
      await expect(heartbreakingBtn).toBeVisible({ timeout: 8000 });
      await heartbreakingBtn.click();
      await expect(gmPage.locator('.dice-result-banner', { hasText: 'Heartbreaking Song' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        expect(bardEl?.hope).toBe(1);
        expect(allyEl?.hope).toBe(4);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Player A (Brix) grants Rally Dice, then spends their own die to clear Stress.
      // (Sheet is re-opened before each card interaction — see note above.)
      // ---------------------------------------------------------------------
      const playerABrixCard = playerPage.locator('div.group\\/char', { hasText: 'Brix' });

      await caption('PLAYER A', 'Grant Rally Dice', 'Once per session — gives Brix and Reya a Rally Die each');
      await playerABrixCard.click();
      const grantBtn = playerPage.getByRole('button', { name: /Grant Rally Dice/i }).first();
      await expect(grantBtn).toBeVisible({ timeout: 8000 });
      await grantBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.featureState?.Rally?.partyDice?.[allyInstanceId]).toBeTruthy();
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Spend Rally Die — Clear Stress', 'Rolls the die and clears Stress equal to the result');
      await playerABrixCard.click();
      const clearStressBtn = playerPage.getByRole('button', { name: /Spend Rally Die — Clear Stress/i }).first();
      await expect(clearStressBtn).toBeVisible({ timeout: 8000 });
      await clearStressBtn.click();

      const rallyStressBannerText = 'Brix — Rally Die';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: rallyStressBannerText })).toBeVisible({ timeout: 8000 });
      }
      await caption('GM', 'Acknowledges the Rally Die roll', '');
      const rallyStressBanner = gmPage.locator('.dice-result-banner', { hasText: rallyStressBannerText });
      await rallyStressBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(rallyStressBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.currentStress).toBeLessThan(3);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Player B rolls a trait (real action roll) and spends the Rally Die Brix
      // granted them on that roll — a cross-player `reviewAction` chip activated
      // mid-banner (M2 pattern).
      // ---------------------------------------------------------------------
      const playerBReyaCard = playerBPage.locator('div.group\\/char', { hasText: 'Reya' });

      await caption('PLAYER B', 'Opens own sheet, rolls Agility', 'Triggers an action roll banner');
      await playerBReyaCard.click();
      // The sheet has two "Roll Agility"-titled controls: the main Traits grid chip (action
      // roll) and a "Reaction Rolls" grid cell at the bottom of the Defense card — both share
      // the same `title` attribute. The main chip's accessible name includes its verb hint
      // (`TRAIT_VERBS.agility`, CharacterDisplay.jsx) so it can be targeted unambiguously.
      await playerBPage.getByRole('button', { name: /Agility.*Sprint/i }).click();

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

      await caption('GM', 'Acknowledges Reya’s roll', '');
      const bBanner = gmPage.locator('.dice-result-banner', { hasText: bBannerText });
      await bBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(bBanner).not.toBeVisible({ timeout: 5000 });

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
      // Own action rolls also dismiss the local hover card (see note above) — reopen it.
      await playerBReyaCard.click();
      const maestroChip = playerBPage.getByText(/Maestro — after Rally/i).first();
      await expect(maestroChip).toBeVisible({ timeout: 8000 });

      await caption('Bard / Troubadour', 'Walkthrough complete', 'Gifted Performer, Maestro, Virtuoso, and Rally');

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
