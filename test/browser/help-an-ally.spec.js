/**
 * Help an Ally on the shared pre-roll strip (multi-actor).
 *
 * Player B toggles Help on Player A's table-visible trait pre-roll; Proceed
 * appends names + dice; Apply spends B's Hope. A second case queues two helpers
 * and posts `[2d6kh]`.
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
  addElementsToTable,
  setTableTop,
  getTableState,
  cancelAllPendingBanners,
} from '../helpers/multi-auth.js';

async function setupTestTable(opts = {}) {
  const { playerEmails = [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email] } = opts;
  await cancelAllPendingBanners();
  const table = await createTestTable('Help an Ally Table');
  await invitePlayers(table.id, playerEmails);
  return table.id;
}

function pc({ instanceId, name, hope = 3, assigned }) {
  return {
    instanceId,
    elementType: 'character',
    id: `nonexistent-${instanceId}`,
    name,
    currentHp: 6, maxHp: 6, currentStress: 0, maxStress: 6, hope, maxHope: 6,
    conditions: '',
    ...(assigned ? {
      assignedPlayerUid: assigned.uid,
      assignedPlayerEmail: assigned.email,
    } : {}),
  };
}

async function openTraitPreRoll({ gmPage, actorPage, actorName }) {
  for (const p of [gmPage, actorPage]) {
    await p.getByLabel('Hide dice').click();
  }
  await actorPage.locator(`text=${actorName}`).first().click();
  const agilityChip = actorPage.getByTitle('Roll Agility');
  await expect(agilityChip).toBeVisible({ timeout: 8000 });
  await agilityChip.click();

  const spotlightBanner = gmPage.locator('.dice-result-banner', { hasText: 'requesting the spotlight' });
  await expect(spotlightBanner).toBeVisible({ timeout: 8000 });
  await spotlightBanner.getByTestId('banner-acknowledge').click();

  await expect(actorPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
  await expect(gmPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
}

test.describe('Help an Ally — player helper spends Hope on Apply', () => {
  let tableId;
  let actorId;
  let helperId;

  test.beforeAll(async () => {
    tableId = await setupTestTable();
    actorId = `char-actor-${Date.now()}`;
    helperId = `char-helper-${Date.now()}`;
    await addElementsToTable(tableId, [
      pc({ instanceId: actorId, name: 'Actor PC', assigned: ACTOR_PLAYER_A }),
      pc({ instanceId: helperId, name: 'Helper PC', assigned: ACTOR_PLAYER_B }),
    ]);
    await setTableTop(tableId, { sessionStarted: true });
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
  });

  test('Player B Help → pending Hope → Proceed includes helper die → Apply spends B Hope', async ({ page }) => {
    await authenticateActor(page, ACTOR_GM);
    await page.goto(`/table/${tableId}`);
    await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });

    const playerAPage = await page.context().newPage();
    await authenticateActor(playerAPage, ACTOR_PLAYER_A);
    await playerAPage.goto(`/table/${tableId}`);
    await expect(playerAPage.locator('text=Actor PC').first()).toBeVisible({ timeout: 15000 });

    const playerBPage = await page.context().newPage();
    await authenticateActor(playerBPage, ACTOR_PLAYER_B);
    await playerBPage.goto(`/table/${tableId}`);
    await expect(playerBPage.locator('text=Helper PC').first()).toBeVisible({ timeout: 15000 });
    await playerBPage.getByLabel('Hide dice').click();

    await openTraitPreRoll({ gmPage: page, actorPage: playerAPage, actorName: 'Actor PC' });
    await expect(playerBPage.getByText('Before the roll')).toBeVisible({ timeout: 8000 });

    await expect(playerBPage.getByTestId('preroll-help-toggle')).toBeVisible();
    await playerBPage.getByTestId('preroll-help-toggle').click();
    await expect(page.getByTestId(`preroll-help-row-${helperId}`)).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.getByTestId('preroll-help-label')).toHaveValue('Helper PC helps');

    await page.getByRole('button', { name: 'Approve' }).click();
    const proceedBtn = playerAPage.getByRole('button', { name: 'Proceed' });
    await expect(proceedBtn).toBeEnabled({ timeout: 8000 });

    const rollPosted = playerAPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await proceedBtn.click();
    const req = await rollPosted;
    const body = req.postDataJSON();
    expect(body.rollText).toContain(' Helper PC helps [d6]');
    expect(body._helpAlly).toEqual(expect.arrayContaining([
      expect.objectContaining({ instanceId: helperId, hopeCost: 1, die: 'd6' }),
    ]));
    expect(body._preRollIntentId).toBeTruthy();

    const banner = page.locator('.dice-result-banner', { hasText: 'Actor PC Agility' });
    await expect(banner).toBeVisible({ timeout: 8000 });
    await banner.getByTestId('banner-acknowledge').click();
    await expect(banner).not.toBeVisible({ timeout: 8000 });

    await expect(async () => {
      const state = await getTableState(tableId);
      const helper = (state.elements || state.activeElements || []).find((e) => e.instanceId === helperId);
      expect(helper?.hope).toBe(2);
    }).toPass({ timeout: 8000 });

    await playerAPage.close();
    await playerBPage.close();
  });
});

test.describe('Help an Ally — two helpers keep-highest', () => {
  let tableId;
  let actorId;
  let helperBId;
  let helperCId;

  test.beforeAll(async () => {
    tableId = await setupTestTable();
    actorId = `char-actor2-${Date.now()}`;
    helperBId = `char-helper-b-${Date.now()}`;
    helperCId = `char-helper-c-${Date.now()}`;
    await addElementsToTable(tableId, [
      pc({ instanceId: actorId, name: 'Lead PC', assigned: ACTOR_PLAYER_A }),
      pc({ instanceId: helperBId, name: 'Beau PC', assigned: ACTOR_PLAYER_B }),
      pc({ instanceId: helperCId, name: 'Cara PC' }),
    ]);
    await setTableTop(tableId, { sessionStarted: true });
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
  });

  test('Player B + GM-added Cara post [2d6kh]', async ({ page }) => {
    await authenticateActor(page, ACTOR_GM);
    await page.goto(`/table/${tableId}`);
    await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });

    const playerAPage = await page.context().newPage();
    await authenticateActor(playerAPage, ACTOR_PLAYER_A);
    await playerAPage.goto(`/table/${tableId}`);
    await expect(playerAPage.locator('text=Lead PC').first()).toBeVisible({ timeout: 15000 });

    const playerBPage = await page.context().newPage();
    await authenticateActor(playerBPage, ACTOR_PLAYER_B);
    await playerBPage.goto(`/table/${tableId}`);
    await expect(playerBPage.locator('text=Beau PC').first()).toBeVisible({ timeout: 15000 });
    await playerBPage.getByLabel('Hide dice').click();

    await openTraitPreRoll({ gmPage: page, actorPage: playerAPage, actorName: 'Lead PC' });
    await expect(playerBPage.getByText('Before the roll')).toBeVisible({ timeout: 8000 });

    await playerBPage.getByTestId('preroll-help-toggle').click();
    await expect(page.getByTestId(`preroll-help-add-${helperCId}`)).toBeVisible({ timeout: 8000 });
    await page.getByTestId(`preroll-help-add-${helperCId}`).click();
    await expect(page.getByTestId(`preroll-help-row-${helperBId}`)).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId(`preroll-help-row-${helperCId}`)).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Approve' }).click();
    const proceedBtn = playerAPage.getByRole('button', { name: 'Proceed' });
    await expect(proceedBtn).toBeEnabled({ timeout: 8000 });

    const rollPosted = playerAPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await proceedBtn.click();
    const req = await rollPosted;
    const body = req.postDataJSON();
    expect(body.rollText).toMatch(/Beau PC helps and Cara PC helps \[2d6kh\]/);
    expect(body._helpAlly).toHaveLength(2);

    const banner = page.locator('.dice-result-banner', { hasText: 'Lead PC Agility' });
    await expect(banner).toBeVisible({ timeout: 8000 });
    await banner.getByTestId('banner-acknowledge').click();

    await playerAPage.close();
    await playerBPage.close();
  });
});
