/**
 * Tag Team Rolls on the shared pre-roll strip (multi-actor).
 *
 * Player A opens a table-visible attack pre-roll; GM selects Tag Team;
 * a wait banner shows until Player B takes a full sheet attack (same target).
 * Both pre-roll banners stay visible. A's Proceed stays disabled until B finishes.
 * Both result banners stay pending until someone clicks Use this roll.
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
  const table = await createTestTable('Tag Team Table');
  await invitePlayers(table.id, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);
  return table.id;
}

function meleeWeapon() {
  return {
    name: 'Shortsword',
    trait: 'Agility',
    range: 'Close',
    damage: 'd8 phy',
  };
}

function pc({ instanceId, name, assigned, tokenX, tokenY }) {
  return {
    instanceId,
    elementType: 'character',
    id: `nonexistent-${instanceId}`,
    name,
    currentHp: 6, maxHp: 6, currentStress: 0, maxStress: 6, hope: 5, maxHope: 6,
    conditions: '',
    traits: { agility: 1, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    weapons: [meleeWeapon()],
    tokenX,
    tokenY,
    ...(assigned ? {
      assignedPlayerUid: assigned.uid,
      assignedPlayerEmail: assigned.email,
    } : {}),
  };
}

async function openAttackPreRoll({ gmPage, actorPage, actorName, targetName }) {
  for (const p of [gmPage, actorPage]) {
    await p.getByLabel('Hide dice').click();
  }
  await actorPage.locator(`text=${actorName}`).first().click();
  const sword = actorPage.getByRole('button', { name: /^Shortsword\b/i }).first();
  await expect(sword).toBeVisible({ timeout: 8000 });
  await sword.click();

  const chooseTarget = actorPage.getByText('Choose target');
  if (await chooseTarget.isVisible({ timeout: 3000 }).catch(() => false)) {
    await actorPage.getByRole('button', { name: new RegExp(targetName, 'i') }).first().click();
  }

  const spotlightBanner = gmPage.locator('.dice-result-banner', { hasText: 'requesting the spotlight' });
  await expect(spotlightBanner).toBeVisible({ timeout: 8000 });
  await spotlightBanner.getByTestId('banner-acknowledge').click();

  await expect(actorPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
  await expect(gmPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
}

test.describe('Tag Team — partner Duality then choose', () => {
  let tableId;
  let actorId;
  let partnerId;
  let goblinId;

  test.beforeAll(async () => {
    tableId = await setupTestTable();
    actorId = `char-actor-${Date.now()}`;
    partnerId = `char-partner-${Date.now()}`;
    goblinId = `adv-goblin-${Date.now()}`;
    await addElementsToTable(tableId, [
      pc({ instanceId: actorId, name: 'Actor PC', assigned: ACTOR_PLAYER_A, tokenX: 10, tokenY: 10 }),
      pc({ instanceId: partnerId, name: 'Partner PC', assigned: ACTOR_PLAYER_B, tokenX: 10, tokenY: 14 }),
      {
        instanceId: goblinId,
        elementType: 'adversary',
        id: `nonexistent-${goblinId}`,
        name: 'Goblin',
        tokenX: 16,
        tokenY: 10,
        currentHp: 3,
        hp_max: 3,
        evasion: 10,
        role: 'standard',
      },
    ]);
    await setTableTop(tableId, { sessionStarted: true });
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
  });

  test('Player B Duality gates Proceed; Use this roll then Apply', async ({ page }) => {
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
    await expect(playerBPage.locator('text=Partner PC').first()).toBeVisible({ timeout: 15000 });
    await playerBPage.getByLabel('Hide dice').click();

    await openAttackPreRoll({
      gmPage: page,
      actorPage: playerAPage,
      actorName: 'Actor PC',
      targetName: 'Goblin',
    });
    await expect(playerBPage.getByText('Before the roll')).toBeVisible({ timeout: 8000 });

    await page.getByTestId('preroll-tag-team').click();
    await expect(page.getByTestId(`preroll-tag-team-row-${partnerId}`)).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.getByTestId(`preroll-tag-team-row-${partnerId}`)).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('preroll-tag-team-wait')).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.getByTestId('preroll-tag-team-wait')).toContainText('Tag Team Action');

    const proceedBtn = playerAPage.getByRole('button', { name: 'Proceed' });
    await expect(proceedBtn).toBeEnabled();

    await playerBPage.locator('text=Partner PC').first().click();
    const partnerSword = playerBPage.getByRole('button', { name: /^Shortsword\b/i }).first();
    await expect(partnerSword).toBeVisible({ timeout: 8000 });
    await partnerSword.click();
    await expect(playerBPage.getByTestId('preroll-banner-tag-team-partner')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('preroll-banner-tag-team-partner')).toBeVisible({ timeout: 8000 });
    await expect(playerAPage.getByTestId('preroll-banner-tag-team-partner')).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.getByTestId('preroll-banner')).toBeVisible();
    await expect(playerBPage.getByTestId('preroll-tag-team-wait')).toHaveCount(0);
    const partnerProceed = playerBPage.getByTestId('preroll-banner-tag-team-partner').getByRole('button', { name: 'Proceed' });
    await expect(partnerProceed).toBeEnabled({ timeout: 8000 });
    const partnerRollPosted = playerBPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await partnerProceed.click();
    const partnerReq = await partnerRollPosted;
    const partnerBody = partnerReq.postDataJSON();
    expect(partnerBody._isReaction).toBeFalsy();
    expect(partnerBody._tagTeamIntentId).toBeTruthy();
    expect(partnerBody._tagTeamRole).toBe('partner');
    expect(partnerBody._skipPreRollIntent).toBeFalsy();

    await expect(proceedBtn).toBeEnabled({ timeout: 8000 });
    const leaderRollPosted = playerAPage.waitForRequest((req) => (
      req.method() === 'POST' && /\/api\/room\/[^/]+\/roll$/.test(new URL(req.url()).pathname)
    ));
    await proceedBtn.click();
    const leaderReq = await leaderRollPosted;
    const leaderBody = leaderReq.postDataJSON();
    expect(leaderBody._tagTeamIntentId).toBeTruthy();
    expect(leaderBody._tagTeamRole).toBe('initiator');
    expect(leaderBody._isReaction).toBeFalsy();
    expect(leaderBody._tagTeamPartnerInstanceId).toBe(partnerId);

    await expect(page.getByTestId('tag-team-use-roll')).toHaveCount(2, { timeout: 15000 });
    await expect(page.getByText(/\+ Tag Team \(\d+\)/)).toHaveCount(2);
    await expect(page.getByTestId('tag-team-damage-type')).toHaveCount(0);
    await page.getByTestId('tag-team-use-roll').first().click();
    await expect(page.getByTestId('banner-acknowledge').first()).toBeVisible({ timeout: 8000 });
    await page.getByTestId('banner-acknowledge').first().click();

    await playerAPage.close();
    await playerBPage.close();
  });
});
