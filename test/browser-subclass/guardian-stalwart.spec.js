/**
 * Subclass feature video — Guardian / Stalwart.
 *
 * Walks through every Stalwart feature (Unwavering, Iron Will, Unrelenting,
 * Partners-in-Arms, Undaunted, Loyal Protector) plus inherited Guardian class
 * features (Frontline Tank, Unstoppable), driven from three browser contexts
 * (GM, Player A = Stalwart, Player B = ally who takes hits for intervention chips).
 *
 * Ally-damage intervention pattern (plan row "Guardian/Stalwart"):
 *  - GM posts a real adversary attack banner targeting Player B via `gmRoll` with
 *    `_attackerInstanceId` + `_selectedTargetInstanceId` (same SSE banner path as M1/M2).
 *  - Player A activates Partners-in-Arms / Loyal Protector `reviewAction` chips on that
 *    banner (`postPlayerV2ReviewChip`); GM Acknowledges.
 *
 * Coverage notes:
 *  - **Unwavering / Unrelenting / Undaunted** — `passiveStatMods` on thresholds; assert cards.
 *  - **Frontline Tank / Unstoppable** — V2 card chips on the owner's sheet.
 *  - **Iron Will / Partners-in-Arms / Loyal Protector** — `reviewAction` chips; assert
 *    armor/stress costs apply. Severity reduction / damage redirect mutate pending
 *    `action.effects` in-engine and are not separately re-applied on Acknowledge, so this
 *    suite treats those in-place mutations as exercised by the chip click + cost assert.
 *  - Range bands are exact (`veryClose` for Partners, `close` for Loyal Protector) — tokens
 *    are repositioned between those steps via `updateElement`.
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
import { buildGuardianStalwartCharacterData, buildAllyCharacterData } from '../helpers/subclass-cast.js';

/** Guaranteed-hit adversary attack with physical damage (post tag `phy`). */
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

test.describe('Subclass video — Guardian / Stalwart', () => {
  let tableId;
  let daraLibId;
  let allyLibId;
  let daraInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Guardian Stalwart Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const daraLib = await createLibraryCharacter(ACTOR_GM, buildGuardianStalwartCharacterData({ name: 'Dara' }));
    daraLibId = daraLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    daraInstanceId = `char-dara-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-bruiser-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: daraInstanceId,
        elementType: 'character',
        id: daraLib.id,
        name: daraLib.name,
        // currentArmor = marked slots (CheckboxTrack filled). Leave 2 marked so clearArmor(2) → 0.
        currentHp: 8, currentStress: 0, hope: 5, currentArmor: 2,
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
        // Very Close to Dara (centers ~8ft apart → nearest-edge ~5.5ft → veryClose).
        tokenX: 108, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Armored Bruiser',
        tier: 1,
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        // Melee of both PCs for Revenge-style adjacency / attack range.
        tokenX: 103, tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (daraLibId) await deleteLibraryCharacter(ACTOR_GM, daraLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Dara the Stalwart: Frontline Tank, Unstoppable, Iron Will, Partners-in-Arms, Loyal Protector', async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, playerBPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Guardian',
      subclassName: 'Stalwart',
      actors: ['gm', 'playerA', 'playerB'],
    });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage], ['B', playerBPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Dara (Guardian/Stalwart), Reya (ally), Armored Bruiser');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Dara').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Reya').first()).toBeVisible({ timeout: 15000 });

      for (const p of [gmPage, playerPage, playerBPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      // dice_rolls pending queue is per gm_uid (not table) — clear leftovers from prior runs
      // so Acknowledge doesn't hit a stale "Voss: Frontline Tank" banner (costs no-op).
      await cancelAllPendingBanners();

      const playerDaraCard = playerPage.locator('div.group\\/char', { hasText: 'Dara' });
      const gmDaraCard = gmPage.locator('div.group\\/char', { hasText: 'Dara' });

      // Sidebar card toggles the hover sheet open/closed. Display-only steps do not
      // call dismissAllHoverCards, so Escape first to guarantee the next click opens.
      async function openPlayerDaraSheet() {
        await playerPage.keyboard.press('Escape');
        await playerPage.waitForTimeout(150);
        await playerDaraCard.click();
      }

      async function clickGmDaraActionsChip(nameRe) {
        await gmPage.keyboard.press('Escape');
        await gmPage.waitForTimeout(150);
        await gmDaraCard.click();
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
      // Passive threshold features — display assert on the sheet.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Unwavering / Unrelenting / Undaunted', 'Passive +1/+2/+3 damage thresholds — cards on sheet');
      await openPlayerDaraSheet();
      await expect(playerPage.getByText('Unwavering', { exact: true }).first()).toBeVisible({ timeout: 8000 });
      await expect(playerPage.getByText('Unrelenting', { exact: true }).first()).toBeVisible({ timeout: 8000 });
      await expect(playerPage.getByText('Undaunted', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Frontline Tank — V2 Actions chip (not the amber Hope card). Hope-named
      // class features: page-wide / Hope-card click posts `_featureUse` without
      // running V2 onUse (clearArmor never applies). Scope to Actions chip.
      // ---------------------------------------------------------------------
      await caption('GM', 'Frontline Tank', 'Actions chip — spends 3 Hope, clears 2 Armor');
      await clickGmDaraActionsChip(/Frontline Tank/i);

      await expect(async () => {
        const state = await getTableState(tableId);
        const dara = (state.elements || []).find((e) => e.instanceId === daraInstanceId);
        expect(dara?.hope).toBe(2);
        // clearArmor decreases marked slots: 2 → 0
        expect(dara?.currentArmor).toBe(0);
      }).toPass({ timeout: 8000 });

      // Informational actionLoop banners are usually suppressed; dismiss if sticky.
      await gmPage.keyboard.press('Escape');
      const frontlineBanner = gmPage
        .locator('.dice-result-banner')
        .filter({ hasText: /Dara/i })
        .filter({ hasText: 'Frontline Tank' });
      if (await frontlineBanner.first().isVisible().catch(() => false)) {
        await caption('GM', 'Acknowledges Frontline Tank', 'Dismisses action notice');
        await frontlineBanner.first().getByRole('button', { name: 'Acknowledge' }).click({ force: true });
        await expect(frontlineBanner.first()).not.toBeVisible({ timeout: 5000 });
      }

      // ---------------------------------------------------------------------
      // Unstoppable — once per long rest; V2 Actions chip sets featureState.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Unstoppable', 'Once per long rest — becomes Unstoppable (d6 die at level 8)');
      await clickGmDaraActionsChip(/Unstoppable/i);

      await expect(async () => {
        const state = await getTableState(tableId);
        const dara = (state.elements || []).find((e) => e.instanceId === daraInstanceId);
        expect(JSON.stringify(dara?.featureState || {})).toMatch(/unstoppableActive":true/);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Iron Will — Bruiser attacks Dara; Player A marks an Armor Slot to reduce severity.
      // ---------------------------------------------------------------------
      await caption('GM', 'Armored Bruiser attacks Dara', 'Physical damage banner — Iron Will reviewAction');
      const ironRoll = await gmAdversaryAttack(tableId, {
        advInstanceId,
        targetInstanceId: daraInstanceId,
        displayName: 'Armored Bruiser Smash Dara',
      });
      expect(ironRoll._rollDbId).toBeTruthy();

      const ironBannerText = 'Armored Bruiser Smash Dara';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: ironBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Iron Will', 'Marks 1 Armor Slot to reduce physical severity');
      // Dismiss hover sheet — Traits grid otherwise intercepts banner chip clicks (z-[55]).
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const ironBannerOnPlayer = playerPage.locator('.dice-result-banner', { hasText: ironBannerText });
      const ironWillBtn = ironBannerOnPlayer.getByRole('button', { name: /Iron Will/i });
      await expect(ironWillBtn).toBeVisible({ timeout: 8000 });
      await ironWillBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const dara = (state.elements || []).find((e) => e.instanceId === daraInstanceId);
        // armorMark +1 on marked track: 0 → 1
        expect(dara?.currentArmor).toBe(1);
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Acknowledges Iron Will banner', 'Skip damage apply — cancel to keep Dara healthy for later steps');
      const ironBanner = gmPage.locator('.dice-result-banner', { hasText: ironBannerText });
      await ironBanner.locator('button', { hasText: 'Cancel' }).first().click();
      await expect(ironBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Partners-in-Arms — ally in Very Close takes physical damage.
      // ---------------------------------------------------------------------
      await caption('GM', 'Bruiser attacks Reya (Very Close)', 'Partners-in-Arms reviewAction for Dara');
      const piaRoll = await gmAdversaryAttack(tableId, {
        advInstanceId,
        targetInstanceId: allyInstanceId,
        displayName: 'Armored Bruiser Smash Reya',
      });
      expect(piaRoll._rollDbId).toBeTruthy();

      const piaBannerText = 'Armored Bruiser Smash Reya';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: piaBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Partners-in-Arms', 'Mark Armor to reduce Reya’s damage severity (Very Close)');
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const piaBannerOnPlayer = playerPage.locator('.dice-result-banner', { hasText: piaBannerText });
      const piaGroup = piaBannerOnPlayer.getByRole('group', { name: /Partners-in-Arms targets/i });
      await expect(piaGroup).toBeVisible({ timeout: 8000 });
      // Ensure Reya is selected (may already be pre-selected when she's the only target).
      const reyaTgt = piaGroup.getByRole('button', { name: /Reya/i });
      await expect(reyaTgt).toBeVisible({ timeout: 5000 });
      await reyaTgt.click();
      // Apply's accessible name is the chip description (aria-label), not "Apply".
      await piaBannerOnPlayer.locator('button', { hasText: /^Apply$/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const dara = (state.elements || []).find((e) => e.instanceId === daraInstanceId);
        // armorMark +1: 1 → 2
        expect(dara?.currentArmor).toBe(2);
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Cancels Partners-in-Arms banner', '');
      const piaBanner = gmPage.locator('.dice-result-banner', { hasText: piaBannerText });
      await piaBanner.locator('button', { hasText: 'Cancel' }).first().click();
      await expect(piaBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Loyal Protector — ally at ≤2 HP in Close range; Dara takes the hit (Stress).
      // ---------------------------------------------------------------------
      await caption('GM', 'Repositions Reya to Close + sets HP to 2', 'Loyal Protector eligibility');
      await updateElement(tableId, allyInstanceId, { tokenX: 120, tokenY: 100, currentHp: 2 });

      await caption('GM', 'Bruiser attacks low-HP Reya', 'Loyal Protector reviewAction');
      const lpRoll = await gmAdversaryAttack(tableId, {
        advInstanceId,
        targetInstanceId: allyInstanceId,
        displayName: 'Armored Bruiser Finish Reya',
      });
      expect(lpRoll._rollDbId).toBeTruthy();

      const lpBannerText = 'Armored Bruiser Finish Reya';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: lpBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Loyal Protector', 'Mark 1 Stress — sprint to Reya’s side and take the damage');
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const lpBannerOnPlayer = playerPage.locator('.dice-result-banner', { hasText: lpBannerText });
      const lpGroup = lpBannerOnPlayer.getByRole('group', { name: /Loyal Protector targets/i });
      await expect(lpGroup).toBeVisible({ timeout: 8000 });
      await lpGroup.getByRole('button', { name: /Reya/i }).click();
      const lpApply = lpBannerOnPlayer.locator('button', { hasText: /^Apply$/i });
      await expect(lpApply).toBeVisible({ timeout: 5000 });
      await lpApply.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const dara = (state.elements || []).find((e) => e.instanceId === daraInstanceId);
        expect(dara?.currentStress).toBe(1);
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Cancels Loyal Protector banner', 'Stress cost already applied; skip damage resolve');
      const lpBanner = gmPage.locator('.dice-result-banner', { hasText: lpBannerText });
      await lpBanner.locator('button', { hasText: 'Cancel' }).first().click();
      await expect(lpBanner).not.toBeVisible({ timeout: 5000 });

      await caption('Guardian / Stalwart', 'Walkthrough complete', 'Class + Stalwart foundation/specialization/mastery');

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
