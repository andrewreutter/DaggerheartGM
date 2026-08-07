/**
 * Subclass feature video — Bard / Wordsmith.
 *
 * Walks through every Wordsmith feature (Rousing Speech, Heart of a Poet, Eloquent,
 * Epic Poetry) plus the inherited Bard class features (Make a Scene, Rally), driven from
 * three real browser contexts (GM, Player A = the Wordsmith, Player B = an ally).
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the harness design.
 *
 * Multi-user coverage (per the plan's "Bard/Troubadour + Wordsmith" row):
 *  - Player A runs Make a Scene / Rousing Speech — multi-instance mutations apply via
 *    `POST /api/room/:tableId/v2-owned-card-chip` (lesson 7: prefer Player A for owned
 *    card chips that mutate allies/adversaries).
 *  - Player A grants Rally Dice (Epic Poetry → d10) and spends their own die to clear Stress.
 *  - Player B rolls a trait and spends the granted Rally Die via the cross-sheet
 *    "Spend Rally Die — Action" `reviewAction` chip (M2 pattern).
 *  - Epic Poetry's Tag Team d10 advantage chip is captioned as a known VTT gap: there is no
 *    Game Table UI yet that posts `action.type === 'tagTeam'` rolls, so the intent chip cannot
 *    be exercised end-to-end. The d10 Rally Die size (same feature) is asserted mechanically.
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
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildBardWordsmithCharacterData, buildAllyCharacterData } from '../helpers/subclass-cast.js';

test.describe('Subclass video — Bard / Wordsmith', () => {
  let tableId;
  let bardLibId;
  let allyLibId;
  let bardInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Bard Wordsmith Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const bardLib = await createLibraryCharacter(ACTOR_GM, buildBardWordsmithCharacterData({ name: 'Callie' }));
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
        // hope: 4 — Make a Scene (3) then Heart of a Poet (1). currentStress marked so
        // "Spend Rally Die — Clear Stress" is visible. maxHp/maxStress from factory: 6 / 7.
        currentHp: 6, currentStress: 3, hope: 4, currentArmor: 0,
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
        // ≥2 Stress so Rousing Speech can clear 2.
        currentHp: 6, currentStress: 3, hope: 3, currentArmor: 0,
        conditions: '',
        // Far band (≤100ft) — well within Rousing Speech / Make a Scene Close/Far needs.
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
        tokenX: 110, tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (bardLibId) await deleteLibraryCharacter(ACTOR_GM, bardLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Callie the Wordsmith: Rousing Speech, Heart of a Poet, Eloquent, Epic Poetry, and Rally', async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, playerBPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
        className: 'Bard',
        subclassName: 'Wordsmith',
        actors: ['gm', 'playerA', 'playerB'],
      });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage], ['B', playerBPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Callie (Bard/Wordsmith), Reya (ally), and a Snarling Goblin');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Callie').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Reya').first()).toBeVisible({ timeout: 15000 });

      // ---------------------------------------------------------------------
      // Start Session
      // ---------------------------------------------------------------------
      await caption('GM', 'Start Session', 'Arms session-frequency features (Rally, Eloquent)');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Player A — Make a Scene / Rousing Speech (multi-instance via v2-owned-card-chip)
      // ---------------------------------------------------------------------
      const playerACallieCard = playerPage.locator('div.group\\/char', { hasText: 'Callie' });

      // Make a Scene (Bard base): spend 3 Hope to Distract the Goblin.
      // Sidebar cards toggle — ensureSheetOpen avoids closing an already-open sheet.
      await caption('PLAYER A', 'Make a Scene', 'Spends 3 Hope — the Goblin becomes Distracted (-2 Difficulty)');
      const actionsMake = await ensureSheetOpen(playerPage, playerACallieCard);
      const makeASceneGroup = actionsMake.getByRole('group', { name: /Make a Scene targets/i });
      await expect(makeASceneGroup).toBeVisible({ timeout: 8000 });
      await makeASceneGroup.getByRole('button', { name: /Snarling Goblin/i }).click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Make a Scene' })).toHaveCount(0, { timeout: 6000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.hope).toBe(1);
      }).toPass({ timeout: 8000 });

      // Rousing Speech — clears 2 Stress on allies within Far.
      // Do NOT use a page-wide /Rousing Speech/i button match: the Features-list expand
      // control for the same-named feature also includes the "long" frequency badge in its
      // accessible name, so `.first()` silently expands the card instead of activating the
      // Actions-strip chip.
      await caption('PLAYER A', 'Rousing Speech', 'Allies within Far clear 2 Stress (once per long rest)');
      const actionsRousing = await ensureSheetOpen(playerPage, playerACallieCard);
      // Prefer the Actions strip chip class (lesson 15) — not Features expand headers.
      const rousingBtn = actionsRousing
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Rousing Speech/i });
      await expect(rousingBtn).toBeVisible({ timeout: 8000 });
      await expect(rousingBtn).toBeEnabled({ timeout: 8000 });
      await rousingBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        expect(allyEl?.currentStress).toBe(1);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Player A — Heart of a Poet (Presence action roll + reviewAction d4)
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Heart of a Poet', 'Rolls Presence, then spends 1 Hope to add a d4');
      const presenceBtn = playerPage.getByRole('button', { name: /Presence.*Charm/i });
      await ensureSheetOpen(playerPage, playerACallieCard, presenceBtn);
      await presenceBtn.click();
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const presenceBannerText = 'Callie Presence';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: presenceBannerText })).toBeVisible({ timeout: 8000 });
      }

      const heartBtn = playerPage.getByRole('button', { name: /Heart of a Poet/i }).first();
      await expect(heartBtn).toBeVisible({ timeout: 8000 });
      await heartBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        expect(bardEl?.hope).toBe(0);
      }).toPass({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Presence roll', 'Heart of a Poet d4 applied');
      const presenceBanner = gmPage.locator('.dice-result-banner', { hasText: presenceBannerText });
      await ack(presenceBanner, { holdMs: 0 });
      await expect(presenceBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Eloquent — isSelect card chip (actionLoop only; no GM Acknowledge)
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Eloquent', 'Once per session — choose a benefit for an ally');
      const actionsEloquent = await ensureSheetOpen(playerPage, playerACallieCard);
      const eloquentGroup = actionsEloquent.getByRole('group', { name: /Eloquent/i });
      await expect(eloquentGroup).toBeVisible({ timeout: 8000 });
      await eloquentGroup.getByRole('button', { name: /Find a mundane object/i }).click();

      // Action-only banner self-dismisses; assert via Action Log / just wait briefly.
      await playerPage.waitForTimeout(800);

      // ---------------------------------------------------------------------
      // Rally + Epic Poetry d10 die size
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Grant Rally Dice', 'Epic Poetry: Rally Die is a d10 (not d6/d8)');
      const actionsGrant = await ensureSheetOpen(playerPage, playerACallieCard);
      // Rally chips can render twice in the Actions strip (guide + modifier row) — use .first().
      const grantBtn = actionsGrant.getByRole('button', { name: /Grant Rally Dice/i }).first();
      await expect(grantBtn).toBeVisible({ timeout: 8000 });
      await grantBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const bardEl = (state.elements || []).find((e) => e.instanceId === bardInstanceId);
        const partyDice = bardEl?.featureState?.Rally?.partyDice;
        expect(partyDice?.[bardInstanceId]?.dice).toBe('d10');
        expect(partyDice?.[allyInstanceId]?.dice).toBe('d10');
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Spend Rally Die — Clear Stress', 'Rolls the d10 and clears Stress equal to the result');
      const actionsClear = await ensureSheetOpen(playerPage, playerACallieCard);
      const clearStressBtn = actionsClear
        .getByRole('button', { name: /Spend Rally Die — Clear Stress/i })
        .first();
      await expect(clearStressBtn).toBeVisible({ timeout: 8000 });
      await clearStressBtn.click();

      const rallyStressBannerText = 'Callie — Rally Die';
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
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Player B spends Rally Die on an action roll (cross-sheet reviewAction)
      // ---------------------------------------------------------------------
      const playerBReyaCard = playerBPage.locator('div.group\\/char', { hasText: 'Reya' });

      await caption('PLAYER B', 'Opens own sheet, rolls Agility', 'Triggers an action roll banner');
      const agilityBtn = playerBPage.getByRole('button', { name: /Agility.*Sprint/i });
      await ensureSheetOpen(playerBPage, playerBReyaCard, agilityBtn);
      await agilityBtn.click();
      await expect(playerBPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerBPage.getByRole('button', { name: 'Proceed' }).click();

      const bBannerText = 'Reya Agility';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: bBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER B', 'Spend Rally Die — Action', 'Adds the d10 Rally Die to this action roll (cross-sheet)');
      const spendActionBtn = playerBPage.getByRole('button', { name: /Spend Rally Die — Action/i }).first();
      await expect(spendActionBtn).toBeVisible({ timeout: 8000 });
      await spendActionBtn.click();

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Reya’s roll', '');
      const bBanner = gmPage.locator('.dice-result-banner', { hasText: bBannerText });
      await ack(bBanner, { holdMs: 0 });
      await expect(bBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Epic Poetry — sheet display + known Tag Team intent-chip gap
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Epic Poetry',
        'Sheet feature + d10 Rally already verified; Tag Team advantage chip needs Game Table Tag Team rolls (not wired yet)'
      );
      const epicPoetry = playerPage.getByText(/Epic Poetry/i).first();
      await ensureSheetOpen(playerPage, playerACallieCard, epicPoetry);
      await expect(epicPoetry).toBeVisible({ timeout: 8000 });

      await caption('Bard / Wordsmith', 'Walkthrough complete', 'Rousing Speech, Heart of a Poet, Eloquent, Epic Poetry, Rally');

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
