/**
 * Subclass feature video — Druid / Warden of Renewal.
 *
 * Walks through Clarity of Nature, Regeneration, Regenerative Reach, Warden's
 * Protection, and Defender, plus inherited Druid class features (Beastform,
 * Wildtouch). Three actors: GM, Player A (Reed the Warden), Player B (ally Moss)
 * so Defender can fire on an ally-damage banner (plan multi-user row).
 *
 * Phase 1 TEST_GAP hardening (docs/plans/subclass-video-coverage-gaps.md):
 *  - P0 hard-assert Hope/HP/Stress numbers for Protection + Defender
 *  - P1 Regeneration on ally in Very Close (Regenerative Reach)
 *  - P1 Long Rest refreshes once/long-rest featureUsage
 *  - Beastform Fragile / last-HP auto-drop deferred (PRODUCT_GAP)
 *
 * Coverage notes:
 *  - **Wildtouch / Regenerative Reach** — narrative/display; caption + assert cards render.
 *  - **Beastform** — required for Defender (`table.me.inBeastform`).
 *  - **Clarity of Nature** — card chip posts an actionLoop notification (no dice); no GM Ack.
 *  - **Regeneration** — self + Very Close ally; clears 1d4 HP.
 *  - **Warden's Protection** — Player A via `v2-owned-card-chip` (lesson 7).
 *  - **Defender** — reviewAction chip on adversary attack against Player B.
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
  updateElement,
  cancelAllPendingBanners,
  grantCampaignPassForTable,
  gmRoll,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import { buildDruidWardenOfRenewalCharacterData } from '../helpers/subclass-cast-druid.js';
import { buildAllyCharacterData } from '../helpers/subclass-cast.js';

/** Guide/`featureUsage` keys are often `sub-<Name>-N`, not the bare feature name. */
function featureUsageEntry(featureUsage, nameSubstring) {
  const fu = featureUsage && typeof featureUsage === 'object' ? featureUsage : {};
  const re = new RegExp(nameSubstring, 'i');
  const hit = Object.entries(fu).find(([k]) => re.test(k));
  return hit ? { key: hit[0], entry: hit[1] } : null;
}

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
        // Hope for Regeneration (3) + Very Close Regen (3) + Warden's Protection (2) — refill between.
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
        // Wounded so Warden's Protection / Defender / Very Close Regen have room to heal.
        currentHp: 3,
        currentStress: 2,
        hope: 3,
        currentArmor: 0,
        conditions: '',
        // Start in Melee of Reed; repositioned to Very Close for Regenerative Reach.
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
    const {
      gmPage,
      playerPage,
      playerBPage,
      caption,
      finish,
      ack,
      holdForDiceTumble,
      ensureSheetOpen,
      selectBannerDamageTarget,
    } = await startSubclassRun(browser, {
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
      const clarityBtn = actionsClarity
        .locator('button.dh-sheet-clickable-chip')
        .filter({ hasText: /Clarity of Nature/i });
      await expect(clarityBtn).toBeVisible({ timeout: 8000 });
      await clarityBtn.scrollIntoViewIfNeeded();
      await clarityBtn.click();
      // ActionLoop-only chip — frequency may land under a guide key (`sub-Clarity…`).
      // Hard-assert once/long-rest refresh via Protection + Long Rest below.
      await playerPage.waitForTimeout(500);

      // -----------------------------------------------------------------
      // Regeneration — heal self (own instance; player path OK).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Regeneration', 'Spend 3 Hope — clear 1d4 HP on self');
      const hpBeforeRegen = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === reedInstanceId
      )?.currentHp;
      const hopeBeforeRegen = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === reedInstanceId
      )?.hope;
      const actionsRegen = await ensureSheetOpen(playerPage, playerReedCard);
      const regenGroup = actionsRegen.getByRole('group', { name: /Regeneration targets/i });
      await expect(regenGroup).toBeVisible({ timeout: 8000 });
      await regenGroup.getByRole('button', { name: /Reed/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        expect(reed?.hope, 'Regeneration Hope cost').toBe((hopeBeforeRegen ?? 6) - 3);
        expect(reed?.currentHp, 'Regeneration cleared HP on self').toBeGreaterThan(hpBeforeRegen ?? 4);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Regeneration — Very Close ally (Regenerative Reach at tier ≥ 3).
      // -----------------------------------------------------------------
      await caption('PLAYER A', 'Regeneration (Very Close)', 'Regenerative Reach — Moss outside Melee');
      // Edge distance ~7.5' → Very Close band (Melee ≤5', Very Close ≤10').
      await updateElement(tableId, allyInstanceId, { tokenX: 110, tokenY: 100, currentHp: 2 });
      await updateElement(tableId, reedInstanceId, { hope: 6 });

      const allyHpBeforeVc = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === allyInstanceId
      )?.currentHp;
      const hopeBeforeVc = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === reedInstanceId
      )?.hope;

      const actionsRegenVc = await ensureSheetOpen(playerPage, playerReedCard);
      const regenGroupVc = actionsRegenVc.getByRole('group', { name: /Regeneration targets/i });
      await expect(regenGroupVc).toBeVisible({ timeout: 8000 });
      const mossRegenBtn = regenGroupVc.getByRole('button', { name: /Moss/i });
      await expect(mossRegenBtn, 'Moss in Very Close for Regenerative Reach').toBeVisible({ timeout: 8000 });
      await mossRegenBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        const ally = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        expect(reed?.hope, 'Very Close Regeneration Hope').toBe((hopeBeforeVc ?? 6) - 3);
        expect(ally?.currentHp, 'Very Close Regeneration healed Moss').toBeGreaterThan(allyHpBeforeVc ?? 2);
      }).toPass({ timeout: 8000 });

      // Move Moss back to Close/Melee for Protection + Defender range gates.
      await updateElement(tableId, allyInstanceId, { tokenX: 105, tokenY: 100 });
      await updateElement(tableId, reedInstanceId, { hope: 6 });

      // -----------------------------------------------------------------
      // Warden's Protection — hard-assert Hope −2 and ally HP +2 (capped).
      // -----------------------------------------------------------------
      await caption(
        'PLAYER A',
        "Warden's Protection",
        'Spend 2 Hope — clear 2 HP on ally Moss within Close range'
      );
      const allyHpBeforeProt = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === allyInstanceId
      )?.currentHp;
      const hopeBeforeProt = (await getTableState(tableId)).elements.find(
        (e) => e.instanceId === reedInstanceId
      )?.hope;
      const allyMaxHp =
        (await getTableState(tableId)).elements.find((e) => e.instanceId === allyInstanceId)?.maxHp ?? 6;

      const actionsProtection = await ensureSheetOpen(playerPage, playerReedCard);
      const protectionGroup = actionsProtection.getByRole('group', { name: /Warden's Protection targets/i });
      await expect(protectionGroup).toBeVisible({ timeout: 8000 });
      await protectionGroup.getByRole('button', { name: /Moss/i }).click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const ally = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        expect(reed?.hope, "Warden's Protection Hope cost").toBe((hopeBeforeProt ?? 6) - 2);
        const expectedHp = Math.min(allyMaxHp, (allyHpBeforeProt ?? 3) + 2);
        expect(ally?.currentHp, "Warden's Protection cleared 2 HP on Moss").toBe(expectedHp);
        const prot = featureUsageEntry(reed?.featureUsage, "Warden's Protection");
        expect(prot, 'Protection featureUsage key present').toBeTruthy();
        expect(prot?.entry?.used, 'Protection marked used').toBe(true);
        expect(prot?.entry?.cycle).toBe('longRest');
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
      // Defender — hard-assert +1 Stress on Reed.
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
      await selectBannerDamageTarget(gmPage, gmBanner, /Moss/i);

      await caption('PLAYER A', 'Defender', 'In Beastform — mark Stress to reduce Moss’s pending HP by 1');
      const defenderChip = playerPage.getByRole('button', { name: /^Defender$/i }).first();
      await expect(defenderChip).toBeVisible({ timeout: 10000 });
      await defenderChip.click();

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
        expect(reed?.currentStress, 'Defender Stress cost').toBe((reedStressBefore ?? 0) + 1);
        expect(ally?.currentHp, 'Defender ally took reduced damage').toBeLessThan(allyHpBeforeHit ?? 6);
        expect(ally?.currentHp, 'Defender ally survived').toBeGreaterThan(0);
      }).toPass({ timeout: 8000 });

      // Beastform last-HP / Fragile auto-drop: PRODUCT_GAP (see Elements spec + Phase 2).
      // Drop out manually so Long Rest starts from a clean non-beastform state.
      await caption('PLAYER A', 'Drop out of Beastform', 'Return to normal form before Long Rest');
      const actionsDrop = await ensureSheetOpen(playerPage, playerReedCard);
      const dropBtn = actionsDrop.getByRole('button', { name: /Drop out of .*Beastform/i }).first();
      await expect(dropBtn).toBeVisible({ timeout: 8000 });
      await dropBtn.click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        const bf = reed?.featureState?.['classes:srd-cls-druid']?.activeBeastform;
        expect(bf == null || bf === null).toBe(true);
      }).toPass({ timeout: 8000 });

      // -----------------------------------------------------------------
      // Long Rest — refreshes once/long-rest Clarity + Protection usage.
      // -----------------------------------------------------------------
      await caption('GM', 'Long Rest', 'Refresh Clarity / Warden\'s Protection frequency');
      await updateElement(tableId, reedInstanceId, { currentHp: 4, hope: 3 });

      gmPage.once('dialog', (d) => d.accept());
      await gmPage.getByRole('button', { name: '⏹ Long' }).click();
      const longRestBanner = gmPage.locator('.dice-result-banner', { hasText: /Long Rest/i });
      await expect(longRestBanner).toBeVisible({ timeout: 8000 });
      await ack(longRestBanner, { holdMs: 0 });
      await expect(longRestBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const reed = (state.elements || []).find((e) => e.instanceId === reedInstanceId);
        expect(
          featureUsageEntry(reed?.featureUsage, "Warden's Protection"),
          'Long Rest cleared Protection usage'
        ).toBeNull();
        // Clarity is actionLoop-only; when its usage key is present it must also clear.
        const clarityAfter = featureUsageEntry(reed?.featureUsage, 'Clarity of Nature');
        expect(clarityAfter, 'Long Rest cleared Clarity usage if present').toBeNull();
      }).toPass({ timeout: 10000 });

      await caption('Druid / Warden of Renewal', 'Walkthrough complete', 'Clarity, Regen VC, Protection, Defender, Long Rest');

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
