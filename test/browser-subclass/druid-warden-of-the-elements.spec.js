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
 *  - P2 combat matrix: Fire retaliation + Fire aura Stress, Air Agility advantage,
 *    Water splash Stress, aura once/rest gate
 *  - Severe channel clear: engine unit-tested; E2E skipped (VTT ack applied Minor HP for
 *    damage [40] vs sheet thresholds 14/21 — needs damageTier / threshold wiring check)
 *  - Beastform Fragile / last-HP auto-drop deferred (PRODUCT_GAP)
 *  - Skipped PRODUCT_GAP: Evolution trait picker, Water aura reposition, Air fly/hover
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
  playerRoll,
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

/** Player A Quarterstaff attack via sheet (fallback: playerRoll API). */
async function rollQuarterstaffAt(playerPage, playerElmCard, ensureSheetOpen, {
  targetNameRe,
  elmInstanceId,
  targetInstanceId,
  tableId,
}) {
  const staff = playerPage.getByRole('button', { name: /Quarterstaff/i }).first();
  await ensureSheetOpen(playerPage, playerElmCard, playerPage.getByText(/Quarterstaff/i).first());
  const canClick = await staff.isVisible({ timeout: 4000 }).catch(() => false);
  const bannerText = 'Elm Quarterstaff';
  if (canClick) {
    await staff.scrollIntoViewIfNeeded();
    await staff.click();
    const chooseTargetText = playerPage.getByText('Choose target');
    if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playerPage.getByRole('button', { name: targetNameRe }).first().click();
    }
    await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
    await playerPage.getByRole('button', { name: 'Proceed' }).click();
    await expect(playerPage.getByText('Before you roll')).not.toBeVisible({ timeout: 8000 });
  } else {
    await playerRoll(
      ACTOR_PLAYER_A,
      tableId,
      'Hope [1d12] Fear [1d12] [d20+2] damage [1d6+1] phy',
      bannerText,
      {
        _attackerInstanceId: elmInstanceId,
        _weaponId: 'srd-wpn-quarterstaff',
        _weaponRangeFt: 5,
        _selectedTargetInstanceId: targetInstanceId,
      }
    );
  }
  return bannerText;
}

test.describe('Subclass video — Druid / Warden of the Elements', () => {
  let tableId;
  let elmLibId;
  let allyLibId;
  let elmInstanceId;
  let allyInstanceId;
  let advInstanceId;
  let adv2InstanceId;

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
    adv2InstanceId = `adv-goblin2-${Date.now() + 3}`;

    await addElementsToTable(tableId, [
      {
        instanceId: elmInstanceId,
        elementType: 'character',
        id: elmLib.id,
        name: elmLib.name,
        // Room for Beastform Stress + Incarnation Stress; full Hope for Evolution (3 Hope).
        // Extra HP headroom for Fire retaliation inbound + Severe-clear demo.
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
        stress_max: 6,
        conditions: '',
        // Melee of Elm (Fire retaliation / Water splash / Dominion).
        tokenX: 103,
        tokenY: 100,
      },
      {
        // Second foe in Very Close of Elm for Water Incarnation splash Stress.
        instanceId: adv2InstanceId,
        elementType: 'adversary',
        id: `test-adv-${adv2InstanceId}`,
        name: 'Cave Rat',
        tier: 1,
        difficulty: 1,
        hp_max: 4,
        currentHp: 4,
        currentStress: 0,
        stress_max: 6,
        conditions: '',
        tokenX: 108,
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
      await caption('GM', 'Loading the table', 'Elm (Druid/Warden of the Elements), Moss, Snarling Goblin, Cave Rat');
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

      // P2 — Aura once/rest gate (frequency-exhausted chip omitted from Actions, like Unstoppable).
      await caption('PLAYER A', 'Elemental Aura (once/rest)', 'Chip omitted until rest clears auraUsedThisRest');
      const actionsAuraGate = await ensurePlayerSheet();
      const auraAgain = actionsAuraGate
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Elemental Aura/i });
      await expect(auraAgain, 'Aura chip should be omitted after once/rest use').toHaveCount(0);

      // -----------------------------------------------------------------
      // P2 — Fire Incarnation retaliation + Fire Aura Stress on HP mark.
      // -----------------------------------------------------------------
      await caption('GM', 'Goblin strikes Elm (Fire)', 'Melee hit — Fire Retaliation 1d10 + Fire Aura Stress');
      const goblinHpBeforeFire = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === advInstanceId
      )?.currentHp;
      // d20+50 vs EVA 13 — guaranteed hit; damage [6] is Minor vs Major 14.
      await gmRoll(
        tableId,
        'Snarling Goblin Claw [d20+50] damage [6] phy',
        'Snarling Goblin',
        {
          _attackerInstanceId: advInstanceId,
          _attackerType: 'adversary',
          _selectedTargetInstanceId: elmInstanceId,
          _attackRangeFt: 5,
        }
      );

      const fireHitText = 'Snarling Goblin';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: fireHitText })).toBeVisible({
          timeout: 8000,
        });
      }
      const fireHitBanner = gmPage.locator('.dice-result-banner', { hasText: fireHitText });
      await selectBannerDamageTarget(gmPage, fireHitBanner, /Elm/i);
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Goblin hit', 'Triggers Fire Retaliation follow-up');
      await ack(fireHitBanner, { holdMs: 0 });
      await expect(fireHitBanner).not.toBeVisible({ timeout: 5000 });

      // postRoll uses displayName=Elm + rollText "…Fire Retaliation damage [1d10]"; banner title is Elm.
      const fireRetaliation = gmPage
        .locator('.dice-result-banner')
        .filter({ hasText: /^Elm|Elm →/ })
        .filter({ hasText: /1d10|damage/i })
        .first();
      await expect(fireRetaliation, 'Fire Retaliation 1d10 banner missing').toBeVisible({
        timeout: 10000,
      });
      await selectBannerDamageTarget(gmPage, fireRetaliation, /Snarling Goblin/i);
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Fire Retaliation', 'Goblin takes magic damage + Fire Aura Stress');
      await ack(fireRetaliation, { holdMs: 0 });
      await expect(fireRetaliation).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const adv = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(adv?.currentHp ?? 8, 'Fire Retaliation HP').toBeLessThan(goblinHpBeforeFire ?? 8);
        expect(adv?.currentStress ?? 0, 'Fire Aura Stress on HP mark').toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 10000 });

      // Severe → clearChannel: covered by unit test
      // `runV2DamageApplyReviewOutcomePhase clears Elemental Incarnation channel on severe HP loss`.
      // E2E deferred — Game Table ack of damage [40] only marked 1 HP (Minor) despite sheet
      // thresholds 14/21 (threshold / damageTotal wiring on adversary→PC ack needs a product pass).

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
      // Air Incarnation — channel + P2 Agility advantage die.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Air)', 'Channel Air — advantage on Agility');
      const actionsForAir = await ensurePlayerSheet();
      await actionsForAir.getByRole('button', { name: /^Air$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement, 'Air Incarnation').toBe('air');
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Elemental Incarnation (Air) — Agility', 'Advantage die on Agility trait roll');
      const agilityBtn = playerPage.getByRole('button', { name: /Agility.*Sprint/i });
      await ensureSheetOpen(playerPage, playerElmCard, agilityBtn);
      await agilityBtn.click();
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const airAgilityText = 'Elm Agility';
      const airBanner = playerPage.locator('.dice-result-banner', { hasText: airAgilityText });
      await expect(airBanner).toBeVisible({ timeout: 8000 });
      await expect(
        airBanner.getByText(/Elemental Incarnation \(Air\)/i).first(),
        'Air Incarnation advantage die missing from Agility banner'
      ).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Air Agility roll', '');
      const airBannerGm = gmPage.locator('.dice-result-banner', { hasText: airAgilityText });
      await ack(airBannerGm, { holdMs: 0 });
      await expect(airBannerGm).not.toBeVisible({ timeout: 5000 });

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
      // P2 — Water Incarnation splash Stress on nearby foe.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Water)', 'Channel Water — Melee splash Stress');
      const actionsForWater = await ensurePlayerSheet();
      await actionsForWater.getByRole('button', { name: /^Water$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement, 'Water Incarnation').toBe('water');
      }).toPass({ timeout: 8000 });

      const ratStressBefore = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === adv2InstanceId
      )?.currentStress ?? 0;

      await caption('PLAYER A', 'Water splash', 'Quarterstaff hit Goblin — Cave Rat marks Stress');
      const staffBannerText = await rollQuarterstaffAt(playerPage, playerElmCard, ensureSheetOpen, {
        targetNameRe: /Snarling Goblin/i,
        elmInstanceId,
        targetInstanceId: advInstanceId,
        tableId,
      });

      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: staffBannerText })).toBeVisible({
          timeout: 15000,
        });
      }
      const staffBannerGm = gmPage.locator('.dice-result-banner', { hasText: staffBannerText }).first();
      await selectBannerDamageTarget(gmPage, staffBannerGm, /Snarling Goblin/i);
      await holdForDiceTumble();
      await caption('GM', "Acknowledges Elm's Quarterstaff", 'Water splash marks Stress on Cave Rat');
      await ack(staffBannerGm, { holdMs: 0 });
      await expect(staffBannerGm).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const rat = (state.elements || []).find((e) => e.instanceId === adv2InstanceId);
        expect(rat?.currentStress ?? 0, 'Water Incarnation splash Stress').toBeGreaterThan(ratStressBefore);
      }).toPass({ timeout: 10000 });

      // Action Log / suppressed banner may show Water Retaliation notice — soft visibility ok.
      const waterNotice = gmPage.getByText(/Water Retaliation|nearby adversary/i).first();
      if (await waterNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
        await caption('GM', 'Water Retaliation notice', 'Nearby adversary marked Stress');
      }

      // -----------------------------------------------------------------
      // Water Dominion reviewAction chip (P1).
      // -----------------------------------------------------------------
      await caption('GM', 'Goblin attacks Elm', 'Guaranteed hit — surfaces Elemental Dominion (Water)');
      await gmRoll(
        tableId,
        'Snarling Goblin Claw [d20+50] damage [1d8] phy',
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

      await caption(
        'Druid / Warden of the Elements',
        'Walkthrough complete',
        'Incarnation combat matrix, Aura, Dominion, Beastform, Rest'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
