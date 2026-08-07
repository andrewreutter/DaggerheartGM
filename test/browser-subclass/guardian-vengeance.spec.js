/**
 * Subclass feature video — Guardian / Vengeance.
 *
 * Walks through every Vengeance feature (At Ease, Revenge, Act of Reprisal, Nemesis)
 * plus inherited Guardian class features (Frontline Tank, Unstoppable), driven from
 * three browser contexts (GM, Player A = Vengeance Guardian, Player B = ally).
 *
 * Ally / self intervention pattern:
 *  - **Revenge**: GM adversary attack succeeds against Voss in Melee → Player A
 *    `reviewAction` chip marks 2 Stress and 1 HP on the attacker (M2-style mid-banner chip).
 *  - **Act of Reprisal**: `onReviewOutcome` stores a reprisal target when an ally in Melee
 *    is damaged — not wired to VTT damage-apply (`runOnVttDamageApplyReviewOutcome` unset)
 *    and synthetic banner effects omit `source`, so this suite asserts the feature card only.
 *  - **Nemesis**: Prioritize card chip (selectTargets) + Swap Hope/Fear reviewAction chip
 *    (`swapHopeFearDice` is engineRollDisplayOnly — assert chip appears/activates; outcome
 *    swap is not persisted on the banner yet).
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
  gmRoll,
  cancelAllPendingBanners,
  grantCampaignPassForTable,
} from '../helpers/multi-auth.js';
import { startSubclassRun } from '../helpers/subclass-video.js';
import { buildGuardianVengeanceCharacterData, buildAllyCharacterData } from '../helpers/subclass-cast.js';

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
    }
  );
}

test.describe('Subclass video — Guardian / Vengeance', () => {
  let tableId;
  let vossLibId;
  let allyLibId;
  let vossInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Guardian Vengeance Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const vossLib = await createLibraryCharacter(ACTOR_GM, buildGuardianVengeanceCharacterData({ name: 'Voss' }));
    vossLibId = vossLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    vossInstanceId = `char-voss-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-thug-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: vossInstanceId,
        elementType: 'character',
        id: vossLib.id,
        name: vossLib.name,
        currentHp: 8, currentStress: 0, hope: 5, currentArmor: 4,
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
        currentHp: 5, currentStress: 0, hope: 3, currentArmor: 0,
        conditions: '',
        // Melee of Voss (centers ~5ft → nearest-edge ~2.5ft → melee) for Act of Reprisal adjacency.
        tokenX: 104, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Rival Cutthroat',
        tier: 1,
        difficulty: 1,
        hp_max: 6,
        currentHp: 6,
        currentStress: 0,
        conditions: '',
        tokenX: 102, tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (vossLibId) await deleteLibraryCharacter(ACTOR_GM, vossLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Voss the Vengeance: Revenge, Nemesis, Act of Reprisal, and Guardian class features', async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, playerBPage, caption, finish, ack } = await startSubclassRun(browser, {
      className: 'Guardian',
      subclassName: 'Vengeance',
      actors: ['gm', 'playerA', 'playerB'],
    });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage], ['B', playerBPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Voss (Guardian/Vengeance), Reya (ally), Rival Cutthroat');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Voss').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Reya').first()).toBeVisible({ timeout: 15000 });

      // Keep 3D dice on the camera (playerPage) so the screencast captures tumbles.
      for (const p of [gmPage, playerBPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      // Pending banner queue is per gm_uid — clear leftovers so Ack targets this run's Voss.
      await cancelAllPendingBanners();

      const playerVossCard = playerPage.locator('div.group\\/char', { hasText: 'Voss' });
      const gmVossCard = gmPage.locator('div.group\\/char', { hasText: 'Voss' });

      async function openVossSheet() {
        await playerPage.keyboard.press('Escape');
        await playerPage.waitForTimeout(150);
        await playerVossCard.click();
      }

      async function clickGmVossActionsChip(nameRe) {
        await gmPage.keyboard.press('Escape');
        await gmPage.waitForTimeout(150);
        await gmVossCard.click();
        const actionsCard = gmPage
          .locator('div.rounded-xl')
          .filter({ has: gmPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
          .first();
        await expect(actionsCard).toBeVisible({ timeout: 8000 });
        const btn = actionsCard.locator('button.dh-sheet-clickable-chip').filter({ hasText: nameRe });
        await expect(btn).toBeVisible({ timeout: 8000 });
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
      }

      // ---------------------------------------------------------------------
      // At Ease — passive +1 max Stress (display).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'At Ease', 'Passive +1 max Stress — card on sheet (maxStress 9)');
      await openVossSheet();
      await expect(playerPage.getByText('At Ease', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Frontline Tank — V2 Actions chip (not amber Hope card; see plan lesson 15).
      // ---------------------------------------------------------------------
      await caption('GM', 'Frontline Tank', 'Actions chip — spends 3 Hope, clears 2 Armor');
      await updateElement(tableId, vossInstanceId, { currentArmor: 2 });
      await clickGmVossActionsChip(/Frontline Tank/i);
      await expect(async () => {
        const state = await getTableState(tableId);
        const voss = (state.elements || []).find((e) => e.instanceId === vossInstanceId);
        expect(voss?.hope).toBe(2);
        expect(voss?.currentArmor).toBe(0);
      }).toPass({ timeout: 8000 });

      await gmPage.keyboard.press('Escape');
      const frontlineBanner = gmPage
        .locator('.dice-result-banner')
        .filter({ hasText: /Voss/i })
        .filter({ hasText: 'Frontline Tank' });
      if (await frontlineBanner.first().isVisible().catch(() => false)) {
        await caption('GM', 'Acknowledges Frontline Tank', 'Dismisses action notice');
        await ack(frontlineBanner.first(), { force: true });
        await expect(frontlineBanner.first()).not.toBeVisible({ timeout: 5000 });
      }

      await caption('PLAYER A', 'Unstoppable', 'Once per long rest');
      await clickGmVossActionsChip(/Unstoppable/i);
      await expect(async () => {
        const state = await getTableState(tableId);
        const voss = (state.elements || []).find((e) => e.instanceId === vossInstanceId);
        expect(JSON.stringify(voss?.featureState || {})).toMatch(/unstoppableActive":true/);
      }).toPass({ timeout: 8000 });

      // Restore Hope for Nemesis (2 Hope) after Frontline Tank spent 3.
      await updateElement(tableId, vossInstanceId, { hope: 4 });

      // ---------------------------------------------------------------------
      // Revenge — adversary succeeds vs Voss in Melee.
      // ---------------------------------------------------------------------
      await caption('GM', 'Rival Cutthroat attacks Voss', 'Guaranteed hit in Melee — Revenge reviewAction');
      const revengeRoll = await gmAdversaryAttack(tableId, {
        advInstanceId,
        targetInstanceId: vossInstanceId,
        displayName: 'Rival Cutthroat Stab Voss',
      });
      expect(revengeRoll._rollDbId).toBeTruthy();

      const revengeBannerText = 'Rival Cutthroat Stab Voss';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: revengeBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Revenge', 'Mark 2 Stress — force the attacker to mark 1 HP');
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const revengeBannerOnPlayer = playerPage.locator('.dice-result-banner', { hasText: revengeBannerText });
      const revengeBtn = revengeBannerOnPlayer.getByRole('button', { name: /Revenge/i });
      await expect(revengeBtn).toBeVisible({ timeout: 8000 });
      await revengeBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const voss = (state.elements || []).find((e) => e.instanceId === vossInstanceId);
        const adv = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(voss?.currentStress).toBe(2);
        expect(adv?.currentHp).toBe(5);
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Cancels Revenge banner', 'Stress + adversary HP already applied');
      const revengeBanner = gmPage.locator('.dice-result-banner', { hasText: revengeBannerText });
      await revengeBanner.locator('button', { hasText: 'Cancel' }).first().click();
      await expect(revengeBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Act of Reprisal — display-only on VTT (see file header).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Act of Reprisal',
        'Display-only — onReviewOutcome not wired to VTT damage-apply; banner effects omit source'
      );
      await openVossSheet();
      await expect(playerPage.getByText('Act of Reprisal', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Nemesis — Prioritize the Cutthroat, then attack and offer Swap Hope/Fear.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Nemesis — Prioritize', 'Spend 2 Hope to Prioritize Rival Cutthroat');
      await openVossSheet();
      // Card `selectTargets` bank in the Actions strip: aria-label `${chip.name} targets`.
      const actionsCard = playerPage
        .locator('div.rounded-xl')
        .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
        .first();
      const prioritizeGroup = actionsCard.getByRole('group', { name: /Prioritize targets/i });
      await expect(prioritizeGroup).toBeVisible({ timeout: 8000 });
      await prioritizeGroup.getByRole('button', { name: /Rival Cutthroat/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const voss = (state.elements || []).find((e) => e.instanceId === vossInstanceId);
        expect(voss?.hope).toBe(2);
        expect(JSON.stringify(voss?.featureState || {})).toMatch(/prioritizedAdversaryId/);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Attacks Prioritized Cutthroat', 'Battleaxe — Swap Hope and Fear reviewAction');
      await openVossSheet();
      const axeCard = playerPage.getByRole('button', { name: /^Battleaxe\b/i }).first();
      await expect(axeCard).toBeVisible({ timeout: 8000 });
      await axeCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Rival Cutthroat/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Voss Battleaxe';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption(
        'PLAYER A',
        'Swap Hope and Fear',
        'Nemesis reviewAction — swapHopeFearDice is engineRollDisplayOnly (chip activates; banner totals may not flip)'
      );
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const swapBtn = playerPage
        .locator('.dice-result-banner', { hasText: attackBannerText })
        .getByRole('button', { name: /Swap Hope and Fear/i });
      await expect(swapBtn).toBeVisible({ timeout: 8000 });
      await swapBtn.click();

      await caption('GM', "Acknowledges Voss's attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      // Select the adversary target chip if Acknowledge is gated on a damage target.
      const cutthroatTarget = attackBanner.getByRole('button', { name: /Rival Cutthroat/i }).first();
      if (await cutthroatTarget.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cutthroatTarget.click();
      }
      await ack(attackBanner);
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await caption('Guardian / Vengeance', 'Walkthrough complete', 'Revenge, Nemesis, Act of Reprisal, Frontline Tank, Unstoppable');

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
