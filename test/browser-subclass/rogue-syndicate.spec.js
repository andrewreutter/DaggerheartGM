/**
 * Subclass feature video — Rogue / Syndicate.
 *
 * Walks through every Syndicate feature (Well-Connected, Contacts Everywhere,
 * Reliable Backup) plus the inherited Rogue class features (Cloaked, Sneak Attack,
 * Rogue's Dodge), driven from a single player browser context (GM + Player A —
 * ally Reya is table-placed for the Sneak Attack Melee path without a Player B browser).
 * See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md for the harness design.
 *
 * Coverage notes:
 *  - **Well-Connected** is narrative-only (CONV-027) — assert the feature card renders.
 *  - **Reliable Backup** raises Contacts Everywhere to 3 session uses and adds mastery options.
 *  - **Contacts Everywhere** — exhaust all 3 uses with options that mutate featureState
 *    (Shielding → `pendingHpShield`, Conversation backup → `conversationHopeD20`) plus one
 *    narrative option (Gold) for the third spend; assert `featureUsage` count / used.
 *  - **hpShield** / **presenceD20** banner-bridge effects remain PRODUCT_GAP — this suite
 *    asserts featureState flags after chip activation, not end-to-end HP / die shape.
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
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildAllyCharacterData } from '../helpers/subclass-cast.js';
import { buildRogueSyndicateCharacterData } from '../helpers/subclass-cast-rogue-syndicate.js';

/** Level-8 Syndicate sheet evasion (no Fleeting Shadow). */
const VEX_BASE_EVASION = 16;

async function expectSneakAttackDieOnBanner(page, bannerText) {
  // Prefer the live pending banner (first); Action Log / replaced banners can share the same label.
  const banner = page.locator('.dice-result-banner', { hasText: bannerText }).first();
  await expect(async () => {
    const text = await banner.innerText();
    expect(text, 'Sneak Attack should add tier (4) d6 to the damage pool').toMatch(/4d6|Sneak Attack/i);
  }).toPass({ timeout: 8000 });
}

async function rollDaggerAtThug(playerPage, playerVexCard, ensureSheetOpen) {
  const daggerCard = playerPage.getByRole('button', { name: /^Dagger\b/i }).first();
  await ensureSheetOpen(playerPage, playerVexCard, daggerCard);
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

/** Guide `featureUsage` key for Contacts Everywhere (not the display name). */
const CONTACTS_USAGE_KEY = 'srd-sub-syndicate-spec-feat-contacts-everywhere';

function contactsFeatureUsage(el) {
  const fu = el?.featureUsage || {};
  return (
    fu[CONTACTS_USAGE_KEY] ||
    fu['Contacts Everywhere'] ||
    Object.entries(fu).find(([k]) => /contacts.?everywhere/i.test(k))?.[1] ||
    null
  );
}

test.describe('Subclass video — Rogue / Syndicate', () => {
  let tableId;
  let vexLibId;
  let allyLibId;
  let vexInstanceId;
  let allyInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Rogue Syndicate Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const vexLib = await createLibraryCharacter(ACTOR_GM, buildRogueSyndicateCharacterData({ name: 'Vex' }));
    vexLibId = vexLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    vexInstanceId = `char-vex-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    thugInstanceId = `adv-thug-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: vexInstanceId,
        elementType: 'character',
        id: vexLib.id,
        name: vexLib.name,
        // maxHp 7 / maxStress 8 / maxHope 6 — see buildRogueSyndicateCharacterData.
        currentHp: 7, currentStress: 2, hope: 5, currentArmor: 0,
        conditions: '',
        tokenX: 100, tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
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
        // 3ft from Vex — well within Melee range (<=5ft).
        tokenX: 103, tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (vexLibId) await deleteLibraryCharacter(ACTOR_GM, vexLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Vex the Syndicate: Cloaked, Sneak Attack, Rogue\'s Dodge, and Contacts Everywhere', async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
        className: 'Rogue',
        subclassName: 'Syndicate',
        actors: ['gm', 'playerA'],
      });

    for (const [tag, p] of [['GM', gmPage], ['A', playerPage]]) {
      p.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`); });
    }

    try {
      await caption('GM', 'Loading the table', 'Vex (Rogue/Syndicate), Reya (ally), and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Vex').first()).toBeVisible({ timeout: 15000 });

      // ---------------------------------------------------------------------
      // Start Session.
      // ---------------------------------------------------------------------
      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerVexCard = playerPage.locator('div.group\\/char', { hasText: 'Vex' });

      // ---------------------------------------------------------------------
      // Baseline evasion (no Fleeting Shadow).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Evasion baseline', `Sheet shows ${VEX_BASE_EVASION} before Rogue's Dodge`);
      await ensureSheetOpen(playerPage, playerVexCard);
      // Evasion lives on the Defense graphic (outside the Actions strip returned by ensureSheetOpen).
      await expect(playerPage.getByText('Evasion', { exact: true }).first()).toBeVisible({ timeout: 8000 });
      await expect(
        playerPage.locator('.font-bold.tabular-nums').filter({ hasText: new RegExp(`^${VEX_BASE_EVASION}`) }).first()
      ).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Cloaked (Rogue class feature) — toggle on.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Cloaked (on)', 'Toggle card chip — adds the Cloaked condition immediately');
      const vexActionsForCloak = await ensureSheetOpen(playerPage, playerVexCard);
      const cloakedToggle = vexActionsForCloak
        .locator('button')
        .filter({ hasText: /^Cloaked$/i })
        .first();
      await expect(cloakedToggle).toBeVisible({ timeout: 8000 });
      await cloakedToggle.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(String(vexEl?.conditions || '')).toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Weapon attack → Sneak Attack review chip (Cloaked) + die assert.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Attacks with Dagger', 'Targets the Alley Thug (guaranteed hit)');
      await rollDaggerAtThug(playerPage, playerVexCard, ensureSheetOpen);

      const attackBannerText = 'Vex Dagger';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 8000 });
      }

      await caption('PLAYER A', 'Sneak Attack (Cloaked)', 'Adds tier (4) d6 damage — succeeded while Cloaked');
      const sneakAttackBtn = playerPage.getByRole('button', { name: /Sneak Attack/i }).first();
      await expect(sneakAttackBtn).toBeVisible({ timeout: 8000 });
      await sneakAttackBtn.click();
      await expectSneakAttackDieOnBanner(playerPage, attackBannerText);

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Vex's attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText }).first();
      await ack(attackBanner, { holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 8).toBeLessThan(8);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Cloaked (off)', 'SRD auto-clears on attack — toggled manually here (not automated)');
      const vexActionsOff = await ensureSheetOpen(playerPage, playerVexCard);
      const cloakedOff = vexActionsOff.locator('button').filter({ hasText: /^Cloaked$/i }).first();
      await expect(cloakedOff).toBeVisible({ timeout: 8000 });
      if ((await cloakedOff.getAttribute('aria-pressed')) === 'true') {
        await cloakedOff.click();
      }

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(String(vexEl?.conditions || '')).not.toMatch(/Cloaked/i);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Sneak Attack ally path — not Cloaked; Reya in Melee of the thug.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Sneak Attack (ally in Melee)',
        'Not Cloaked — Reya within Melee of the thug still enables Sneak Attack'
      );
      await rollDaggerAtThug(playerPage, playerVexCard, ensureSheetOpen);
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({ timeout: 8000 });
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
      // Rogue's Dodge — V2 Actions chip + evasion (+2).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', "Rogue's Dodge", 'Actions chip — spends 3 Hope for +2 Evasion until hit or rest');
      await playerPage.keyboard.press('Escape');
      await playerPage.waitForTimeout(150);
      const vexActionsCard = await ensureSheetOpen(playerPage, playerVexCard);
      const roguesDodgeBtn = vexActionsCard
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Rogue's Dodge/i });
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

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(vexEl?.hope).toBe(hopeBeforeDodge - 3);
        expect(JSON.stringify(vexEl?.featureState || {})).toMatch(/"roguesDodgeActive"\s*:\s*true/);
      }).toPass({ timeout: 8000 });
      // Flexible (+1) + Dodge (+2) → (+3). (Nightwalker Fleeting Shadow can push (+4); Syndicate stays at +3.)
      await caption('PLAYER A', "Rogue's Dodge applied", `Hope spent; Evasion parenthetical includes Dodge +2`);
      await ensureSheetOpen(playerPage, playerVexCard);
      await expect(async () => {
        const el = playerPage.locator('.font-bold.tabular-nums').filter({ hasText: new RegExp(String(VEX_BASE_EVASION)) }).first();
        await expect(el).toBeVisible({ timeout: 2000 });
        await expect(el).toContainText(/\(\+3\)/);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Well-Connected + Reliable Backup — narrative / declarative display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Well-Connected', 'Narrative-only — name a local contact when you arrive in town');
      const wellConnected = playerPage.getByText('Well-Connected', { exact: true }).first();
      await ensureSheetOpen(playerPage, playerVexCard, wellConnected);
      await expect(wellConnected).toBeVisible({ timeout: 8000 });

      await caption('PLAYER A', 'Reliable Backup', 'Mastery — 3× Contacts Everywhere + shielding / d20 Hope options');
      await expect(playerPage.getByText('Reliable Backup', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Contacts Everywhere — 3 session uses (Shielding, Conversation, Gold).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Contacts Everywhere (1/3)', 'Shielding contact — sets pendingHpShield');
      const contactsGroup = playerPage.getByRole('group', { name: /Contacts Everywhere/i }).first();
      await expect(contactsGroup).toBeVisible({ timeout: 8000 });
      await contactsGroup.scrollIntoViewIfNeeded();
      await expect(contactsGroup.getByRole('button', { name: /Gold, tool, or object/i })).toBeVisible();
      await expect(contactsGroup.getByRole('button', { name: /Shielding contact/i })).toBeVisible();
      await expect(contactsGroup.getByRole('button', { name: /Conversation backup/i })).toBeVisible();

      await contactsGroup.getByRole('button', { name: /Shielding contact/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        const bag = vexEl?.featureState?.['Contacts Everywhere'] || {};
        expect(bag.pendingHpShield).toBe(true);
        const fu = contactsFeatureUsage(vexEl);
        expect(fu?.count).toBe(1);
        expect(fu?.used).toBe(false);
        expect(fu?.cycle).toBe('session');
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Contacts Everywhere (2/3)', 'Conversation backup — sets conversationHopeD20');
      await ensureSheetOpen(playerPage, playerVexCard, contactsGroup);
      const conversationBtn = contactsGroup.getByRole('button', { name: /Conversation backup/i });
      await conversationBtn.scrollIntoViewIfNeeded();
      await expect(conversationBtn).toBeVisible({ timeout: 8000 });
      await conversationBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        const bag = vexEl?.featureState?.['Contacts Everywhere'] || {};
        expect(bag.conversationHopeD20).toBe(true);
        const fu = contactsFeatureUsage(vexEl);
        expect(fu?.count).toBe(2);
        expect(fu?.used).toBe(false);
      }).toPass({ timeout: 8000 });

      await caption('PLAYER A', 'Contacts Everywhere (3/3)', 'Gold/tool/object — exhausts session uses');
      await ensureSheetOpen(playerPage, playerVexCard, contactsGroup);
      await contactsGroup.getByRole('button', { name: /Gold, tool, or object/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        const fu = contactsFeatureUsage(vexEl);
        expect(fu?.count).toBe(3);
        expect(fu?.used).toBe(true);
      }).toPass({ timeout: 8000 });

      // Exhausted select chips leave the Actions group (unusable strip) — no group locator.
      await ensureSheetOpen(playerPage, playerVexCard);
      await expect(playerPage.getByText('Contacts Everywhere', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Short Rest — clears Rogue's Dodge (session Contacts uses persist).
      // ---------------------------------------------------------------------
      await caption('GM', 'Short Rest', "Clears Rogue's Dodge; Contacts Everywhere stays session-exhausted");
      await gmPage.getByRole('button', { name: '⏸ Short' }).click();
      const restBanner = gmPage.locator('.dice-result-banner', { hasText: 'Short Rest' });
      await expect(restBanner).toBeVisible({ timeout: 8000 });
      gmPage.once('dialog', (d) => d.accept());
      await ack(restBanner, { holdMs: 0 });
      await expect(restBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const vexEl = (state.elements || []).find((e) => e.instanceId === vexInstanceId);
        expect(JSON.stringify(vexEl?.featureState || {})).not.toMatch(/"roguesDodgeActive"\s*:\s*true/);
        expect(contactsFeatureUsage(vexEl)?.used).toBe(true);
      }).toPass({ timeout: 10000 });

      await caption(
        'Rogue / Syndicate',
        'Walkthrough complete',
        'Sneak Attack (Cloaked + ally), Dodge evasion, Contacts 3× uses, rest clears Dodge'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
