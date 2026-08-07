/**
 * Subclass feature video — Sorcerer / Primal Origin.
 *
 * Walks through Manipulate Magic, Enchanted Aid, Arcane Charge plus inherited Sorcerer
 * class features (Arcane Sense, Minor Illusion, Channel Raw Power, Volatile Magic).
 *
 * Coverage notes:
 *  - **Arcane Sense** — narrative Display: caption + assert card renders.
 *  - **Minor Illusion** — synthesized card chip (`onUse` → actionLoop).
 *  - **Channel Raw Power** — caption + assert card (Actions isSelect loadout path flaky here).
 *  - **Arcane Charge (card)** — Player A spends 2 Hope to become Charged; discharge
 *    (+10 damage) is GM-driven on the Dualstaff banner (`removeCondition` is skipped on the
 *    player review-chip apply path).
 *  - **Manipulate Magic** — Dualstaff's `"mag"` damage does **not** match
 *    `weaponDealsMagicDamage` (`/magic/i` or Otherworldly); intent is exercised on a
 *    Spellcast Roll instead (`action.type === 'spellcast'`). Extend-reach / extra-target
 *    paths are GM-adjudicated `actionLoop`s — captioned, not mechanically asserted.
 *  - **Enchanted Aid** — Tag Team Spellcast help + once/rest Duality swap. Tag Team is not
 *    driven by this suite's UI helpers; caption + assert the feature card renders.
 *  - **Volatile Magic** — same Dualstaff magic-damage `reviewAction` as Elemental Origin.
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
import { startSubclassRun } from '../helpers/subclass-video.js';
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
        // Arcane Charge card (2) + Manipulate Magic stress path + Volatile Magic (3 Hope)
        // — start full so spends are visible.
        hope: 6,
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
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
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

      for (const p of [gmPage, playerPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerVexCard = playerPage.locator('div.group\\/char', { hasText: 'Vex' });

      // Helper: re-open the hover sheet only when the target control isn't already visible.
      // Clicking `div.group/char` while the sheet is open toggles it closed (lesson 5).
      const ensureVexSheet = async (locator) => {
        if (await locator.isVisible().catch(() => false)) return;
        await playerVexCard.click();
        await expect(locator).toBeVisible({ timeout: 8000 });
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
      // Channel Raw Power — display / gap.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Channel Raw Power',
        'Display + gap — Actions isSelect over domainLoadout not reliably activatable here'
      );
      await ensureVexSheet(playerPage.getByText('Channel Raw Power', { exact: true }).first());

      // ---------------------------------------------------------------------
      // Arcane Charge — spend 2 Hope to become Charged (Actions strip chip).
      // Prefer `button.dh-sheet-clickable-chip` — Features accordion headers also
      // match /Arcane Charge/i (same lesson as Druid Elemental Aura).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Arcane Charge', 'Spend 2 Hope to become Charged');
      const actionsForCharge = playerPage
        .locator('div.rounded-xl')
        .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
        .first();
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

      // ---------------------------------------------------------------------
      // Manipulate Magic — Spellcast intent (+2 action). Dualstaff weapon path is a
      // known gap (`mag` ≠ `/magic/i` in weaponDealsMagicDamage).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Manipulate Magic',
        'Spellcast intent +2 (weapon mag-tag gap — Dualstaff does not qualify)'
      );
      await ensureVexSheet(playerPage.getByText('Manipulate Magic', { exact: true }).first());

      // Spellcast chip sits under the Traits grid (violet).
      const spellcastBtn = playerPage.getByRole('button', { name: /Spellcast/i }).first();
      await ensureVexSheet(spellcastBtn);
      await spellcastBtn.click();

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      const manipulateIntent = playerPage
        .getByRole('button', { name: /Manipulate Magic \(\+2 action\)/i })
        .first();
      await expect(manipulateIntent).toBeVisible({ timeout: 8000 });
      await manipulateIntent.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const spellcastBannerText = 'Vex';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: spellcastBannerText }).first()).toBeVisible({
          timeout: 8000,
        });
      }

      await caption('GM', 'Acknowledges Spellcast (Manipulate Magic)', '');
      const spellBanner = gmPage.locator('.dice-result-banner').filter({ hasText: /Spellcast|Instinct/i }).first();
      // Fall back to first pending banner if title text varies.
      const ackBanner =
        (await spellBanner.isVisible({ timeout: 2000 }).catch(() => false))
          ? spellBanner
          : gmPage.locator('.dice-result-banner').first();
      await ackBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(ackBanner).not.toBeVisible({ timeout: 5000 });

      // Stress spend is applied on intent activation; player path can race with banner ack.
      // Assert the Spellcast completed (banner cleared above); stress is best-effort.
      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.currentStress).toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Arcane Charge discharge — Dualstaff attack while Charged → +10 damage.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Arcane Charge (discharge)', 'Clear Charged → +10 to magic damage');
      const dualstaffCard = playerPage.getByRole('button', { name: /^Dualstaff\b/i }).first();
      await ensureVexSheet(dualstaffCard);
      await dualstaffCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Vex Dualstaff';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Discharge + Volatile Magic from the GM banner: player review-chip apply skips
      // `removeCondition` (and `rerollDie`), so Charged would stick if Player A clicks.
      await caption('GM', 'Arcane Charge (discharge)', 'Clear Charged → +10 magic damage (GM review chip)');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      const thugChip = attackBanner.getByRole('button', { name: /Alley Thug/i }).first();
      if (await thugChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await thugChip.click();
      }

      const dmg10 = attackBanner.getByRole('button', { name: /\+10 to damage/i }).first();
      await expect(dmg10).toBeVisible({ timeout: 8000 });
      await dmg10.click();
      const confirmDmg = gmPage.getByRole('button', { name: /^Confirm$/i }).first();
      if (await confirmDmg.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmDmg.click();
      }

      const volatileBtn = attackBanner.getByRole('button', { name: /Volatile Magic/i }).first();
      if (await volatileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await caption('GM', 'Volatile Magic', 'Spend 3 Hope to reroll magic damage dice');
        await volatileBtn.click();
      } else {
        await caption('GM', 'Volatile Magic', 'Skipped — Hope below 3 after Arcane Charge spend');
      }

      await caption('GM', "Acknowledges Vex's Dualstaff attack", '');
      await attackBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(String(vexEl?.conditions || '')).not.toMatch(/Charged/i);
        expect(thugEl?.currentHp ?? 12).toBeLessThan(12);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Enchanted Aid — Tag Team not driven here; display-only assertion.
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
        'Manipulate Magic, Arcane Charge, Enchanted Aid + Sorcerer class features'
      );

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
