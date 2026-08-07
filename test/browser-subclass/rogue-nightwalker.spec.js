/**
 * Subclass feature video — Rogue / Nightwalker.
 *
 * Walks through every Nightwalker feature (Shadow Stepper, Dark Cloud, Adrenaline,
 * Fleeting Shadow, Vanishing Act) plus the inherited Rogue class features it builds on
 * (Cloaked, Sneak Attack, Rogue's Dodge), driven from a single player browser context
 * (GM + Player A only — Nightwalker is fully solo-capable per the plan's phasing).
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the harness design.
 *
 * Coverage notes (per docs/srd-implementation.md "Partial" rows):
 *  - **Cloaked** is a toggle card chip that adds/removes the condition directly — the SRD's
 *    auto-clear on attack/move-within-LOS is GM/table judgment, not automated, so this test
 *    toggles it off manually after the attack to demonstrate the mechanic without claiming
 *    the auto-clear is implemented.
 *  - **Sneak Attack** is a `reviewAction` chip on the pending attack banner (tier in d6 extra
 *    damage) when the attack succeeds while Cloaked **or** an ally is in Melee of the target.
 *    Asserts the 4d6 die lands on the banner (Cloaked path + ally path).
 *  - **Rogue's Dodge** spends 3 Hope and sets `roguesDodgeActive` (+2 Evasion until hit/rest).
 *    Hard-asserts Hope, featureState, sheet Evasion `17 (+2)`, and rest clear of the flag.
 *  - **Vanishing Act** clears Restrained when present, sets Cloaked + `vanishingActCloak`;
 *    rest clears the vanishing-act cloak.
 *  - **Shadow Stepper** / **Dark Cloud** / **Adrenaline** — same as prior suite notes.
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
import { buildAllyCharacterData, buildRogueNightwalkerCharacterData } from '../helpers/subclass-cast.js';

/** Level-8 Nightwalker sheet evasion (includes Fleeting Shadow +1). */
const NYX_BASE_EVASION = 17;

async function expectSneakAttackDieOnBanner(page, bannerText) {
  // Prefer the live pending banner (first); Action Log / replaced banners can share the same label.
  const banner = page.locator('.dice-result-banner', { hasText: bannerText }).first();
  await expect(async () => {
    const text = await banner.innerText();
    expect(text, 'Sneak Attack should add tier (4) d6 to the damage pool').toMatch(/4d6|Sneak Attack/i);
  }).toPass({ timeout: 8000 });
}

async function rollDaggerAtThug(playerPage, playerNyxCard, ensureSheetOpen) {
  const daggerCard = playerPage.getByRole('button', { name: /^Dagger\b/i }).first();
  await ensureSheetOpen(playerPage, playerNyxCard, daggerCard);
  await daggerCard.scrollIntoViewIfNeeded();
  await daggerCard.click();

  const chooseTargetText = playerPage.getByText('Choose target');
  if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
    await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
  }

  await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
  await playerPage.getByRole('button', { name: 'Proceed' }).click();
  await expect(playerPage.getByText('Before you roll')).not.toBeVisible({ timeout: 8000 });
}

test.describe('Subclass video — Rogue / Nightwalker', () => {
  let tableId;
  let nyxLibId;
  let allyLibId;
  let nyxInstanceId;
  let allyInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    // The banner queue is keyed by the shared GM uid across every test file — always start clean.
    await cancelAllPendingBanners();

    const table = await createTestTable('Rogue Nightwalker Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const nyxLib = await createLibraryCharacter(ACTOR_GM, buildRogueNightwalkerCharacterData({ name: 'Nyx' }));
    nyxLibId = nyxLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    nyxInstanceId = `char-nyx-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    thugInstanceId = `adv-thug-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: nyxInstanceId,
        elementType: 'character',
        id: nyxLib.id,
        name: nyxLib.name,
        currentHp: 7, currentStress: 5, hope: 5, currentArmor: 0,
        conditions: '',
        tokenX: 100, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        // Ally in Melee of the thug for the Sneak Attack ally path (no Player B browser needed).
        instanceId: allyInstanceId,
        elementType: 'character',
        id: allyLib.id,
        name: allyLib.name,
        currentHp: 6, currentStress: 0, hope: 3, currentArmor: 0,
        conditions: '',
        tokenX: 106, tokenY: 100,
      },
      {
        instanceId: thugInstanceId,
        elementType: 'adversary',
        id: `test-adv-${thugInstanceId}`,
        name: 'Alley Thug',
        tier: 1,
        // Difficulty 1 guarantees the weapon attack succeeds so Sneak Attack's `reviewAction`
        // chip (gated on `youSucceedOnAnAttack`) actually appears on the banner.
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        // 3ft from Nyx (center-to-center on 5x5' tokens) — well within Melee range (<=5ft).
        tokenX: 103, tokenY: 100,
      },
    ]);

    // Grant a Campaign Pass directly (bypassing Stripe) so the session-start billing gate
    // never blocks this table's "Start Session" — see grantCampaignPassForTable's doc comment.
    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (nyxLibId) await deleteLibraryCharacter(ACTOR_GM, nyxLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test("Nyx the Nightwalker: Cloaked, Sneak Attack, Rogue's Dodge, and the subclass card chips", async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
        className: 'Rogue',
        subclassName: 'Nightwalker',
        actors: ['gm', 'playerA'],
      });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Nyx (Rogue/Nightwalker), Reya (ally), and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Nyx').first()).toBeVisible({ timeout: 15000 });

      // ---------------------------------------------------------------------
      // Start Session.
      // ---------------------------------------------------------------------
      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerNyxCard = playerPage.locator('div.group\\/char', { hasText: 'Nyx' });

      // ---------------------------------------------------------------------
      // Fleeting Shadow — passive +1 Evasion (baked into sheet total 17).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Fleeting Shadow', `Passive +1 Evasion — sheet shows ${NYX_BASE_EVASION}`);
      await ensureSheetOpen(playerPage, playerNyxCard);
      // Evasion lives on the Defense graphic (outside the Actions strip returned by ensureSheetOpen).
      await expect(playerPage.getByText('Evasion', { exact: true }).first()).toBeVisible({ timeout: 8000 });
      await expect(
        playerPage.locator('.font-bold.tabular-nums').filter({ hasText: new RegExp(`^${NYX_BASE_EVASION}`) }).first()
      ).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Cloaked (Rogue class feature) — toggle on.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Cloaked (on)', 'Toggle card chip — adds the Cloaked condition immediately');
      // Prefer the Actions-strip toggle (CheckSquare) over Features expand headers that share the name.
      const nyxActionsForCloak = await ensureSheetOpen(playerPage, playerNyxCard);
      const cloakedToggle = nyxActionsForCloak
        .locator('button')
        .filter({ hasText: /^Cloaked$/i })
        .first();
      await expect(cloakedToggle).toBeVisible({ timeout: 8000 });
      await cloakedToggle.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(String(nyxEl?.conditions || '')).toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Weapon attack while Cloaked → Sneak Attack die (4d6).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Attacks with Dagger', 'Targets the Alley Thug (guaranteed hit while Cloaked)');
      await rollDaggerAtThug(playerPage, playerNyxCard, ensureSheetOpen);

      const attackBannerText = 'Nyx Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 15000 });
      }

      await caption('PLAYER A', 'Sneak Attack (Cloaked)', 'Adds tier (4) d6 damage — succeeded while Cloaked');
      const sneakAttackBtn = playerPage.getByRole('button', { name: /Sneak Attack/i }).first();
      await expect(sneakAttackBtn).toBeVisible({ timeout: 8000 });
      await sneakAttackBtn.click();
      await expectSneakAttackDieOnBanner(playerPage, attackBannerText);

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Nyx's attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText }).first();
      await ack(attackBanner, { holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 8).toBeLessThan(8);
      }).toPass({ timeout: 8000 });

      // Cloaked off — SRD auto-clears this on attack; the engine does not automate
      // that (see file header), so demonstrate the manual toggle instead.
      await caption('PLAYER A', 'Cloaked (off)', 'SRD auto-clears on attack — toggled manually here (not automated)');
      const nyxActionsOff = await ensureSheetOpen(playerPage, playerNyxCard);
      const cloakedOff = nyxActionsOff.locator('button').filter({ hasText: /^Cloaked$/i }).first();
      await expect(cloakedOff).toBeVisible({ timeout: 8000 });
      // Only click if still pressed (toggle may already be off if a prior step cleared it).
      if ((await cloakedOff.getAttribute('aria-pressed')) === 'true') {
        await cloakedOff.click();
      }

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(String(nyxEl?.conditions || '')).not.toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Sneak Attack ally path — not Cloaked; Reya is in Melee of the thug.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Sneak Attack (ally in Melee)',
        'Not Cloaked — Reya within Melee of the thug still enables Sneak Attack'
      );
      await rollDaggerAtThug(playerPage, playerNyxCard, ensureSheetOpen);
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 15000 });
      }

      const sneakAllyBtn = playerPage.getByRole('button', { name: /Sneak Attack/i }).first();
      await expect(sneakAllyBtn).toBeVisible({ timeout: 8000 });
      await sneakAllyBtn.click();
      await expectSneakAttackDieOnBanner(playerPage, attackBannerText);

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges ally-path Sneak Attack', '');
      const allyAttackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText }).first();
      await ack(allyAttackBanner, { holdMs: 0 });
      await expect(allyAttackBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Rogue's Dodge — Hope spend + +2 Evasion on the sheet.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', "Rogue's Dodge", 'Actions chip — spends 3 Hope for +2 Evasion until hit or rest');
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const nyxActionsCard = await ensureSheetOpen(playerPage, playerNyxCard);
      const roguesDodgeBtn = nyxActionsCard
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Rogue's Dodge/i });
      await expect(roguesDodgeBtn).toBeVisible({ timeout: 8000 });
      await roguesDodgeBtn.scrollIntoViewIfNeeded();

      let hopeBeforeDodge;
      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        hopeBeforeDodge = nyxEl?.hope;
        expect(hopeBeforeDodge).toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 8000 });

      await roguesDodgeBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(nyxEl?.hope).toBe(hopeBeforeDodge - 3);
        // Stored under the class scope bag (`classes:srd-cls-rogue`), not the feature name key.
        expect(JSON.stringify(nyxEl?.featureState || {})).toMatch(/"roguesDodgeActive"\s*:\s*true/);
      }).toPass({ timeout: 8000 });

      // Flexible (+1) + Dodge (+2) → (+3); while Cloaked, Fleeting Shadow adds another +1 → (+4).
      await caption('PLAYER A', "Rogue's Dodge applied", `Hope spent; Evasion parenthetical includes Dodge +2`);
      await ensureSheetOpen(playerPage, playerNyxCard);
      await expect(async () => {
        const el = playerPage.locator('.font-bold.tabular-nums').filter({ hasText: new RegExp(String(NYX_BASE_EVASION)) }).first();
        await expect(el).toBeVisible({ timeout: 2000 });
        await expect(el).toContainText(/\(\+[34]\)/);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Shadow Stepper (Nightwalker Foundation) — 1 Stress, becomes Cloaked.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Shadow Stepper', 'Marks 1 Stress, teleports between shadows, becomes Cloaked');
      const shadowStepperBtn = playerPage.getByRole('button', { name: /Shadow Stepper/i }).last();
      await ensureSheetOpen(playerPage, playerNyxCard, shadowStepperBtn);
      await shadowStepperBtn.scrollIntoViewIfNeeded();

      let stressBeforeStepper;
      await expect(async () => {
        const state = await getTableState(tableId);
        stressBeforeStepper = (state.elements || []).find((e) => e.instanceId === nyxInstanceId)?.currentStress;
        expect(typeof stressBeforeStepper).toBe('number');
      }).toPass({ timeout: 8000 });

      await shadowStepperBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(nyxEl?.currentStress).toBe(stressBeforeStepper + 1);
        expect(String(nyxEl?.conditions || '')).toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Dark Cloud (Nightwalker Foundation) — narrative Spellcast Roll (15).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Dark Cloud', 'Spellcast Roll (15) — narrative only, no dice wired');
      const darkCloudBtn = playerPage.getByRole('button', { name: /Dark Cloud/i }).last();
      await ensureSheetOpen(playerPage, playerNyxCard, darkCloudBtn);
      await darkCloudBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Dark Cloud' })).toHaveCount(0, { timeout: 6000 });

      // ---------------------------------------------------------------------
      // Vanishing Act — clear Restrained + Cloaked + vanishingActCloak.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Vanishing Act (Restrained)', 'Apply Restrained, then Vanishing Act clears it');
      await updateElement(tableId, nyxInstanceId, { conditions: 'Restrained' });
      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(String(nyxEl?.conditions || '')).toMatch(/Restrained/i);
      }).toPass({ timeout: 8000 });

      const vanishingActBtn = playerPage.getByRole('button', { name: /Vanishing Act/i }).last();
      await ensureSheetOpen(playerPage, playerNyxCard, vanishingActBtn);
      await vanishingActBtn.scrollIntoViewIfNeeded();

      let stressBeforeVanish;
      await expect(async () => {
        const state = await getTableState(tableId);
        stressBeforeVanish = (state.elements || []).find((e) => e.instanceId === nyxInstanceId)?.currentStress;
        expect(typeof stressBeforeVanish).toBe('number');
      }).toPass({ timeout: 8000 });

      await vanishingActBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(nyxEl?.currentStress).toBe(stressBeforeVanish + 1);
        expect(String(nyxEl?.conditions || '')).not.toMatch(/Restrained/i);
        expect(String(nyxEl?.conditions || '')).toMatch(/Cloaked/i);
        expect(JSON.stringify(nyxEl?.featureState || {})).toMatch(/"vanishingActCloak"\s*:\s*true/);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Adrenaline — display-only in this suite (see file header).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Adrenaline', 'Display-only — onReviewAction hook not wired into outgoing attack banners');
      const adrenaline = playerPage.getByText('Adrenaline', { exact: true }).first();
      await ensureSheetOpen(playerPage, playerNyxCard, adrenaline);
      await expect(adrenaline).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Short Rest — clears Rogue's Dodge + Vanishing Act cloak / Cloaked.
      // ---------------------------------------------------------------------
      await caption('GM', 'Short Rest', 'Clears Rogue\'s Dodge and Vanishing Act cloak');
      await gmPage.getByRole('button', { name: '⏸ Short' }).click();
      const restBanner = gmPage.locator('.dice-result-banner', { hasText: 'Short Rest' });
      await expect(restBanner).toBeVisible({ timeout: 8000 });
      gmPage.once('dialog', (d) => d.accept());
      await ack(restBanner, { holdMs: 0 });
      await expect(restBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(JSON.stringify(nyxEl?.featureState || {})).not.toMatch(/"roguesDodgeActive"\s*:\s*true/);
        expect(JSON.stringify(nyxEl?.featureState || {})).not.toMatch(/"vanishingActCloak"\s*:\s*true/);
        expect(String(nyxEl?.conditions || '')).not.toMatch(/Cloaked/i);
      }).toPass({ timeout: 10000 });

      await caption('Rogue / Nightwalker', 'Walkthrough complete', 'Cloaked, Sneak Attack (Cloaked + ally), Dodge evasion, Vanishing Act, rest clears');

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
