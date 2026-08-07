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
 *
 * Phase 1 TEST_GAP:
 *  - Ascendant Severe threshold (≥ 31 at level 8 with Chainmail).
 *  - Prayer Die pool shrink; Reduce + Hope + Action modes (Damage is on Divine Wielder).
 *  - Wings of Light extra damage d12 (Power of the Gods) + Hope cost.
 *  - Ethereal Visage advantage die on Presence while flying (Fear chip when Hope dominates).
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
  gmRoll,
  setFearCount,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import {
  buildSeraphWingedSentinelCharacterData,
  buildAllyCharacterData,
} from '../helpers/subclass-cast.js';

/** Guaranteed-hit adversary attack with physical damage (for Prayer Die — reduce). */
async function gmAdversaryAttack(tableId, { advInstanceId, targetInstanceId, displayName }) {
  return gmRoll(
    tableId,
    `${displayName} [d20+50] damage [2d8+4] phy melee`,
    displayName,
    {
      _attackerInstanceId: advInstanceId,
      _attackerType: 'adversary',
      _selectedTargetInstanceId: targetInstanceId,
      _attackRangeFt: 5,
    },
  );
}

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
    const { gmPage, playerPage, playerBPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
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
      await holdForDiceTumble();
      await ack(prayerDiceBanner, { force: true, holdMs: 0 });
      await expect(prayerDiceBanner).not.toBeVisible({ timeout: 8000 });

      let prayerPoolLen = 0;
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool) && pool.length).toBeGreaterThan(0);
        prayerPoolLen = pool.length;
      }).toPass({ timeout: 8000 });

      const playerElyraCard = playerPage.locator('div.group\\/char', { hasText: 'Elyra' });

      // ---------------------------------------------------------------------
      // Ascendant (P0) — permanent +4 Severe → effective Severe ≥ 31 (Chainmail 15 + L8 + 4)
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Ascendant',
        'Passive +4 Severe threshold — sheet shows Severe 31 (Chainmail 15 + L8 + 4)',
      );
      await ensureSheetOpen(playerPage, playerElyraCard);
      // Sidebar card: "Thresholds 15 / 31"; Defense graphic: "≥ 31".
      await expect(
        playerPage.getByText(/15\s*\/\s*31|≥\s*31/).first(),
        'Ascendant +4 Severe should yield 31 on Chainmail at level 8',
      ).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Display Ascendant / Ethereal Visage / Power of the Gods on sheet
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Subclass features on sheet',
        'Wings of Light, Ethereal Visage, Ascendant (+4 Severe), Power of the Gods',
      );
      // Open via Actions strip (not feature-name markers — caption overlay repeats those names).
      await ensureSheetOpen(playerPage, playerElyraCard);
      const featuresCard = playerPage
        .locator('div.rounded-xl.bg-gradient-to-b')
        .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Features$/ }) })
        .first();
      await expect(featuresCard).toBeVisible({ timeout: 8000 });
      for (const name of ['Wings of Light', 'Ascendant', 'Ethereal Visage', 'Power of the Gods']) {
        const feat = featuresCard.getByText(name, { exact: true }).first();
        await feat.scrollIntoViewIfNeeded();
        await expect(feat).toBeVisible({ timeout: 8000 });
      }

      // ---------------------------------------------------------------------
      // Wings of Light — Flying toggle
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Wings of Light — Flying', 'Toggle on (fly)');
      const flyingToggle = playerPage.getByRole('button', { name: /^Flying\b/i }).first();
      await ensureSheetOpen(playerPage, playerElyraCard, flyingToggle);
      await flyingToggle.click();

      // Flying may be immediate or deferred-to-ack depending on host wiring; handle both.
      const flyingBanner = gmPage.locator('.dice-result-banner', { hasText: /Wings of Light|Flying/i });
      if (await flyingBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
        await holdForDiceTumble();
        await caption('GM', 'Acknowledges Flying toggle', '');
        await ack(flyingBanner, { holdMs: 0 });
        await expect(flyingBanner).not.toBeVisible({ timeout: 5000 });
      }

      // ---------------------------------------------------------------------
      // Pick up and carry (Stress) — only available while flying
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Pick up and carry', 'Mark 1 Stress while flying');
      const carryBtn = playerPage.getByRole('button', { name: /Pick up and carry/i }).first();
      await ensureSheetOpen(playerPage, playerElyraCard, carryBtn);
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
      // Sidebar cards toggle — do not blind-click after Carry left the sheet open.
      const broadsword = playerPage.getByRole('button', { name: /Broadsword/i }).first();
      await ensureSheetOpen(playerPage, playerElyraCard, broadsword);
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

      // Wings of Light — extra damage d12 (P1; Power of the Gods mastery from session start).
      // Activate from GM banner so postBannerAddDamage + Ack share one camera after the tumble.
      await holdForDiceTumble();
      await caption(
        'GM',
        'Wings of Light — extra damage',
        'Spend 1 Hope for d12 bonus damage (Power of the Gods)',
      );
      await gmPage.keyboard.press('Escape');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await expect(attackBanner).toBeVisible({ timeout: 8000 });
      const hopeBeforeWings = (
        await getTableState(tableId)
      ).elements?.find((e) => e.instanceId === seraphInstanceId)?.hope;
      const wingsDmgBtn = attackBanner
        .getByRole('button', { name: /Wings of Light — extra damage/i })
        .first();
      await expect(
        wingsDmgBtn,
        'Wings of Light — extra damage chip missing (need flying + successful attack)',
      ).toBeVisible({ timeout: 8000 });
      await wingsDmgBtn.click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        expect(el?.hope, 'Wings d12: Hope should decrease by 1').toBe((hopeBeforeWings ?? 4) - 1);
      }).toPass({ timeout: 8000 });
      await expect(attackBanner.getByText(/Wings of Light/i).first()).toBeVisible({ timeout: 8000 });
      // postBannerAddDamage adds a d12 damage sub-item — notation or face label includes d12.
      await expect(attackBanner.getByText(/d12/i).first()).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Broadsword attack', '');
      // Target chips are exact "Cultist Thug" — avoid the banner title
      // ("Elyra Broadsword → Cultist Thug · GM") which is also role=button.
      const cultistChip = attackBanner.getByRole('button', { name: /^Cultist Thug$/i }).first();
      if (await cultistChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cultistChip.click({ force: true });
      }
      // addDamage replaces the banner and restarts the tumble — resolve-instantly then Ack.
      await attackBanner.click({ force: true, position: { x: 12, y: 12 } }).catch(() => {});
      await ack(attackBanner, { force: true, holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Life Support (Player A initiates; GM ack applies Hope + ally heal)
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Life Support', 'Spend 3 Hope — clear 1 HP on Reya');
      const lifeSupportGroup = playerPage.getByRole('group', { name: /Life Support targets/i });
      await ensureSheetOpen(playerPage, playerElyraCard, lifeSupportGroup);
      await lifeSupportGroup.getByRole('button', { name: /Reya/i }).click();
      await playerPage.keyboard.press('Escape');
      const lifeSupportBanner = gmPage.locator('.dice-result-banner', { hasText: 'Life Support' });
      await expect(lifeSupportBanner).toBeVisible({ timeout: 8000 });
      const lifeSupportAck = lifeSupportBanner.getByRole('button', { name: 'Acknowledge' });
      // Sheet select already posts `life-support-select`. A second banner click would toggle
      // the selection off (`sendLifeSupportSelect` deselects) and leave Ack disabled.
      if (!(await lifeSupportAck.isEnabled().catch(() => false))) {
        await lifeSupportBanner.getByRole('button', { name: /Reya/i }).click();
      }
      await expect(lifeSupportAck).toBeEnabled({ timeout: 8000 });
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Life Support', 'Hope spend + ally heal apply on ack');
      await ack(lifeSupportBanner, { force: true, holdMs: 0 });
      await expect(lifeSupportBanner).not.toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Ethereal Visage — Presence roll while flying (advantage onIntent) (P1)
      // ---------------------------------------------------------------------
      await setFearCount(tableId, 3);
      await caption(
        'PLAYER A',
        'Ethereal Visage — Presence',
        'While flying: advantage die on Presence; Fear-instead-of-Hope when Hope dominates',
      );
      // Main Traits grid chip includes TRAIT_VERBS.presence (Charm/Perform/Deceive) —
      // disambiguates from the Defense card's Reaction Rolls grid (same "Presence" title).
      const presenceBtn = playerPage.getByRole('button', { name: /Presence.*Charm/i });
      await ensureSheetOpen(playerPage, playerElyraCard, presenceBtn);
      await presenceBtn.click();
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const presenceBannerText = 'Elyra Presence';
      const presenceBannerPlayer = playerPage.locator('.dice-result-banner', {
        hasText: presenceBannerText,
      });
      await expect(presenceBannerPlayer).toBeVisible({ timeout: 8000 });
      // onIntent adds Ethereal Visage [d6] into the posted roll text / sub-items.
      await expect(
        presenceBannerPlayer.getByText(/Ethereal Visage/i).first(),
        'Ethereal Visage advantage die missing from Presence banner',
      ).toBeVisible({ timeout: 8000 });

      // reviewOutcome Fear chip — only when Hope dominates a successful Presence roll.
      const fearChip = playerPage
        .getByRole('button', { name: /Ethereal Visage — Fear instead of Hope/i })
        .first();
      if (await fearChip.isVisible({ timeout: 2500 }).catch(() => false)) {
        await caption('PLAYER A', 'Ethereal Visage — Fear instead of Hope', 'reviewOutcome toggle');
        const fearBefore = (await getTableState(tableId)).fearCount ?? 0;
        await fearChip.click();
        await expect(async () => {
          const state = await getTableState(tableId);
          expect(state.fearCount, 'Ethereal Visage Fear spend').toBeLessThan(fearBefore);
        }).toPass({ timeout: 8000 });
      }

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Presence roll', '');
      // Pinned character sheet (z-[55]) intercepts banner Acknowledge — dismiss first.
      await gmPage.keyboard.press('Escape');
      await playerPage.keyboard.press('Escape');
      const presenceBanner = gmPage.locator('.dice-result-banner', { hasText: presenceBannerText });
      await ack(presenceBanner, { force: true, holdMs: 0 });
      await expect(presenceBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Prayer Die — reduce damage (P1): adversary hits ally Reya
      // ---------------------------------------------------------------------
      await caption(
        'GM',
        'Cultist attacks Reya',
        'Incoming damage banner for Prayer Die — reduce',
      );
      const reduceRoll = await gmAdversaryAttack(tableId, {
        advInstanceId,
        targetInstanceId: allyInstanceId,
        displayName: 'Cultist Thug Smash Reya',
      });
      expect(reduceRoll._rollDbId).toBeTruthy();
      const reduceBannerText = 'Cultist Thug Smash Reya';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: reduceBannerText })).toBeVisible({
          timeout: 8000,
        });
      }
      await caption(
        'PLAYER A',
        'Prayer Die — reduce damage',
        'Spends a Prayer Die to reduce incoming damage on Reya',
      );
      const prayerDieReduceGroup = playerPage.getByLabel(/reduce incoming damage/i).first();
      const prayerDieReduceOption = prayerDieReduceGroup
        .getByRole('button', { name: /^d4 \(/ })
        .first();
      await expect(
        prayerDieReduceOption,
        'Prayer Die — reduce damage chip missing',
      ).toBeVisible({ timeout: 8000 });
      await prayerDieReduceOption.click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool), 'reduce: pool missing').toBe(true);
        expect(pool.length, 'reduce: pool should shrink by 1').toBe(prayerPoolLen - 1);
      }).toPass({ timeout: 8000 });
      prayerPoolLen -= 1;

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Cultist smash', '');
      await gmPage.keyboard.press('Escape');
      const reduceBanner = gmPage.locator('.dice-result-banner', { hasText: reduceBannerText });
      await ack(reduceBanner, { force: true, holdMs: 0 });
      await expect(reduceBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Prayer Dice — gain Hope (P1 card chip)
      // ---------------------------------------------------------------------
      const hopeBeforeGain = (
        await getTableState(tableId)
      ).elements?.find((e) => e.instanceId === seraphInstanceId)?.hope;
      await caption(
        'PLAYER A',
        'Prayer Dice — gain Hope',
        'Spends a Prayer Die from the Actions strip to gain Hope equal to its face',
      );
      const gainHopeGroup = playerPage.getByRole('group', { name: /Prayer Dice — gain Hope/i });
      await ensureSheetOpen(playerPage, playerElyraCard, gainHopeGroup);
      const gainHopeOption = gainHopeGroup.getByRole('button', { name: /^d4 \(/ }).first();
      await expect(gainHopeOption, 'Prayer Dice — gain Hope chip missing').toBeVisible({
        timeout: 8000,
      });
      await gainHopeOption.click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool), 'gain Hope: pool missing').toBe(true);
        expect(pool.length, 'gain Hope: pool should shrink by 1').toBe(prayerPoolLen - 1);
        expect(el?.hope, 'gain Hope: Hope should increase').toBeGreaterThan(hopeBeforeGain ?? 0);
      }).toPass({ timeout: 8000 });
      prayerPoolLen -= 1;
      await playerPage.keyboard.press('Escape');

      // ---------------------------------------------------------------------
      // M2: Player B rolls → Player A spends Prayer Die — Action (P0 pool shrink)
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
      await expect(prayerDieOption, 'Prayer Die — Action chip missing').toBeVisible({ timeout: 8000 });
      const poolBeforeAction = (
        await getTableState(tableId)
      ).elements?.find((e) => e.instanceId === seraphInstanceId)?.prayerDice?.pool?.length;
      expect(poolBeforeAction, 'Prayer Die — Action: pool empty before spend').toBeGreaterThan(0);
      await prayerDieOption.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool), 'Prayer Die — Action: pool missing').toBe(true);
        expect(pool.length, 'Prayer Die — Action: pool should shrink by 1').toBe(poolBeforeAction - 1);
      }).toPass({ timeout: 12000 });
      await expect(
        playerPage.locator('.dice-result-banner', { hasText: bBannerText }).getByText(/Prayer Die/i).first(),
      ).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Reya’s roll", '');
      await gmPage.keyboard.press('Escape');
      const bBanner = gmPage.locator('.dice-result-banner', { hasText: bBannerText });
      await ack(bBanner, { force: true, holdMs: 0 });
      await expect(bBanner).not.toBeVisible({ timeout: 5000 });

      await caption(
        'Seraph / Winged Sentinel',
        'Walkthrough complete',
        'Ascendant, Wings d12, Ethereal Visage, Prayer Die Reduce/Hope/Action',
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
