/**
 * Subclass feature video — Ranger / Wayfinder.
 *
 * Walks through Path Forward (narrative), Ruthless Predator + Apex Predator (interactive),
 * Elusive Predator (display — onIntent vs Focus attacker), plus inherited Ranger class
 * features (Ranger's Focus, Hold Them Off). GM + Player A only.
 *
 * Coverage notes (per docs/srd-implementation.md — Wayfinder Done) + Phase 1 TEST_GAP:
 *  - **Path Forward**: narrative travel sense — caption + assert card renders.
 *  - **Ruthless Predator**: `reviewAction` chip — mark 1 Stress for +1 damage (asserted).
 *    Severe→adversary Stress needs `runOnVttDamageApplyReviewOutcome` (PRODUCT_GAP — skipped).
 *  - **Apex Predator**: intent chip before attacking Focus — spend 1 Hope; on success remove
 *    1 Fear from the GM pool (table seeded with fearCount: 3).
 *  - **Elusive Predator**: `onIntent` +2 Evasion — no chip / no persisted table mod
 *    (PRODUCT_GAP for hard E2E); assert card renders.
 *  - **Ranger's Focus**: Focus id + Focus target Stress (P0); **End Focus to reroll** Duality (P1).
 *  - **Hold Them Off**: Hope spend asserted; multi-target HP is PRODUCT_GAP.
 */

import { test, expect } from '@playwright/test';
import {
  ACTOR_GM,
  ACTOR_PLAYER_A,
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
  BASE_URL,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildRangerWayfinderCharacterData } from '../helpers/subclass-cast-ranger.js';
import {
  assertRangerFocusStressApplied,
  runEndFocusRerollScene,
} from '../helpers/subclass-ranger-steps.js';

async function setFearCount(tableId, fearCount) {
  const res = await fetch(`${BASE_URL}/api/room/my/op`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACTOR_GM.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ op: 'set-fear', tableId, fearCount }),
  });
  if (!res.ok) throw new Error(`setFearCount failed: ${res.status} — ${await res.text()}`);
}

test.describe('Subclass video — Ranger / Wayfinder', () => {
  let tableId;
  let ashraLibId;
  let ashraInstanceId;
  let advAId;
  let advBId;
  let advCId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Ranger Wayfinder Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const ashraLib = await createLibraryCharacter(
      ACTOR_GM,
      buildRangerWayfinderCharacterData({ name: 'Ashra' }),
    );
    ashraLibId = ashraLib.id;

    ashraInstanceId = `char-ashra-${Date.now()}`;
    advAId = `adv-a-${Date.now() + 1}`;
    advBId = `adv-b-${Date.now() + 2}`;
    advCId = `adv-c-${Date.now() + 3}`;

    await addElementsToTable(tableId, [
      {
        instanceId: ashraInstanceId,
        elementType: 'character',
        id: ashraLib.id,
        name: ashraLib.name,
        currentHp: 7,
        currentStress: 0,
        hope: 6,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: advAId,
        elementType: 'adversary',
        id: `test-adv-${advAId}`,
        name: 'Stalked Prey',
        tier: 1,
        difficulty: 1,
        hp_max: 10,
        currentHp: 10,
        // damageTargets maps stress_max → maxStress; wrapEntity.markStress no-ops when that is 0.
        stress_max: 6,
        maxStress: 6,
        currentStress: 0,
        conditions: '',
        tokenX: 103,
        tokenY: 100,
      },
      {
        instanceId: advBId,
        elementType: 'adversary',
        id: `test-adv-${advBId}`,
        name: 'Side Threat',
        tier: 1,
        difficulty: 1,
        hp_max: 10,
        currentHp: 10,
        stress_max: 6,
        maxStress: 6,
        currentStress: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 103,
      },
      {
        instanceId: advCId,
        elementType: 'adversary',
        id: `test-adv-${advCId}`,
        name: 'Flank Threat',
        tier: 1,
        difficulty: 1,
        hp_max: 10,
        currentHp: 10,
        stress_max: 6,
        maxStress: 6,
        currentStress: 0,
        conditions: '',
        tokenX: 103,
        tokenY: 103,
      },
    ]);

    await setFearCount(tableId, 3);
    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (ashraLibId) await deleteLibraryCharacter(ACTOR_GM, ashraLibId);
  });

  test('Ashra the Wayfinder: Path Forward, Focus, Apex/Ruthless Predator, Hold Them Off', async ({
    browser,
  }) => {
    const consoleErrors = [];
    const {
      gmPage,
      playerPage,
      caption,
      finish,
      ack,
      holdForDiceTumble,
      ensureSheetOpen,
      selectBannerDamageTarget,
      dismissBannerTargetMenu,
    } = await startSubclassRun(browser, {
      className: 'Ranger',
      subclassName: 'Wayfinder',
      actors: ['gm', 'playerA'],
    });

    for (const [tag, p] of [
      ['GM', gmPage],
      ['A', playerPage],
    ]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`);
      });
    }

    try {
      await caption('GM', 'Loading the table', 'Ashra (Ranger/Wayfinder) + three Melee threats (Fear 3)');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Ashra').first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerAshraCard = playerPage.locator('div.group\\/char', { hasText: 'Ashra' });

      // ---------------------------------------------------------------------
      // Path Forward + Elusive Predator — narrative / display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Path Forward', 'Narrative — shortest path to a known place');
      const pathForward = playerPage.getByText('Path Forward', { exact: true }).first();
      await ensureSheetOpen(playerPage, playerAshraCard, pathForward);

      await caption(
        'PLAYER A',
        'Elusive Predator',
        'Card only — onIntent +2 Evasion not persisted on table yet (PRODUCT_GAP)',
      );
      await expect(playerPage.getByText('Elusive Predator', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Ranger's Focus — set Stalked Prey as Focus.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', "Ranger's Focus", 'Attempt Focus on Stalked Prey (1 Hope)');
      const daggerCard = playerPage.getByRole('button', { name: /^Dagger\b/i }).first();
      await ensureSheetOpen(playerPage, playerAshraCard, daggerCard);
      await daggerCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Stalked Prey/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: /Attempt Ranger'?s Focus/i }).first().click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const focusAttackText = 'Ashra Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: focusAttackText })).toBeVisible({
          timeout: 8000,
        });
      }

      const focusBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: focusAttackText });
      await selectBannerDamageTarget(playerPage, focusBannerPlayer, /Stalked Prey/i);

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Ranger's Focus attack", 'Focus set + target marks Stress');
      const focusBannerGm = gmPage.locator('.dice-result-banner', { hasText: focusAttackText });
      await selectBannerDamageTarget(gmPage, focusBannerGm, /Stalked Prey/i);
      await ack(focusBannerGm, { holdMs: 0 });
      await expect(focusBannerGm).not.toBeVisible({ timeout: 5000 });

      await assertRangerFocusStressApplied({
        tableId,
        rangerInstanceId: ashraInstanceId,
        advInstanceId: advAId,
        rangerName: 'Ashra',
      });

      // ---------------------------------------------------------------------
      // Apex Predator — intent chip vs Focus; Ruthless Predator on the banner.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Apex Predator', 'Spend 1 Hope before attacking Focus — remove Fear on hit');
      await ensureSheetOpen(playerPage, playerAshraCard, daggerCard);
      await daggerCard.click();
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Stalked Prey/i }).first().click();
      }
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      const apexToggle = playerPage.getByRole('button', { name: /Apex Predator/i }).first();
      await expect(apexToggle).toBeVisible({ timeout: 8000 });
      await apexToggle.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const apexAttackText = 'Ashra Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: apexAttackText })).toBeVisible({
          timeout: 8000,
        });
      }

      const apexBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: apexAttackText });
      await selectBannerDamageTarget(playerPage, apexBannerPlayer, /Stalked Prey/i);

      await caption('PLAYER A', 'Ruthless Predator', 'Mark 1 Stress for +1 damage on this roll');
      const ruthlessBtn = apexBannerPlayer.getByRole('button', { name: /Ruthless Predator/i }).first();
      await expect(ruthlessBtn).toBeVisible({ timeout: 8000 });
      await dismissBannerTargetMenu(playerPage);
      await ruthlessBtn.click();

      // Ruthless stressCost applies on chip Activate; Apex intent spent 1 Hope (Hope-result
      // acks may refund, so only require Stress + that Hope is below the starting 6).
      await expect(async () => {
        const state = await getTableState(tableId);
        const ashraEl = (state.elements || []).find((e) => e.instanceId === ashraInstanceId);
        expect(ashraEl?.currentStress ?? 0).toBeGreaterThanOrEqual(1);
        expect(ashraEl?.hope ?? 6).toBeLessThan(6);
      }).toPass({ timeout: 8000 });

      await holdForDiceTumble();
      await caption(
        'GM',
        'Acknowledges Apex + Ruthless attack',
        'Apex Fear −1; Severe→Stress hook not on VTT damage-apply (PRODUCT_GAP)',
      );
      const fearBeforeAck = await getTableState(tableId).then(
        (s) => s.fearCount ?? s.data?.fearCount ?? 0,
      );
      const apexBannerGm = gmPage.locator('.dice-result-banner', { hasText: apexAttackText });
      const bannerText = (await apexBannerGm.textContent().catch(() => '')) || '';
      const bannerHasFear = /with Fear/i.test(bannerText);
      await ack(apexBannerGm, { holdMs: 0 });
      await expect(apexBannerGm).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const fear = state.fearCount ?? state.data?.fearCount ?? 0;
        // Apex spendFear (−1) on damage ack; Fear-result duality also +1 → net ≤ pre-ack.
        expect(fear).toBeLessThanOrEqual(fearBeforeAck);
        if (!bannerHasFear) expect(fear).toBeLessThan(fearBeforeAck);
      }).toPass({ timeout: 10000 });

      // ---------------------------------------------------------------------
      // End Focus to reroll — miss vs Focus → Duality reroll + clear Focus.
      // ---------------------------------------------------------------------
      await runEndFocusRerollScene({
        tableId,
        gmPage,
        playerPage,
        caption,
        ensureSheetOpen,
        selectBannerDamageTarget,
        dismissBannerTargetMenu,
        holdForDiceTumble,
        charCard: playerAshraCard,
        charName: 'Ashra',
        advNameRe: /Stalked Prey/i,
        advInstanceId: advAId,
        rangerInstanceId: ashraInstanceId,
        attackBannerText: focusAttackText,
        restoreDifficulty: 1,
      });

      // ---------------------------------------------------------------------
      // Hold Them Off.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Hold Them Off', 'Spend 3 Hope — damage two extra Melee adversaries');
      await ensureSheetOpen(playerPage, playerAshraCard, daggerCard);
      await daggerCard.click();
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Stalked Prey/i }).first().click();
      }
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const holdAttackText = 'Ashra Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: holdAttackText })).toBeVisible({
          timeout: 8000,
        });
      }

      const holdBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: holdAttackText });
      await selectBannerDamageTarget(playerPage, holdBannerPlayer, /Stalked Prey/i);

      const holdGroup = holdBannerPlayer.getByRole('group', { name: /Hold Them Off/i });
      await expect(holdGroup).toBeVisible({ timeout: 8000 });
      await holdGroup.getByRole('button', { name: /Side Threat/i }).click();
      await holdGroup.getByRole('button', { name: /Flank Threat/i }).click();
      await holdBannerPlayer
        .getByRole('button', { name: /Spend 3 Hope to apply your weapon damage/i })
        .click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const ashraEl = (state.elements || []).find((e) => e.instanceId === ashraInstanceId);
        // Focus (1) + Apex (1) + Hold Them Off (3) from starting 6. Hope-result acks refund +1
        // per successful Hope duality, so net after HTO is often 3 (not 2).
        expect(ashraEl?.hope ?? 6, 'Hold Them Off should spend 3 Hope').toBeLessThanOrEqual(3);
        expect(ashraEl?.hope ?? 6).toBeLessThan(6);
      }).toPass({ timeout: 10000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Hold Them Off attack', 'Hope spent; extra-target HP apply is a known gap');
      const holdBannerGm = gmPage.locator('.dice-result-banner', { hasText: /Ashra Dagger|Hold Them Off/i }).first();
      await expect(holdBannerGm).toBeVisible({ timeout: 8000 });
      await ack(holdBannerGm, { holdMs: 0 });
      await expect(holdBannerGm).not.toBeVisible({ timeout: 8000 });

      await caption(
        'Ranger / Wayfinder',
        'Walkthrough complete',
        'Focus Stress, Apex/Ruthless, End Focus reroll, Hold Them Off',
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
