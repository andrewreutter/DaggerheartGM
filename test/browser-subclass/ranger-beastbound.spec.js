/**
 * Subclass feature video — Ranger / Beastbound.
 *
 * Walks through the Companion declarative sheet card (+ "Take an action"), narrative
 * training / Loyal Friend / Battle-Bonded cards, plus inherited Ranger class features
 * (Ranger's Focus intent toggle, Hold Them Off reviewAction multi-select). GM + Player A
 * only — Beastbound is solo-capable for this suite (companion is owned by the Ranger).
 *
 * Coverage notes (per docs/srd-implementation.md) + Phase 1 TEST_GAP hardening:
 *  - **Companion**: declarative sheet card (`Fang` / Wolf) + experiences + boardToken
 *    (tray → place near Ranger) + shape-anchored "Take an action" → Companion Act.
 *  - **Expert Training**, **Advanced Training**, **Loyal Friend**: narrative / advancement-
 *    only — caption + assert the feature card renders (GM actionLoop — not mechanical E2E).
 *  - **Battle-Bonded**: `onIntent` +2 Evasion — no chip / no persisted table mod today
 *    (PRODUCT_GAP for hard E2E); assert the card renders.
 *  - **Ranger's Focus**: intent toggle; on hit assert Focus id + Focus target Stress (P0).
 *  - **End Focus to reroll**: force miss vs Focus → V2 review chip → Duality reroll + Focus clear (P1).
 *  - **Hold Them Off**: Hope spend asserted; multi-target HP via `addDamageRoll` is PRODUCT_GAP.
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
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildRangerBeastboundCharacterData } from '../helpers/subclass-cast-ranger.js';
import {
  assertRangerFocusStressApplied,
  assertBeastboundCompanionTokenAndExperiences,
  runEndFocusRerollScene,
} from '../helpers/subclass-ranger-steps.js';

test.describe('Subclass video — Ranger / Beastbound', () => {
  let tableId;
  let kestLibId;
  let kestInstanceId;
  let advAId;
  let advBId;
  let advCId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Ranger Beastbound Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const kestLib = await createLibraryCharacter(
      ACTOR_GM,
      buildRangerBeastboundCharacterData({ name: 'Kest' }),
    );
    kestLibId = kestLib.id;

    kestInstanceId = `char-kest-${Date.now()}`;
    advAId = `adv-a-${Date.now() + 1}`;
    advBId = `adv-b-${Date.now() + 2}`;
    advCId = `adv-c-${Date.now() + 3}`;

    await addElementsToTable(tableId, [
      {
        instanceId: kestInstanceId,
        elementType: 'character',
        id: kestLib.id,
        name: kestLib.name,
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
        name: 'Focus Wolf',
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
        name: 'Pack Scout',
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
        name: 'Pack Runner',
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

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (kestLibId) await deleteLibraryCharacter(ACTOR_GM, kestLibId);
  });

  test("Kest the Beastbound: Companion sheet, Ranger's Focus, and Hold Them Off", async ({ browser }) => {
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
      subclassName: 'Beastbound',
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
      await caption('GM', 'Loading the table', 'Kest (Ranger/Beastbound) + three Melee pack wolves');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Kest').first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerKestCard = playerPage.locator('div.group\\/char', { hasText: 'Kest' });

      // ---------------------------------------------------------------------
      // Companion declarative sheet card + "Take an action" (Companion Act).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Companion sheet', 'Declarative card — Fang the Wolf + experiences');
      const fangMarker = playerPage.getByText('Fang', { exact: true }).first();
      await ensureSheetOpen(playerPage, playerKestCard, fangMarker);
      await expect(playerPage.getByText('Wolf', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      await caption('PLAYER A', 'Companion token + experiences', 'boardToken auto-add; place Fang near Kest');
      await assertBeastboundCompanionTokenAndExperiences({
        tableId,
        playerPage,
        kestInstanceId,
        placeOnMap: true,
      });

      await caption('PLAYER A', 'Take an action', 'Companion Act — Spellcast (Agility) roll');
      const takeActionBtn = playerPage.getByRole('button', { name: /Take an action/i }).first();
      await ensureSheetOpen(playerPage, playerKestCard, takeActionBtn);
      await takeActionBtn.click();

      // Player-owned card chips post `sheetActionRoll` server-side (skip client "Before you roll").
      // If a pre-roll panel does appear (GM path / future wiring), Proceed through it.
      const companionBannerText = 'Companion Act';
      const beforeYouRoll = playerPage.getByText('Before you roll');
      if (await beforeYouRoll.isVisible({ timeout: 2500 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: 'Proceed' }).click();
      }
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: companionBannerText })).toBeVisible({
          timeout: 10000,
        });
      }
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Companion Act', '');
      const companionBanner = gmPage.locator('.dice-result-banner', { hasText: companionBannerText });
      await ack(companionBanner, { holdMs: 0 });
      await expect(companionBanner).not.toBeVisible({ timeout: 5000 });

      // Narrative / display-only Beastbound features.
      await caption('PLAYER A', 'Expert Training', 'Narrative — additional companion level-up option');
      const expertTraining = playerPage.getByText('Expert Training', { exact: true }).first();
      await ensureSheetOpen(playerPage, playerKestCard, expertTraining);

      await caption('PLAYER A', 'Advanced Training', 'Narrative — two more companion level-up options');
      await expect(playerPage.getByText('Advanced Training', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption('PLAYER A', 'Loyal Friend', 'Narrative — once/long rest damage swap (GM resolves)');
      await expect(playerPage.getByText('Loyal Friend', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Battle-Bonded',
        'Card only — onIntent +2 Evasion not persisted on table yet (PRODUCT_GAP)',
      );
      await expect(playerPage.getByText('Battle-Bonded', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Ranger's Focus — intent toggle on next weapon attack.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', "Ranger's Focus", 'Toggle Attempt Ranger\'s Focus (1 Hope) on next attack');
      const daggerCard = playerPage.getByRole('button', { name: /^Dagger\b/i }).first();
      await ensureSheetOpen(playerPage, playerKestCard, daggerCard);
      await daggerCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Focus Wolf/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      const focusToggle = playerPage.getByRole('button', { name: /Attempt Ranger'?s Focus/i }).first();
      await expect(focusToggle).toBeVisible({ timeout: 8000 });
      await focusToggle.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const focusAttackText = 'Kest Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: focusAttackText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Select primary damage target before Acknowledge (do not leave the portal open).
      const focusBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: focusAttackText });
      await selectBannerDamageTarget(playerPage, focusBannerPlayer, /Focus Wolf/i);

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Ranger's Focus attack", 'Focus Wolf becomes Focus + marks Stress');
      const focusBannerGm = gmPage.locator('.dice-result-banner', { hasText: focusAttackText });
      await selectBannerDamageTarget(gmPage, focusBannerGm, /Focus Wolf/i);
      await ack(focusBannerGm, { holdMs: 0 });
      await expect(focusBannerGm).not.toBeVisible({ timeout: 5000 });

      await assertRangerFocusStressApplied({
        tableId,
        rangerInstanceId: kestInstanceId,
        advInstanceId: advAId,
        rangerName: 'Kest',
      });

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
        charCard: playerKestCard,
        charName: 'Kest',
        advNameRe: /Focus Wolf/i,
        advInstanceId: advAId,
        rangerInstanceId: kestInstanceId,
        attackBannerText: focusAttackText,
        restoreDifficulty: 1,
      });

      // ---------------------------------------------------------------------
      // Hold Them Off — successful weapon attack, multi-select two extras.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Hold Them Off setup', 'Attack Focus Wolf again (needs ≥3 Hope)');
      await ensureSheetOpen(playerPage, playerKestCard, daggerCard);
      await daggerCard.click();
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Focus Wolf/i }).first().click();
      }
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const holdAttackText = 'Kest Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: holdAttackText })).toBeVisible({
          timeout: 8000,
        });
      }

      const holdBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: holdAttackText });
      await selectBannerDamageTarget(playerPage, holdBannerPlayer, /Focus Wolf/i);
      await dismissBannerTargetMenu(playerPage);

      await caption('PLAYER A', 'Hold Them Off', 'Spend 3 Hope — damage two extra Melee adversaries');
      const holdGroup = holdBannerPlayer.getByRole('group', { name: /Hold Them Off/i });
      await expect(holdGroup).toBeVisible({ timeout: 8000 });
      await holdGroup.getByRole('button', { name: /Pack Scout/i }).click();
      await holdGroup.getByRole('button', { name: /Pack Runner/i }).click();
      await holdBannerPlayer
        .getByRole('button', { name: /Spend 3 Hope to apply your weapon damage/i })
        .click();

      // Chip hopeCost applies immediately; addDamageRoll follow-ups augment the banner with
      // Hold Them Off damage dice (primary-target path) — extra-adversary HP apply is a known gap.
      await expect(async () => {
        const state = await getTableState(tableId);
        const kestEl = (state.elements || []).find((e) => e.instanceId === kestInstanceId);
        // Hold Them Off spends 3 Hope; Focus spent 1 earlier (Hope-result acks may refund 1).
        expect(kestEl?.hope ?? 6).toBeLessThanOrEqual(3);
      }).toPass({ timeout: 10000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Hold Them Off attack', 'Hope spent; extra-target HP apply is a known gap');
      const holdBannerGm = gmPage.locator('.dice-result-banner', { hasText: /Kest Dagger|Hold Them Off/i }).first();
      await expect(holdBannerGm).toBeVisible({ timeout: 8000 });
      await ack(holdBannerGm, { holdMs: 0 });
      await expect(holdBannerGm).not.toBeVisible({ timeout: 8000 });

      await caption(
        'Ranger / Beastbound',
        'Walkthrough complete',
        'Companion token/XP, Focus Stress, End Focus reroll, Hold Them Off',
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
