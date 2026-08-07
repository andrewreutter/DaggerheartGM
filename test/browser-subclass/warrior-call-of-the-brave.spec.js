/**
 * Subclass feature video — Warrior / Call of the Brave.
 *
 * Walks through Call of the Brave features (Courage, Battle Ritual, Rise to the
 * Challenge, Camaraderie) plus inherited Warrior class features (No Mercy,
 * Attack of Opportunity via token move, Combat Training). GM + Player A only.
 *
 * Coverage notes:
 *  - **No Mercy** — root hopeCost/onUse synthesizes a card chip; spends 3 Hope and
 *    sets featureState noMercyActive (+1 to attack rolls until rest). **P1:** Short Rest
 *    ack clears `noMercyActive` (hard-asserted).
 *  - **Attack of Opportunity** — GM drags an adversary out of Melee; `onTokenMove`
 *    posts a suppressed action-loop notification that still lands in the Action Log
 *    (M6-style map automation). The leaveMelee reaction-outcome multi-select chip
 *    requires a manual reaction loop with `reactionContext.kind === 'leaveMelee'`
 *    (not wired from the Defense Reaction grid yet) — captioned as a known gap.
 *  - **Combat Training** — passive (+level to physical damage); assert card renders.
 *  - **Courage** — automatic onResolve when Fear > Hope on a failed roll; assert card
 *    (dice outcomes are not forced in this suite).
 *  - **Battle Ritual** — long-rest card chip (Player A); clears 2 Stress / gains 2 Hope immediately.
 *  - **Rise to the Challenge** — Hope die becomes d20 while HP ≤ 2; demonstrated via a
 *    trait roll at low HP (display the feature + roll; die-size assertion is best-effort).
 *  - **Camaraderie** — narrative/display only (Tag Team automation deferred).
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
import { buildWarriorCallOfTheBraveCharacterData } from '../helpers/subclass-cast-warrior.js';

const CHAR_NAME = 'Kara';
const ADV_NAME = 'Fleeing Raider';

/** Drag a placed map token (not its dim tray proxy) far enough to leave Melee. */
async function dragAdversaryOutOfMelee(page, advName) {
  // Dismiss pinned sheets / overlays that intercept pointer events on the map.
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
  // ~40'+ at typical map px/ft — well outside Melee (≤5') from a co-located warrior.
  await page.mouse.move(startX + 360, startY, { steps: 20 });
  await page.mouse.up();
}

/**
 * Hover sheets toggle on sidebar-card click. Display-only asserts leave the sheet open,
 * so a naive re-click would close it — Escape first, then open.
 */
async function openCharSheet(page, charCard) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await charCard.click();
}

/**
 * Card-chip button (frequency badge in the accessible name, e.g. "Battle Ritual ○ long").
 * Features expand headers match the bare feature name and must not be clicked instead.
 */
function frequencyChipButton(page, featureName) {
  // Features expand headers also lift frequency onto the title when chips are hidden —
  // `.last()` prefers the Actions-strip chip (later in DOM).
  const re = new RegExp(`${featureName}[\\s\\S]*\\b(long|short|session|rest)\\b`, 'i');
  return page.getByRole('button', { name: re }).last();
}

test.describe('Subclass video — Warrior / Call of the Brave', () => {
  let tableId;
  let charLibId;
  let charInstanceId;
  let advInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Warrior Call of the Brave Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const charLib = await createLibraryCharacter(
      ACTOR_GM,
      buildWarriorCallOfTheBraveCharacterData({ name: CHAR_NAME })
    );
    charLibId = charLib.id;

    charInstanceId = `char-brave-${Date.now()}`;
    advInstanceId = `adv-raider-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: charInstanceId,
        elementType: 'character',
        id: charLib.id,
        name: charLib.name,
        // HP ≤ 2 for Rise to the Challenge; Stress marked so Battle Ritual is visible.
        currentHp: 2,
        currentStress: 4,
        hope: 5,
        currentArmor: 0,
        conditions: '',
        // Near map center — room to drag the raider out of Melee.
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
        difficulty: 1,
        hp_max: 8,
        currentHp: 8,
        currentStress: 0,
        conditions: '',
        // 3ft from Kara — Melee.
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

  test('Kara the Brave: No Mercy, Attack of Opportunity, Battle Ritual, and subclass features', async ({
    browser,
  }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish, ack, holdForDiceTumble } = await startSubclassRun(browser, {
      className: 'Warrior',
      subclassName: 'Call of the Brave',
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
      await caption('GM', 'Loading the table', `${CHAR_NAME} (Warrior/Call of the Brave) and ${ADV_NAME}`);
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator(`text=${CHAR_NAME}`).first()).toBeVisible({ timeout: 15000 });

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 15000 });
      await ack(startBanner, { holdMs: 0 });
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });
      // Rest cycle buttons no-op until the client sees sessionStarted (SSE).
      await expect(gmPage.getByRole('button', { name: '■ End' })).toBeVisible({ timeout: 15000 });

      const playerCharCard = playerPage.locator('div.group\\/char', { hasText: CHAR_NAME });

      // ---------------------------------------------------------------------
      // No Mercy (Warrior hope feature) — V2 Actions strip chip (amber Hope card
      // is hidden when the feature is on the guide). Click posts a feature-use
      // banner; GM Ack spends 3 Hope.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'No Mercy',
        'Actions chip — spend 3 Hope for +1 to attacks until rest (applies immediately)'
      );
      await openCharSheet(playerPage, playerCharCard);
      const karaActionsCard = playerPage
        .locator('div.rounded-xl.bg-gradient-to-b')
        .filter({ has: playerPage.locator('span.uppercase', { hasText: /^Actions$/ }) })
        .first();
      await expect(karaActionsCard).toBeVisible({ timeout: 8000 });
      const noMercyBtn = karaActionsCard
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
        expect(el?.featureState?.['No Mercy']?.noMercyActive).toBe(true);
      }).toPass({ timeout: 8000 });
      await caption('PLAYER A', 'No Mercy applied', 'Hope spent; +1 attacks until rest');

      // ---------------------------------------------------------------------
      // No Mercy clears on Short Rest (hooks.onRest) — P1 TEST_GAP.
      // ---------------------------------------------------------------------
      await caption('GM', 'Short Rest', 'No Mercy ends at the next rest');
      await expect(gmPage.getByRole('button', { name: '■ End' })).toBeVisible({ timeout: 8000 });
      // RestBanner confirms when downtime moves are unfilled — register before Ack.
      gmPage.once('dialog', (dialog) => dialog.accept());
      await gmPage.getByRole('button', { name: '⏸ Short' }).click();
      const restBanner = gmPage.locator('.dice-result-banner', { hasText: /Short Rest/i });
      await expect(restBanner).toBeVisible({ timeout: 15000 });
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges Short Rest', 'Skip move picks — confirm clears No Mercy');
      await ack(restBanner, { holdMs: 0 });
      await expect(restBanner).not.toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === charInstanceId);
        expect(
          el?.featureState?.['No Mercy']?.noMercyActive,
          'No Mercy should clear on Short Rest'
        ).not.toBe(true);
      }).toPass({ timeout: 8000 });
      await caption('GM', 'No Mercy cleared', 'featureState.noMercyActive is no longer true');

      // ---------------------------------------------------------------------
      // Attack of Opportunity — GM drags adversary out of Melee (onTokenMove).
      // ---------------------------------------------------------------------
      await caption(
        'GM',
        'Attack of Opportunity',
        `Drags ${ADV_NAME} out of Melee — onTokenMove fires the interrupt prompt`
      );
      await dragAdversaryOutOfMelee(gmPage, ADV_NAME);

      await expect(async () => {
        const state = await getTableState(tableId);
        const adv = (state.elements || []).find((e) => e.instanceId === advInstanceId);
        expect(adv?.tokenX ?? 43).toBeGreaterThan(50);
      }).toPass({ timeout: 8000 });

      // Suppressed action banner still appends to the Action Log (roll-log-append).
      await expect(playerPage.getByText(/Attack of Opportunity/i).first()).toBeVisible({ timeout: 10000 });

      await caption(
        'PLAYER A',
        'Attack of Opportunity — outcome chips',
        'leaveMelee reaction loop not yet wired from the Reaction grid (known gap) — prompt is in the Action Log'
      );

      // ---------------------------------------------------------------------
      // Combat Training — passive display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Combat Training', 'Passive — +level to physical damage; ignore weapon burden');
      await openCharSheet(playerPage, playerCharCard);
      await expect(playerPage.getByText('Combat Training', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      // ---------------------------------------------------------------------
      // Courage — passive display (auto Hope on fail when Fear > Hope).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Courage',
        'Passive — on a failed roll, if Fear die > Hope die, gain 1 Hope'
      );
      await expect(playerPage.getByText('Courage', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Battle Ritual — long-rest card chip (owned-sheet; Player A).
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Battle Ritual', 'Once per long rest — clear 2 Stress and gain 2 Hope');
      await openCharSheet(playerPage, playerCharCard);
      const battleRitualBtn = frequencyChipButton(playerPage, 'Battle Ritual');
      await expect(battleRitualBtn).toBeVisible({ timeout: 8000 });
      await battleRitualBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const el = (state.elements || []).find((e) => e.instanceId === charInstanceId);
        expect(el?.currentStress).toBe(2);
        expect(el?.hope).toBe(4);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Rise to the Challenge — trait roll while HP ≤ 2 (Hope die → d20).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Rise to the Challenge',
        'HP ≤ 2 — Hope die becomes a d20 on action rolls'
      );
      await openCharSheet(playerPage, playerCharCard);
      await expect(playerPage.getByText('Rise to the Challenge', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });
      await playerPage.getByRole('button', { name: /Agility.*Sprint/i }).click();
      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const traitBannerText = `${CHAR_NAME} Agility`;
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: traitBannerText })).toBeVisible({
          timeout: 8000,
        });
      }
      await holdForDiceTumble();
      await caption('GM', 'Acknowledges the Agility roll', 'Rise to the Challenge applied at intent');
      const traitBanner = gmPage.locator('.dice-result-banner', { hasText: traitBannerText });
      await ack(traitBanner, { holdMs: 0 });
      await expect(traitBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Camaraderie — narrative/display only.
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Camaraderie',
        'Display-only — extra Tag Team / reduced Hope cost not yet automated'
      );
      await openCharSheet(playerPage, playerCharCard);
      await expect(playerPage.getByText('Camaraderie', { exact: true }).first()).toBeVisible({
        timeout: 8000,
      });

      await caption(
        'Warrior / Call of the Brave',
        'Walkthrough complete',
        'No Mercy, Attack of Opportunity, Battle Ritual, Rise to the Challenge, Courage, Camaraderie'
      );

      const seriousErrors = filterSeriousSubclassConsoleErrors(consoleErrors);
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
