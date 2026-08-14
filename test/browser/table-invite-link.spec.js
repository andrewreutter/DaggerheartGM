/**
 * Table invite link + leave — multi-actor UI coverage.
 *
 * GM generates a reusable /join/:token link; Player A redeems it in the
 * browser; GM kicks them (clears roster + character assignment); Player B
 * joins the same link and leaves via the Characters-panel button.
 */
import { test, expect } from '@playwright/test';
import {
  ACTOR_GM,
  ACTOR_PLAYER_A,
  ACTOR_PLAYER_B,
  authenticateActor,
  createTestTable,
  deleteTestTable,
  createLibraryCharacter,
  deleteLibraryCharacter,
  addElementsToTable,
  getTableState,
} from '../helpers/multi-auth.js';

test.describe('table invite link and leave', () => {
  let tableId;
  let charLibId;
  const charInstanceId = `invite-char-${Date.now()}`;

  test.beforeAll(async () => {
    const table = await createTestTable('Invite Link Test');
    tableId = table.id;
    const lib = await createLibraryCharacter(ACTOR_GM, { name: 'Invite Test PC', _tableId: table.id });
    charLibId = lib.id;
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (charLibId) await deleteLibraryCharacter(ACTOR_GM, charLibId);
  });

  test('GM generates link; player joins, is kicked, and another player leaves', async ({ browser }) => {
    const gmCtx = await browser.newContext();
    const playerACtx = await browser.newContext();
    const playerBCtx = await browser.newContext();
    const gmPage = await gmCtx.newPage();
    const playerAPage = await playerACtx.newPage();
    const playerBPage = await playerBCtx.newPage();

    try {
      await authenticateActor(gmPage, ACTOR_GM);
      await authenticateActor(playerAPage, ACTOR_PLAYER_A);
      await authenticateActor(playerBPage, ACTOR_PLAYER_B);

      await gmPage.goto(`/table/${tableId}`);
      await expect(gmPage.getByRole('heading', { name: 'Characters' })).toBeVisible({ timeout: 15000 });

      await gmPage.getByTitle('Manage invited players').click();
      await gmPage.getByRole('button', { name: 'Generate Invite Link' }).click();
      const inviteInput = gmPage.locator('input[readonly]');
      await expect(inviteInput).toHaveValue(new RegExp(`/join/`), { timeout: 10000 });
      const inviteUrl = await inviteInput.inputValue();
      const token = inviteUrl.split('/join/')[1];
      expect(token).toBeTruthy();

      await playerAPage.goto(`/join/${token}`);
      await expect(playerAPage).toHaveURL(new RegExp(`/table/${tableId}`), { timeout: 15000 });
      await expect(gmPage.getByText(ACTOR_PLAYER_A.email)).toBeVisible({ timeout: 10000 });

      await addElementsToTable(tableId, [{
        instanceId: charInstanceId,
        elementType: 'character',
        id: charLibId,
        name: 'Invite Test PC',
        currentHp: 6,
        maxHp: 6,
        currentStress: 0,
        maxStress: 6,
        hope: 2,
        maxHope: 6,
        conditions: '',
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
      }]);

      // Cancel confirm must not remove the player.
      gmPage.once('dialog', async (d) => {
        expect(d.message()).toMatch(/Remove .* from this table/i);
        await d.dismiss();
      });
      await gmPage.getByTitle('Remove player').click();
      await expect.poll(async () => {
        const state = await getTableState(tableId, ACTOR_GM);
        return (state.playerEmails || []).map((e) => e.toLowerCase())
          .includes(ACTOR_PLAYER_A.email.toLowerCase());
      }, { timeout: 5000 }).toBe(true);

      gmPage.once('dialog', (d) => d.accept());
      await gmPage.getByTitle('Remove player').click();
      await expect.poll(async () => {
        const state = await getTableState(tableId, ACTOR_GM);
        const emails = (state.playerEmails || []).map((e) => e.toLowerCase());
        const el = (state.elements || []).find((e) => e.instanceId === charInstanceId);
        return {
          invited: emails.includes(ACTOR_PLAYER_A.email.toLowerCase()),
          assigned: el?.assignedPlayerEmail || null,
        };
      }, { timeout: 10000 }).toEqual({ invited: false, assigned: null });

      await playerBPage.goto(`/join/${token}`);
      await expect(playerBPage).toHaveURL(new RegExp(`/table/${tableId}`), { timeout: 15000 });
      await expect(playerBPage.getByRole('button', { name: 'Leave table' })).toBeVisible({ timeout: 10000 });
      playerBPage.once('dialog', (d) => d.accept());
      await playerBPage.getByRole('button', { name: 'Leave table' }).click();
      await expect(playerBPage).toHaveURL('/', { timeout: 10000 });
    } finally {
      await gmCtx.close();
      await playerACtx.close();
      await playerBCtx.close();
    }
  });
});
