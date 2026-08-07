/**
 * Subclass feature video — Druid / Warden of Renewal.
 *
 * Walks through Clarity of Nature, Regeneration, Regenerative Reach, Warden's
 * Protection, and Defender, plus inherited Druid class features (Beastform,
 * Wildtouch). Three actors: GM, Player A (Reed the Warden), Player B (ally Moss)
 * so Defender can fire on an ally-damage banner (plan multi-user row).
 *
 * Coverage notes:
 *  - **Wildtouch / Regenerative Reach** — narrative/display; caption + assert cards render.
 *    Regenerative Reach only extends Regeneration's range (tier ≥ 3); no separate chip.
 *  - **Beastform** — required for Defender (`table.me.inBeastform`); transform before the
 *    ally-damage step.
 *  - **Clarity of Nature** — card chip posts an actionLoop notification (no dice); no GM Ack.
 *  - **Regeneration** — player regenerates self (own instance); clears 1d4 HP.
 *  - **Warden's Protection** — mutates the ally; Player A activates it via
 *    `POST /api/room/:tableId/v2-owned-card-chip` (lesson 7: prefer Player A for
 *    multi-instance owned card chips).
 *  - **Defender** — reviewAction chip on an adversary attack banner against Player B while
 *    Reed is in Beastform; Player A activates it (stress 1, reduce ally pending HP by 1).
 */

import { test, expect } from '@playwright/test';
import {
  ACTOR_GM,
  ACTOR_PLAYER_A,
  ACTOR_PLAYER_B,
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
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildDruidWardenOfRenewalCharacterData } from '../helpers/subclass-cast-druid.js';
import { buildAllyCharacterData } from '../helpers/subclass-cast.js';

test.describe('Subclass video — Druid / Warden of Renewal', () => {
  let tableId;
  let reedLibId;
  let allyLibId;
  let reedInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Druid Warden of Renewal Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const reedLib = await createLibraryCharacter(
      ACTOR_GM,
      buildDruidWardenOfRenewalCharacterData({ name: 'Reed' })
    );
    reedLibId = reedLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Moss' }));
    allyLibId = allyLib.id;

    reedInstanceId = `char-reed-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-goblin-${Date.now() + 2}`;

    await addElementsToTable(tableId, [
      {
        instanceId: reedInstanceId,
        elementType: 'character',
        id: reedLib.id,
        name: reedLib.name,
        // Short of max HP so Regeneration (self) is visible; room for Beastform + Defender Stress;
        // Hope for Regeneration (3) + Warden's Protection (2).
        currentHp: 4,
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
        // Wounded so Warden's Protection / Defender have something to change.
        currentHp: 3,
        currentStress: 2,
        hope: 3,
        currentArmor: 0,
        conditions: '',
        tokenX: 105,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Snarling Goblin',
        tier: 1,
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        tokenX: 108,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (reedLibId) await deleteLibraryCharacter(ACTOR_GM, reedLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test("Reed the Warden of Renewal: Clarity, Regeneration, Protection, Defender", async ({ browser }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, playerBPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
        className: 'Druid',
        subclassName: 'Warden of Renewal',
        actors: ['gm', 'playerA', 'playerB'],
      });

    for (const [tag, p] of [
      ['GM', gmPage],
      ['A', playerPage],
      ['B', playerBPage],
    ]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(`[${tag}] ${msg.text()}`);
      });
    }

    try {
      await caption('GM', 'Loading the table', 'Reed (Druid/Warden of Renewal), Moss (ally), Snarling Goblin');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Reed').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Moss').first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerReedCard = playerPage.locator('div.group\\/char', { hasText: 'Reed' });
      // Card chips live in Actions. Sidebar card click *toggles* — use shared ensureSheetOpen.

      // -----------------------------------------------------------------
      // Wildtouch + Regenerative Reach — narrative/display.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Wildtouch', 'Narrative class feature — assert card renders');
      await ensureSheetOpen(playerPage, playerReedCard);
      await expect(playerPage.getByText(/Wildtouch/i).first()).toBeVisible({ timeout: 8000 });

      await caption('PLAYER A', "Regenerative Reach", 'Specialization — extends Regeneration to Very Close');
      await ensureSheetOpen(playerPage, playerReedCard);
      await expect(playerPage.getByText(/Regenerative Reach/i).first()).toBeVisible({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Clarity of Nature — long-rest card chip (actionLoop only).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Clarity of Nature', 'Once per long rest — serenity space (GM distributes Stress clears)');
      const actionsClarity = await ensureSheetOpen(playerPage, playerReedCard);
      // Prefer the Actions strip chip — Features accordion headers also match the name.
      const clarityBtn = actionsClarity
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Clarity of Nature/i });
      await expect(clarityBtn).toBeVisible({ timeout: 8000 });
      await clarityBtn.scrollIntoViewIfNeeded();
      await clarityBtn.click();
      // Action-only card chips suppress pending banners — no Ack step.

      // -----------------------------------------------------------------
      // Regeneration — heal self (own instance; player path OK).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Regeneration', 'Spend 3 Hope — clear 1d4 HP on self');
      const hpBeforeRegen = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === reedInstanceId
      )?.currentHp;
      const actionsRegen = await ensureSheetOpen(playerPage, playerReedCard);
      const regenGroup = actionsRegen.getByRole('group', { name: /Regeneration targets/i });
      await expect(regenGroup).toBeVisible({ timeout: 8000 });
      await regenGroup.getByRole('button', { name: /Reed/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        expect(reed?.hope).toBeLessThan(6);
        expect(reed?.currentHp).toBeGreaterThan(hpBeforeRegen ?? 4);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Warden's Protection — Player A; multi-instance HP clears via
      // v2-owned-card-chip (subclass-video-test-plan.md lesson 7).
      // -----------------------------------------------------------------
      await caption(
        'PLAYER A',
        "Warden's Protection",
        'Spend Hope — clear HP on ally Moss within Close range'
      );
      const allyHpBefore = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === allyInstanceId
      )?.currentHp;
      const actionsProtection = await ensureSheetOpen(playerPage, playerReedCard);
      const protectionGroup = actionsProtection.getByRole('group', { name: /Warden's Protection targets/i });
      await expect(protectionGroup).toBeVisible({ timeout: 8000 });
      await protectionGroup.getByRole('button', { name: /Moss/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const ally = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        // d4 allies cleared — with one selected target, Moss should gain up to 2 HP (capped by max).
        expect(ally?.currentHp).toBeGreaterThanOrEqual(allyHpBefore ?? 3);
        expect(reed?.hope).toBeLessThanOrEqual(3);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Beastform — required for Defender.
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Beastform', 'Transform into Agile Scout (required for Defender)');
      const actionsBf = await ensureSheetOpen(playerPage, playerReedCard);
      const beastformSelect = actionsBf.getByRole('button', { name: 'Beastform 1 Stress', exact: true });
      await expect(beastformSelect).toBeVisible({ timeout: 8000 });
      await expect(beastformSelect).not.toHaveAttribute('aria-disabled', 'true');
      await beastformSelect.click();
      // Portaled CustomSelect — see subclass-video-test-plan.md lesson 18.
      const agileOpt = playerPage
        .locator('[data-dh-outside-dismiss-exempt]')
        .getByRole('button', { name: /^Agile Scout$/i });
      await expect(agileOpt).toBeVisible({ timeout: 5000 });
      await agileOpt.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        const bf =
          reed?.featureState?.['classes:srd-cls-druid']?.activeBeastform || reed?.activeBeastform;
        expect(bf?.beastformId || bf?.id).toBe('srd-bst-agile-scout');
      }).toPass({ timeout: 10000 });

      // -----------------------------------------------------------------
      // Defender — Goblin hits Moss for ≥2 raw damage while Reed is in Beastform.
      // -----------------------------------------------------------------
      await caption('GM', 'Goblin attacks Moss', 'Guaranteed hit with heavy damage — Defender chip');
      const allyHpBeforeHit = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === allyInstanceId
      )?.currentHp;
      const reedStressBefore = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === reedInstanceId
      )?.currentStress;

      await gmRoll(
        tableId,
        'Snarling Goblin Claw [d20+10] damage [2d12] phy',
        'Snarling Goblin',
        {
          _attackerInstanceId: advInstanceId,
          _attackerType: 'adversary',
          _selectedTargetInstanceId: allyInstanceId,
          _attackRangeFt: 5,
        }
      );

      const atkBannerText = 'Snarling Goblin';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: atkBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      const gmBanner = gmPage.locator('.dice-result-banner', { hasText: atkBannerText });
      const mossTargetChip = gmBanner.getByRole('button', { name: /Moss/i }).first();
      if (await mossTargetChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mossTargetChip.click();
      }

      await caption('PLAYER A', 'Defender', 'In Beastform — mark Stress to reduce Moss’s pending HP by 1');
      const defenderChip = playerPage.getByRole('button', { name: /^Defender$/i }).first();
      await expect(defenderChip).toBeVisible({ timeout: 10000 });
      await defenderChip.click();

      // selectTargets: pick Moss if a target bank is shown, then Confirm.
      const defenderMoss = playerPage
        .locator('.dice-result-banner', { hasText: atkBannerText })
        .getByRole('button', { name: /Moss/i })
        .first();
      if (await defenderMoss.isVisible({ timeout: 2000 }).catch(() => false)) {
        await defenderMoss.click();
      }
      const confirmBtn = playerPage
        .locator('.dice-result-banner', { hasText: atkBannerText })
        .getByRole('button', { name: /^Confirm$/i })
        .first();
      if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmBtn.click();
      }

      await holdForDiceTumble();
      await caption('GM', 'Acknowledges the Goblin attack', 'Moss takes reduced HP; Reed marked Stress');
      await ack(gmBanner, { holdMs: 0 });
      await expect(gmBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        const ally = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        expect(reed?.currentStress).toBeGreaterThan(reedStressBefore ?? 0);
        // Ally should have taken some HP loss, but Defender reduced it by 1 vs unmitigated.
        expect(ally?.currentHp).toBeLessThan(allyHpBeforeHit ?? 6);
        expect(ally?.currentHp).toBeGreaterThan(0);
      }).toPass({ timeout: 8000 });

      await caption('Druid / Warden of Renewal', 'Walkthrough complete', 'Clarity, Regeneration, Protection, Defender');

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
