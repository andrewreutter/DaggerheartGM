/**
 * Subclass feature video — Sorcerer / Elemental Origin.
 *
 * Walks through Elementalist, Natural Evasion, Transcendence plus inherited Sorcerer
 * class features (Arcane Sense, Minor Illusion, Channel Raw Power, Volatile Magic).
 * Player-capable initiations (sheet, intents, review chips, weapon rolls) are Player A;
 * GM handles Start Session, adversary attacks, and banner Acknowledge.
 *
 * Coverage notes (Phase 1 TEST_GAP hardening):
 *  - **Arcane Sense** — narrative-only (Display): caption + assert the feature card renders.
 *  - **Minor Illusion** — synthesized card chip (`onUse` → `actionLoop` DC 10); mutation is
 *    an informational action notification (no pending banner requiring Ack).
 *  - **Channel Raw Power** — seeded-loadout walk + Hope assert lives on Primal Origin
 *    (`sorcerer-primal-origin.spec.js`). Here: caption + assert the feature card renders.
 *  - **Elementalist** — create-placement affinity chip is character-creation-only; affinity is
 *    pre-seeded. **P0:** hard-click the +3 damage intent (second Elementalist chip), assert
 *    Hope −1 and banner Intent (used) log. Intent `addRollStatic` is not persisted onto the
 *    pending banner (applyV2BannerMutations skip) — do not assert a damage sub-item +3.
 *  - **Natural Evasion** — **P1:** Stress +1 and `featureState['Natural Evasion'].naturalEvasionD6`
 *    (1–6). Sheet evasion / hit→miss via `pendingEvasionBonus` is not wired for this feature.
 *  - **Transcendence** — card `multiSelect` (pick 2) is PRODUCT_GAP — caption + assert render.
 *  - **Volatile Magic** — hard-click + Hope −3; `damageDie` reroll partition is PRODUCT_GAP.
 *
 * Ally-damage intervention: Elemental Origin has none (Natural Evasion is against-you).
 * Two actors (GM + Player A) are sufficient.
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
import { buildSorcererElementalOriginCharacterData } from '../helpers/subclass-cast-sorcerer.js';

test.describe('Subclass video — Sorcerer / Elemental Origin', () => {
  let tableId;
  let pyraLibId;
  let pyraInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Sorcerer Elemental Origin Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const pyraLib = await createLibraryCharacter(
      ACTOR_GM,
      buildSorcererElementalOriginCharacterData({ name: 'Pyra' })
    );
    pyraLibId = pyraLib.id;

    pyraInstanceId = `char-pyra-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: pyraInstanceId,
        elementType: 'character',
        id: pyraLib.id,
        name: pyraLib.name,
        // maxHp 7 / maxStress 8 / maxHope 6 — leave headroom for Stress (Natural Evasion)
        // and Hope spends (Elementalist 1 + Volatile Magic 3).
        currentHp: 7,
        currentStress: 2,
        hope: 5,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
        // Character-creation Elementalist affinity (create-placement chip is not on Game Table).
        featureState: { ElementalOrigin: { element: 'fire' } },
        // Seed hydrated loadout (Channel exercised on Primal; keep parity with cast factory).
        domainLoadout: [
          { id: 'srd-abl-rune-ward', name: 'Rune Ward', level: 1 },
          { id: 'srd-abl-wall-walk', name: 'Wall Walk', level: 1 },
          { id: 'srd-abl-cinder-grasp', name: 'Cinder Grasp', level: 2 },
          { id: 'srd-abl-counterspell', name: 'Counterspell', level: 3 },
          { id: 'srd-abl-blink-out', name: 'Blink Out', level: 4 },
        ],
      },
      {
        instanceId: thugInstanceId,
        elementType: 'adversary',
        id: `test-adv-${thugInstanceId}`,
        name: 'Alley Thug',
        tier: 1,
        // Difficulty 1 guarantees Dualstaff hits so Volatile Magic's success-gated chip appears.
        difficulty: 1,
        hp_max: 10,
        currentHp: 10,
        currentStress: 0,
        conditions: '',
        // Within Very Close of Pyra — Dualstaff is Far, so any close placement is fine.
        tokenX: 105,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (pyraLibId) await deleteLibraryCharacter(ACTOR_GM, pyraLibId);
  });

  test('Pyra the Elemental Origin: Elementalist, Natural Evasion, Transcendence, and Sorcerer class features', async ({
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
      selectBannerDamageTarget,
      dismissBannerTargetMenu,
    } = await startSubclassRun(browser, {
      className: 'Sorcerer',
      subclassName: 'Elemental Origin',
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
      await caption('GM', 'Loading the table', 'Pyra (Sorcerer/Elemental Origin) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Pyra').first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });
      // dice_rolls pending queue is per gm_uid — clear orphans from other suites sharing this GM.
      await cancelAllPendingBanners();

      const playerPyraCard = playerPage.locator('div.group\\/char', { hasText: 'Pyra' });

      // Helper: re-open the hover sheet only when the target control isn't already visible.
      // Clicking `div.group/char` while the sheet is open toggles it closed (lesson 5).
      const ensurePyraSheet = async (locator) => {
        if (await locator.isVisible().catch(() => false)) return;
        await playerPyraCard.click();
        await expect(locator).toBeVisible({ timeout: 8000 });
      };

      // ---------------------------------------------------------------------
      // Arcane Sense — narrative Display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Arcane Sense', 'Narrative-only — sense magic within Close range');
      await playerPyraCard.click();
      await expect(playerPage.getByText('Arcane Sense', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Minor Illusion — synthesized card chip → actionLoop (suppressed banner).
      // Sheet still open from Arcane Sense — do not re-click the sidebar card.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Minor Illusion', 'Spellcast DC 10 — actionLoop notification (no Ack)');
      const minorIllusionBtn = playerPage.getByRole('button', { name: /Minor Illusion/i }).first();
      await ensurePyraSheet(minorIllusionBtn);
      await minorIllusionBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Minor Illusion' })).toHaveCount(0, {
        timeout: 6000,
      });

      // ---------------------------------------------------------------------
      // Channel Raw Power — card renders; seeded walk + Hope assert is on Primal Origin.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Channel Raw Power',
        'Card on sheet — seeded loadout Hope path asserted on Primal Origin video'
      );
      await ensurePyraSheet(playerPage.getByText('Channel Raw Power', { exact: true }).first());

      // ---------------------------------------------------------------------
      // Elementalist — P0: +3 damage intent + Hope spend + Intent (used) log.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Elementalist', 'Fire affinity pre-seeded; intent +3 damage on Dualstaff');
      await ensurePyraSheet(playerPage.getByText('Elementalist', { exact: true }).first());

      let hopeBeforeElementalist;
      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        hopeBeforeElementalist = pyraEl?.hope;
        expect(hopeBeforeElementalist, 'Elementalist needs ≥1 Hope').toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Dualstaff attack', 'Before-you-roll → Elementalist +3 damage → Proceed');
      const dualstaffCard = playerPage.getByRole('button', { name: /^Dualstaff\b/i }).first();
      await ensurePyraSheet(dualstaffCard);
      await dualstaffCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      // Both intents share accessible name "Elementalist"; chips are ordered +2 action, +3 damage.
      const elementalistIntents = playerPage.getByRole('button', { name: /^Elementalist\b/i });
      await expect(elementalistIntents, 'Elementalist +2 and +3 intents').toHaveCount(2, { timeout: 8000 });
      await elementalistIntents.nth(1).click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Pyra Dualstaff';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      const playerAttackBanner = playerPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await expect(
        playerAttackBanner.getByText(/Elementalist/i).first(),
        'Elementalist Intent (used) log on banner'
      ).toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        expect(pyraEl?.hope, 'Elementalist spends 1 Hope').toBe(hopeBeforeElementalist - 1);
      }).toPass({ timeout: 8000 });

      // Volatile Magic on this same banner (magic damage + hope ≥ 3).
      await caption('PLAYER A', 'Volatile Magic', 'Spend 3 Hope to queue damage-die rerolls');
      let hopeBeforeVolatile;
      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        hopeBeforeVolatile = pyraEl?.hope;
        expect(hopeBeforeVolatile, 'Volatile Magic needs ≥3 Hope').toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 8000 });

      const volatileBtn = playerAttackBanner.getByRole('button', { name: /Volatile Magic/i }).first();
      await expect(volatileBtn, 'Volatile Magic review chip').toBeVisible({ timeout: 8000 });
      await expect(volatileBtn).toBeEnabled({ timeout: 8000 });
      await volatileBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        expect(pyraEl?.hope, 'Volatile Magic spends 3 Hope').toBe(hopeBeforeVolatile - 3);
      }).toPass({ timeout: 10000 });

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Pyra's Dualstaff attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await selectBannerDamageTarget(gmPage, attackBanner, /Alley Thug/i);
      await dismissBannerTargetMenu(gmPage);
      await ack(attackBanner, { holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 10).toBeLessThan(10);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Natural Evasion — P1: Stress + naturalEvasionD6 in featureState.
      // ---------------------------------------------------------------------
      await caption('GM', 'Alley Thug attacks Pyra', 'Guaranteed hit (+20) so Natural Evasion appears');
      await gmRoll(tableId, 'Alley Thug Claw [d20+20] damage [1d8] phy', 'Alley Thug Claw', {
        _attackerInstanceId: thugInstanceId,
        _attackerType: 'adversary',
        _selectedTargetInstanceId: pyraInstanceId,
        _attackRangeFt: 5,
      });

      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: 'Alley Thug Claw' })).toBeVisible({
          timeout: 8000,
        });
      }

      let stressBeforeEvasion;
      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        stressBeforeEvasion = pyraEl?.currentStress;
        expect(typeof stressBeforeEvasion).toBe('number');
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Natural Evasion', 'Mark 1 Stress, roll d6 into featureState');
      // Pinned sheet / choose-target portal intercept banner chip clicks (lessons 13 / Wayfinder).
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const thugBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: 'Alley Thug Claw' });
      await selectBannerDamageTarget(playerPage, thugBannerPlayer, /Pyra/i);
      await dismissBannerTargetMenu(playerPage);
      const naturalEvasionBtn = thugBannerPlayer.getByRole('button', { name: /Natural Evasion/i }).first();
      await expect(naturalEvasionBtn, 'Natural Evasion review chip').toBeVisible({ timeout: 8000 });
      await expect(naturalEvasionBtn).toBeEnabled({ timeout: 8000 });
      await naturalEvasionBtn.click();
      // Player locally marks the chip consumed only after a successful v2-review-chip response.
      await expect(thugBannerPlayer.getByRole('status').filter({ hasText: /Natural Evasion/i })).toBeVisible({
        timeout: 8000,
      });

      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        expect(pyraEl?.currentStress, 'Natural Evasion marks 1 Stress').toBe(stressBeforeEvasion + 1);
        const d6 = pyraEl?.featureState?.['Natural Evasion']?.naturalEvasionD6;
        expect(d6, 'naturalEvasionD6 persisted in featureState').toBeGreaterThanOrEqual(1);
        expect(d6, 'naturalEvasionD6 is a d6 face').toBeLessThanOrEqual(6);
      }).toPass({ timeout: 10000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Alley Thug attack', '');
      const thugBanner = gmPage.locator('.dice-result-banner', { hasText: 'Alley Thug Claw' });
      await selectBannerDamageTarget(gmPage, thugBanner, /Pyra/i);
      await dismissBannerTargetMenu(gmPage);
      await ack(thugBanner, { holdMs: 0 });
      await expect(thugBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Transcendence — multiSelect card UI gap (PRODUCT_GAP — caption + assert render).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Transcendence',
        'Known gap: card multiSelect (pick 2) not wired in GuideFeatureCard — display only here'
      );
      await ensurePyraSheet(playerPage.getByText('Transcendence', { exact: true }).first());

      await caption(
        'Sorcerer / Elemental Origin',
        'Walkthrough complete',
        'Elementalist +3 Hope, Natural Evasion d6 state, Transcendence + Sorcerer class features'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
