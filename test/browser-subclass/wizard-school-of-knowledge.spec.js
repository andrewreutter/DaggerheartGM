/**
 * Subclass feature video — Wizard / School of Knowledge.
 *
 * Walks through Knowledge subclass features (Prepared, Adept, Perfect Recall,
 * Accomplished, Brilliant, Honed Expertise) plus inherited Wizard class features
 * (Prestidigitation, Strange Patterns, Not This Time). GM + Player A only —
 * School of Knowledge is solo-capable; Not This Time is exercised when an adversary
 * attacks the wizard (banner chip / legacy GM button), not via a second PC.
 *
 * Coverage notes (docs/srd-implementation.md Partial rows):
 *  - **Prepared / Accomplished / Brilliant** — extra domain cards (builder/loadout); display-only.
 *  - **Strange Patterns** — `create` placement is character-editor; sheet card asserted here.
 *    Review chips when a Duality face matches the chosen number are not forced (random dice).
 *  - **Adept** — intent chip toggles on Before-you-roll with Experience. Mechanical Stress /
 *    double-Experience / Hope refund run from `hooks.onReviewAction` when `adeptUseStress` is
 *    armed via chip `onUse`; Game Table `handlePreRollProceed` currently skips calling `onUse`
 *    for `_v2IntentChip` rows (only applies hopeCost/stressCost + a few named special cases), so
 *    this suite asserts the Adept intent control is usable and the Experience roll posts, not the
 *    Stress mutation.
 *  - **Perfect Recall** — once/rest card chip → actionLoop (recall cost is GM/table judgment).
 *  - **Honed Expertise** — auto d6 on Experience use when Adept did not consume; display-only here
 *    (RNG; Adept path already exercised).
 *  - **Not This Time** — exercised via the legacy GM banner button (3 Hope, force reroll). The
 *    V2 `reviewAction` chip also appears for players, but player `postPlayerV2ReviewChip` does
 *    not yet apply `rerollDie` follow-ups (`unsupported mutations: rerollDie`), so the GM
 *    button is the reliable end-to-end path for this video.
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
import { buildWizardSchoolOfKnowledgeCharacterData } from '../helpers/subclass-cast-wizard.js';

test.describe('Subclass video — Wizard / School of Knowledge', () => {
  let tableId;
  let quillLibId;
  let quillInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Wizard School of Knowledge Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const quillLib = await createLibraryCharacter(
      ACTOR_GM,
      buildWizardSchoolOfKnowledgeCharacterData({ name: 'Quill' })
    );
    quillLibId = quillLib.id;

    quillInstanceId = `char-quill-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: quillInstanceId,
        elementType: 'character',
        id: quillLib.id,
        name: quillLib.name,
        // Hope 5: Experience (1) + later Not This Time (3); some Stress headroom for Adept.
        currentHp: 6,
        currentStress: 1,
        hope: 5,
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
        // Within Far of Quill (and Melee) for Not This Time range gate.
        tokenX: 105,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (quillLibId) await deleteLibraryCharacter(ACTOR_GM, quillLibId);
  });

  test('Quill the Scholar: Adept, Perfect Recall, Not This Time, and Knowledge narrative features', async ({
    browser,
  }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Wizard',
      subclassName: 'School of Knowledge',
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
      await caption('GM', 'Loading the table', 'Quill (Wizard/School of Knowledge) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Quill').first()).toBeVisible({ timeout: 15000 });

      for (const p of [gmPage, playerPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerQuillCard = playerPage.locator('div.group\\/char', { hasText: 'Quill' });

      // ---------------------------------------------------------------------
      // Narrative / display-only class + subclass features
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Prestidigitation', 'Display-only — harmless magic at will');
      await playerQuillCard.click();
      await expect(playerPage.getByText('Prestidigitation', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Strange Patterns',
        'Display-only here — number pick is a create-placement chip in the character editor'
      );
      await expect(playerPage.getByText('Strange Patterns', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption('PLAYER A', 'Prepared', 'Display-only — extra domain card (builder/loadout)');
      await expect(playerPage.getByText('Prepared', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption('PLAYER A', 'Accomplished', 'Display-only — extra domain card');
      await expect(playerPage.getByText('Accomplished', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption('PLAYER A', 'Brilliant', 'Display-only — extra domain card');
      await expect(playerPage.getByText('Brilliant', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Honed Expertise',
        'Display-only in this walkthrough — auto d6 Hope refund when Experience is used without Adept'
      );
      await expect(playerPage.getByText('Honed Expertise', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Adept — Experience + intent chip on a Knowledge trait roll
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Adept',
        'Select Experience + Adept intent chip (Stress-for-Hope arming — see file header for onUse gap)'
      );
      // Sheet is already open from the display-only assertions above — do not click the
      // sidebar card again (same-card toggle would close it; see lesson 5).
      const knowledgeTrait = playerPage.getByRole('button', { name: /Knowledge.*Recall/i }).first();
      await expect(knowledgeTrait).toBeVisible({ timeout: 8000 });
      await knowledgeTrait.click();

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: /Arcane Theory/i }).first().click();
      const adeptIntent = playerPage.getByRole('button', { name: /^Adept\b/i }).first();
      await expect(adeptIntent).toBeVisible({ timeout: 8000 });
      await adeptIntent.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const traitBannerText = 'Quill';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: traitBannerText }).first()).toBeVisible({
          timeout: 8000,
        });
      }
      // Banner should include the Experience line when Arcane Theory was selected.
      await expect(
        playerPage.locator('.dice-result-banner', { hasText: traitBannerText }).getByText(/Arcane Theory/i).first()
      ).toBeVisible({ timeout: 8000 });

      await caption('GM', "Acknowledges Quill's Knowledge roll", '');
      const traitBanner = gmPage.locator('.dice-result-banner', { hasText: traitBannerText }).first();
      await traitBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(traitBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Perfect Recall — once/rest card chip
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Perfect Recall',
        'Once per rest — reduce Recall Cost by 1 when recalling from vault (GM applies)'
      );
      await playerQuillCard.click();
      const perfectRecallBtn = playerPage.getByRole('button', { name: /Perfect Recall/i }).first();
      await expect(perfectRecallBtn).toBeVisible({ timeout: 8000 });
      await perfectRecallBtn.click();
      // Action-loop-only chip: notification is often suppressed; no pending banner required.
      await playerPage.waitForTimeout(600);

      // ---------------------------------------------------------------------
      // Not This Time — adversary attacks Quill within Far range
      // ---------------------------------------------------------------------
      const hopeBeforeNtt = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === quillInstanceId
      )?.hope;
      expect(hopeBeforeNtt).toBeGreaterThanOrEqual(3);

      await caption('GM', 'Alley Thug attacks Quill', 'Adversary attack within Far — Not This Time eligible');
      const advRoll = await gmRoll(
        tableId,
        'Alley Thug Claw Attack [d20+1] damage [1d6] melee',
        'Alley Thug Claw',
        {
          _attackerInstanceId: thugInstanceId,
          _attackerType: 'adversary',
          _attackRangeFt: 5,
          _selectedTargetInstanceId: quillInstanceId,
        }
      );
      expect(advRoll._rollDbId).toBeTruthy();

      const advBannerText = 'Alley Thug Claw';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: advBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Prefer the legacy GM button — player V2 chip cannot apply `rerollDie` yet (see header).
      await caption(
        'GM',
        'Not This Time',
        'Spend 3 Hope (Quill) to force the adversary to reroll — legacy GM banner button'
      );
      const legacyNtt = gmPage.getByRole('button', { name: /Not This Time/i }).first();
      await expect(legacyNtt).toBeVisible({ timeout: 8000 });
      await legacyNtt.click();

      // Reroll replaces the banner; acknowledge the new (or same) pending attack.
      await expect(async () => {
        const banner = gmPage.locator('.dice-result-banner', { hasText: /Alley Thug|Not This Time/i }).first();
        await expect(banner).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 10000 });

      const nttBanner = gmPage.locator('.dice-result-banner').filter({ hasText: /Alley Thug|Quill/i }).first();
      await caption('GM', 'Acknowledges the (re)rolled attack', '3 Hope spent from Quill');
      if (await nttBanner.getByRole('button', { name: 'Acknowledge' }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
        // Select Quill as damage target if the banner requires it.
        const quillTarget = nttBanner.getByRole('button', { name: /Quill/i }).first();
        if (await quillTarget.isVisible({ timeout: 1500 }).catch(() => false)) {
          await quillTarget.click();
        }
        await nttBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      }

      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        expect(quillEl?.hope).toBeLessThan(hopeBeforeNtt);
      }).toPass({ timeout: 10000 });

      await caption(
        'Wizard / School of Knowledge',
        'Walkthrough complete',
        'Adept, Perfect Recall, Not This Time, and Knowledge narrative features'
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
