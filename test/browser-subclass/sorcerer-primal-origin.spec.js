/**
 * Subclass feature video — Sorcerer / Primal Origin.
 *
 * Walks through Manipulate Magic, Enchanted Aid, Arcane Charge plus inherited Sorcerer
 * class features (Arcane Sense, Minor Illusion, Channel Raw Power, Volatile Magic).
 * Player-capable initiations (sheet, intents, review chips, weapon/spellcast rolls) are
 * Player A; GM handles Start Session and banner Acknowledge.
 *
 * Coverage notes (Phase 1 TEST_GAP hardening):
 *  - **Arcane Sense** — narrative Display: caption + assert card renders.
 *  - **Minor Illusion** — synthesized card chip (`onUse` → actionLoop).
 *  - **Channel Raw Power** — **P1:** seeded `domainLoadout` → Actions CustomSelect Hope path
 *    (Cinder Grasp +2 Hope); assert hope ↑ and featureUsage. Vault move mutation is still a
 *    VTT follow-up (cutover doc) — do not require loadout length shrink.
 *  - **Arcane Charge (card)** — spend 2 Hope → Charged. Magic-damage `onReviewOutcome` Charged
 *    needs `runOnVttDamageApplyReviewOutcome` (not set — not asserted). Discharge +10 hardened;
 *    +3 reaction Difficulty is actionLoop-only (caption).
 *  - **Manipulate Magic** — Spellcast +2 action (stress); extend-reach intent (actionLoop +
 *    stress). Double-die / Dualstaff weapon path blocked by `weaponDealsMagicDamage` PRODUCT_GAP
 *    (`mag` ≠ `/magic/i`). Extra-target review is actionLoop — caption when exercised.
 *  - **Enchanted Aid** — Tag Team PRODUCT_GAP; caption + assert card renders.
 *  - **Volatile Magic** — hard-click + Hope −3; `damageDie` reroll partition is PRODUCT_GAP.
 *
 * Ally-damage intervention: Primal Origin has none (Arcane Charge reacts to *self* taking
 * magic damage; Enchanted Aid is Tag Team help). Two actors (GM + Player A) are sufficient.
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
import { buildSorcererPrimalOriginCharacterData } from '../helpers/subclass-cast-sorcerer.js';

test.describe('Subclass video — Sorcerer / Primal Origin', () => {
  let tableId;
  let vexLibId;
  let vexInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Sorcerer Primal Origin Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const vexLib = await createLibraryCharacter(
      ACTOR_GM,
      buildSorcererPrimalOriginCharacterData({ name: 'Vex' })
    );
    vexLibId = vexLib.id;

    vexInstanceId = `char-vex-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: vexInstanceId,
        elementType: 'character',
        id: vexLib.id,
        name: vexLib.name,
        currentHp: 7,
        currentStress: 1,
        // Channel (+2 from Cinder Grasp) → Arcane Charge (−2) → Volatile (−3).
        // Start below maxHope so Channel Hope gain is visible.
        hope: 4,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
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
        difficulty: 1,
        hp_max: 12,
        currentHp: 12,
        currentStress: 0,
        conditions: '',
        tokenX: 105,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (vexLibId) await deleteLibraryCharacter(ACTOR_GM, vexLibId);
  });

  test('Vex the Primal Origin: Manipulate Magic, Arcane Charge, Enchanted Aid, and Sorcerer class features', async ({
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
      subclassName: 'Primal Origin',
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
      await caption('GM', 'Loading the table', 'Vex (Sorcerer/Primal Origin) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Vex').first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });
      // dice_rolls pending queue is per gm_uid — clear orphans from other suites sharing this GM.
      await cancelAllPendingBanners();

      const playerVexCard = playerPage.locator('div.group\\/char', { hasText: 'Vex' });

      // Helper: re-open the hover sheet only when the target control isn't already visible.
      // Clicking `div.group/char` while the sheet is open toggles it closed (lesson 5).
      const ensureVexSheet = async (locator) => {
        if (await locator.isVisible().catch(() => false)) return;
        await playerVexCard.click();
        await expect(locator).toBeVisible({ timeout: 8000 });
      };

      const actionsStrip = () =>
        playerPage
          .locator('div.rounded-xl.bg-gradient-to-b')
          .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
          .first();

      // Portaled CustomSelect options (lesson 18 / Beastform).
      const pickActionsSelectOption = async (trigger, optionName) => {
        await expect(trigger).toBeVisible({ timeout: 8000 });
        await expect(trigger).not.toHaveAttribute('aria-disabled', 'true');
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const opt = playerPage
          .locator('[data-dh-outside-dismiss-exempt]')
          .getByRole('button', { name: optionName });
        await expect(opt, `Channel / Actions option ${optionName}`).toBeVisible({ timeout: 5000 });
        await opt.click();
      };

      // ---------------------------------------------------------------------
      // Arcane Sense — narrative Display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Arcane Sense', 'Narrative-only — sense magic within Close range');
      await playerVexCard.click();
      await expect(playerPage.getByText('Arcane Sense', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Minor Illusion — sheet still open; do not toggle-close via sidebar re-click.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Minor Illusion', 'Spellcast DC 10 — actionLoop notification (no Ack)');
      const minorIllusionBtn = playerPage.getByRole('button', { name: /Minor Illusion/i }).first();
      await ensureVexSheet(minorIllusionBtn);
      await minorIllusionBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Minor Illusion' })).toHaveCount(0, {
        timeout: 6000,
      });

      // ---------------------------------------------------------------------
      // Channel Raw Power — P1 seeded loadout Hope path.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Channel Raw Power',
        'Seeded loadout — vault Cinder Grasp for +2 Hope (once/long rest)'
      );
      let hopeBeforeChannel;
      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        hopeBeforeChannel = vexEl?.hope;
        expect(hopeBeforeChannel, 'baseline hope before Channel').toBeLessThan(6);
      }).toPass({ timeout: 8000 });

      const actionsForChannel = actionsStrip();
      await ensureVexSheet(actionsForChannel);
      const channelTrigger = actionsForChannel.getByRole('button', { name: /Channel Raw Power/i }).first();
      await pickActionsSelectOption(
        channelTrigger,
        /Cinder Grasp — gain 2 Hope \(card moves to vault\)/i
      );

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.hope, 'Channel Raw Power gains 2 Hope').toBe(hopeBeforeChannel + 2);
        const fu = vexEl?.featureUsage || {};
        const channelUsed = Object.entries(fu).some(
          ([k, v]) => /Channel Raw Power/i.test(k) && v && (v.used === true || (v.usedCount ?? 0) >= 1)
        );
        expect(channelUsed, 'Channel Raw Power featureUsage marked used').toBe(true);
      }).toPass({ timeout: 10000 });

      // ---------------------------------------------------------------------
      // Arcane Charge — spend 2 Hope to become Charged (Actions strip chip).
      // Prefer `button.dh-sheet-clickable-chip` — Features accordion headers also
      // match /Arcane Charge/i (same lesson as Druid Elemental Aura).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Arcane Charge', 'Spend 2 Hope to become Charged');
      const actionsForCharge = actionsStrip();
      await ensureVexSheet(actionsForCharge);
      const arcaneChargeBtn = actionsForCharge
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Arcane Charge/i });
      await expect(arcaneChargeBtn).toBeVisible({ timeout: 8000 });
      await expect(arcaneChargeBtn).toBeEnabled();
      await arcaneChargeBtn.scrollIntoViewIfNeeded();
      await arcaneChargeBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(String(vexEl?.conditions || '')).toMatch(/Charged/i);
        expect(vexEl?.hope).toBeLessThanOrEqual(4);
      }).toPass({ timeout: 8000 });

      await caption(
        'PLAYER A',
        'Arcane Charge (magic damage)',
        'Skipped — onReviewOutcome Charged needs runOnVttDamageApplyReviewOutcome (product)'
      );

      // ---------------------------------------------------------------------
      // Manipulate Magic — Spellcast +2 action (stress), then extend-reach mode.
      // Dualstaff weapon path is PRODUCT_GAP (`mag` ≠ `/magic/i`).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Manipulate Magic (+2)',
        'Spellcast intent +2 — mark 1 Stress (weapon mag-tag gap — Dualstaff does not qualify)'
      );
      await ensureVexSheet(playerPage.getByText('Manipulate Magic', { exact: true }).first());

      let stressBeforeManipulate;
      await expect(async () => {
        const state = await getTableState(tableId);
        stressBeforeManipulate = (state.elements || []).find((e) => e.instanceId === vexInstanceId)
          ?.currentStress;
        expect(typeof stressBeforeManipulate).toBe('number');
      }).toPass({ timeout: 8000 });

      const spellcastBtn = playerPage.getByRole('button', { name: /Spellcast/i }).first();
      await ensureVexSheet(spellcastBtn);
      await spellcastBtn.click();

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      const manipulatePlus2 = playerPage
        .getByRole('button', { name: /Manipulate Magic \(\+2 action\)/i })
        .first();
      await expect(manipulatePlus2, 'Manipulate Magic +2 intent').toBeVisible({ timeout: 8000 });
      await manipulatePlus2.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const spellcastBannerText = 'Vex';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: spellcastBannerText }).first()).toBeVisible({
          timeout: 8000,
        });
      }

      await expect(
        playerPage.locator('.dice-result-banner').first().getByText(/Manipulate Magic/i).first(),
        'Manipulate Magic Intent (used) log'
      ).toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.currentStress, 'Manipulate Magic +2 marks 1 Stress').toBe(
          stressBeforeManipulate + 1
        );
      }).toPass({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Spellcast (Manipulate Magic +2)', '');
      const spellBanner = gmPage.locator('.dice-result-banner').filter({ hasText: /Spellcast|Instinct/i }).first();
      const ackBanner =
        (await spellBanner.isVisible({ timeout: 2000 }).catch(() => false))
          ? spellBanner
          : gmPage.locator('.dice-result-banner').first();
      await ack(ackBanner, { holdMs: 0 });
      await expect(ackBanner).not.toBeVisible({ timeout: 5000 });

      // Extend-reach mode (intent actionLoop — GM-adjudicated; assert Stress only).
      await caption(
        'PLAYER A',
        'Manipulate Magic (extend reach)',
        'Spellcast intent — mark 1 Stress; reach band is GM-adjudicated actionLoop'
      );
      let stressBeforeExtend;
      await expect(async () => {
        const state = await getTableState(tableId);
        stressBeforeExtend = (state.elements || []).find((e) => e.instanceId === vexInstanceId)
          ?.currentStress;
        expect(typeof stressBeforeExtend).toBe('number');
      }).toPass({ timeout: 8000 });

      await ensureVexSheet(spellcastBtn);
      await spellcastBtn.click();
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      const manipulateExtend = playerPage
        .getByRole('button', { name: /Manipulate Magic \(extend reach\)/i })
        .first();
      await expect(manipulateExtend, 'Manipulate Magic extend-reach intent').toBeVisible({
        timeout: 8000,
      });
      await manipulateExtend.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: spellcastBannerText }).first()).toBeVisible({
          timeout: 8000,
        });
      }

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.currentStress, 'Manipulate Magic extend marks 1 Stress').toBe(
          stressBeforeExtend + 1
        );
      }).toPass({ timeout: 8000 });

      // Extra-target review chip (actionLoop) if present on this Spellcast banner.
      const playerSpellBanner = playerPage.locator('.dice-result-banner').filter({ hasText: /Spellcast|Instinct|Vex/i }).first();
      const extraTargetBtn = playerSpellBanner
        .getByRole('button', { name: /Manipulate Magic \(extra target\)/i })
        .first();
      if (await extraTargetBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await caption('PLAYER A', 'Manipulate Magic (extra target)', 'Review actionLoop — GM resolves');
        await extraTargetBtn.click();
      } else {
        await caption(
          'PLAYER A',
          'Manipulate Magic (extra target / double die)',
          'Extra target not on this Spellcast; double die needs magic-weapon damage dice (Dualstaff mag PRODUCT_GAP)'
        );
      }

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Spellcast (extend reach)', '');
      const spellBanner2 = gmPage.locator('.dice-result-banner').filter({ hasText: /Spellcast|Instinct/i }).first();
      const ackBanner2 =
        (await spellBanner2.isVisible({ timeout: 2000 }).catch(() => false))
          ? spellBanner2
          : gmPage.locator('.dice-result-banner').first();
      await ack(ackBanner2, { holdMs: 0 });
      await expect(ackBanner2).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Arcane Charge discharge — Dualstaff attack while Charged → +10 damage.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Dualstaff attack', 'While Charged — discharge +10 + Volatile Magic');
      // Clear any leftover intent / sheet overlays from the Spellcast steps.
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(200);
      await expect(playerPage.getByText('Before you roll')).toHaveCount(0, { timeout: 5000 });

      const dualstaffCard = playerPage.getByRole('button', { name: /^Dualstaff\b/i }).first();
      await ensureVexSheet(dualstaffCard);
      await dualstaffCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      await expect(chooseTargetText, 'Dualstaff choose-target menu').toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Vex Dualstaff';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 12000,
        });
      }

      await caption('PLAYER A', 'Arcane Charge (discharge +10)', 'Clear Charged → +10 magic damage');
      const playerAttackBanner = playerPage.locator('.dice-result-banner', { hasText: attackBannerText });
      const dmg10 = playerAttackBanner.getByRole('button', { name: /\+10 to damage/i }).first();
      await expect(dmg10, 'Arcane Charge +10 discharge').toBeVisible({ timeout: 8000 });
      await dmg10.click();
      const confirmDmg = playerPage.getByRole('button', { name: /^Confirm$/i }).first();
      if (await confirmDmg.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmDmg.click();
      }

      await expect(
        playerAttackBanner.getByText(/Arcane Charge/i).first(),
        'Arcane Charge +10 damage on banner'
      ).toBeVisible({ timeout: 8000 });

      await caption(
        'PLAYER A',
        'Arcane Charge (+3 reaction)',
        'Skipped this run — actionLoop Difficulty handoff (GM-adjudicated); +10 path asserted above'
      );

      let hopeBeforeVolatile;
      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        hopeBeforeVolatile = vexEl?.hope;
        expect(hopeBeforeVolatile, 'Volatile Magic needs ≥3 Hope').toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 8000 });

      const volatileBtn = playerAttackBanner.getByRole('button', { name: /Volatile Magic/i }).first();
      await expect(volatileBtn, 'Volatile Magic review chip').toBeVisible({ timeout: 8000 });
      await expect(volatileBtn).toBeEnabled({ timeout: 8000 });
      await caption('PLAYER A', 'Volatile Magic', 'Spend 3 Hope — damageDie reroll is PRODUCT_GAP');
      await volatileBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.hope, 'Volatile Magic spends 3 Hope').toBe(hopeBeforeVolatile - 3);
      }).toPass({ timeout: 10000 });

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Vex's Dualstaff attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await selectBannerDamageTarget(gmPage, attackBanner, /Alley Thug/i);
      await dismissBannerTargetMenu(gmPage);
      await ack(attackBanner, { holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(String(vexEl?.conditions || '')).not.toMatch(/Charged/i);
        expect(thugEl?.currentHp ?? 12).toBeLessThan(12);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Enchanted Aid — Tag Team PRODUCT_GAP; display-only assertion.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Enchanted Aid',
        'Display-only in this suite — Tag Team Spellcast help not UI-driven'
      );
      await ensureVexSheet(playerPage.getByText('Enchanted Aid', { exact: true }).first());

      await caption(
        'Sorcerer / Primal Origin',
        'Walkthrough complete',
        'Channel Hope, Manipulate Magic modes, Arcane Charge +10, Volatile Hope'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
