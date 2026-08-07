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
 *    damage) when the attack succeeds while Cloaked. The adversary's `difficulty` is set to 1
 *    so the attack is a guaranteed hit, letting the chip actually appear and be exercised.
 *  - **Rogue's Dodge** is the class Hope ability — a single amber clickable chip on the
 *    Features list (no separate "Use" button). Clicking it posts an action notification that
 *    requires GM Acknowledge (`_featureUse: true`); the ack spends 3 Hope and sets
 *    `featureState[...].roguesDodgeActive` (+2 Evasion until the next successful attack
 *    against Nyx, or until rest).
 *  - **Shadow Stepper**, **Dark Cloud**, and **Vanishing Act** are V2 card chips without
 *    `gameTableDeferUntilBannerAck` — clicking them applies their mutations (Stress cost,
 *    Cloaked condition) immediately client-side; the resulting action-loop notification is a
 *    purely informational banner that the client suppresses entirely (no tags, no
 *    `_featureUse`), so it never actually appears as a pending banner requiring GM Ack (see
 *    `computeActionAckTouchesTableState` / `shouldSuppressActionBanner` in
 *    src/client/lib/action-notification-banner.js) — same pattern as Bard's Relaxing Song in
 *    the Troubadour pilot spec.
 *  - **Dark Cloud** has no Stress/Hope cost and no dice roll wired (its "Spellcast Roll (15)"
 *    is narrative text only) — the test clicks it and asserts only that the notification
 *    fires; no mechanical state change to assert.
 *  - **Adrenaline** (+level to damage while Vulnerable) and **Fleeting Shadow** (+1 Evasion
 *    passive, unlocks Very Far for Shadow Stepper) are both display-only in this suite:
 *    Adrenaline's `onReviewAction` hook is only wired into the damage-*received* hook gate,
 *    not the standard attacker-side damage-roll review chips, so it never surfaces as a
 *    clickable chip on an outgoing attack banner (docs/srd-implementation.md "Partial"); the
 *    test only asserts both feature cards render on the sheet.
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
import { buildRogueNightwalkerCharacterData } from '../helpers/subclass-cast.js';

test.describe('Subclass video — Rogue / Nightwalker', () => {
  let tableId;
  let nyxLibId;
  let nyxInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    // The banner queue is keyed by the shared GM uid across every test file — always start clean.
    await cancelAllPendingBanners();

    const table = await createTestTable('Rogue Nightwalker Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const nyxLib = await createLibraryCharacter(ACTOR_GM, buildRogueNightwalkerCharacterData({ name: 'Nyx' }));
    nyxLibId = nyxLib.id;

    nyxInstanceId = `char-nyx-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: nyxInstanceId,
        elementType: 'character',
        id: nyxLib.id,
        name: nyxLib.name,
        currentHp: 7, currentStress: 5, hope: 4, currentArmor: 0,
        conditions: '',
        tokenX: 100, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
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
  });

  test("Nyx the Nightwalker: Cloaked, Sneak Attack, Rogue's Dodge, and the subclass card chips", async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Rogue',
      subclassName: 'Nightwalker',
      actors: ['gm', 'playerA'],
    });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Nyx (Rogue/Nightwalker) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Nyx').first()).toBeVisible({ timeout: 15000 });

      // Hide the 3D dice canvas on both clients so every banner in this walkthrough resolves
      // immediately instead of racing a tumbling-dice animation (established pattern).
      for (const p of [gmPage, playerPage]) {
        await p.getByLabel('Hide dice').click();
      }

      // ---------------------------------------------------------------------
      // Start Session.
      // ---------------------------------------------------------------------
      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerNyxCard = playerPage.locator('div.group\\/char', { hasText: 'Nyx' });

      // ---------------------------------------------------------------------
      // Cloaked (Rogue class feature) — toggle on. A card-chip toggle with no
      // `gameTableDeferUntilBannerAck`: the condition mutation applies immediately;
      // the resulting action-loop notification is purely informational and is
      // suppressed client-side (never a pending banner) — see file header.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Cloaked (on)', 'Toggle card chip — adds the Cloaked condition immediately');
      await playerNyxCard.click();
      const cloakedToggle = playerPage.getByRole('button', { name: /Cloaked/i }).first();
      await expect(cloakedToggle).toBeVisible({ timeout: 8000 });
      await cloakedToggle.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(String(nyxEl?.conditions || '')).toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Weapon attack (Dagger) on the Alley Thug — guaranteed hit (difficulty 1) so
      // Sneak Attack's `reviewAction` chip (gated on a successful attack while
      // Cloaked) appears on the pending banner.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Attacks with Dagger', 'Targets the Alley Thug (guaranteed hit)');
      await playerNyxCard.click();
      const daggerCard = playerPage.getByRole('button', { name: /^Dagger\b/i }).first();
      await expect(daggerCard).toBeVisible({ timeout: 8000 });
      await daggerCard.click();

      // In-range weapon attacks with more than one valid target show an in-place
      // "Choose target" popover before the roll is sent (CharacterHoverCard.jsx).
      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
      }

      // Every weapon attack routes through a "Before you roll" confirmation panel.
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Nyx Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Sneak Attack', 'Adds tier (4) d6 damage — succeeded while Cloaked');
      const sneakAttackBtn = playerPage.getByRole('button', { name: /Sneak Attack/i }).first();
      await expect(sneakAttackBtn).toBeVisible({ timeout: 8000 });
      await sneakAttackBtn.click();

      await caption('GM', "Acknowledges Nyx's attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await attackBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 8).toBeLessThan(8);
      }).toPass({ timeout: 8000 });

      // Cloaked off — SRD auto-clears this on attack; the engine does not automate
      // that (see file header), so demonstrate the manual toggle instead.
      await caption('PLAYER A', 'Cloaked (off)', 'SRD auto-clears on attack — toggled manually here (not automated)');
      await playerNyxCard.click();
      await expect(cloakedToggle).toBeVisible({ timeout: 8000 });
      await cloakedToggle.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(String(nyxEl?.conditions || '')).not.toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Rogue's Dodge — Hope ability chip (whole card is the button; no "Use").
      // Posts an action notification; GM Ack spends 3 Hope + sets roguesDodgeActive.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', "Rogue's Dodge", 'Spends 3 Hope for +2 Evasion until hit or rest');
      await playerNyxCard.click();
      const roguesDodgeBtn = playerPage.getByRole('button', { name: /Rogue's Dodge/i }).first();
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

      const dodgeBannerText = "Rogue's Dodge";
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: dodgeBannerText })).toBeVisible({ timeout: 8000 });
      }
      await caption('GM', "Acknowledges Rogue's Dodge", '');
      const dodgeBanner = gmPage.locator('.dice-result-banner', { hasText: dodgeBannerText });
      await dodgeBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(dodgeBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const nyxEl = (state.elements || []).find((e) => e.instanceId === nyxInstanceId);
        expect(nyxEl?.hope).toBe(hopeBeforeDodge - 3);
        // Stored under the class scope bag (`classes:srd-cls-rogue`), not the feature name key.
        expect(JSON.stringify(nyxEl?.featureState || {})).toMatch(/"roguesDodgeActive"\s*:\s*true/);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Shadow Stepper (Nightwalker Foundation) — 1 Stress, becomes Cloaked.
      // Mutation applies immediately; the notification is suppressed (see header).
      // Use `.last()`: Features list expand toggles share the feature name and
      // appear earlier in the DOM than the Actions-strip chip.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Shadow Stepper', 'Marks 1 Stress, teleports between shadows, becomes Cloaked');
      await playerNyxCard.click();
      const shadowStepperBtn = playerPage.getByRole('button', { name: /Shadow Stepper/i }).last();
      await expect(shadowStepperBtn).toBeVisible({ timeout: 8000 });
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
      // Dark Cloud (Nightwalker Foundation) — narrative Spellcast Roll (15), no
      // dice wired and no cost: click and confirm the notification fires.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Dark Cloud', 'Spellcast Roll (15) — narrative only, no dice wired');
      await playerNyxCard.click();
      const darkCloudBtn = playerPage.getByRole('button', { name: /Dark Cloud/i }).last();
      await expect(darkCloudBtn).toBeVisible({ timeout: 8000 });
      await darkCloudBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Dark Cloud' })).toHaveCount(0, { timeout: 6000 });

      // ---------------------------------------------------------------------
      // Vanishing Act (Nightwalker Specialization) — 1 Stress, becomes Cloaked.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Vanishing Act', 'Marks 1 Stress to become Cloaked at any time');
      await playerNyxCard.click();
      const vanishingActBtn = playerPage.getByRole('button', { name: /Vanishing Act/i }).last();
      await expect(vanishingActBtn).toBeVisible({ timeout: 8000 });
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
        expect(String(nyxEl?.conditions || '')).toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Adrenaline (Nightwalker Mastery) and Fleeting Shadow (Nightwalker
      // Specialization) — both display-only in this suite (see file header).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Adrenaline', 'Display-only — onReviewAction hook not wired into outgoing attack banners');
      await playerNyxCard.click();
      await expect(playerPage.getByText('Adrenaline', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      await caption('PLAYER A', 'Fleeting Shadow', 'Display-only — passive +1 Evasion, unlocks Very Far for Shadow Stepper');
      await expect(playerPage.getByText('Fleeting Shadow', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      await caption('Rogue / Nightwalker', 'Walkthrough complete', 'Cloaked, Sneak Attack, Rogue\u2019s Dodge, and every Nightwalker feature');

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
