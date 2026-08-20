/**
 * Group Rolls on the shared pre-roll strip (multi-actor).
 *
 * Player A opens a table-visible trait pre-roll; GM checks Group roll;
 * Player B picks a trait and rolls a reaction. A's Proceed stays disabled
 * until B finishes or skips. Proceed appends +1 / −1 from the chip result.
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
  cancelAllPendingBanners,
} from '../helpers/multi-auth.js';

async function setupTestTable() {
  await cancelAllPendingBanners();
  const table = await createTestTable('Group Roll Table');
  await invitePlayers(table.id, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);
  return table.id;
}

function pc({ instanceId, name, assigned }) {
  return {
    instanceId,
    elementType: 'character',
    id: `nonexistent-${instanceId}`,
    name,
    currentHp: 6, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
    conditions: '',
    traits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
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

test.describe('Group roll — collaborator reaction then modifier', () => {
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

  test('Player B reaction gates Proceed and stamps +1 or −1', async ({ page }) => {
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

    await page.getByTestId('preroll-group-roll').check();
    await expect(page.getByTestId(`preroll-group-row-${helperId}`)).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.getByTestId(`preroll-group-row-${helperId}`)).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('preroll-visibility')).toBeDisabled();

    await page.getByRole('button', { name: 'Approve' }).click();
    const proceedBtn = playerAPage.getByRole('button', { name: 'Proceed' });
    await expect(proceedBtn).toBeDisabled();
    await expect(proceedBtn).toHaveAttribute('title', 'Waiting for group reaction rolls');

    await playerBPage.getByTestId(`preroll-group-trait-${helperId}`).locator('button').click();
    await playerBPage.getByRole('button', { name: 'Agility' }).last().click();
    await playerBPage.getByTestId(`preroll-group-roll-btn-${helperId}`).click();
    await expect(playerBPage.getByTestId('preroll-group-roll')).toHaveCount(0);
    const helperProceed = playerBPage.getByRole('button', { name: 'Proceed' });
    await expect(helperProceed).toBeEnabled({ timeout: 8000 });
    const helperRollPosted = playerBPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await helperProceed.click();
    const helperReq = await helperRollPosted;
    const helperBody = helperReq.postDataJSON();
    expect(helperBody._isReaction).toBe(true);
    expect(helperBody._groupRollIntentId).toBeTruthy();
    expect(helperBody._skipPreRollIntent).toBeFalsy();

    const resultChip = playerBPage.getByTestId(`preroll-group-row-${helperId}`);
    await expect(resultChip).toHaveText(/Success|Failure|Critical/i, { timeout: 8000 });
    const chipText = await resultChip.innerText();
    const expectBonus = /Success|Critical/i.test(chipText) ? ' + 1' : ' - 1';

    await expect(proceedBtn).toBeEnabled({ timeout: 8000 });
    const leaderRollPosted = playerAPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await proceedBtn.click();
    const leaderReq = await leaderRollPosted;
    const leaderBody = leaderReq.postDataJSON();
    expect(leaderBody.rollText).toContain(expectBonus);
    expect(leaderBody._groupRoll).toEqual(expect.objectContaining({
      modifier: expectBonus === ' + 1' ? 1 : -1,
    }));
    expect(leaderBody._isReaction).toBeFalsy();

    await playerAPage.close();
    await playerBPage.close();
  });
});

test.describe('Group roll — Skip unblocks with no modifier', () => {
  let tableId;
  let actorId;
  let helperId;

  test.beforeAll(async () => {
    tableId = await setupTestTable();
    actorId = `char-actor-skip-${Date.now()}`;
    helperId = `char-helper-skip-${Date.now()}`;
    await addElementsToTable(tableId, [
      pc({ instanceId: actorId, name: 'Lead PC', assigned: ACTOR_PLAYER_A }),
      pc({ instanceId: helperId, name: 'Skip PC', assigned: ACTOR_PLAYER_B }),
    ]);
    await setTableTop(tableId, { sessionStarted: true });
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
  });

  test('Skip unblocks Proceed with no +1/−1', async ({ page }) => {
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
    await expect(playerBPage.locator('text=Skip PC').first()).toBeVisible({ timeout: 15000 });
    await playerBPage.getByLabel('Hide dice').click();

    await openTraitPreRoll({ gmPage: page, actorPage: playerAPage, actorName: 'Lead PC' });
    await expect(playerBPage.getByText('Before the roll')).toBeVisible({ timeout: 8000 });

    await page.getByTestId('preroll-group-roll').check();
    await expect(playerBPage.getByTestId(`preroll-group-skip-${helperId}`)).toBeVisible({ timeout: 8000 });
    await playerBPage.getByTestId(`preroll-group-skip-${helperId}`).click();
    await expect(playerBPage.getByTestId(`preroll-group-row-${helperId}`)).toContainText('Skipped');

    await page.getByRole('button', { name: 'Approve' }).click();
    const proceedBtn = playerAPage.getByRole('button', { name: 'Proceed' });
    await expect(proceedBtn).toBeEnabled({ timeout: 8000 });

    const rollPosted = playerAPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await proceedBtn.click();
    const req = await rollPosted;
    const body = req.postDataJSON();
    expect(body.rollText).not.toMatch(/ [+-] 1/);
    expect(body._groupRoll.modifier).toBe(0);

    await playerAPage.close();
    await playerBPage.close();
  });
});
