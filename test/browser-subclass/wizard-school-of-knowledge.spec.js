/**
 * Subclass feature video — Wizard / School of Knowledge.
 *
 * Walks through Knowledge subclass features (Prepared, Adept, Perfect Recall,
 * Accomplished, Brilliant, Honed Expertise) plus inherited Wizard class features
 * (Prestidigitation, Strange Patterns, Not This Time). GM + Player A only —
 * School of Knowledge is solo-capable; Not This Time is exercised when an adversary
 * attacks the wizard (banner chip / legacy GM button), not via a second PC.
 *
 * Coverage notes (docs/srd-implementation.md Partial rows + Phase 1 TEST_GAP):
 *  - **Prepared / Accomplished / Brilliant** — extra domain cards (builder/loadout); display-only.
 *  - **Strange Patterns** — create UI is PRODUCT_GAP; this suite seeds `patternNumber` on the
 *    table element, retries Duality rolls until review chips appear, then Long Rest → re-pick.
 *  - **Adept** — intent `onUse` arms `featureState.SchoolOfKnowledge.adeptUseStress` (asserted).
 *    Full Stress / double-Experience / Hope refund via `hooks.onReviewAction` is PRODUCT_GAP
 *    (`collectPhaseChipsOnly`) — not asserted here.
 *  - **Perfect Recall** — once/rest card chip → `featureUsage` used + cycle rest (asserted).
 *  - **Honed Expertise** — display-only here (RNG; Adept path already exercised).
 *  - **Not This Time** — legacy GM banner button (V2 `gmDie`/`damageDie` reroll is PRODUCT_GAP).
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
  updateElement,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildWizardSchoolOfKnowledgeCharacterData } from '../helpers/subclass-cast-wizard.js';

/** Pattern face seeded on the table element (create UI is PRODUCT_GAP). */
const STRANGE_PATTERN_NUMBER = 7;
/** Duality match ~16%/roll; 30 tries ≈ 99% success without forcing dice. */
const STRANGE_PATTERNS_MAX_ATTEMPTS = 30;

function frequencyChipButton(page, featureName) {
  const re = new RegExp(`${featureName}[\\s\\S]*\\b(long|short|session|rest)\\b`, 'i');
  return page.getByRole('button', { name: re }).last();
}

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
        // Hope 5: Experience (1) + later Not This Time (3); Stress headroom for Strange Patterns clear.
        currentHp: 6,
        currentStress: 2,
        hope: 5,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
        // Bypass create-placement chip (PRODUCT_GAP) — seed chosen Duality number for review chips.
        featureState: {
          'Strange Patterns': { patternNumber: STRANGE_PATTERN_NUMBER },
        },
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

  test('Quill the Scholar: Adept, Perfect Recall, Strange Patterns, Not This Time', async ({
    browser,
  }) => {
    // Duality match retries + Long Rest re-pick can exceed the default 5m subclass timeout.
    test.setTimeout(480_000);

    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
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

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerQuillCard = playerPage.locator('div.group\\/char', { hasText: 'Quill' });

      // ---------------------------------------------------------------------
      // Narrative / display-only class + subclass features
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Prestidigitation', 'Display-only — harmless magic at will');
      await ensureSheetOpen(playerPage, playerQuillCard);
      await expect(playerPage.getByText('Prestidigitation', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'PLAYER A',
        'Strange Patterns',
        `Seeded pattern ${STRANGE_PATTERN_NUMBER} (create UI is PRODUCT_GAP) — review chips next`
      );
      await expect(playerPage.getByText('Strange Patterns', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });
      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        expect(quillEl?.featureState?.['Strange Patterns']?.patternNumber).toBe(STRANGE_PATTERN_NUMBER);
      }).toPass({ timeout: 8000 });

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
      // Strange Patterns — review chips when Duality matches seeded number
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Strange Patterns — match Duality',
        `Retry Knowledge rolls until Hope/Fear shows ${STRANGE_PATTERN_NUMBER}`
      );

      let strangePatternsHit = false;
      for (let attempt = 1; attempt <= STRANGE_PATTERNS_MAX_ATTEMPTS; attempt++) {
        await ensureSheetOpen(playerPage, playerQuillCard);
        const knowledgeTrait = playerPage.getByRole('button', { name: /Knowledge.*Recall/i }).first();
        await expect(knowledgeTrait).toBeVisible({ timeout: 8000 });
        await knowledgeTrait.click();

        await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
        // No Experience — save Hope for Adept / Not This Time.
        await playerPage.getByRole('button', { name: 'Proceed' }).click();

        const traitBannerText = 'Quill';
        for (const p of [gmPage, playerPage]) {
          await expect(p.locator('.dice-result-banner', { hasText: traitBannerText }).first()).toBeVisible({
            timeout: 8000,
          });
        }

        await playerPage.keyboard.press('Escape');
        await playerPage.waitForTimeout(150);

        const playerBanner = playerPage.locator('.dice-result-banner', { hasText: traitBannerText }).first();
        const clearStressChip = playerBanner.getByRole('button', {
          name: /Strange Patterns — clear Stress/i,
        });
        const gainHopeChip = playerBanner.getByRole('button', {
          name: /Strange Patterns — gain Hope/i,
        });

        const clearVisible = await clearStressChip.isVisible().catch(() => false);
        const hopeVisible = await gainHopeChip.isVisible().catch(() => false);

        if (clearVisible || hopeVisible) {
          const stressBefore = (await getTableState(tableId)).elements.find(
            (e) => e.instanceId === quillInstanceId
          )?.currentStress;
          const hopeBefore = (await getTableState(tableId)).elements.find(
            (e) => e.instanceId === quillInstanceId
          )?.hope;

          // Prefer clear Stress so Hope stays available for Adept Experience + Not This Time.
          if (clearVisible) {
            await caption('PLAYER A', 'Strange Patterns — clear Stress', `Attempt ${attempt} — Duality matched`);
            await clearStressChip.click();
            await expect(async () => {
              const state = await getTableState(tableId);
              const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
              expect(
                quillEl?.currentStress,
                'Strange Patterns clear Stress should reduce Stress by 1'
              ).toBe((stressBefore ?? 2) - 1);
              expect(quillEl?.featureState?.['Strange Patterns']?.strangePatternsUsed).toBe(true);
            }).toPass({ timeout: 10000 });
          } else {
            await caption('PLAYER A', 'Strange Patterns — gain Hope', `Attempt ${attempt} — Duality matched`);
            await gainHopeChip.click();
            await expect(async () => {
              const state = await getTableState(tableId);
              const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
              expect(
                quillEl?.hope,
                'Strange Patterns gain Hope should increase Hope by 1'
              ).toBeGreaterThan(hopeBefore ?? 0);
              expect(quillEl?.featureState?.['Strange Patterns']?.strangePatternsUsed).toBe(true);
            }).toPass({ timeout: 10000 });
          }

          strangePatternsHit = true;
          await holdForDiceTumble();
          await caption('GM', "Acknowledges Quill's Strange Patterns roll", '');
          const gmTraitBanner = gmPage.locator('.dice-result-banner', { hasText: traitBannerText }).first();
          await ack(gmTraitBanner, { holdMs: 0 });
          await expect(gmTraitBanner).not.toBeVisible({ timeout: 5000 });
          break;
        }

        // Miss: skip tumble hold — keep the video short while searching for a Duality match.
        const gmTraitBanner = gmPage.locator('.dice-result-banner', { hasText: traitBannerText }).first();
        await ack(gmTraitBanner, { holdMs: 0 });
        await expect(gmTraitBanner).not.toBeVisible({ timeout: 5000 });
      }

      expect(
        strangePatternsHit,
        `Strange Patterns review chips never appeared after ${STRANGE_PATTERNS_MAX_ATTEMPTS} Duality rolls (pattern ${STRANGE_PATTERN_NUMBER})`
      ).toBe(true);

      // ---------------------------------------------------------------------
      // Adept — Experience + intent chip; assert armed featureState flag
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Adept',
        'Select Experience + Adept intent — arms SchoolOfKnowledge.adeptUseStress'
      );
      await ensureSheetOpen(playerPage, playerQuillCard);
      const knowledgeTrait = playerPage.getByRole('button', { name: /Knowledge.*Recall/i }).first();
      await expect(knowledgeTrait).toBeVisible({ timeout: 8000 });
      await knowledgeTrait.click();

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: /Arcane Theory/i }).first().click();
      const adeptIntent = playerPage.getByRole('button', { name: /^Adept\b/i }).first();
      await expect(adeptIntent).toBeVisible({ timeout: 8000 });
      await adeptIntent.click();
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const adeptBannerText = 'Quill';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: adeptBannerText }).first()).toBeVisible({
          timeout: 8000,
        });
      }
      await expect(
        playerPage.locator('.dice-result-banner', { hasText: adeptBannerText }).getByText(/Arcane Theory/i).first()
      ).toBeVisible({ timeout: 8000 });

      // Assert arming before Ack (onResolve clears the flag). Prefer armed; accept consumed if
      // onReviewAction ever wires through on this path.
      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        const bag = quillEl?.featureState?.SchoolOfKnowledge || {};
        expect(
          bag.adeptUseStress === true || bag.adeptConsumedThisRoll === true,
          `Adept arming missing — featureState.SchoolOfKnowledge=${JSON.stringify(bag)}`
        ).toBe(true);
      }).toPass({ timeout: 10000 });

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Quill's Adept Knowledge roll", '');
      const adeptBanner = gmPage.locator('.dice-result-banner', { hasText: adeptBannerText }).first();
      await ack(adeptBanner, { holdMs: 0 });
      await expect(adeptBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Perfect Recall — once/rest card chip → featureUsage
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Perfect Recall',
        'Once per rest — assert featureUsage used + chip disabled'
      );
      const actionsPerfect = await ensureSheetOpen(playerPage, playerQuillCard);
      const perfectRecallBtn = frequencyChipButton(actionsPerfect, 'Perfect Recall');
      await expect(perfectRecallBtn).toBeVisible({ timeout: 8000 });
      await expect(perfectRecallBtn).toBeEnabled({ timeout: 2000 });
      await perfectRecallBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        const fu = quillEl?.featureUsage || {};
        // Keys are chip-scoped (e.g. `Perfect Recall::Perfect Recall::card`) or guide ids —
        // not the bare feature name.
        const usage = Object.entries(fu).find(
          ([k, v]) => /Perfect Recall/i.test(k) && v && (v.used === true || (v.count ?? 0) >= 1)
        )?.[1];
        expect(usage, `Perfect Recall featureUsage missing: ${JSON.stringify(fu)}`).toBeTruthy();
        expect(usage.cycle).toBe('rest');
      }).toPass({ timeout: 10000 });

      // Frequency gate is tracked in featureUsage (chip may stay visually enabled until SSE
      // remounts the strip). Long rest below asserts the rest-cycle clear.

      // ---------------------------------------------------------------------
      // Long Rest — Strange Patterns re-pick (restChangeAvailable)
      // ---------------------------------------------------------------------
      await caption('GM', 'Long Rest', 'Triggers Strange Patterns re-pick (restChangeAvailable)');
      await gmPage.getByRole('button', { name: '⏹ Long' }).click();
      const longRestBanner = gmPage.locator('.dice-result-banner', { hasText: /Long Rest/i });
      await expect(longRestBanner).toBeVisible({ timeout: 8000 });
      // Rest moves left empty → confirm dialog on Acknowledge.
      gmPage.once('dialog', (d) => d.accept());
      await ack(longRestBanner, { holdMs: 0 });
      await expect(longRestBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        expect(quillEl?.featureState?.['Strange Patterns']?.restChangeAvailable).toBe(true);
        // Perfect Recall rest frequency should clear on long rest.
        const fu = quillEl?.featureUsage || {};
        const stillUsed = Object.entries(fu).some(
          ([k, v]) => /Perfect Recall/i.test(k) && v && (v.used === true || (v.count ?? 0) >= 1)
        );
        expect(stillUsed, `Perfect Recall should clear after long rest: ${JSON.stringify(fu)}`).toBe(false);
      }).toPass({ timeout: 10000 });

      await caption('PLAYER A', 'Strange Patterns — new number', 'Pick a new Duality number after long rest');
      const actionsRepick = await ensureSheetOpen(playerPage, playerQuillCard);
      // 12 options → CustomSelect (inline max is 8). Portal options need dismiss-exempt click.
      const newNumberTrigger = actionsRepick
        .getByRole('button', { name: /Strange Patterns — new number/i })
        .first();
      await expect(newNumberTrigger).toBeVisible({ timeout: 8000 });
      await expect(newNumberTrigger).not.toHaveAttribute('aria-disabled', 'true');
      await newNumberTrigger.click();
      const nineOpt = playerPage
        .locator('[data-dh-outside-dismiss-exempt]')
        .getByRole('button', { name: /^9$/ });
      await expect(nineOpt).toBeVisible({ timeout: 5000 });
      await nineOpt.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        const bag = quillEl?.featureState?.['Strange Patterns'] || {};
        expect(bag.patternNumber, `expected patternNumber 9 after re-pick, got ${JSON.stringify(bag)}`).toBe(9);
        expect(bag.restChangeAvailable).toBe(false);
      }).toPass({ timeout: 10000 });

      // Restore Hope for Not This Time if Experience / rest moves drained it.
      await updateElement(tableId, quillInstanceId, { hope: 5 });

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

      await caption(
        'GM',
        'Not This Time',
        'Spend 3 Hope (Quill) to force the adversary to reroll — legacy GM banner button'
      );
      const legacyNtt = gmPage.getByRole('button', { name: /Not This Time/i }).first();
      await expect(legacyNtt).toBeVisible({ timeout: 8000 });
      await legacyNtt.click();

      await expect(async () => {
        const banner = gmPage.locator('.dice-result-banner', { hasText: /Alley Thug|Not This Time/i }).first();
        await expect(banner).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 10000 });

      const nttBanner = gmPage.locator('.dice-result-banner').filter({ hasText: /Alley Thug|Quill/i }).first();
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges the (re)rolled attack', '3 Hope spent from Quill');
      if (
        await nttBanner
          .getByRole('button', { name: 'Acknowledge' })
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        const quillTarget = nttBanner.getByRole('button', { name: /Quill/i }).first();
        if (await quillTarget.isVisible({ timeout: 1500 }).catch(() => false)) {
          await quillTarget.click();
        }
        await ack(nttBanner, { holdMs: 0 });
      }

      await expect(async () => {
        const state = await getTableState(tableId);
        const quillEl = (state.elements || []).find((e) => e.instanceId === quillInstanceId);
        expect(quillEl?.hope).toBeLessThan(hopeBeforeNtt);
      }).toPass({ timeout: 10000 });

      await caption(
        'Wizard / School of Knowledge',
        'Walkthrough complete',
        'Adept arming, Perfect Recall usage, Strange Patterns chips + rest re-pick, Not This Time'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
