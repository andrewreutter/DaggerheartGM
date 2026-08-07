/**
 * Subclass feature video — Seraph / Winged Sentinel.
 *
 * Walks through Winged Sentinel features (Wings of Light, Ethereal Visage, Ascendant,
 * Power of the Gods) plus inherited Seraph class features (Prayer Dice, Life Support),
 * from three browser contexts (GM, Player A = Seraph, Player B = ally).
 *
 * Special multi-user coverage (per the plan):
 *  - Session start grants Prayer Dice via physical-roll resume.
 *  - Owner (Player A) spends a Prayer Die on Player B's pending action banner (M2).
 *  - Power of the Gods arms `powerOfTheGodsMastery` on session start (d12 Wings damage).
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
import {
  buildSeraphWingedSentinelCharacterData,
  buildAllyCharacterData,
} from '../helpers/subclass-cast.js';

test.describe('Subclass video — Seraph / Winged Sentinel', () => {
  let tableId;
  let seraphLibId;
  let allyLibId;
  let seraphInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Seraph Winged Sentinel Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const seraphLib = await createLibraryCharacter(
      ACTOR_GM,
      buildSeraphWingedSentinelCharacterData({ name: 'Elyra' }),
    );
    seraphLibId = seraphLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    seraphInstanceId = `char-ws-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-cultist-${Date.now() + 2}`;

    const preState = await getTableState(tableId);
    const mapId = preState?.maps?.[0]?.id ?? null;

    await addElementsToTable(tableId, [
      {
        instanceId: seraphInstanceId,
        elementType: 'character',
        id: seraphLib.id,
        name: seraphLib.name,
        currentHp: 8,
        currentStress: 1,
        hope: 4,
        currentArmor: 0,
        conditions: '',
        tokenX: 40,
        tokenY: 40,
        ...(mapId ? { mapId } : {}),
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: allyInstanceId,
        elementType: 'character',
        id: allyLib.id,
        name: allyLib.name,
        currentHp: 3,
        maxHp: 6,
        currentStress: 0,
        hope: 3,
        currentArmor: 0,
        conditions: '',
        tokenX: 45,
        tokenY: 40,
        ...(mapId ? { mapId } : {}),
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Cultist Thug',
        tier: 1,
        difficulty: 1,
        hp_max: 6,
        currentHp: 6,
        currentStress: 0,
        conditions: '',
        tokenX: 43,
        tokenY: 40,
        ...(mapId ? { mapId } : {}),
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (seraphLibId) await deleteLibraryCharacter(ACTOR_GM, seraphLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Elyra the Winged Sentinel: Wings of Light, Prayer Dice, Ethereal Visage', async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const consoleErrors = [];
    const { gmPage, playerPage, playerBPage, caption, finish, ack } = await startSubclassRun(browser, {
      className: 'Seraph',
      subclassName: 'Winged Sentinel',
      actors: ['gm', 'playerA', 'playerB'],
    });

    for (const [tag, p] of [
      ['GM', gmPage],
      ['A', playerPage],
      ['B', playerBPage],
    ]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`);
      });
    }

    try {
      await caption('GM', 'Loading the table', 'Elyra (Seraph/Winged Sentinel), Reya (ally), Cultist Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({
        timeout: 15000,
      });
      await expect(playerPage.locator('text=Elyra').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Reya').first()).toBeVisible({ timeout: 15000 });

      // Keep 3D dice on the camera (playerPage) so the screencast captures tumbles.
      for (const p of [gmPage, playerBPage]) {
        await p.getByLabel('Hide dice').click();
      }

      // ---------------------------------------------------------------------
      // Start Session → Prayer Dice + Power of the Gods mastery flag
      // ---------------------------------------------------------------------
      await caption(
        'GM',
        'Start Session',
        'Prayer Dice physical roll + Power of the Gods arms d12 Wings damage',
      );
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      await caption('GM', 'Prayer Dice roll', 'Physical-roll resume — acknowledge to grant the pool');
      const prayerDiceBanner = gmPage.locator('.dice-result-banner', {
        hasText: 'Elyra — Prayer Dice',
      });
      await expect(prayerDiceBanner).toBeVisible({ timeout: 8000 });
      await ack(prayerDiceBanner, { force: true });
      await expect(prayerDiceBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool) && pool.length).toBeGreaterThan(0);
      }).toPass({ timeout: 8000 });

      const playerElyraCard = playerPage.locator('div.group\\/char', { hasText: 'Elyra' });

      // ---------------------------------------------------------------------
      // Display Ascendant / Ethereal Visage / Power of the Gods on sheet
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Subclass features on sheet',
        'Wings of Light, Ethereal Visage, Ascendant (+4 Severe), Power of the Gods',
      );
      await playerElyraCard.click();
      await expect(playerPage.getByText('Wings of Light', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });
      await expect(playerPage.getByText('Ascendant', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });
      await expect(playerPage.getByText('Ethereal Visage', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });
      await expect(playerPage.getByText('Power of the Gods', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Wings of Light — Flying toggle
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Wings of Light — Flying', 'Toggle on (fly)');
      await playerElyraCard.click();
      const flyingToggle = playerPage.getByRole('button', { name: /^Flying\b/i }).first();
      await expect(flyingToggle).toBeVisible({ timeout: 8000 });
      await flyingToggle.click();

      // Flying may be immediate or deferred-to-ack depending on host wiring; handle both.
      const flyingBanner = gmPage.locator('.dice-result-banner', { hasText: /Wings of Light|Flying/i });
      if (await flyingBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
        await caption('GM', 'Acknowledges Flying toggle', '');
        await ack(flyingBanner);
        await expect(flyingBanner).not.toBeVisible({ timeout: 5000 });
      }

      // ---------------------------------------------------------------------
      // Pick up and carry (Stress) — only available while flying
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Pick up and carry', 'Mark 1 Stress while flying');
      await playerElyraCard.click();
      const carryBtn = playerPage.getByRole('button', { name: /Pick up and carry/i }).first();
      await expect(carryBtn).toBeVisible({ timeout: 8000 });
      const stressBefore = (
        await getTableState(tableId)
      ).elements?.find((e) => e.instanceId === seraphInstanceId)?.currentStress;
      await carryBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        expect(el?.currentStress).toBeGreaterThan(stressBefore ?? 1);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Attack while flying — Wings of Light extra damage reviewAction chip
      // (before Life Support so Hope remains for the chip / sheet stays uncluttered)
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Attack while flying',
        'Wings of Light — extra damage (Hope for d12 via Power of the Gods)',
      );
      await playerElyraCard.click();
      const broadsword = playerPage.getByRole('button', { name: /Broadsword/i }).first();
      await expect(broadsword).toBeVisible({ timeout: 8000 });
      await broadsword.click();

      if (await playerPage.getByText('Choose target').isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Cultist Thug/i }).first().click();
      }
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Elyra Broadsword';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      const wingsDmgBtn = playerPage.getByRole('button', { name: /Wings of Light — extra damage/i }).first();
      if (await wingsDmgBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await caption('PLAYER A', 'Wings of Light — extra damage', 'Spend 1 Hope for bonus damage die');
        await wingsDmgBtn.click();
      } else {
        await caption(
          'PLAYER A',
          'Wings of Light — extra damage',
          'Chip not shown (attack may have missed or flying state not armed) — continuing',
        );
      }

      await caption('GM', 'Acknowledges Broadsword attack', '');
      await gmPage.keyboard.press('Escape');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await ack(attackBanner, { force: true });
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Life Support (GM) — ally heal (deferred banner; ally must be selected on banner)
      // ---------------------------------------------------------------------
      const gmElyraCard = gmPage.locator('div.group\\/char', { hasText: 'Elyra' });
      await caption('GM', 'Life Support', 'Spend 3 Hope — clear 1 HP on Reya');
      await gmElyraCard.click();
      const lifeSupportGroup = gmPage.getByRole('group', { name: /Life Support targets/i });
      await expect(lifeSupportGroup).toBeVisible({ timeout: 8000 });
      await lifeSupportGroup.getByRole('button', { name: /Reya/i }).click();
      await gmPage.keyboard.press('Escape');
      const lifeSupportBanner = gmPage.locator('.dice-result-banner', { hasText: 'Life Support' });
      await expect(lifeSupportBanner).toBeVisible({ timeout: 8000 });
      const lifeSupportAck = lifeSupportBanner.getByRole('button', { name: 'Acknowledge' });
      // Sheet select already posts `life-support-select`. A second banner click would toggle
      // the selection off (`sendLifeSupportSelect` deselects) and leave Ack disabled.
      if (!(await lifeSupportAck.isEnabled().catch(() => false))) {
        await lifeSupportBanner.getByRole('button', { name: /Reya/i }).click();
      }
      await expect(lifeSupportAck).toBeEnabled({ timeout: 8000 });
      await ack(lifeSupportBanner, { force: true });
      await expect(lifeSupportBanner).not.toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Ethereal Visage — Presence roll while flying (advantage onIntent)
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Ethereal Visage — Presence',
        'While flying: advantage on Presence rolls',
      );
      await playerElyraCard.click();
      // Main Traits grid chip includes TRAIT_VERBS.presence (Charm/Perform/Deceive) —
      // disambiguates from the Defense card's Reaction Rolls grid (same "Presence" title).
      await playerPage.getByRole('button', { name: /Presence.*Charm/i }).click();
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const presenceBannerText = 'Elyra Presence';
      await expect(
        gmPage.locator('.dice-result-banner', { hasText: presenceBannerText }),
      ).toBeVisible({ timeout: 8000 });

      // Optional Ethereal Visage reviewOutcome chip — only when Hope dominates a
      // successful Presence roll and the GM Fear pool is non-empty (often absent here).
      const fearChip = playerPage
        .getByRole('button', { name: /Ethereal Visage — Fear instead of Hope/i })
        .first();
      if (await fearChip.isVisible({ timeout: 2500 }).catch(() => false)) {
        await caption('PLAYER A', 'Ethereal Visage — Fear instead of Hope', 'reviewOutcome toggle');
        await fearChip.click();
      }

      await caption('GM', 'Acknowledges Presence roll', '');
      // Pinned character sheet (z-[55]) intercepts banner Acknowledge — dismiss first.
      await gmPage.keyboard.press('Escape');
      await playerPage.keyboard.press('Escape');
      const presenceBanner = gmPage.locator('.dice-result-banner', { hasText: presenceBannerText });
      await ack(presenceBanner, { force: true });
      await expect(presenceBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // M2: Player B rolls → Player A spends Prayer Die
      // ---------------------------------------------------------------------
      const playerBReyaCard = playerBPage.locator('div.group\\/char', { hasText: 'Reya' });
      await caption('PLAYER B', 'Rolls Agility', 'Pending banner for Elyra to aid with a Prayer Die');
      await playerBReyaCard.click();
      await playerBPage.getByRole('button', { name: /Agility.*Sprint/i }).click();
      await expect(playerBPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerBPage.getByRole('button', { name: 'Proceed' }).click();

      const bBannerText = 'Reya Agility';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: bBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      await caption(
        'PLAYER A',
        'Prayer Die — Action',
        'Spends a Prayer Die on Reya’s action roll (cross-player M2)',
      );
      const prayerDieActionGroup = playerPage.getByLabel(/add its value to this action roll/i).first();
      const prayerDieOption = prayerDieActionGroup.getByRole('button', { name: /^d4 \(/ }).first();
      await expect(prayerDieOption).toBeVisible({ timeout: 8000 });
      await prayerDieOption.click();

      await caption('GM', "Acknowledges Reya’s roll", '');
      await gmPage.keyboard.press('Escape');
      const bBanner = gmPage.locator('.dice-result-banner', { hasText: bBannerText });
      await ack(bBanner, { force: true });
      await expect(bBanner).not.toBeVisible({ timeout: 5000 });

      await caption(
        'Seraph / Winged Sentinel',
        'Walkthrough complete',
        'Prayer Dice resume, Wings of Light, Life Support, M2 Prayer Die spend',
      );

      const seriousErrors = consoleErrors.filter(
        (e) =>
          !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*(403|404)|source\.set|reading 'set'|billing.*session-start/i.test(
            e,
          ),
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
