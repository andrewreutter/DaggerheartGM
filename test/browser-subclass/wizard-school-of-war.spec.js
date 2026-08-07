/**
 * Subclass feature video — Wizard / School of War.
 *
 * Walks through War subclass features (Battlemage, Face Your Fear, Conjure Shield,
 * Fueled by Fear, Thrive in Chaos, Have No Fear) plus inherited Wizard class features
 * (Prestidigitation, Strange Patterns, Not This Time). GM + Player A only.
 *
 * Coverage notes (docs/srd-implementation.md Partial rows):
 *  - **Battlemage** — +1 max HP (declarative); assert feature card (sheet overlay applies HP).
 *  - **Conjure Shield** — +Proficiency to Evasion while Hope ≥ 2; assert card + Hope seed ≥ 2.
 *  - **Face Your Fear** / **Fueled by Fear** / **Have No Fear** — Fear-success damage dice
 *    scale by tier inside Face Your Fear's hook; cannot force Fear dominance with random
 *    duality dice, so these are captioned + sheet-asserted (display).
 *  - **Thrive in Chaos** — `reviewAction` on a successful attack with damage: mark Stress,
 *    target marks +1 HP. Adversary difficulty 1 for a reliable hit.
 *  - **Not This Time** — legacy GM banner button (player V2 `rerollDie` follow-up unsupported).
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
import { startSubclassRun } from '../helpers/subclass-video.js';
import { buildWizardSchoolOfWarCharacterData } from '../helpers/subclass-cast-wizard.js';

test.describe('Subclass video — Wizard / School of War', () => {
  let tableId;
  let hexLibId;
  let hexInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Wizard School of War Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const hexLib = await createLibraryCharacter(
      ACTOR_GM,
      buildWizardSchoolOfWarCharacterData({ name: 'Hex' })
    );
    hexLibId = hexLib.id;

    hexInstanceId = `char-hex-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: hexInstanceId,
        elementType: 'character',
        id: hexLib.id,
        name: hexLib.name,
        // Hope 4: Conjure Shield (≥2) + Not This Time (3); Stress headroom for Thrive.
        currentHp: 6,
        currentStress: 1,
        hope: 4,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: thugInstanceId,
        elementType: 'adversary',
        id: `test-adv-${thugInstanceId}`,
        name: 'Alley Thug',
        tier: 1,
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        tokenX: 103,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (hexLibId) await deleteLibraryCharacter(ACTOR_GM, hexLibId);
  });

  test('Hex the Battlemage: Thrive in Chaos, Conjure Shield, Not This Time, and War passives', async ({
    browser,
  }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Wizard',
      subclassName: 'School of War',
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
      await caption('GM', 'Loading the table', 'Hex (Wizard/School of War) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Hex').first()).toBeVisible({ timeout: 15000 });

      for (const p of [gmPage, playerPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerHexCard = playerPage.locator('div.group\\/char', { hasText: 'Hex' });

      // ---------------------------------------------------------------------
      // Class + subclass narrative / passive features
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Prestidigitation', 'Display-only — Wizard class feature');
      await playerHexCard.click();
      await expect(playerPage.getByText('Prestidigitation', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption('PLAYER A', 'Strange Patterns', 'Display-only — number pick lives in the editor');
      await expect(playerPage.getByText('Strange Patterns', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption('PLAYER A', 'Battlemage', '+1 max HP passive (V2 declarative overlay)');
      await expect(playerPage.getByText('Battlemage', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Conjure Shield',
        'While Hope ≥ 2, add Proficiency to Evasion (Hope seeded at 4)'
      );
      await expect(playerPage.getByText('Conjure Shield', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Face Your Fear',
        'Display-only here — extra magic damage on Fear-dominant success (RNG)'
      );
      await expect(playerPage.getByText('Face Your Fear', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Fueled by Fear',
        'Display-only — scales Face Your Fear to 2d10 at tier 2+ (merged into hook)'
      );
      await expect(playerPage.getByText('Fueled by Fear', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Have No Fear',
        'Display-only — scales Face Your Fear to 3d10 at tier 3+ (merged into hook)'
      );
      await expect(playerPage.getByText('Have No Fear', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Thrive in Chaos — successful Greatstaff attack → reviewAction chip
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Attacks with Greatstaff',
        'Targets Alley Thug (difficulty 1) so Thrive in Chaos can appear'
      );
      // Sheet is already open from the display-only assertions above — do not click the
      // sidebar card again (same-card toggle would close it; see lesson 5).
      const staffCard = playerPage.getByRole('button', { name: /^Greatstaff\b/i }).first();
      await expect(staffCard).toBeVisible({ timeout: 8000 });
      await staffCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Hex Greatstaff';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      await caption(
        'PLAYER A',
        'Thrive in Chaos',
        'Mark 1 Stress — target marks 1 additional Hit Point'
      );
      const thriveBtn = playerPage.getByRole('button', { name: /Thrive in Chaos/i }).first();
      await expect(thriveBtn).toBeVisible({ timeout: 10000 });
      await thriveBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const hexEl = (state.elements || []).find((e) => e.instanceId === hexInstanceId);
        expect(hexEl?.currentStress).toBeGreaterThanOrEqual(2);
      }).toPass({ timeout: 10000 });

      await caption('GM', "Acknowledges Hex's attack", 'Applies weapon damage + Thrive bonus HP');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      const thugChip = attackBanner.getByRole('button', { name: /Alley Thug/i }).first();
      if (await thugChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await thugChip.click();
      }
      await attackBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 8).toBeLessThan(8);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Not This Time
      // ---------------------------------------------------------------------
      const hopeBeforeNtt = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === hexInstanceId
      )?.hope;
      expect(hopeBeforeNtt).toBeGreaterThanOrEqual(3);

      await caption('GM', 'Alley Thug attacks Hex', 'Adversary attack within Far — Not This Time eligible');
      const advRoll = await gmRoll(
        tableId,
        'Alley Thug Claw Attack [d20+1] damage [1d6] melee',
        'Alley Thug Claw',
        {
          _attackerInstanceId: thugInstanceId,
          _attackerType: 'adversary',
          _attackRangeFt: 5,
          _selectedTargetInstanceId: hexInstanceId,
        }
      );
      expect(advRoll._rollDbId).toBeTruthy();

      const advBannerText = 'Alley Thug Claw';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: advBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      await caption(
        'GM',
        'Not This Time',
        'Spend 3 Hope (Hex) to force the adversary to reroll — legacy GM banner button'
      );
      const legacyNtt = gmPage.getByRole('button', { name: /Not This Time/i }).first();
      await expect(legacyNtt).toBeVisible({ timeout: 8000 });
      await legacyNtt.click();

      await expect(async () => {
        const banner = gmPage.locator('.dice-result-banner', { hasText: /Alley Thug|Not This Time/i }).first();
        await expect(banner).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 10000 });

      const nttBanner = gmPage.locator('.dice-result-banner').filter({ hasText: /Alley Thug|Hex/i }).first();
      await caption('GM', 'Acknowledges the (re)rolled attack', '3 Hope spent from Hex');
      if (
        await nttBanner
          .getByRole('button', { name: 'Acknowledge' })
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        const hexTarget = nttBanner.getByRole('button', { name: /Hex/i }).first();
        if (await hexTarget.isVisible({ timeout: 1500 }).catch(() => false)) {
          await hexTarget.click();
        }
        await nttBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      }

      await expect(async () => {
        const state = await getTableState(tableId);
        const hexEl = (state.elements || []).find((e) => e.instanceId === hexInstanceId);
        expect(hexEl?.hope).toBeLessThan(hopeBeforeNtt);
      }).toPass({ timeout: 10000 });

      await caption(
        'Wizard / School of War',
        'Walkthrough complete',
        'Thrive in Chaos, Conjure Shield, Not This Time, and War passives'
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
