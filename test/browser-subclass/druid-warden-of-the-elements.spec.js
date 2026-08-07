/**
 * Subclass feature video — Druid / Warden of the Elements.
 *
 * Walks through Elemental Incarnation, Elemental Aura, and Elemental Dominion, plus
 * inherited Druid class features (Beastform, Evolution, Wildtouch). GM + Player A only
 * for most of the walk; an ally token is still placed so Close-range aura copy stays
 * honest. See .cursor/plans/subclass_feature_video_suite_7ff124eb.plan.md.
 *
 * Coverage notes:
 *  - **Wildtouch** — narrative/display only (announce); caption + assert the card renders.
 *  - **Beastform / Evolution** — V2 card `isSelect` (CustomSelect; 24 options at tier 4).
 *    Transform + Drop out exercised via Beastform; Evolution asserts Hope spend + transform.
 *  - **Elemental Incarnation** — `selectPresentation: 'iconGrid'` Fire/Earth/Water/Air.
 *  - **Elemental Aura** — once-per-rest card chip (requires a channeled element first).
 *  - **Elemental Dominion** — mastery card asserted on the sheet; Water reviewAction chip
 *    (Vulnerable attacker) exercised when an adversary attack succeeds against Elm while
 *    Channeling Water.
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
import { buildDruidWardenOfTheElementsCharacterData } from '../helpers/subclass-cast-druid.js';
import { buildAllyCharacterData } from '../helpers/subclass-cast.js';

test.describe('Subclass video — Druid / Warden of the Elements', () => {
  let tableId;
  let elmLibId;
  let allyLibId;
  let elmInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Druid Warden of the Elements Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const elmLib = await createLibraryCharacter(
      ACTOR_GM,
      buildDruidWardenOfTheElementsCharacterData({ name: 'Elm' })
    );
    elmLibId = elmLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Moss' }));
    allyLibId = allyLib.id;

    elmInstanceId = `char-elm-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-goblin-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: elmInstanceId,
        elementType: 'character',
        id: elmLib.id,
        name: elmLib.name,
        // Room for Beastform Stress + Incarnation Stress; full Hope for Evolution (3 Hope).
        currentHp: 7,
        currentStress: 0,
        hope: 6,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: allyInstanceId,
        elementType: 'character',
        id: allyLib.id,
        name: allyLib.name,
        currentHp: 6,
        currentStress: 0,
        hope: 3,
        currentArmor: 0,
        conditions: '',
        tokenX: 105,
        tokenY: 100,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Snarling Goblin',
        tier: 1,
        // Difficulty 1 so Water Dominion's `anAttackSucceeds` gate always opens.
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        // Melee of Elm (Fire retaliation / Water Dominion reposition range).
        tokenX: 103,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (elmLibId) await deleteLibraryCharacter(ACTOR_GM, elmLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Elm the Warden of the Elements: Incarnation, Aura, Dominion, Beastform, Evolution', async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Druid',
      subclassName: 'Warden of the Elements',
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
      await caption('GM', 'Loading the table', 'Elm (Druid/Warden of the Elements), Moss, Snarling Goblin');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Elm').first()).toBeVisible({ timeout: 15000 });

      for (const p of [gmPage, playerPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerElmCard = playerPage.locator('div.group\\/char', { hasText: 'Elm' });
      // Card chips live in the sheet's Actions emphasis card — bare name matches also hit
      // Features accordion headers. Sidebar card click *toggles* the sheet: only click when
      // Actions is not already visible (display-only steps do not auto-dismiss the sheet).
      const actionsLocator = () =>
        playerPage
          .locator('div.rounded-xl')
          .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
          .first();
      const ensurePlayerSheet = async () => {
        const actions = actionsLocator();
        if (!(await actions.isVisible().catch(() => false))) {
          await playerElmCard.click();
        }
        await expect(actions).toBeVisible({ timeout: 8000 });
        return actions;
      };

      // -----------------------------------------------------------------
      // Wildtouch — narrative/display only.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Wildtouch', 'Narrative class feature — assert card renders');
      await ensurePlayerSheet();
      await expect(playerPage.getByText(/Wildtouch/i).first()).toBeVisible({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Elemental Incarnation — channel Fire (iconGrid).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Fire)', 'Mark 1 Stress to Channel Fire');
      const actionsForFire = await ensurePlayerSheet();
      const fireBtn = actionsForFire.getByRole('button', { name: /^Fire$/i });
      await expect(fireBtn).toBeVisible({ timeout: 8000 });
      await fireBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement).toBe('fire');
        expect(elm?.currentStress).toBeGreaterThanOrEqual(1);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Elemental Aura — once per rest while Channeling.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Aura', 'Assume Fire aura until Channeling ends');
      const actionsForAura = await ensurePlayerSheet();
      // Prefer the Actions strip chip (`dh-sheet-clickable-chip`) — Features accordion
      // headers also match `/Elemental Aura/i` (e.g. "Elemental Aura Before a roll").
      const auraBtn = actionsForAura
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Elemental Aura/i });
      await expect(auraBtn).toBeVisible({ timeout: 8000 });
      await auraBtn.scrollIntoViewIfNeeded();
      await auraBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.auraActive).toBe(true);
        expect(elm?.featureState?.WardenOfTheElements?.auraUsedThisRest).toBe(true);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Elemental Dominion — mastery card on the sheet (Fire bonus is onIntent).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Dominion', 'Mastery feature card (Fire +Proficiency on damage)');
      await ensurePlayerSheet();
      await expect(playerPage.getByText(/Elemental Dominion/i).first()).toBeVisible({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Beastform / Evolution — CustomSelect from the player's Actions strip.
      // (Helper opens the portaled option list and picks Agile Scout.)
      // -----------------------------------------------------------------
      // CustomSelect options are portaled to body; must use the outside-dismiss-exempt
      // portal (see subclass-video-test-plan.md lesson 18 / useHoverOverlay).
      const pickBeastformOption = async (page, trigger) => {
        await expect(trigger).toBeVisible({ timeout: 8000 });
        // Soft-blocked selects open the menu but ignore option clicks — fail loudly.
        await expect(trigger).not.toHaveAttribute('aria-disabled', 'true');
        await trigger.click();
        const opt = page
          .locator('[data-dh-outside-dismiss-exempt]')
          .getByRole('button', { name: /^Agile Scout$/i });
        await expect(opt).toBeVisible({ timeout: 5000 });
        await opt.click();
      };

      await caption('PLAYER A', 'Beastform', 'Mark 1 Stress — transform into Agile Scout');
      const actionsForBf = await ensurePlayerSheet();
      await pickBeastformOption(
        playerPage,
        actionsForBf.getByRole('button', { name: 'Beastform 1 Stress', exact: true })
      );

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf =
          elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform || elm?.activeBeastform;
        expect(bf?.beastformId || bf?.id).toBe('srd-bst-agile-scout');
        expect(bf?.viaEvolution === true).toBe(false);
      }).toPass({ timeout: 10000 });

      await caption('PLAYER A', 'Drop out of Beastform', 'Return to normal form');
      const actionsForDrop = await ensurePlayerSheet();
      const dropBtn = actionsForDrop.getByRole('button', { name: /Drop out of .*Beastform/i }).first();
      await expect(dropBtn).toBeVisible({ timeout: 8000 });
      await dropBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf = elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform;
        expect(bf == null || bf === null).toBe(true);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Evolution — spend 3 Hope to transform without Stress.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Evolution', 'Spend 3 Hope — Beastform without marking Stress');
      const hopeBeforeEvo = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === elmInstanceId
      )?.hope;
      const actionsForEvo = await ensurePlayerSheet();
      await pickBeastformOption(
        playerPage,
        actionsForEvo.getByRole('button', { name: /^Evolution/i }).filter({ hasNotText: /Druid/i })
      );

      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf =
          elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform || elm?.activeBeastform;
        expect(bf?.beastformId || bf?.id).toBe('srd-bst-agile-scout');
        expect(bf?.viaEvolution).toBe(true);
        expect(elm?.hope).toBe((hopeBeforeEvo ?? 6) - 3);
      }).toPass({ timeout: 10000 });

      // Drop out again so Water Dominion demo is not blocked by beastform weapon UI.
      const actionsForDrop2 = await ensurePlayerSheet();
      await actionsForDrop2.getByRole('button', { name: /Drop out of .*Beastform/i }).first().click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        const bf = elm?.featureState?.['classes:srd-cls-druid']?.activeBeastform;
        expect(bf == null || bf === null).toBe(true);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Re-channel Water, then adversary hits Elm → Elemental Dominion (Water)
      // reviewAction chip makes the attacker Vulnerable.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Elemental Incarnation (Water)', 'Re-channel Water for Dominion chip');
      const actionsForWater = await ensurePlayerSheet();
      await actionsForWater.getByRole('button', { name: /^Water$/i }).click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const elm = (state.elements || []).find((e) => e.instanceId === elmInstanceId);
        expect(elm?.featureState?.WardenOfTheElements?.channeledElement).toBe('water');
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Goblin attacks Elm', 'Guaranteed hit — surfaces Elemental Dominion (Water)');
      await gmRoll(
        tableId,
        'Snarling Goblin Claw [d20+10] damage [1d8] phy',
        'Snarling Goblin',
        {
          _attackerInstanceId: advInstanceId,
          _attackerType: 'adversary',
          _selectedTargetInstanceId: elmInstanceId,
          _attackRangeFt: 5,
        }
      );

      const atkBannerText = 'Snarling Goblin';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: atkBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Ensure the banner's selected target is Elm (chip gate + synthetic effects).
      const gmBanner = gmPage.locator('.dice-result-banner', { hasText: atkBannerText });
      const elmTargetChip = gmBanner.getByRole('button', { name: /Elm/i }).first();
      if (await elmTargetChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await elmTargetChip.click();
      }

      await caption('PLAYER A', 'Elemental Dominion (Water)', 'Mark Stress — attacker becomes Vulnerable');
      const dominionWater = playerPage.getByRole('button', { name: /Elemental Dominion \(Water\)/i }).first();
      await expect(dominionWater).toBeVisible({ timeout: 10000 });
      await dominionWater.click();
      // selectTargets Confirm path — if a Confirm button appears, click it.
      const confirmBtn = playerPage.getByRole('button', { name: /^Confirm$/i }).first();
      if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await caption('GM', 'Acknowledges the Goblin attack', '');
      await gmBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(gmBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const adv = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(String(adv?.conditions || '')).toMatch(/Vulnerable/i);
      }).toPass({ timeout: 8000 });

      await caption('Druid / Warden of the Elements', 'Walkthrough complete', 'Incarnation, Aura, Dominion, Beastform, Evolution');

      const seriousErrors = consoleErrors.filter(
        (e) =>
          !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*(403|404)/i.test(
            e
          )
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
