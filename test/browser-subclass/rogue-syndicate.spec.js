/**
 * Subclass feature video — Rogue / Syndicate.
 *
 * Walks through every Syndicate feature (Well-Connected, Contacts Everywhere,
 * Reliable Backup) plus the inherited Rogue class features (Cloaked, Sneak Attack,
 * Rogue's Dodge), driven from a single player browser context (GM + Player A —
 * Syndicate is solo-capable; Contacts Everywhere only mutates the owner's own
 * featureState / actionLoop).
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the harness design.
 *
 * Coverage notes:
 *  - **Well-Connected** is narrative-only (CONV-027) — assert the feature card renders.
 *  - **Reliable Backup** is declarative (`contactsEverywhereSessionUses: 3`) — it adds two
 *    mastery options to Contacts Everywhere's `isSelect` list and raises the engine session
 *    cap to 3. Assert the card renders and that mastery options appear on the chip.
 *  - **Contacts Everywhere** is a session `isSelect` card chip. Selecting an option applies
 *    immediately (actionLoop notifications are informational and suppressed — same pattern as
 *    Nightwalker's Shadow Stepper). Mastery options **Shielding contact** / **Conversation
 *    backup** set `pendingHpShield` / `conversationHopeD20` in featureState. This suite arms
 *    **Shielding contact** and asserts `pendingHpShield` (engine unit tests cover the 3-use
 *    path and damage-reduce / d20 Hope hooks).
 *  - **hpShield** / **presenceD20** engine hooks (`onReviewAction` damage reduce, `onIntent`
 *    d20 Hope die) are not fully wired through the Game Table damage-ack / trait-roll bridges
 *    for this feature (no `runOnVttDamageApplyReviewOutcome` / automatic intent apply) — this
 *    suite asserts the featureState flags after chip activation, not end-to-end HP / die shape.
 *  - Inherited Rogue features follow the same patterns as `rogue-nightwalker.spec.js`.
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
import { buildRogueSyndicateCharacterData } from '../helpers/subclass-cast-rogue-syndicate.js';

test.describe('Subclass video — Rogue / Syndicate', () => {
  let tableId;
  let vexLibId;
  let vexInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Rogue Syndicate Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const vexLib = await createLibraryCharacter(ACTOR_GM, buildRogueSyndicateCharacterData({ name: 'Vex' }));
    vexLibId = vexLib.id;

    vexInstanceId = `char-vex-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: vexInstanceId,
        elementType: 'character',
        id: vexLib.id,
        name: vexLib.name,
        // maxHp 7 / maxStress 8 / maxHope 6 — see buildRogueSyndicateCharacterData.
        currentHp: 7, currentStress: 2, hope: 4, currentArmor: 0,
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
        // 3ft from Vex — well within Melee range (<=5ft).
        tokenX: 103, tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (vexLibId) await deleteLibraryCharacter(ACTOR_GM, vexLibId);
  });

  test('Vex the Syndicate: Cloaked, Sneak Attack, Rogue\'s Dodge, and Contacts Everywhere', async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Rogue',
      subclassName: 'Syndicate',
      actors: ['gm', 'playerA'],
    });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Vex (Rogue/Syndicate) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Vex').first()).toBeVisible({ timeout: 15000 });

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

      const playerVexCard = playerPage.locator('div.group\\/char', { hasText: 'Vex' });

      // ---------------------------------------------------------------------
      // Cloaked (Rogue class feature) — toggle on.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Cloaked (on)', 'Toggle card chip — adds the Cloaked condition immediately');
      await playerVexCard.click();
      const cloakedToggle = playerPage.getByRole('button', { name: /Cloaked/i }).first();
      await expect(cloakedToggle).toBeVisible({ timeout: 8000 });
      await cloakedToggle.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(String(vexEl?.conditions || '')).toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Weapon attack → Sneak Attack review chip.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Attacks with Dagger', 'Targets the Alley Thug (guaranteed hit)');
      await playerVexCard.click();
      const daggerCard = playerPage.getByRole('button', { name: /^Dagger\b/i }).first();
      await expect(daggerCard).toBeVisible({ timeout: 8000 });
      await daggerCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Vex Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Sneak Attack', 'Adds tier (4) d6 damage — succeeded while Cloaked');
      const sneakAttackBtn = playerPage.getByRole('button', { name: /Sneak Attack/i }).first();
      await expect(sneakAttackBtn).toBeVisible({ timeout: 8000 });
      await sneakAttackBtn.click();

      await caption('GM', "Acknowledges Vex's attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await attackBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 8).toBeLessThan(8);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Cloaked (off)', 'SRD auto-clears on attack — toggled manually here (not automated)');
      await playerVexCard.click();
      await expect(cloakedToggle).toBeVisible({ timeout: 8000 });
      await cloakedToggle.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(String(vexEl?.conditions || '')).not.toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Rogue's Dodge — Hope ability chip (whole card is the button; no "Use").
      // ---------------------------------------------------------------------
      await caption('PLAYER A', "Rogue's Dodge", 'Spends 3 Hope for +2 Evasion until hit or rest');
      await playerVexCard.click();
      const roguesDodgeBtn = playerPage.getByRole('button', { name: /Rogue's Dodge/i }).first();
      await expect(roguesDodgeBtn).toBeVisible({ timeout: 8000 });
      await roguesDodgeBtn.scrollIntoViewIfNeeded();

      let hopeBeforeDodge;
      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        hopeBeforeDodge = vexEl?.hope;
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
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.hope).toBe(hopeBeforeDodge - 3);
        // Stored under the class scope bag (`classes:srd-cls-rogue`), not the feature name key.
        expect(JSON.stringify(vexEl?.featureState || {})).toMatch(/"roguesDodgeActive"\s*:\s*true/);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Well-Connected + Reliable Backup — narrative / declarative display.
      // One sheet open for this whole block (re-clicking the sidebar card toggles
      // the hover sheet closed — see subclass-video-test-plan.md lesson 5).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Well-Connected', 'Narrative-only — name a local contact when you arrive in town');
      await playerVexCard.click();
      await expect(playerPage.getByText('Well-Connected', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      await caption('PLAYER A', 'Reliable Backup', 'Mastery — 3× Contacts Everywhere + shielding / d20 Hope options');
      await expect(playerPage.getByText('Reliable Backup', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Contacts Everywhere — assert mastery options render, then pick Shielding.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Contacts Everywhere', 'Mastery options visible — pick Shielding contact');
      const contactsGroup = playerPage.getByRole('group', { name: /Contacts Everywhere/i }).first();
      await expect(contactsGroup).toBeVisible({ timeout: 8000 });
      await contactsGroup.scrollIntoViewIfNeeded();
      // Base + Reliable Backup mastery options (5 total).
      await expect(contactsGroup.getByRole('button', { name: /Gold, tool, or object/i })).toBeVisible();
      await expect(contactsGroup.getByRole('button', { name: /Shielding contact/i })).toBeVisible();
      await expect(contactsGroup.getByRole('button', { name: /Conversation backup/i })).toBeVisible();

      await contactsGroup.getByRole('button', { name: /Shielding contact/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        const bag = vexEl?.featureState?.['Contacts Everywhere'] || {};
        expect(bag.pendingHpShield).toBe(true);
      }).toPass({ timeout: 8000 });

      await caption(
        'PLAYER A',
        'Contacts Everywhere (armed)',
        'pendingHpShield set — next HP loss is reduced by 1 (engine); Reliable Backup allows up to 3 uses/session'
      );

      await caption('Rogue / Syndicate', 'Walkthrough complete', 'Cloaked, Sneak Attack, Rogue\u2019s Dodge, Contacts Everywhere + mastery');

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
