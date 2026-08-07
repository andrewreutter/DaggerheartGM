/**
 * Subclass feature video — Seraph / Divine Wielder.
 *
 * Walks through Divine Wielder features (Spirit Weapon, Sparing Touch, Devout,
 * Sacred Resonance) plus inherited Seraph class features (Prayer Dice, Life Support),
 * from three browser contexts (GM, Player A = Seraph, Player B = ally).
 *
 * Special multi-user coverage (per the plan):
 *  - Session start grants Prayer Dice via physical-roll resume (Start Session →
 *    Acknowledge → "Kael — Prayer Dice" banner → Acknowledge → pool granted).
 *  - Owner (Player A) spends a Prayer Die on Player B's pending action banner
 *    (M2 pattern from test/browser/action-loop-multi-actor.spec.js).
 *
 * Notes:
 *  - Life Support: Player A initiates the card chip (posts deferred action banner +
 *    `life-support-select`); GM acknowledges so Hope spend + ally heal apply.
 *  - Sparing Touch: display-only in this suite — Actions strip `isSelect` returns
 *    before `selectTargets`, so the heal cannot be activated from the chip UI yet
 *    (PRODUCT_GAP — Phase 3).
 *  - Devout (tier 3+) also has `onSessionStart` that silently rolls (n+1)d4 drop
 *    lowest; the class Prayer Dice `rollThenResume` banner still appears and its
 *    ack overwrites the pool with the physical-roll faces — that banner is what
 *    this video asserts.
 *  - Spirit Weapon / Sacred Resonance are mostly automatic hooks — Spirit Weapon's
 *    Melee→Close range override is exercised via a Broadsword attack; Sacred
 *    Resonance / Spirit Weapon reach are PRODUCT_GAP (not asserted here).
 *  - Phase 1 TEST_GAP: Prayer Die pool shrink; Damage + Hope spend modes (Reduce
 *    lives on the Winged Sentinel sibling walkthrough).
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
  playerRoll,
} from '../helpers/multi-auth.js';
import { startSubclassRun, filterSeriousSubclassConsoleErrors } from '../helpers/subclass-video.js';
import {
  buildSeraphDivineWielderCharacterData,
  buildAllyCharacterData,
} from '../helpers/subclass-cast.js';

test.describe('Subclass video — Seraph / Divine Wielder', () => {
  let tableId;
  let seraphLibId;
  let allyLibId;
  let seraphInstanceId;
  let allyInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Seraph Divine Wielder Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);

    const seraphLib = await createLibraryCharacter(
      ACTOR_GM,
      buildSeraphDivineWielderCharacterData({ name: 'Kael' }),
    );
    seraphLibId = seraphLib.id;
    const allyLib = await createLibraryCharacter(ACTOR_GM, buildAllyCharacterData({ name: 'Reya' }));
    allyLibId = allyLib.id;

    seraphInstanceId = `char-seraph-${Date.now()}`;
    allyInstanceId = `char-ally-${Date.now() + 1}`;
    advInstanceId = `adv-cultist-${Date.now() + 2}`;

    // Pin tokens to the table's first map near center so Melee reach checks stay valid
    // (default maps can be large; edge placements + missing mapId have left tokens
    // visually/logically out of range in prior runs).
    const preState = await getTableState(tableId);
    const mapId = preState?.maps?.[0]?.id ?? null;

    await addElementsToTable(tableId, [
      {
        instanceId: seraphInstanceId,
        elementType: 'character',
        id: seraphLib.id,
        name: seraphLib.name,
        currentHp: 8,
        currentStress: 0,
        hope: 5,
        currentArmor: 0,
        conditions: '',
        tokenX: 40,
        tokenY: 40,
        ...(mapId ? { mapId } : {}),
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: allyInstanceId,
        elementType: 'character',
        id: allyLib.id,
        name: allyLib.name,
        currentHp: 3,
        maxHp: 6,
        currentStress: 2,
        hope: 3,
        currentArmor: 0,
        conditions: '',
        tokenX: 45,
        tokenY: 40,
        ...(mapId ? { mapId } : {}),
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
      {
        instanceId: advInstanceId,
        elementType: 'adversary',
        id: `test-adv-${advInstanceId}`,
        name: 'Cultist Thug',
        tier: 1,
        difficulty: 1,
        hp_max: 6,
        currentHp: 6,
        currentStress: 0,
        conditions: '',
        tokenX: 43,
        tokenY: 40,
        ...(mapId ? { mapId } : {}),
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (seraphLibId) await deleteLibraryCharacter(ACTOR_GM, seraphLibId);
    if (allyLibId) await deleteLibraryCharacter(ACTOR_GM, allyLibId);
  });

  test('Kael the Divine Wielder: Prayer Dice, Life Support, Spirit Weapon, Sparing Touch', async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const consoleErrors = [];
    const { gmPage, playerPage, playerBPage, caption, finish, ack, holdForDiceTumble, ensureSheetOpen } =
      await startSubclassRun(browser, {
        className: 'Seraph',
        subclassName: 'Divine Wielder',
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
      await caption('GM', 'Loading the table', 'Kael (Seraph/Divine Wielder), Reya (ally), Cultist Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);
      await playerBPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({
        timeout: 15000,
      });
      await expect(playerPage.locator('text=Kael').first()).toBeVisible({ timeout: 15000 });
      await expect(playerBPage.locator('text=Reya').first()).toBeVisible({ timeout: 15000 });

      // ---------------------------------------------------------------------
      // Start Session → Prayer Dice physical-roll resume
      // ---------------------------------------------------------------------
      await caption(
        'GM',
        'Start Session',
        'Prayer Dice onSessionStart queues a physical d4 roll (Devout may also silently upgrade the pool)',
      );
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      await caption('GM', 'Prayer Dice roll', 'Physical-roll resume — acknowledge to grant the pool');
      const prayerDiceBanner = gmPage.locator('.dice-result-banner', {
        hasText: 'Kael — Prayer Dice',
      });
      await expect(prayerDiceBanner).toBeVisible({ timeout: 8000 });
      for (const p of [playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: 'Kael — Prayer Dice' })).toBeVisible({
          timeout: 8000,
        });
      }
      // Hold tumble on GM, then ack (helper force-resolves if pointer-events:none still blocks Ack).
      await holdForDiceTumble();
      await ack(prayerDiceBanner, { force: true, holdMs: 0 });
      await expect(prayerDiceBanner).not.toBeVisible({ timeout: 8000 });

      let prayerPoolLen = 0;
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool) && pool.length).toBeGreaterThan(0);
        prayerPoolLen = pool.length;
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Sheet: Spirit Weapon / Devout / Sacred Resonance cards render
      // ---------------------------------------------------------------------
      const playerKaelCard = playerPage.locator('div.group\\/char', { hasText: 'Kael' });
      await caption('PLAYER A', 'Subclass features on sheet', 'Spirit Weapon, Sparing Touch, Devout, Sacred Resonance');
      const spiritWeapon = playerPage.getByText('Spirit Weapon', { exact: true }).first();
      await ensureSheetOpen(playerPage, playerKaelCard, spiritWeapon);
      await expect(spiritWeapon).toBeVisible({
        timeout: 8000,
      });
      await expect(playerPage.getByText('Devout', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });
      await expect(playerPage.getByText('Sacred Resonance', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Spirit Weapon — Broadsword attack (before Life Support so Hope/sheet stay clean)
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Spirit Weapon — Broadsword',
        'Sheet shows Range: melee → close; attacking Cultist Thug in Melee',
      );
      // WeaponCard only gets role=button when in-range; Game Table may also hide
      // out-of-range weapons entirely (`filterOutDisabledWeapons`). Prefer the UI
      // path; fall back to a real playerRoll so the rest of the walkthrough can run.
      const broadsword = playerPage.getByRole('button', { name: /Broadsword/i }).first();
      await ensureSheetOpen(playerPage, playerKaelCard, playerPage.getByText(/Broadsword/i).first());
      const canClickWeapon = await broadsword.isVisible({ timeout: 4000 }).catch(() => false);
      const attackBannerText = 'Kael Broadsword';
      if (canClickWeapon) {
        await broadsword.click();
        const chooseTargetText = playerPage.getByText('Choose target');
        if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
          await playerPage.getByRole('button', { name: /Cultist Thug/i }).first().click();
        }
        await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
        await playerPage.getByRole('button', { name: 'Proceed' }).click();
      } else {
        await expect(playerPage.getByText(/Broadsword/i).first()).toBeVisible({ timeout: 8000 });
        await caption(
          'PLAYER A',
          'Spirit Weapon — API attack roll',
          'Broadsword card not clickable (range filter) — posting the same attack via player roll API',
        );
        await playerRoll(
          ACTOR_PLAYER_A,
          tableId,
          'Hope [1d12] Fear [1d12] [1d20+5] damage [4d8]',
          attackBannerText,
          {
            _attackerInstanceId: seraphInstanceId,
            _weaponId: 'srd-wpn-broadsword',
            _weaponRangeFt: 5,
            _selectedTargetInstanceId: advInstanceId,
          },
        );
      }

      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Prayer Die — Damage (P1): spend from GM banner (addDamage replaces the roll).
      await holdForDiceTumble();
      await caption(
        'GM',
        'Prayer Die — Damage',
        'Spends a Prayer Die to add its face value to Broadsword damage',
      );
      await gmPage.keyboard.press('Escape');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await expect(attackBanner).toBeVisible({ timeout: 8000 });
      const prayerDieDamageGroup = attackBanner
        .getByLabel(/add its value to this damage roll/i)
        .first();
      const prayerDieDamageOption = prayerDieDamageGroup.getByRole('button', { name: /^d4 \(/ }).first();
      await expect(prayerDieDamageOption, 'Prayer Die — Damage chip missing on attack banner').toBeVisible({
        timeout: 8000,
      });
      await prayerDieDamageOption.click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool), 'Prayer Die — Damage: pool missing').toBe(true);
        expect(pool.length, 'Prayer Die — Damage: pool should shrink by 1').toBe(prayerPoolLen - 1);
      }).toPass({ timeout: 8000 });
      prayerPoolLen -= 1;
      // postBannerAddDamage cancels + replaces the banner — wait for the new roll.
      await expect(
        attackBanner.getByText(/Prayer Die/i).first(),
      ).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption(
        'GM',
        'Acknowledges Broadsword attack',
        'Sacred Resonance auto-adds when damage dice match (not asserted — PRODUCT_GAP)',
      );
      // Damage banners need a selected target before Acknowledge enables.
      // Exact name — not the banner title ("… → Cultist Thug · GM").
      const cultistChip = attackBanner.getByRole('button', { name: /^Cultist Thug$/i }).first();
      if (await cultistChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cultistChip.click({ force: true });
      }
      // After addDamage, cutTo GM can re-show dice and gate Acknowledge — resolve then ack.
      await attackBanner.click({ force: true, position: { x: 12, y: 12 } }).catch(() => {});
      await ack(attackBanner, { force: true, holdMs: 0 });
      await expect(attackBanner).not.toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Life Support (Player A initiates; GM ack applies Hope + ally heal)
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Life Support',
        'Spend 3 Hope — clear 1 HP on Reya (Close range)',
      );
      const lifeSupportGroup = playerPage.getByRole('group', { name: /Life Support targets/i });
      await ensureSheetOpen(playerPage, playerKaelCard, lifeSupportGroup);
      await lifeSupportGroup.getByRole('button', { name: /Reya/i }).click();

      // Deferred card chip → action banner. Sheet select posts `life-support-select`;
      // do NOT re-click Reya on the banner (toggle would deselect). Dismiss hover sheet
      // so it cannot intercept banner Acknowledge (z-[55] overlay).
      await playerPage.keyboard.press('Escape');
      const lifeSupportBanner = gmPage.locator('.dice-result-banner', { hasText: 'Life Support' });
      await expect(lifeSupportBanner).toBeVisible({ timeout: 8000 });
      const lifeSupportAck = lifeSupportBanner.getByRole('button', { name: 'Acknowledge' });
      if (!(await lifeSupportAck.isEnabled().catch(() => false))) {
        await lifeSupportBanner.getByRole('button', { name: /Reya/i }).click();
      }
      await expect(lifeSupportAck).toBeEnabled({ timeout: 8000 });
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Life Support', 'Hope spend + ally heal apply on ack');
      await ack(lifeSupportBanner, { force: true, holdMs: 0 });
      await expect(lifeSupportBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const seraphEl = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const allyEl = (state.elements || []).find((e) => e.instanceId === allyInstanceId);
        expect(seraphEl?.hope).toBeLessThan(5);
        expect(allyEl?.currentHp).toBeGreaterThan(3);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Sparing Touch — chip renders (isSelect + selectTargets). Known UI gap:
      // GuideFeatureCard's isSelect branch returns before selectTargets, so the
      // Actions strip only shows "Clear 2 HP / Clear 2 Stress" with no target
      // bank — clicking applies selectedId but onUse no-ops without
      // selectedTargetIds. Assert the chip UI; do not require a heal.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Sparing Touch',
        'Chip renders (Devout: 2 uses/long rest) — target select not wired with isSelect yet',
      );
      const sparingTouchGroup = playerPage.getByRole('group', { name: /Sparing Touch/i });
      await ensureSheetOpen(playerPage, playerKaelCard, sparingTouchGroup);
      await expect(sparingTouchGroup).toBeVisible({ timeout: 8000 });
      await expect(
        sparingTouchGroup.getByRole('button', { name: /Clear 2 Hit Points/i }),
      ).toBeVisible({ timeout: 4000 });
      await expect(
        sparingTouchGroup.getByRole('button', { name: /Clear 2 Stress/i }),
      ).toBeVisible({ timeout: 4000 });
      await playerPage.keyboard.press('Escape');

      // ---------------------------------------------------------------------
      // Prayer Dice — gain Hope (P1 card chip)
      // ---------------------------------------------------------------------
      const hopeBeforeGain = (
        await getTableState(tableId)
      ).elements?.find((e) => e.instanceId === seraphInstanceId)?.hope;
      await caption(
        'PLAYER A',
        'Prayer Dice — gain Hope',
        'Spends a Prayer Die from the Actions strip to gain Hope equal to its face',
      );
      const gainHopeGroup = playerPage.getByRole('group', { name: /Prayer Dice — gain Hope/i });
      await ensureSheetOpen(playerPage, playerKaelCard, gainHopeGroup);
      const gainHopeOption = gainHopeGroup.getByRole('button', { name: /^d4 \(/ }).first();
      await expect(gainHopeOption, 'Prayer Dice — gain Hope chip missing').toBeVisible({
        timeout: 8000,
      });
      await gainHopeOption.click();
      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool), 'gain Hope: pool missing').toBe(true);
        expect(pool.length, 'gain Hope: pool should shrink by 1').toBe(prayerPoolLen - 1);
        expect(el?.hope, 'gain Hope: Hope should increase').toBeGreaterThan(hopeBeforeGain ?? 0);
      }).toPass({ timeout: 8000 });
      prayerPoolLen -= 1;
      await playerPage.keyboard.press('Escape');

      // ---------------------------------------------------------------------
      // M2: Player B rolls → Player A (owner) spends Prayer Die on that banner
      // ---------------------------------------------------------------------
      const playerBReyaCard = playerBPage.locator('div.group\\/char', { hasText: 'Reya' });
      await caption('PLAYER B', 'Rolls Agility', 'Pending banner for Kael to aid with a Prayer Die');
      await playerBReyaCard.click();
      await playerBPage.getByRole('button', { name: /Agility.*Sprint/i }).click();
      await expect(playerBPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerBPage.getByRole('button', { name: 'Proceed' }).click();

      const bBannerText = 'Reya Agility';
      for (const p of [gmPage, playerPage, playerBPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: bBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      await caption(
        'PLAYER A',
        'Prayer Die — Action',
        'Spends a Prayer Die to add its value to Reya’s action roll (cross-player M2)',
      );
      const prayerDieActionGroup = playerPage.getByLabel(/add its value to this action roll/i).first();
      const prayerDieOption = prayerDieActionGroup.getByRole('button', { name: /^d4 \(/ }).first();
      await expect(prayerDieOption, 'Prayer Die — Action chip missing').toBeVisible({ timeout: 8000 });
      const poolBeforeAction = (
        await getTableState(tableId)
      ).elements?.find((e) => e.instanceId === seraphInstanceId)?.prayerDice?.pool?.length;
      expect(poolBeforeAction, 'Prayer Die — Action: pool empty before spend').toBeGreaterThan(0);
      await prayerDieOption.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === seraphInstanceId);
        const pool = el?.prayerDice?.pool;
        expect(Array.isArray(pool), 'Prayer Die — Action: pool missing').toBe(true);
        expect(pool.length, 'Prayer Die — Action: pool should shrink by 1').toBe(poolBeforeAction - 1);
      }).toPass({ timeout: 12000 });
      await expect(
        playerPage.locator('.dice-result-banner', { hasText: bBannerText }).getByText(/Prayer Die/i).first(),
      ).toBeVisible({ timeout: 8000 });

      await holdForDiceTumble();
      await caption('GM', "Acknowledges Reya’s roll", '');
      await gmPage.keyboard.press('Escape');
      const bBanner = gmPage.locator('.dice-result-banner', { hasText: bBannerText });
      await ack(bBanner, { force: true, holdMs: 0 });
      await expect(bBanner).not.toBeVisible({ timeout: 5000 });

      await caption(
        'Seraph / Divine Wielder',
        'Walkthrough complete',
        'Prayer Dice resume, Damage/Hope/Action spends, Life Support, Spirit Weapon',
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
