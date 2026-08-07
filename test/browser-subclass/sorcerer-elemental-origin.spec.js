/**
 * Subclass feature video — Sorcerer / Elemental Origin.
 *
 * Walks through Elementalist, Natural Evasion, Transcendence plus inherited Sorcerer
 * class features (Arcane Sense, Minor Illusion, Channel Raw Power, Volatile Magic),
 * driven from Player A's camera with the GM acknowledging banners.
 *
 * Coverage notes:
 *  - **Arcane Sense** — narrative-only (Display): caption + assert the feature card renders.
 *  - **Minor Illusion** — synthesized card chip (`onUse` → `actionLoop` DC 10); mutation is
 *    an informational action notification (no pending banner requiring Ack).
 *  - **Channel Raw Power** — V2 `isSelect` over `table.me.domainLoadout`; Game Table loadout
 *    hydration for the Actions CustomSelect is unreliable in this suite, so we caption +
 *    assert the feature card renders (living gap report).
 *  - **Elementalist** — create-placement affinity chip is character-creation-only (not on the
 *    Game Table); affinity is pre-seeded on the table element. Intent chips (+2 action / +3
 *    damage) share the feature name label; exercised via Dualstaff intent panel.
 *  - **Natural Evasion** — `reviewAction` when an attack succeeds *against the Sorcerer*
 *    (self-targeted, not ally-damage). GM posts a high-bonus adversary attack via `gmRoll`
 *    with `_selectedTargetInstanceId` set to Pyra so `isSuccess` enriches true vs Evasion.
 *  - **Transcendence** — card `multiSelect` (pick 2) is not wired in GuideFeatureCard
 *    (CustomSelect only forwards a single `selectedId`); captioned as a known UI gap —
 *    assert the feature card renders.
 *  - **Volatile Magic** — `reviewAction` on a successful Dualstaff attack (magic damage
 *    via `mag` post tag → engine `damageType: 'magic'`).
 *
 * Ally-damage intervention: Elemental Origin has none (Natural Evasion is against-you).
 * Two actors (GM + Player A) are sufficient.
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
  gmRoll,
} from '../helpers/multi-auth.js';
import { startSubclassRun } from '../helpers/subclass-video.js';
import { buildSorcererElementalOriginCharacterData } from '../helpers/subclass-cast-sorcerer.js';

test.describe('Subclass video — Sorcerer / Elemental Origin', () => {
  let tableId;
  let pyraLibId;
  let pyraInstanceId;
  let thugInstanceId;

  test.beforeAll(async () => {
    await cancelAllPendingBanners();

    const table = await createTestTable('Sorcerer Elemental Origin Video');
    tableId = table.id;
    await invitePlayers(tableId, [ACTOR_PLAYER_A.email]);

    const pyraLib = await createLibraryCharacter(
      ACTOR_GM,
      buildSorcererElementalOriginCharacterData({ name: 'Pyra' })
    );
    pyraLibId = pyraLib.id;

    pyraInstanceId = `char-pyra-${Date.now()}`;
    thugInstanceId = `adv-thug-${Date.now() + 1}`;

    await addElementsToTable(tableId, [
      {
        instanceId: pyraInstanceId,
        elementType: 'character',
        id: pyraLib.id,
        name: pyraLib.name,
        // maxHp 7 / maxStress 8 / maxHope 6 — leave headroom for Stress (Natural Evasion)
        // and Hope spends (Elementalist / Volatile Magic).
        currentHp: 7,
        currentStress: 2,
        hope: 5,
        currentArmor: 0,
        conditions: '',
        tokenX: 100,
        tokenY: 100,
        assignedPlayerUid: ACTOR_PLAYER_A.uid,
        assignedPlayerEmail: ACTOR_PLAYER_A.email,
        // Character-creation Elementalist affinity (create-placement chip is not on Game Table).
        featureState: { ElementalOrigin: { element: 'fire' } },
        // Seed hydrated loadout so Channel Raw Power's isSelect has options (runtime merge).
        domainLoadout: [
          { id: 'srd-abl-rune-ward', name: 'Rune Ward', level: 1 },
          { id: 'srd-abl-wall-walk', name: 'Wall Walk', level: 1 },
          { id: 'srd-abl-cinder-grasp', name: 'Cinder Grasp', level: 2 },
          { id: 'srd-abl-counterspell', name: 'Counterspell', level: 3 },
          { id: 'srd-abl-blink-out', name: 'Blink Out', level: 4 },
        ],
      },
      {
        instanceId: thugInstanceId,
        elementType: 'adversary',
        id: `test-adv-${thugInstanceId}`,
        name: 'Alley Thug',
        tier: 1,
        // Difficulty 1 guarantees Dualstaff hits so Volatile Magic's success-gated chip appears.
        difficulty: 1,
        hp_max: 10,
        currentHp: 10,
        currentStress: 0,
        conditions: '',
        // Within Very Close of Pyra — Dualstaff is Far, so any close placement is fine.
        tokenX: 105,
        tokenY: 100,
      },
    ]);

    await grantCampaignPassForTable(tableId);
  });

  test.afterAll(async () => {
    if (tableId) await deleteTestTable(tableId);
    if (pyraLibId) await deleteLibraryCharacter(ACTOR_GM, pyraLibId);
  });

  test('Pyra the Elemental Origin: Elementalist, Natural Evasion, Transcendence, and Sorcerer class features', async ({
    browser,
  }) => {
    const consoleErrors = [];
    const { gmPage, playerPage, caption, finish } = await startSubclassRun(browser, {
      className: 'Sorcerer',
      subclassName: 'Elemental Origin',
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
      await caption('GM', 'Loading the table', 'Pyra (Sorcerer/Elemental Origin) and an Alley Thug');
      await authenticateActor(gmPage, ACTOR_GM);
      await gmPage.goto(`/table/${tableId}`);
      await playerPage.goto(`/table/${tableId}`);

      await expect(gmPage.locator('button', { hasText: 'Add Character' })).toBeVisible({ timeout: 15000 });
      await expect(playerPage.locator('text=Pyra').first()).toBeVisible({ timeout: 15000 });

      for (const p of [gmPage, playerPage]) {
        await p.getByLabel('Hide dice').click();
      }

      await caption('GM', 'Start Session', '');
      await gmPage.getByRole('button', { name: '▶ Session' }).click();
      const startBanner = gmPage.locator('.dice-result-banner', { hasText: 'Start Session' });
      await expect(startBanner).toBeVisible({ timeout: 8000 });
      await startBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(startBanner).not.toBeVisible({ timeout: 5000 });

      const playerPyraCard = playerPage.locator('div.group\\/char', { hasText: 'Pyra' });

      // Helper: re-open the hover sheet only when the target control isn't already visible.
      // Clicking `div.group/char` while the sheet is open toggles it closed (lesson 5).
      const ensurePyraSheet = async (locator) => {
        if (await locator.isVisible().catch(() => false)) return;
        await playerPyraCard.click();
        await expect(locator).toBeVisible({ timeout: 8000 });
      };

      // ---------------------------------------------------------------------
      // Arcane Sense — narrative Display.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Arcane Sense', 'Narrative-only — sense magic within Close range');
      await playerPyraCard.click();
      await expect(playerPage.getByText('Arcane Sense', { exact: true }).first()).toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Minor Illusion — synthesized card chip → actionLoop (suppressed banner).
      // Sheet still open from Arcane Sense — do not re-click the sidebar card.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Minor Illusion', 'Spellcast DC 10 — actionLoop notification (no Ack)');
      const minorIllusionBtn = playerPage.getByRole('button', { name: /Minor Illusion/i }).first();
      await ensurePyraSheet(minorIllusionBtn);
      await minorIllusionBtn.click();
      await expect(playerPage.locator('.dice-result-banner', { hasText: 'Minor Illusion' })).toHaveCount(0, {
        timeout: 6000,
      });

      // ---------------------------------------------------------------------
      // Channel Raw Power — display / gap (CustomSelect loadout path flaky on Game Table).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Channel Raw Power',
        'Display + gap — Actions isSelect over domainLoadout not reliably activatable here'
      );
      await ensurePyraSheet(playerPage.getByText('Channel Raw Power', { exact: true }).first());

      // ---------------------------------------------------------------------
      // Elementalist — feature card + intent (+2 action) on Dualstaff attack.
      // ---------------------------------------------------------------------
      await caption('PLAYER A', 'Elementalist', 'Fire affinity pre-seeded; intent +2 on Dualstaff attack');
      await ensurePyraSheet(playerPage.getByText('Elementalist', { exact: true }).first());

      await caption('PLAYER A', 'Dualstaff attack', 'Before-you-roll → Elementalist intent → Proceed');
      const dualstaffCard = playerPage.getByRole('button', { name: /^Dualstaff\b/i }).first();
      await ensurePyraSheet(dualstaffCard);
      await dualstaffCard.click();

      const chooseTargetText = playerPage.getByText('Choose target');
      if (await chooseTargetText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await playerPage.getByRole('button', { name: /Alley Thug/i }).first().click();
      }

      await expect(playerPage.getByText('Before you roll')).toBeVisible({ timeout: 8000 });
      // Both Elementalist intents share the feature name; click the first match (+2 or +3).
      const elementalistIntent = playerPage.getByRole('button', { name: /Elementalist/i }).first();
      if (await elementalistIntent.isVisible({ timeout: 2000 }).catch(() => false)) {
        await elementalistIntent.click();
      }
      await playerPage.getByRole('button', { name: 'Proceed' }).click();

      const attackBannerText = 'Pyra Dualstaff';
      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: attackBannerText })).toBeVisible({
          timeout: 8000,
        });
      }

      // Volatile Magic on this same banner (magic damage + hope ≥ 3).
      await caption('PLAYER A', 'Volatile Magic', 'Spend 3 Hope to reroll magic damage dice');
      const volatileBtn = playerPage.getByRole('button', { name: /Volatile Magic/i }).first();
      await expect(volatileBtn).toBeVisible({ timeout: 8000 });
      await volatileBtn.click();

      await caption('GM', "Acknowledges Pyra's Dualstaff attack", '');
      const attackBanner = gmPage.locator('.dice-result-banner', { hasText: attackBannerText });
      // Select target chip if Acknowledge is gated.
      const thugChip = attackBanner.getByRole('button', { name: /Alley Thug/i }).first();
      if (await thugChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await thugChip.click();
      }
      await attackBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(attackBanner).not.toBeVisible({ timeout: 5000 });

      await expect(async () => {
        const state = await getTableState(tableId);
        const thugEl = (state.elements || []).find((e) => e.instanceId === thugInstanceId);
        expect(thugEl?.currentHp ?? 10).toBeLessThan(10);
      }).toPass({ timeout: 8000 });

      // ---------------------------------------------------------------------
      // Natural Evasion — GM adversary attack succeeds against Pyra → review chip.
      // ---------------------------------------------------------------------
      await caption('GM', 'Alley Thug attacks Pyra', 'Guaranteed hit (+20) so Natural Evasion appears');
      await gmRoll(tableId, 'Alley Thug Claw [d20+20] damage [1d8] phy', 'Alley Thug Claw', {
        _attackerInstanceId: thugInstanceId,
        _attackerType: 'adversary',
        _selectedTargetInstanceId: pyraInstanceId,
        _attackRangeFt: 5,
      });

      for (const p of [gmPage, playerPage]) {
        await expect(p.locator('.dice-result-banner', { hasText: 'Alley Thug Claw' })).toBeVisible({
          timeout: 8000,
        });
      }

      await caption('PLAYER A', 'Natural Evasion', 'Mark 1 Stress, roll d6, add to Evasion vs this attack');
      const naturalEvasionBtn = playerPage.getByRole('button', { name: /Natural Evasion/i }).first();
      await expect(naturalEvasionBtn).toBeVisible({ timeout: 8000 });
      await naturalEvasionBtn.click();

      await expect(async () => {
        const state = await getTableState(tableId);
        const pyraEl = (state.elements || []).find((e) => e.instanceId === pyraInstanceId);
        // Started at currentStress 2; Natural Evasion marks +1.
        expect(pyraEl?.currentStress).toBeGreaterThanOrEqual(3);
      }).toPass({ timeout: 8000 });

      await caption('GM', 'Acknowledges Alley Thug attack', '');
      const thugBanner = gmPage.locator('.dice-result-banner', { hasText: 'Alley Thug Claw' });
      const pyraTargetChip = thugBanner.getByRole('button', { name: /Pyra/i }).first();
      if (await pyraTargetChip.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pyraTargetChip.click();
      }
      await thugBanner.locator('button', { hasText: 'Acknowledge' }).first().click();
      await expect(thugBanner).not.toBeVisible({ timeout: 5000 });

      // ---------------------------------------------------------------------
      // Transcendence — multiSelect card UI gap (caption + assert render).
      // ---------------------------------------------------------------------
      await caption(
        'PLAYER A',
        'Transcendence',
        'Known gap: card multiSelect (pick 2) not wired in GuideFeatureCard — display only here'
      );
      await ensurePyraSheet(playerPage.getByText('Transcendence', { exact: true }).first());

      await caption(
        'Sorcerer / Elemental Origin',
        'Walkthrough complete',
        'Elementalist, Natural Evasion, Transcendence + Sorcerer class features'
      );

      const seriousErrors = consoleErrors.filter(
        (e) => !/favicon|manifest|WebGL|\[DiceRoller\] init failed|Failed to load resource.*403/i.test(e)
      );
      expect(seriousErrors, `Unexpected console errors:\n${seriousErrors.join('\n')}`).toEqual([]);
    } finally {
      await finish();
    }
  });
});
