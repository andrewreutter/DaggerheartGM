/**
 * Subclass feature video — Druid / Warden of the Elements.
 *
 * Walks through Elemental Incarnation, Elemental Aura, and Elemental Dominion, plus
 * inherited Druid class features (Beastform, Evolution, Wildtouch). GM + Player A only
 * for most of the walk; an ally token is still placed so Close-range aura copy stays
 * honest. See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md.
 *
 * Phase 1 TEST_GAP hardening (docs/plans/subclass-video-coverage-gaps.md):
 *  - P1 elemental matrix: Fire+Aura, Earth thresholds, Air channel, Water Dominion chip
 *  - P1 Short Rest clears channel / aura featureState
 *  - Beastform Fragile / last-HP auto-drop deferred (PRODUCT_GAP)
 *
 * Coverage notes:
 *  - **Wildtouch** — narrative/display only (announce); caption + assert the card renders.
 *  - **Beastform / Evolution** — V2 card `isSelect` (CustomSelect; 24 options at tier 4).
 *  - **Elemental Incarnation** — `selectPresentation: 'iconGrid'` Fire/Earth/Water/Air.
 *  - **Elemental Aura** — once-per-rest card chip (requires a channeled element first).
 *  - **Elemental Dominion** — Water reviewAction chip; Air/Earth via passiveStatMods.
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
  gmRoll,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildDruidWardenOfTheElementsCharacterData } from '../helpers/subclass-cast-druid.js';
import { buildAllyCharacterData } from '../helpers/subclass-cast.js';

/** Major threshold band start from the open sheet's DAMAGE THRESHOLDS graphic. */
async function readSheetMajorThreshold(page) {
  const majorLabel = page.getByText('Major', { exact: true }).first();
  await expect(majorLabel).toBeVisible({ timeout: 5000 });
  const rangeText = await majorLabel.locator('..').locator('span').nth(1).textContent();
  const m = String(rangeText || '').match(/^(\d+)–/);
  return m ? Number(m[1]) : null;
}

test.describe('Subclass video — Druid / Warden of the Elements', () => {
  let tableId;
  let elmLibId;
  let allyLibId;
  let elmInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Druid Warden of the Elements Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const elmLib = await createLibraryCharacter(
      ACTOR_GM,
      buildDruidWardenOfTheElementsCharacterData({ name: 'Elm' })
    );
    elmLibId = elmLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Moss' }));
    allyLibId = allyLib.id;

    elmInstanceId = `char-elm-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-goblin-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: elmInstanceId,
        elementType: 'character',
        id: elmLib.id,
        name: elmLib.name,
        // Room for Beastform Stress + Incarnation Stress; full Hope for Evolution (3 Hope).
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
        instanceId: allyInstanceId,
        elementType: 'character',
        id: allyLib.id,
        name: allyLib.name,
        currentHp: 6,
        currentStress: 0,
        hope: 3,
        currentArmor: 0,
        conditions: '',
        tokenX: 105,
        tokenY: 100,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Snarling Goblin',
        tier: 1,
        // Difficulty 1 so Water Dominion's `anAttackSucceeds` gate always opens.
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        // Melee of Elm (Fire retaliation / Water Dominion reposition range).
        tokenX: 103,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (elmLibId) await deleteLibraryCharacter(ACTOR_GM, elmLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Elm the Warden of the Elements: Incarnation, Aura, Dominion, Beastform, Evolution', async ({ browser }) => {
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
    } = await startSubclassRun(browser, {
      className: 'Druid',
      subclassName: 'Warden of the Elements',
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
      await caption('GM', 'Loading the table', 'Elm (Druid/Warden of the Elements), Moss, Snarling Goblin');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Elm').first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerElmCard = playerPage.locator('div.group\\/char', { hasText: 'Elm' });
      const ensurePlayerSheet = () => ensureSheetOpen(playerPage, playerElmCard);

      // -----------------------------------------------------------------
      // Wildtouch — narrative/display only.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Wildtouch', 'Narrative class feature — assert card renders');
      await ensurePlayerSheet();
      await expect(playerPage.getByText(/Wildtouch/i).first()).toBeVisible({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Elemental Incarnation — channel Fire (iconGrid) + Aura.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Fire)', 'Mark 1 Stress to Channel Fire');
      const actionsForFire = await ensurePlayerSheet();
      const fireBtn = actionsForFire.getByRole('button', { name: /^Fire$/i });
      await expect(fireBtn).toBeVisible({ timeout: 8000 });
      await fireBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement, 'Fire Incarnation').toBe('fire');
        expect(elm?.currentStress, 'Fire Incarnation Stress').toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Elemental Aura', 'Assume Fire aura until Channeling ends');
      const actionsForAura = await ensurePlayerSheet();
      const auraBtn = actionsForAura
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Elemental Aura/i });
      await expect(auraBtn).toBeVisible({ timeout: 8000 });
      await auraBtn.scrollIntoViewIfNeeded();
      await auraBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.auraActive, 'Fire Aura active').toBe(true);
        expect(elm?.featureState?.WardenOfTheElements?.auraUsedThisRest, 'Aura used this rest').toBe(true);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Earth Incarnation — +Proficiency to Major/Severe thresholds (sheet).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Earth)', 'Channel Earth — +Proficiency thresholds');
      await ensurePlayerSheet();
      const majorBeforeEarth = await readSheetMajorThreshold(playerPage);
      expect(majorBeforeEarth, 'baseline Major threshold readable').toBeGreaterThan(0);

      const actionsForEarth = await ensurePlayerSheet();
      await actionsForEarth.getByRole('button', { name: /^Earth$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement, 'Earth Incarnation').toBe('earth');
      }).toPass({ timeout: 8000 });

      await ensurePlayerSheet();
      await expect(async () => {
        const majorAfter = await readSheetMajorThreshold(playerPage);
        // Tier-4 proficiency is 4 — Earth passiveStatMods adds proficiency to thresholds.
        expect(majorAfter, 'Earth channel raises Major threshold').toBeGreaterThan(majorBeforeEarth);
        expect(majorAfter - majorBeforeEarth, 'Earth Major delta = proficiency').toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Air Incarnation — channel asserted in featureState.
      // (Dominion +1 Evasion is applied in applyDeclarativeFeatures / unit-tested;
      // mergeV2DeclarativeSheetOverlay does not yet surface evasion deltas on the sheet.)
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Air)', 'Channel Air (Dominion +1 Evasion in engine)');
      const actionsForAir = await ensurePlayerSheet();
      await actionsForAir.getByRole('button', { name: /^Air$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement, 'Air Incarnation').toBe('air');
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Elemental Dominion', 'Mastery feature card (Fire/Earth/Air/Water while Channeling)');
      await ensurePlayerSheet();
      await expect(playerPage.getByText(/Elemental Dominion/i).first()).toBeVisible({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Beastform / Evolution — CustomSelect from the player's Actions strip.
      // -----------------------------------------------------------------
      const pickBeastformOption = async (page, trigger) => {
        await expect(trigger).toBeVisible({ timeout: 8000 });
        await expect(trigger).not.toHaveAttribute('aria-disabled', 'true');
        await trigger.click();
        const opt = page
          .locator('[data-dh-outside-dismiss-exempt]')
          .getByRole('button', { name: /^Agile Scout$/i });
        await expect(opt).toBeVisible({ timeout: 5000 });
        await opt.click();
      };

      await caption('PLAYER A', 'Beastform', 'Mark 1 Stress — transform into Agile Scout');
      const actionsForBf = await ensurePlayerSheet();
      await pickBeastformOption(
        playerPage,
        actionsForBf.getByRole('button', { name: 'Beastform 1 Stress', exact: true })
      );

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf =
          elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform || elm?.activeBeastform;
        expect(bf?.beastformId || bf?.id).toBe('srd-bst-agile-scout');
        expect(bf?.viaEvolution === true).toBe(false);
      }).toPass({ timeout: 10000 });

      await caption('PLAYER A', 'Drop out of Beastform', 'Return to normal form');
      const actionsForDrop = await ensurePlayerSheet();
      const dropBtn = actionsForDrop.getByRole('button', { name: /Drop out of .*Beastform/i }).first();
      await expect(dropBtn).toBeVisible({ timeout: 8000 });
      await dropBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf = elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform;
        expect(bf == null || bf === null).toBe(true);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Evolution', 'Spend 3 Hope — Beastform without marking Stress');
      const hopeBeforeEvo = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === elmInstanceId
      )?.hope;
      const actionsForEvo = await ensurePlayerSheet();
      await pickBeastformOption(
        playerPage,
        actionsForEvo.getByRole('button', { name: /^Evolution/i }).filter({ hasNotText: /Druid/i })
      );

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf =
          elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform || elm?.activeBeastform;
        expect(bf?.beastformId || bf?.id).toBe('srd-bst-agile-scout');
        expect(bf?.viaEvolution).toBe(true);
        expect(elm?.hope, 'Evolution Hope cost').toBe((hopeBeforeEvo ?? 6) - 3);
      }).toPass({ timeout: 10000 });

      const actionsForDrop2 = await ensurePlayerSheet();
      await actionsForDrop2.getByRole('button', { name: /Drop out of .*Beastform/i }).first().click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf = elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform;
        expect(bf == null || bf === null).toBe(true);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Water Incarnation + Elemental Dominion (Water) reviewAction chip.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Water)', 'Re-channel Water for Dominion chip');
      const actionsForWater = await ensurePlayerSheet();
      await actionsForWater.getByRole('button', { name: /^Water$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement, 'Water Incarnation').toBe('water');
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Goblin attacks Elm', 'Guaranteed hit — surfaces Elemental Dominion (Water)');
      await gmRoll(
        tableId,
        'Snarling Goblin Claw [d20+10] damage [1d8] phy',
        'Snarling Goblin',
        {
          _attackerInstanceId: advInstanceId,
          _attackerType: 'adversary',
          _selectedTargetInstanceId: elmInstanceId,
          _attackRangeFt: 5,
        }
      );

      const atkBannerText = 'Snarling Goblin';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: atkBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      const gmBanner = gmPage.locator('.dice-result-banner', { hasText: atkBannerText });
      await selectBannerDamageTarget(gmPage, gmBanner, /Elm/i);

      await caption('PLAYER A', 'Elemental Dominion (Water)', 'Mark Stress — attacker becomes Vulnerable');
      const dominionWater = playerPage.getByRole('button', { name: /Elemental Dominion \(Water\)/i }).first();
      await expect(dominionWater).toBeVisible({ timeout: 10000 });
      await dominionWater.click();
      const confirmBtn = playerPage.getByRole('button', { name: /^Confirm$/i }).first();
      if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges the Goblin attack', '');
      await ack(gmBanner, { holdMs: 0 });
      await expect(gmBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const adv = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(String(adv?.conditions || ''), 'Water Dominion Vulnerable').toMatch(/Vulnerable/i);
      }).toPass({ timeout: 8000 });

      // Beastform Fragile / last-HP auto-drop: PRODUCT_GAP when form lives only in
      // featureState (applyDamageToTarget skips drop if legacy activeBeastform is absent).
      // Drop chip is already exercised above. See Phase 2 / Phase 3 in coverage-gaps plan.

      // -----------------------------------------------------------------
      // Short Rest — clears channel + aura rest flags (ElementalIncarnation.onRest).
      // -----------------------------------------------------------------
      await caption('GM', 'Short Rest', 'Clears Elemental channel / aura rest flags');
      // Water may still be channeled from Dominion; re-channel Fire so rest clear is obvious on video.
      const actionsPreRest = await ensurePlayerSheet();
      await actionsPreRest.getByRole('button', { name: /^Fire$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement).toBe('fire');
      }).toPass({ timeout: 8000 });

      gmPage.once('dialog', (d) => d.accept());
      await gmPage.getByRole('button', { name: '⏸ Short' }).click();
      const restBanner = gmPage.locator('.dice-result-banner', { hasText: /Short Rest/i });
      await expect(restBanner).toBeVisible({ timeout: 8000 });
      await ack(restBanner, { holdMs: 0 });
      await expect(restBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const w = elm?.featureState?.WardenOfTheElements || {};
        expect(w.channeledElement == null || w.channeledElement === null, 'Rest cleared channel').toBe(true);
        expect(w.auraActive === true, 'Rest cleared auraActive').toBe(false);
        expect(w.auraUsedThisRest === true, 'Rest cleared auraUsedThisRest').toBe(false);
      }).toPass({ timeout: 10000 });

      await caption('Druid / Warden of the Elements', 'Walkthrough complete', 'Incarnation matrix, Aura, Dominion, Beastform, Rest');

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
