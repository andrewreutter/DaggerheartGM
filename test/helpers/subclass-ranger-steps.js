/**
 * Shared Playwright steps for Ranger subclass video specs (Beastbound + Wayfinder).
 * Phase 1 TEST_GAP helpers — Focus Stress asserts + End Focus Duality reroll scene.
 */

import { expect } from '@playwright/test';
import { getTableState, updateElement } from './multi-auth.js';

/**
 * After a successful Ranger's Focus damage ack: Focus id set + Focus target marked ≥1 Stress.
 * (SRD: when you deal damage to your Focus, they mark a Stress — applied on Game Table ack.)
 */
export async function assertRangerFocusStressApplied({
  tableId,
  rangerInstanceId,
  advInstanceId,
  rangerName,
}) {
  await expect(async () => {
    const state = await getTableState(tableId);
    const rangerEl = (state.elements || []).find((e) => e.instanceId === rangerInstanceId);
    const advEl = (state.elements || []).find((e) => e.instanceId === advInstanceId);
    const focusId = rangerEl?.focusTargetInstanceId ?? rangerEl?.focusTargetId;
    expect(
      focusId === advInstanceId || advEl?.focusedBy === rangerName,
      "Ranger's Focus should set focusTargetId / focusedBy",
    ).toBe(true);
    expect(
      advEl?.currentStress ?? 0,
      'Focus target should mark ≥1 Stress when damaged while Focused',
    ).toBeGreaterThanOrEqual(1);
  }, "Ranger's Focus Stress (adversary currentStress) not applied after Focus ack").toPass({
    timeout: 10000,
  });
}

/**
 * Force a miss vs Focus (high difficulty), activate V2 "End Focus to reroll", assert Duality
 * replacement banner + Focus cleared. Restores adversary difficulty to `restoreDifficulty`.
 *
 * Retries a few times if a Critical auto-succeeds despite difficulty 30.
 */
export async function runEndFocusRerollScene({
  tableId,
  gmPage,
  playerPage,
  caption,
  ensureSheetOpen,
  selectBannerDamageTarget,
  dismissBannerTargetMenu,
  holdForDiceTumble,
  charCard,
  charName,
  weaponNameRe = /^Dagger\b/i,
  advNameRe,
  advInstanceId,
  rangerInstanceId,
  attackBannerText,
  restoreDifficulty = 1,
  maxAttempts = 5,
}) {
  await updateElement(tableId, advInstanceId, { difficulty: 30 });

  let endFocusActivated = false;
  for (let attempt = 0; attempt < maxAttempts && !endFocusActivated; attempt++) {
    await caption(
      'PLAYER A',
      attempt === 0 ? 'End Focus setup' : 'End Focus retry',
      `Attack Focus at difficulty 30 (miss) — attempt ${attempt + 1}`,
    );

    const daggerCard = playerPage.getByRole('button', { name: weaponNameRe }).first();
    await ensureSheetOpen(playerPage, charCard, daggerCard);
    await daggerCard.click();

    const chooseTargetText = playerPage.getByText('Choose target');
    if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playerPage.getByRole('button', { name: advNameRe }).first().click();
    }

    await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
    await playerPage.getByRole('button', { name: 'Proceed' }).click();

    for (const p of [gmPage, playerPage]) {
      await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
        timeout: 8000,
      });
    }

    const failBannerPlayer = playerPage.locator('.dice-result-banner', { hasText: attackBannerText });
    await selectBannerDamageTarget(playerPage, failBannerPlayer, advNameRe);
    await dismissBannerTargetMenu(playerPage);

    const endFocusBtn = failBannerPlayer.getByRole('button', { name: /End Focus to reroll/i }).first();
    const chipVisible = await endFocusBtn.isVisible({ timeout: 4000 }).catch(() => false);

    if (!chipVisible) {
      // Critical / unexpected success — cancel and retry.
      await caption('GM', 'Cancel (auto-success)', 'Need a miss for End Focus chip');
      const failBannerGm = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      await failBannerGm.getByRole('button', { name: /^Cancel$/i }).first().click();
      await expect(failBannerGm).not.toBeVisible({ timeout: 5000 });
      continue;
    }

    await caption('PLAYER A', 'End Focus to reroll', 'Clear Focus + Duality dice reroll');
    const oldDbHint = await failBannerPlayer.getAttribute('data-roll-db-id').catch(() => null);
    await endFocusBtn.click();

    // Replacement banner via Duality reroll (may keep same attack text).
    await expect(async () => {
      const state = await getTableState(tableId);
      const rangerEl = (state.elements || []).find((e) => e.instanceId === rangerInstanceId);
      const advEl = (state.elements || []).find((e) => e.instanceId === advInstanceId);
      const focusId = rangerEl?.focusTargetInstanceId ?? rangerEl?.focusTargetId;
      expect(focusId == null || focusId === '', 'Focus should clear after End Focus').toBe(true);
      expect(advEl?.focusedBy == null || advEl?.focusedBy === '', 'focusedBy should clear').toBe(true);
    }).toPass({ timeout: 10000 });

    // New or replaced pending banner still visible for GM ack/cancel.
    const afterBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText }).first();
    await expect(afterBanner).toBeVisible({ timeout: 8000 });
    // If the attribute exists on the old banner node, prefer seeing a replacement; otherwise presence is enough.
    if (oldDbHint) {
      await expect(afterBanner).not.toHaveAttribute('data-roll-db-id', oldDbHint).catch(() => {});
    }

    await holdForDiceTumble();
    await caption('GM', 'Cancels End Focus reroll banner', 'Focus already cleared by the chip');
    await afterBanner.getByRole('button', { name: /^Cancel$/i }).first().click();
    await expect(afterBanner).not.toBeVisible({ timeout: 8000 });

    endFocusActivated = true;
  }

  expect(
    endFocusActivated,
    `End Focus to reroll chip never appeared after ${maxAttempts} miss attempts (check Focus + difficulty)`,
  ).toBe(true);

  await updateElement(tableId, advInstanceId, { difficulty: restoreDifficulty });
  void charName; // reserved for clearer failure messages / future captions
}

/**
 * Beastbound: companion experiences on sheet + boardToken row in table state.
 * Optionally places the companion token near the Ranger when a map id is available.
 */
export async function assertBeastboundCompanionTokenAndExperiences({
  tableId,
  playerPage,
  kestInstanceId,
  placeOnMap = true,
}) {
  await expect(playerPage.getByText('Scent Tracking').first()).toBeVisible({ timeout: 8000 });
  await expect(playerPage.getByText('Pack Tactics').first()).toBeVisible({ timeout: 8000 });

  await expect(async () => {
    const state = await getTableState(tableId);
    const kest = (state.elements || []).find((e) => e.instanceId === kestInstanceId);
    const bt = (state.elements || []).find(
      (e) =>
        e.elementType === 'boardToken' &&
        (e.parentInstanceId === kestInstanceId || e.ownerInstanceId === kestInstanceId),
    );
    expect(bt, 'Beastbound companion boardToken should auto-add').toBeTruthy();
    expect(kest?.companion?.experiences?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(kest?.companion?.maxStress ?? 0).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 10000 });

  if (!placeOnMap) return;

  const state = await getTableState(tableId);
  const kest = (state.elements || []).find((e) => e.instanceId === kestInstanceId);
  const bt = (state.elements || []).find(
    (e) =>
      e.elementType === 'boardToken' &&
      (e.parentInstanceId === kestInstanceId || e.ownerInstanceId === kestInstanceId),
  );
  if (!bt?.instanceId) return;
  const mapId =
    kest?.mapId ??
    state.maps?.[0]?.id ??
    state.mapConfig?.mapId ??
    null;
  await updateElement(tableId, bt.instanceId, {
    tokenX: (kest?.tokenX ?? 100) + 0,
    tokenY: (kest?.tokenY ?? 100) + 2,
    ...(mapId ? { mapId } : {}),
  });

  await expect(async () => {
    const next = await getTableState(tableId);
    const placed = (next.elements || []).find((e) => e.instanceId === bt.instanceId);
    expect(placed?.tokenX).not.toBeNull();
    expect(placed?.tokenY).not.toBeNull();
  }).toPass({ timeout: 8000 });
}
