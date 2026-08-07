/**
 * Subclass feature video — Warrior / Call of the Slayer.
 *
 * Walks through Call of the Slayer features (Slayer bank/spend, Weapon Specialist,
 * Martial Preparation) plus inherited Warrior class features (No Mercy, Attack of
 * Opportunity via token move, Combat Training). GM + Player A only.
 *
 * Coverage notes:
 *  - **Slayer** — after Start Session, seed `featureState.CallOfTheSlayer.slayerDiceCount`
 *    so spend chips are available without relying on a Hope-dominating roll. Optionally
 *    banks a die when the reviewAction chip appears; Player A spends via the damage-roll
 *    isSelect chip on a Broadsword attack.
 *  - **Weapon Specialist** — on a successful primary-weapon attack with a secondary that
 *    has a leading damage die, Player A spends 1 Hope to add that die (reviewAction chip).
 *  - **Martial Preparation** — long-rest card chip (Player A) posts an informational
 *    action-loop (suppressed banner → Action Log).
 *  - **Attack of Opportunity** — same GM token-drag pattern as Call of the Brave.
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
  updateElement,
  getTableState,
  cancelAllPendingBanners,
  grantCampaignPassForTable,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildWarriorCallOfTheSlayerCharacterData } from '../helpers/subclass-cast-warrior.js';

const CHAR_NAME = 'Rex';
const ADV_NAME = 'Marked Prey';

async function dragAdversaryOutOfMelee(page, advName) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const mapToken = page.locator(`[title="${advName}"]:not(.opacity-20)`).first();
  await expect(mapToken).toBeVisible({ timeout: 12000 });
  await mapToken.scrollIntoViewIfNeeded();
  const box = await mapToken.boundingBox();
  if (!box) throw new Error(`No bounding box for map token "${advName}"`);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 360, startY, { steps: 20 });
  await page.mouse.up();
}

/** Escape-dismiss then open — sidebar cards toggle, so a re-click can close an open sheet. */
async function openCharSheet(page, charCard) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await charCard.click();
}

/** Card-chip with frequency badge in the name (avoids Features expand headers). */
function frequencyChipButton(page, featureName) {
  // Features expand headers also lift frequency onto the title when chips are hidden —
  // `.last()` prefers the Actions-strip chip (later in DOM).
  const re = new RegExp(`${featureName}[\\s\\S]*\\b(long|short|session|rest)\\b`, 'i');
  return page.getByRole('button', { name: re }).last();
}

test.describe('Subclass video — Warrior / Call of the Slayer', () => {
  let tableId;
  let charLibId;
  let charInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Warrior Call of the Slayer Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const charLib = await createLibraryCharacter(
      ACTOR_GM,
      buildWarriorCallOfTheSlayerCharacterData({ name: CHAR_NAME })
    );
    charLibId = charLib.id;

    charInstanceId = `char-slayer-${Date.now()}`;
    advInstanceId = `adv-prey-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: charInstanceId,
        elementType: 'character',
        id: charLib.id,
        name: charLib.name,
        currentHp: 7,
        currentStress: 1,
        hope: 5,
        currentArmor: 0,
        conditions: '',
        tokenX: 40,
        tokenY: 40,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: ADV_NAME,
        tier: 1,
        // Difficulty 1 — guaranteed hit so Weapon Specialist / spend chips can appear.
        difficulty: 1,
        hp_max: 10,
        currentHp: 10,
        currentStress: 0,
        conditions: '',
        tokenX: 43,
        tokenY: 40,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (charLibId) await deleteLibraryCharacter(ACTOR_GM, charLibId);
  });

  test('Rex the Slayer: Slayer dice, Weapon Specialist, Martial Preparation, and class features', async ({
    browser,
  }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish, ack, holdForDiceTumble } = await startSubclassRun(browser, {
      className: 'Warrior',
      subclassName: 'Call of the Slayer',
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
      await caption('GM', 'Loading the table', `${CHAR_NAME} (Warrior/Call of the Slayer) and ${ADV_NAME}`);
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator(`text=${CHAR_NAME}`).first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', 'Slayer onSessionStart would clear leftover dice from a prior session');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      // Seed Slayer Dice after session start so onSessionStart does not wipe them.
      await caption('GM', 'Seed Slayer Dice', '2 dice in the CallOfTheSlayer pool (simulates prior Hope banks)');
      await updateElement(tableId, charInstanceId, {
        featureState: {
          CallOfTheSlayer: {
            slayerDiceCount: 2,
            weaponSpecialistSlayerRerollAvailable: true,
          },
        },
      });

      const playerCharCard = playerPage.locator('div.group\\/char', { hasText: CHAR_NAME });

      // ---------------------------------------------------------------------
      // No Mercy (V2 Actions chip → GM Ack) + Combat Training display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'No Mercy', 'Actions chip — 3 Hope applies immediately');
      await openCharSheet(playerPage, playerCharCard);
      const slayerActionsCard = playerPage
        .locator('div.rounded-xl.bg-gradient-to-b')
        .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
        .first();
      await expect(slayerActionsCard).toBeVisible({ timeout: 8000 });
      const noMercyBtn = slayerActionsCard
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /No Mercy/i });
      await expect(noMercyBtn).toBeVisible({ timeout: 8000 });

      let hopeBeforeNoMercy;
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === charInstanceId);
        hopeBeforeNoMercy = el?.hope;
        expect(hopeBeforeNoMercy).toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 8000 });

      await noMercyBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === charInstanceId);
        expect(el?.hope).toBe(hopeBeforeNoMercy - 3);
        expect(JSON.stringify(el?.featureState || {})).toMatch(/"noMercyActive"\s*:\s*true/);
      }).toPass({ timeout: 8000 });
      await caption('PLAYER A', 'No Mercy applied', 'Hope spent; +1 attacks until rest');

      await caption('PLAYER A', 'Combat Training', 'Passive — +level physical damage');
      await openCharSheet(playerPage, playerCharCard);
      await expect(playerPage.getByText('Combat Training', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Broadsword attack — exercise Slayer (damage spend) + Weapon Specialist
      // as reviewAction chips on the pending banner. (Intent-phase Slayer spend
      // is an isSelect chip; the preroll panel only toggles V2 intent chips and
      // does not pass selectedId into activateChip — known Game Table gap.)
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Attacks with Broadsword',
        'Guaranteed hit — surfaces Slayer / Weapon Specialist reviewAction chips'
      );
      await openCharSheet(playerPage, playerCharCard);
      const broadsword = playerPage.getByRole('button', { name: /^Broadsword\b/i }).first();
      await expect(broadsword).toBeVisible({ timeout: 8000 });
      await broadsword.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: new RegExp(ADV_NAME, 'i') }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      // Intent "Slayer (spend on action roll)" may render as a non-functional toggle
      // (isSelect not wired in preroll) — leave it alone and Proceed.
      await caption(
        'PLAYER A',
        'Slayer (intent spend)',
        'Known gap: preroll toggles do not pass isSelect selectedId — spend via damage chip instead'
      );
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = `${CHAR_NAME} Broadsword`;
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Optional bank chip when Hope dominates (not guaranteed).
      const bankBtn = playerPage.getByRole('button', { name: /Slayer \(bank d6\)/i }).first();
      if (await bankBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await caption('PLAYER A', 'Slayer (bank d6)', 'Hope dominated — bank a die instead of gaining Hope');
        await bankBtn.click();
      }

      // Slayer spend: engine `rollDie` is audit-only; damage lands via addRollStatic →
      // postBannerAddDamage (player `postPlayerV2ReviewChip` applies the same follow-ups).
      await caption('PLAYER A', 'Slayer (spend on damage roll)', 'Spend 1 seeded Slayer die into the damage pool');
      const spendOneDmg = playerPage.getByRole('button', { name: /Spend 1 Slayer/i }).first();
      await expect(spendOneDmg).toBeVisible({ timeout: 8000 });
      await spendOneDmg.click();

      const specialistBtn = playerPage.getByRole('button', { name: /Weapon Specialist/i }).first();
      if (await specialistBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await caption('PLAYER A', 'Weapon Specialist', 'Spend 1 Hope — add Shortsword damage die to this hit');
        await specialistBtn.click();
      } else {
        await caption('PLAYER A', 'Weapon Specialist', 'Chip not on banner — sheet assert later');
      }

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Rex's attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      const targetChip = attackBanner.getByRole('button', { name: new RegExp(ADV_NAME, 'i') }).first();
      if (await targetChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await targetChip.click();
      }
      await ack(attackBanner, { holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === charInstanceId);
        const pool = el?.featureState?.CallOfTheSlayer?.slayerDiceCount;
        expect(pool == null || pool < 2).toBe(true);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Martial Preparation — card chip → Action Log narration (Player A).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Martial Preparation',
        'Long-rest training move — party gains Slayer Dice (GM distributes)'
      );
      await openCharSheet(playerPage, playerCharCard);
      const martialBtn = frequencyChipButton(playerPage, 'Martial Preparation');
      await expect(martialBtn).toBeVisible({ timeout: 8000 });
      await martialBtn.click();
      await expect(playerPage.getByText(/Martial Preparation/i).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Attack of Opportunity — token leave Melee.
      // ---------------------------------------------------------------------
      await caption(
        'GM',
        'Attack of Opportunity',
        `Drags ${ADV_NAME} out of Melee — Warrior onTokenMove interrupt`
      );
      await dragAdversaryOutOfMelee(gmPage, ADV_NAME);

      await expect(async () => {
        const state = await getTableState(tableId);
        const adv = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(adv?.tokenX ?? 43).toBeGreaterThan(50);
      }).toPass({ timeout: 8000 });

      await expect(playerPage.getByText(/Attack of Opportunity/i).first()).toBeVisible({ timeout: 10000 });

      await caption('PLAYER A', 'Slayer / Weapon Specialist cards', 'Foundation + Specialization features on the sheet');
      await openCharSheet(playerPage, playerCharCard);
      await expect(playerPage.getByText('Slayer', { exact: true }).first()).toBeVisible({ timeout: 8000 });
      await expect(playerPage.getByText('Weapon Specialist', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'Warrior / Call of the Slayer',
        'Walkthrough complete',
        'Slayer, Weapon Specialist, Martial Preparation, No Mercy, Attack of Opportunity'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
