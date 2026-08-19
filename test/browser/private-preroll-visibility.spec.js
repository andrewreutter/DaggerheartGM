/**
 * Private pre-roll visibility: a Player A roll stamped `_rollVisibility: gm_and_player`
 * appears for A + GM (banner + Action Log) and is omitted for Player B.
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
  playerRoll,
  cancelAllPendingBanners,
} from '../helpers/multi-auth.js';

const PRIVATE_DISPLAY = 'Private Nova Roll';

test.describe('Private pre-roll visibility', () => {
  let tableId;
  let charAInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();
    const table = await createTestTable('Private Roll Table');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email, ACTOR_PLAYER_B.email]);
    charAInstanceId = `char-priv-a-${Date.now()}`;
    await addElementsToTable(tableId, [
      {
        instanceId: charAInstanceId,
        elementType: 'character',
        id: `nonexistent-priv-a-${Date.now()}`,
        name: 'Player A PC',
        currentHp: 6, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
        conditions: '',
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      },
      {
        instanceId: `char-priv-b-${Date.now()}`,
        elementType: 'character',
        id: `nonexistent-priv-b-${Date.now()}`,
        name: 'Player B PC',
        currentHp: 6, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
        conditions: '',
        assignedPlayerUid: ACTOR_PLAYER_B.uid,
        assignedPlayerEmail: ACTOR_PLAYER_B.email,
      },
    ]);
    await setTableTop(tableId, { sessionStarted: true });
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
  });

  test('Player A private roll appears for A + GM, not Player B (banner + Action Log)', async ({ page }) => {
    await authenticateActor(page, ACTOR_GM);
    await page.goto(`/table/${tableId}`);
    await expect(page.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });

    const playerAPage = await page.context().newPage();
    const playerBPage = await page.context().newPage();
    await authenticateActor(playerAPage, ACTOR_PLAYER_A);
    await authenticateActor(playerBPage, ACTOR_PLAYER_B);
    await playerAPage.goto(`/table/${tableId}`);
    await playerBPage.goto(`/table/${tableId}`);
    await expect(playerAPage.locator('text=Player A PC').first()).toBeVisible({ timeout: 15000 });
    await expect(playerBPage.locator('text=Player B PC').first()).toBeVisible({ timeout: 15000 });

    for (const p of [page, playerAPage, playerBPage]) {
      const hide = p.getByLabel('Hide dice');
      if (await hide.isVisible().catch(() => false)) await hide.click();
    }

    const roll = await playerRoll(ACTOR_PLAYER_A, tableId, 'Hope [1d12] Fear [1d12]', PRIVATE_DISPLAY, {
      _attackerInstanceId: charAInstanceId,
      _rollVisibility: 'gm_and_player',
    });
    expect(roll._rollDbId).toBeTruthy();
    expect(roll._rollVisibility).toBe('gm_and_player');
    expect(roll._visibilityPlayerUid).toBe(ACTOR_PLAYER_A.uid);

    await expect(page.locator('.dice-result-banner', { hasText: PRIVATE_DISPLAY })).toBeVisible({ timeout: 8000 });
    await expect(playerAPage.locator('.dice-result-banner', { hasText: PRIVATE_DISPLAY })).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.locator('.dice-result-banner', { hasText: PRIVATE_DISPLAY })).toHaveCount(0);

    await expect(page.getByTestId('roll-private-hint').first()).toBeVisible({ timeout: 8000 });
    await expect(playerAPage.getByTestId('roll-private-hint').first()).toBeVisible({ timeout: 8000 });
    await expect(playerBPage.getByTestId('roll-private-hint')).toHaveCount(0);
    await expect(playerBPage.getByText(PRIVATE_DISPLAY)).toHaveCount(0);
  });
});
