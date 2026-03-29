/**
 * Unit tests for src/client/lib/table-ops.js and src/client/lib/character-calc.js
 *
 * Pure-logic tests for the table operation state transformations and
 * character calculation utilities.
 * No browser, no DOM, no Firebase needed.
 */
import { describe, it, expect } from 'vitest';
import {
  applyTableOp,
  RUNTIME_KEYS,
  CHARACTER_RUNTIME_KEYS,
  TABLE_STATE_V2_ROOT_KEYS,
  applyV2ActiveModifierMutations,
  applyV2BannerMutations,
  applyV2LifecycleMutations,
  formatV2RollDieMutationLine,
  partitionV2BannerChipMutations,
  normalizeV2BannerChipMutations,
} from '../../src/client/lib/table-ops.js';
import { computeArmorModifiers, getEffectiveWeaponRange } from '../../src/client/lib/character-calc.js';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../src/features-v2/engine/feature-scope-keys.js';

// ---------------------------------------------------------------------------
// applyTableOp — GM-side state transformations
// ---------------------------------------------------------------------------

describe('applyTableOp', () => {
  const mkElement = (overrides = {}) => ({
    id: 'adv-1', instanceId: 'inst-1', elementType: 'adversary',
    name: 'Goblin', currentHp: 5, currentStress: 0, conditions: '',
    ...overrides,
  });

  it('update-element updates matching element', () => {
    const state = { activeElements: [mkElement(), mkElement({ instanceId: 'inst-2' })] };
    const result = applyTableOp({ op: 'update-element', instanceId: 'inst-1', updates: { currentHp: 3 } }, state);
    expect(result.activeElements[0].currentHp).toBe(3);
    expect(result.activeElements[1].currentHp).toBe(5);
  });

  it('add-elements appends new elements', () => {
    const state = { activeElements: [mkElement()] };
    const newEl = mkElement({ instanceId: 'inst-new', name: 'Orc' });
    const result = applyTableOp({ op: 'add-elements', elements: [newEl] }, state);
    expect(result.activeElements).toHaveLength(2);
    expect(result.activeElements[1].name).toBe('Orc');
  });

  it('remove-element removes matching element', () => {
    const state = { activeElements: [mkElement(), mkElement({ instanceId: 'inst-2' })] };
    const result = applyTableOp({ op: 'remove-element', instanceId: 'inst-1' }, state);
    expect(result.activeElements).toHaveLength(1);
    expect(result.activeElements[0].instanceId).toBe('inst-2');
  });

  it('clear-table keeps only characters and resets featureCountdowns', () => {
    const state = {
      activeElements: [
        mkElement(),
        mkElement({ instanceId: 'char-1', elementType: 'character', name: 'Hero' }),
        mkElement({ instanceId: 'env-1', elementType: 'environment', name: 'Forest' }),
      ],
      featureCountdowns: { 'some|key|0': 2 },
    };
    const result = applyTableOp({ op: 'clear-table' }, state);
    expect(result.activeElements).toHaveLength(1);
    expect(result.activeElements[0].elementType).toBe('character');
    expect(result.featureCountdowns).toEqual({});
  });

  it('set-fear sets fearCount', () => {
    const result = applyTableOp({ op: 'set-fear', fearCount: 5 }, {});
    expect(result.fearCount).toBe(5);
  });

  it('set-countdown merges countdown value', () => {
    const state = { featureCountdowns: { 'a|b|0': 1 } };
    const result = applyTableOp({ op: 'set-countdown', key: 'c|d|0', value: 3 }, state);
    expect(result.featureCountdowns).toEqual({ 'a|b|0': 1, 'c|d|0': 3 });
  });

  it('set-battle-mods replaces battle mods', () => {
    const mods = { lessDifficult: true, moreDangerous: false };
    const result = applyTableOp({ op: 'set-battle-mods', tableBattleMods: mods }, {});
    expect(result.tableBattleMods).toEqual(mods);
  });

  it('set-player-emails sets playerEmails', () => {
    const result = applyTableOp({ op: 'set-player-emails', playerEmails: ['a@b.com'] }, {});
    expect(result.playerEmails).toEqual(['a@b.com']);
  });

  it('life-support-select sets selection for roll', () => {
    const result = applyTableOp(
      { op: 'life-support-select', _rollDbId: 42, selectedLifeSupportTargetInstanceId: 'char-1' },
      {}
    );
    expect(result.lifeSupportSelections).toEqual({ '42': 'char-1' });
  });

  it('life-support-select with null clears selection', () => {
    const state = { lifeSupportSelections: { '42': 'char-1' } };
    const result = applyTableOp(
      { op: 'life-support-select', _rollDbId: 42, selectedLifeSupportTargetInstanceId: null },
      state
    );
    expect(result.lifeSupportSelections).toEqual({});
  });

  it('life-support-clear removes roll from selections', () => {
    const state = { lifeSupportSelections: { '42': 'char-1', '43': 'char-2' } };
    const result = applyTableOp({ op: 'life-support-clear', _rollDbId: 42 }, state);
    expect(result.lifeSupportSelections).toEqual({ '43': 'char-2' });
  });

  it('rest-move-select sets move for character and slot', () => {
    const result = applyTableOp(
      { op: 'rest-move-select', rollDbId: 10, instanceId: 'c1', slot: 1, moveId: 'tend-to-wounds' },
      {}
    );
    expect(result.restMovesSelections).toEqual({ '10': { c1: { move1: 'tend-to-wounds' } } });
  });

  it('rest-move-select merges move2 for same character', () => {
    const state = { restMovesSelections: { '10': { c1: { move1: 'tend-to-wounds' } } } };
    const result = applyTableOp(
      { op: 'rest-move-select', rollDbId: 10, instanceId: 'c1', slot: 2, moveId: 'prepare' },
      state
    );
    expect(result.restMovesSelections['10'].c1).toEqual({ move1: 'tend-to-wounds', move2: 'prepare' });
  });

  it('rest-move-select accepts targetInstanceId and rollResult', () => {
    const result = applyTableOp(
      {
        op: 'rest-move-select',
        rollDbId: 10,
        instanceId: 'c1',
        slot: 1,
        moveId: 'tend-to-wounds',
        targetInstanceId: 'c2',
        rollResult: { dice: '1d4', value: 3 },
      },
      {}
    );
    expect(result.restMovesSelections['10'].c1).toEqual({
      move1: 'tend-to-wounds',
      move1TargetInstanceId: 'c2',
      move1RollResult: { dice: '1d4', value: 3 },
    });
  });

  it('rest-move-clear removes roll from rest moves', () => {
    const state = { restMovesSelections: { '10': { c1: { move1: 'x', move2: 'y' } }, '11': { c2: { move1: 'z' } } } };
    const result = applyTableOp({ op: 'rest-move-clear', _rollDbId: 10 }, state);
    expect(result.restMovesSelections).toEqual({ '11': { c2: { move1: 'z' } } });
  });

  it('update-base-data preserves runtime keys while replacing base data', () => {
    const el = mkElement({
      id: 'adv-1', instanceId: 'inst-1', elementType: 'adversary',
      name: 'Goblin', currentHp: 3, currentStress: 1, conditions: 'poisoned',
      role: 'bruiser', tier: 2, hp_max: 10, features: [{ name: 'Smash' }],
    });
    const state = { activeElements: [el] };
    const newBaseData = { id: 'adv-1', role: 'skulk', tier: 3, hp_max: 15, features: [{ name: 'Sneak' }] };
    const result = applyTableOp({ op: 'update-base-data', elementId: 'adv-1', newBaseData }, state);
    const updated = result.activeElements[0];
    expect(updated.role).toBe('skulk');
    expect(updated.hp_max).toBe(15);
    expect(updated.features[0].name).toBe('Sneak');
    // Runtime keys preserved
    expect(updated.instanceId).toBe('inst-1');
    expect(updated.elementType).toBe('adversary');
    expect(updated.name).toBe('Goblin');
    expect(updated.currentHp).toBe(3);
    expect(updated.currentStress).toBe(1);
    expect(updated.conditions).toBe('poisoned');
    expect(updated.tier).toBe(2);
  });

  it('update-base-data does not affect non-matching elements', () => {
    const state = {
      activeElements: [
        mkElement({ id: 'adv-1', instanceId: 'inst-1' }),
        mkElement({ id: 'adv-2', instanceId: 'inst-2', name: 'Orc' }),
      ],
    };
    const result = applyTableOp({ op: 'update-base-data', elementId: 'adv-1', newBaseData: { id: 'adv-1', role: 'new' } }, state);
    expect(result.activeElements[1].name).toBe('Orc');
    expect(result.activeElements[1].id).toBe('adv-2');
  });

  it('character-library-update replaces base data while preserving runtime keys', () => {
    const char = {
      id: 'char-1', instanceId: 'inst-c', elementType: 'character',
      name: 'Stale Name', tier: 1, maxHp: 6, weapons: [{ name: 'Hand Runes' }],
      currentHp: 4, currentStress: 1, hope: 3, currentArmor: 1,
      conditions: 'dazed', tokenX: 10, tokenY: 20,
      assignedPlayerEmail: 'p@example.com', assignedPlayerUid: 'uid-p', playerName: 'Player',
    };
    const state = { activeElements: [mkElement(), char] };
    const newBaseData = {
      id: 'char-1', name: 'Fresh Name', tier: 2, maxHp: 8,
      weapons: [{ name: 'Dualstaff' }], class: 'Ranger', _source: 'own',
    };
    const result = applyTableOp({ op: 'character-library-update', characterId: 'char-1', newBaseData }, state);
    const updated = result.activeElements[1];

    // Base data replaced from newBaseData
    expect(updated.name).toBe('Fresh Name');
    expect(updated.tier).toBe(2);
    expect(updated.maxHp).toBe(8);
    expect(updated.weapons[0].name).toBe('Dualstaff');
    expect(updated.class).toBe('Ranger');

    // Runtime keys preserved
    expect(updated.instanceId).toBe('inst-c');
    expect(updated.elementType).toBe('character');
    expect(updated.currentHp).toBe(4);
    expect(updated.currentStress).toBe(1);
    expect(updated.hope).toBe(3);
    expect(updated.currentArmor).toBe(1);
    expect(updated.conditions).toBe('dazed');
    expect(updated.tokenX).toBe(10);
    expect(updated.tokenY).toBe(20);
    expect(updated.assignedPlayerEmail).toBe('p@example.com');
    expect(updated.assignedPlayerUid).toBe('uid-p');
    expect(updated.playerName).toBe('Player');
  });

  it('character-library-update preserves V2 featureState on the character element', () => {
    const fs = { Rally: { granted: true }, 'Channel Raw Power': { channelRawPowerDamageBonus: 1 } };
    const char = {
      id: 'char-1', instanceId: 'inst-c', elementType: 'character',
      name: 'Hero', tier: 1, maxHp: 6,
      featureState: fs,
    };
    const state = { activeElements: [char] };
    const newBaseData = { id: 'char-1', name: 'Hero Renamed', tier: 2, maxHp: 8 };
    const result = applyTableOp({ op: 'character-library-update', characterId: 'char-1', newBaseData }, state);
    const updated = result.activeElements[0];
    expect(updated.name).toBe('Hero Renamed');
    expect(updated.featureState).toEqual(fs);
  });

  it('TABLE_STATE_V2_ROOT_KEYS lists session-wide V2 featureState root key', () => {
    expect(TABLE_STATE_V2_ROOT_KEYS).toContain('featureState');
  });

  it('character-library-update does not affect non-matching elements', () => {
    const state = { activeElements: [mkElement({ id: 'adv-1', instanceId: 'inst-1' })] };
    const result = applyTableOp({ op: 'character-library-update', characterId: 'char-1', newBaseData: { id: 'char-1' } }, state);
    expect(result.activeElements[0]).toBe(state.activeElements[0]);
  });

  it('set-map merges into existing mapConfig and preserves map view when op omits it', () => {
    const state = {
      mapConfig: {
        mapImageUrl: 'https://x/map.png',
        mapDimension: 'width',
        mapSizeFt: 100,
        mapImageNaturalWidth: 800,
        mapImageNaturalHeight: 600,
        mapViewZoomRatio: 0.75,
        mapViewPanNorm: { x: 0.2, y: 0.3 },
      },
      activeElements: [],
    };
    const result = applyTableOp({ op: 'set-map', mapSizeFt: 80 }, state);
    expect(result.mapConfig.mapSizeFt).toBe(80);
    expect(result.mapConfig.mapViewZoomRatio).toBe(0.75);
    expect(result.mapConfig.mapViewPanNorm).toEqual({ x: 0.2, y: 0.3 });
  });

  it('set-map clears mapAiImagePrompt when mapImageUrl is removed', () => {
    const state = {
      maps: [
        {
          id: 'm-default',
          name: 'Map 1',
          mapImageUrl: 'https://x/map.png',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
          mapAiImagePrompt: 'a prompt',
          shareWithPlayers: true,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'm-default',
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          mapViewVisibleNorm: null,
          broadcastToPlayers: true,
        },
      ],
      activeMapId: 'm-default',
      gmActiveViewId: 'v1',
      activeElements: [],
    };
    const result = applyTableOp(
      { op: 'set-map', mapImageUrl: null, mapImageNaturalWidth: null, mapImageNaturalHeight: null },
      state,
    );
    expect(result.maps[0].mapImageUrl).toBeNull();
    expect(result.maps[0].mapAiImagePrompt).toBeNull();
  });

  it('set-map with resetTokenPositions clears map view and resets tokens', () => {
    const state = {
      mapConfig: {
        mapImageUrl: 'u',
        mapDimension: 'width',
        mapSizeFt: 100,
        mapImageNaturalWidth: null,
        mapImageNaturalHeight: null,
        mapViewZoomRatio: 0.5,
        mapViewPanNorm: { x: 1, y: 0 },
      },
      activeElements: [mkElement({ tokenX: 10, tokenY: 20 })],
    };
    const result = applyTableOp(
      { op: 'set-map', mapImageUrl: 'v', resetTokenPositions: true },
      state
    );
    expect(result.mapConfig.mapViewZoomRatio).toBeNull();
    expect(result.mapConfig.mapViewPanNorm).toBeNull();
    expect(result.activeElements[0].tokenX).toBeNull();
    expect(result.activeElements[0].tokenY).toBeNull();
  });

  it('set-map-view merges view fields into mapConfig', () => {
    const state = {
      mapConfig: {
        mapImageUrl: 'u',
        mapDimension: 'width',
        mapSizeFt: 100,
        mapImageNaturalWidth: null,
        mapImageNaturalHeight: null,
      },
    };
    const result = applyTableOp(
      {
        op: 'set-map-view',
        mapViewZoomRatio: 0.4,
        mapViewPanNorm: { x: 0.5, y: 0.6 },
      },
      state
    );
    expect(result.mapConfig.mapImageUrl).toBe('u');
    expect(result.mapConfig.mapViewZoomRatio).toBe(0.4);
    expect(result.mapConfig.mapViewPanNorm).toEqual({ x: 0.5, y: 0.6 });
  });

  it('add-map appends a parallel map and focuses it', () => {
    const state = {
      mapConfig: {
        mapImageUrl: 'a',
        mapDimension: 'width',
        mapSizeFt: 100,
        mapImageNaturalWidth: null,
        mapImageNaturalHeight: null,
      },
      activeElements: [],
    };
    const result = applyTableOp({ op: 'add-map', name: 'B' }, state);
    expect(result.maps.length).toBe(2);
    expect(result.maps[1].name).toBe('B');
    expect(result.activeMapId).toBe(result.maps[1].id);
    expect(result.gmMapView).toEqual({
      mapId: result.activeMapId,
      mapViewZoomRatio: null,
      mapViewPanNorm: null,
      mapViewVisibleNorm: null,
    });
  });

  it('add-map with extraCameraVisibleNorms adds additional views with mapViewVisibleNorm', () => {
    const state = {
      mapConfig: {
        mapImageUrl: 'a',
        mapDimension: 'width',
        mapSizeFt: 100,
        mapImageNaturalWidth: null,
        mapImageNaturalHeight: null,
      },
      activeElements: [],
    };
    const result = applyTableOp(
      {
        op: 'add-map',
        name: 'Imported',
        extraCameraVisibleNorms: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.25 }],
      },
      state,
    );
    const newMapId = result.maps[result.maps.length - 1].id;
    const onMap = result.mapViews.filter((v) => v.mapId === newMapId);
    expect(onMap.length).toBe(2);
    expect(onMap[0].name).toBe('Main');
    expect(onMap[1].name).toBe('Camera 2');
    expect(onMap[1].mapViewVisibleNorm).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.25 });
  });

  it('set-active-map switches focus and clears broadcast framing', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
        {
          id: 'b',
          name: 'B',
          mapImageUrl: 'y',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      activeMapId: 'a',
      gmMapView: { mapId: 'a', mapViewZoomRatio: 0.5, mapViewPanNorm: { x: 0.1, y: 0.2 } },
      activeElements: [],
    };
    const result = applyTableOp({ op: 'set-active-map', activeMapId: 'b' }, state);
    expect(result.activeMapId).toBe('b');
    expect(result.gmMapView).toEqual({
      mapId: 'b',
      mapViewZoomRatio: null,
      mapViewPanNorm: null,
      mapViewVisibleNorm: null,
    });
  });

  it('set-active-view selects a view and syncs activeMapId', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: 0.2,
          mapViewPanNorm: { x: 0.3, y: 0.4 },
          broadcastToPlayers: true,
        },
        {
          id: 'v2',
          mapId: 'a',
          name: 'Close-up',
          mapViewZoomRatio: 0.9,
          mapViewPanNorm: { x: 0.1, y: 0.1 },
          broadcastToPlayers: false,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const result = applyTableOp({ op: 'set-active-view', viewId: 'v2' }, state);
    expect(result.gmActiveViewId).toBe('v2');
    expect(result.activeMapId).toBe('a');
    expect(result.mapConfig.mapViewZoomRatio).toBe(0.9);
    // Snapshot mapConfig must carry the selected view’s framing (BattleMap GM hydrate decodes this after switching views).
    expect(result.mapConfig.mapViewPanNorm).toEqual({ x: 0.1, y: 0.1 });
  });

  it('force-player-map-view increments playerMapViewFocus for a broadcast view', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
          shareWithPlayers: true,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: 0.2,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const r = applyTableOp({ op: 'force-player-map-view', viewId: 'v1' }, state);
    expect(r.playerMapViewFocus.seq).toBe(1);
    expect(r.playerMapViewFocus.viewId).toBe('v1');
    expect(r.playerMapViewFocus.freeMapExploreMapId).toBeNull();
  });

  it('force-player-map-view succeeds for a broadcast view even when the map is not shared with players', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
          shareWithPlayers: false,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: 0.2,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const r = applyTableOp({ op: 'force-player-map-view', viewId: 'v1' }, state);
    expect(r.playerMapViewFocus.seq).toBe(1);
    expect(r.playerMapViewFocus.viewId).toBe('v1');
  });

  it('force-player-map-view is a no-op for a non-broadcast view', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
          shareWithPlayers: true,
        },
      ],
      mapViews: [
        {
          id: 'v2',
          mapId: 'a',
          name: 'Secret',
          mapViewZoomRatio: 0.9,
          mapViewPanNorm: null,
          broadcastToPlayers: false,
        },
      ],
      gmActiveViewId: 'v2',
      activeMapId: 'a',
      activeElements: [],
    };
    const r = applyTableOp({ op: 'force-player-map-view', viewId: 'v2' }, state);
    expect(r).toEqual({});
  });

  it('force-player-map-view allows free-map tile when map is shared with players', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
          shareWithPlayers: true,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const r = applyTableOp({ op: 'force-player-map-view', freeMapExploreMapId: 'a' }, state);
    expect(r.playerMapViewFocus.seq).toBe(1);
    expect(r.playerMapViewFocus.viewId).toBeNull();
    expect(r.playerMapViewFocus.freeMapExploreMapId).toBe('a');
  });

  it('set-map-share toggles map shareWithPlayers', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
          shareWithPlayers: true,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeElements: [],
    };
    const result = applyTableOp({ op: 'set-map-share', mapId: 'a', shareWithPlayers: false }, state);
    expect(result.maps[0].shareWithPlayers).toBe(false);
  });

  it('set-map-free-explore clears gmActiveViewId and keeps framing on gmMapView only', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: 0.5,
          mapViewPanNorm: { x: 0.1, y: 0.2 },
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const result = applyTableOp({ op: 'set-map-free-explore', mapId: 'a' }, state);
    expect(result.gmActiveViewId).toBeNull();
    expect(result.activeMapId).toBe('a');
    expect(result.mapViews[0].mapViewZoomRatio).toBe(0.5);
    expect(result.mapConfig.mapViewZoomRatio).toBeNull();
  });

  it('set-map-view with gmActiveViewId null updates gmMapView only', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: 0.5,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: null,
      activeMapId: 'a',
      gmMapView: { mapId: 'a', mapViewZoomRatio: null, mapViewPanNorm: null },
      activeElements: [],
    };
    const result = applyTableOp(
      {
        op: 'set-map-view',
        viewId: null,
        mapId: 'a',
        mapViewZoomRatio: 0.8,
        mapViewPanNorm: { x: 0.3, y: 0.4 },
      },
      state,
    );
    expect(result.mapViews[0].mapViewZoomRatio).toBe(0.5);
    expect(result.mapConfig.mapViewZoomRatio).toBe(0.8);
  });

  it('remove-map clears tokens on that map and cannot remove last map', () => {
    const mkMap = (id, url) => ({
      id,
      name: id,
      mapImageUrl: url,
      mapDimension: 'width',
      mapSizeFt: 100,
      mapImageNaturalWidth: null,
      mapImageNaturalHeight: null,
    });
    const state = {
      maps: [mkMap('a', 'x'), mkMap('b', 'y')],
      activeMapId: 'b',
      gmMapView: { mapId: 'b', mapViewZoomRatio: null, mapViewPanNorm: null },
      activeElements: [mkElement({ instanceId: 't1', tokenX: 1, tokenY: 2, mapId: 'b' })],
    };
    const removed = applyTableOp({ op: 'remove-map', mapId: 'b' }, state);
    expect(removed.maps.length).toBe(1);
    expect(removed.activeMapId).toBe('a');
    expect(removed.activeElements[0].tokenX).toBeNull();
    expect(removed.activeElements[0].mapId).toBeNull();

    const single = applyTableOp({ op: 'remove-map', mapId: 'a' }, { ...state, maps: [mkMap('a', 'x')], activeMapId: 'a', activeElements: [] });
    expect(single).toEqual({});
  });

  it('set-map-overlay stores overlayPng on the map row', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const png = 'data:image/png;base64,AAAA';
    const result = applyTableOp({ op: 'set-map-overlay', mapId: 'a', overlayPng: png }, state);
    expect(result.maps[0].overlayPng).toBe(png);
  });

  it('set-map-fog legacy op still applies overlayPng', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const png = 'data:image/png;base64,LEGACY';
    const result = applyTableOp({ op: 'set-map-fog', mapId: 'a', fogPng: png }, state);
    expect(result.maps[0].overlayPng).toBe(png);
    expect(result.maps[0].fogPng).toBeUndefined();
  });

  it('set-map-view-overlay stores overlayPng on the map view row', () => {
    const state = {
      maps: [
        {
          id: 'a',
          name: 'A',
          mapImageUrl: 'x',
          mapDimension: 'width',
          mapSizeFt: 100,
          mapImageNaturalWidth: null,
          mapImageNaturalHeight: null,
        },
      ],
      mapViews: [
        {
          id: 'v1',
          mapId: 'a',
          name: 'Main',
          mapViewZoomRatio: null,
          mapViewPanNorm: null,
          broadcastToPlayers: true,
        },
      ],
      gmActiveViewId: 'v1',
      activeMapId: 'a',
      activeElements: [],
    };
    const png = 'data:image/png;base64,BBBB';
    const result = applyTableOp({ op: 'set-map-view-overlay', viewId: 'v1', overlayPng: png }, state);
    expect(result.mapViews[0].overlayPng).toBe(png);
  });

  it('unknown op returns empty object', () => {
    const result = applyTableOp({ op: 'nonexistent' }, {});
    expect(result).toEqual({});
  });
});


// ---------------------------------------------------------------------------
// RUNTIME_KEYS sanity check
// ---------------------------------------------------------------------------

describe('RUNTIME_KEYS', () => {
  it('contains expected core keys', () => {
    expect(RUNTIME_KEYS).toContain('instanceId');
    expect(RUNTIME_KEYS).toContain('elementType');
    expect(RUNTIME_KEYS).toContain('currentHp');
    expect(RUNTIME_KEYS).toContain('name');
    expect(RUNTIME_KEYS).toContain('tier');
    expect(RUNTIME_KEYS).toContain('mapId');
  });
});

// ---------------------------------------------------------------------------
// CHARACTER_RUNTIME_KEYS — keys preserved per-element when resolving characters
// ---------------------------------------------------------------------------

describe('CHARACTER_RUNTIME_KEYS', () => {
  it('contains the expected table-local keys', () => {
    expect(CHARACTER_RUNTIME_KEYS).toContain('instanceId');
    expect(CHARACTER_RUNTIME_KEYS).toContain('elementType');
    expect(CHARACTER_RUNTIME_KEYS).toContain('currentHp');
    expect(CHARACTER_RUNTIME_KEYS).toContain('currentStress');
    expect(CHARACTER_RUNTIME_KEYS).toContain('hope');
    expect(CHARACTER_RUNTIME_KEYS).toContain('currentArmor');
    expect(CHARACTER_RUNTIME_KEYS).toContain('conditions');
    expect(CHARACTER_RUNTIME_KEYS).toContain('tokenX');
    expect(CHARACTER_RUNTIME_KEYS).toContain('tokenY');
    expect(CHARACTER_RUNTIME_KEYS).toContain('mapId');
    expect(CHARACTER_RUNTIME_KEYS).toContain('assignedPlayerEmail');
    expect(CHARACTER_RUNTIME_KEYS).toContain('assignedPlayerUid');
    expect(CHARACTER_RUNTIME_KEYS).toContain('playerName');
    expect(CHARACTER_RUNTIME_KEYS).toContain('prayerDice');
  });

  it('does NOT contain base-data keys that should come from the library', () => {
    // These fields should come from the library record, not the stored element.
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('name');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('tier');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxHp');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxStress');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxHope');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('maxArmor');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('evasion');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('traits');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('class');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('weapons');
    expect(CHARACTER_RUNTIME_KEYS).not.toContain('classFeatures');
  });
});

// ---------------------------------------------------------------------------
// Character resolution logic — simulates the resolvedActiveElements useMemo
// ---------------------------------------------------------------------------

describe('character resolution logic', () => {
  // Pure function that mirrors the app.jsx useMemo logic.
  const resolveElements = (activeElements, libraryCharacters) => {
    const libraryById = new Map(libraryCharacters.map(c => [c.id, c]));
    return activeElements.map(el => {
      if (el.elementType !== 'character' || !el.id) return el;
      const libraryChar = libraryById.get(el.id);
      if (!libraryChar) return el;
      const runtime = {};
      CHARACTER_RUNTIME_KEYS.forEach(k => { if (k in el) runtime[k] = el[k]; });
      return { ...libraryChar, ...runtime };
    });
  };

  it('merges library base data onto a character element', () => {
    const stored = {
      id: 'char-1', instanceId: 'inst-1', elementType: 'character',
      name: 'Old Name', tier: 1, maxHp: 6,
      currentHp: 4, currentStress: 1, hope: 3,
      conditions: 'dazed', tokenX: 10, tokenY: 20,
    };
    const library = [{ id: 'char-1', name: 'Updated Name', tier: 2, maxHp: 8, class: 'Bard' }];
    const [resolved] = resolveElements([stored], library);

    // Base data comes from library
    expect(resolved.name).toBe('Updated Name');
    expect(resolved.tier).toBe(2);
    expect(resolved.maxHp).toBe(8);
    expect(resolved.class).toBe('Bard');

    // Runtime state preserved from stored element
    expect(resolved.currentHp).toBe(4);
    expect(resolved.currentStress).toBe(1);
    expect(resolved.hope).toBe(3);
    expect(resolved.conditions).toBe('dazed');
    expect(resolved.tokenX).toBe(10);
    expect(resolved.tokenY).toBe(20);
    expect(resolved.instanceId).toBe('inst-1');
    expect(resolved.elementType).toBe('character');
  });

  it('preserves prayerDice pool when merging library (Seraph)', () => {
    const stored = {
      id: 'char-1',
      instanceId: 'inst-1',
      elementType: 'character',
      prayerDice: { pool: [2, 3, 4] },
    };
    const library = [{ id: 'char-1', name: 'Seraph', class: 'Seraph' }];
    const [resolved] = resolveElements([stored], library);
    expect(resolved.prayerDice).toEqual({ pool: [2, 3, 4] });
  });

  it('falls back to stored data when library character is not found', () => {
    const stored = {
      id: 'char-99', instanceId: 'inst-1', elementType: 'character',
      name: 'Orphan', maxHp: 6, currentHp: 5,
    };
    const library = [{ id: 'char-1', name: 'Someone Else' }];
    const [resolved] = resolveElements([stored], library);

    expect(resolved).toBe(stored); // exact same reference
  });

  it('passes through non-character elements unchanged', () => {
    const adversary = { id: 'adv-1', instanceId: 'inst-a', elementType: 'adversary', name: 'Goblin' };
    const library = [];
    const [resolved] = resolveElements([adversary], library);
    expect(resolved).toBe(adversary);
  });

  it('falls through for characters without an id (manually created)', () => {
    const stored = {
      instanceId: 'inst-manual', elementType: 'character', name: 'Manual Hero', currentHp: 5,
    };
    const library = [{ id: 'char-1', name: 'Library Hero' }];
    const [resolved] = resolveElements([stored], library);
    expect(resolved).toBe(stored);
  });

  it('resolves multiple instances of the same library character independently', () => {
    const el1 = { id: 'char-1', instanceId: 'inst-1', elementType: 'character', currentHp: 3, conditions: 'hurt' };
    const el2 = { id: 'char-1', instanceId: 'inst-2', elementType: 'character', currentHp: 6, conditions: '' };
    const library = [{ id: 'char-1', name: 'Hero', maxHp: 8 }];
    const resolved = resolveElements([el1, el2], library);

    expect(resolved[0].instanceId).toBe('inst-1');
    expect(resolved[0].currentHp).toBe(3);
    expect(resolved[0].conditions).toBe('hurt');
    expect(resolved[1].instanceId).toBe('inst-2');
    expect(resolved[1].currentHp).toBe(6);
    // Both pick up library base data
    expect(resolved[0].name).toBe('Hero');
    expect(resolved[1].name).toBe('Hero');
    expect(resolved[0].maxHp).toBe(8);
    expect(resolved[1].maxHp).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// computeArmorModifiers — armor feature stat/roll modifier extraction
// ---------------------------------------------------------------------------

describe('computeArmorModifiers', () => {
  it('returns empty result for null armor', () => {
    const result = computeArmorModifiers(null);
    expect(result.traits).toEqual({});
    expect(result.evasion).toBe(0);
    expect(result.rollModifiers).toEqual([]);
    expect(result.feature).toBeNull();
    expect(result.sources).toEqual([]);
  });

  it('returns empty result for armor without features', () => {
    const result = computeArmorModifiers({ name: 'Leather Armor', features: [] });
    expect(result.traits).toEqual({});
    expect(result.evasion).toBe(0);
    expect(result.feature).toBeNull();
  });

  it('parses Flexible: +1 to Evasion', () => {
    const armor = { name: 'Gambeson Armor', features: [{ name: 'Flexible', description: '+1 to Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(1);
    expect(result.feature).toEqual({ name: 'Flexible', description: '+1 to Evasion' });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ armor: 'Gambeson Armor', feature: 'Flexible', stat: 'evasion', value: 1 });
  });

  it('parses Heavy: -1 to Evasion', () => {
    const armor = { name: 'Chainmail Armor', features: [{ name: 'Heavy', description: '-1 to Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(-1);
    expect(result.sources[0].value).toBe(-1);
  });

  it('parses Very Heavy: -2 to Evasion; -1 to Agility', () => {
    const armor = { name: 'Full Plate Armor', features: [{ name: 'Very Heavy', description: '-2 to Evasion; -1 to Agility' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(-2);
    expect(result.traits.agility).toBe(-1);
    expect(result.sources).toHaveLength(2);
  });

  it('parses Gilded: +1 to Presence', () => {
    const armor = { name: 'Bellamoi Fine Armor', features: [{ name: 'Gilded', description: '+1 to Presence' }] };
    const result = computeArmorModifiers(armor);
    expect(result.traits.presence).toBe(1);
    expect(result.evasion).toBe(0);
    expect(result.sources).toHaveLength(1);
  });

  it('parses Difficult: -1 to all character traits and Evasion', () => {
    const armor = { name: 'Savior Chainmail', features: [{ name: 'Difficult', description: '-1 to all character traits and Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.traits.agility).toBe(-1);
    expect(result.traits.strength).toBe(-1);
    expect(result.traits.finesse).toBe(-1);
    expect(result.traits.instinct).toBe(-1);
    expect(result.traits.presence).toBe(-1);
    expect(result.traits.knowledge).toBe(-1);
    expect(result.evasion).toBe(-1);
    expect(result.sources).toHaveLength(7);
  });

  it('parses Channeling: +1 to Spellcast Rolls as a roll modifier', () => {
    const armor = { name: 'Channeling Armor', features: [{ name: 'Channeling', description: '+1 to Spellcast Rolls' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(0);
    expect(result.traits).toEqual({});
    expect(result.rollModifiers).toHaveLength(1);
    expect(result.rollModifiers[0]).toMatchObject({ name: 'Channeling', score: 1, rollType: 'spellcast' });
  });

  it('parses Quiet: +2 bonus to rolls to move silently as a roll modifier', () => {
    const armor = { name: 'Tyris Soft Armor', features: [{ name: 'Quiet', description: 'You gain a +2 bonus to rolls you make to move silently.' }] };
    const result = computeArmorModifiers(armor);
    expect(result.rollModifiers).toHaveLength(1);
    expect(result.rollModifiers[0]).toMatchObject({ name: 'Quiet', score: 2, rollType: 'stealth' });
  });

  it('stores feature info for display-only features like Truthseeking', () => {
    const armor = { name: 'Veritas Opal Armor', features: [{ name: 'Truthseeking', description: 'This armor glows when another creature within Close range tells a lie.' }] };
    const result = computeArmorModifiers(armor);
    expect(result.feature).toEqual({ name: 'Truthseeking', description: 'This armor glows when another creature within Close range tells a lie.' });
    expect(result.evasion).toBe(0);
    expect(result.traits).toEqual({});
    expect(result.rollModifiers).toEqual([]);
  });

  it('handles armor with feature using text field instead of description', () => {
    const armor = { name: 'Gambeson', features: [{ name: 'Flexible', text: '+1 to Evasion' }] };
    const result = computeArmorModifiers(armor);
    expect(result.evasion).toBe(1);
    expect(result.feature.description).toBe('+1 to Evasion');
  });
});

// ---------------------------------------------------------------------------
// applyV2ActiveModifierMutations — V2 engine → Phase 1 activeModifiers
// ---------------------------------------------------------------------------

describe('applyV2ActiveModifierMutations', () => {
  const char = (id, mods = []) => ({
    id: 'lib-1',
    instanceId: id,
    elementType: 'character',
    name: 'Hero',
    activeModifiers: mods,
  });

  it('appends a modifier with id+name', () => {
    const els = [char('c1')];
    const next = applyV2ActiveModifierMutations(els, [
      { type: 'appendActiveModifier', payload: { instanceId: 'c1', modifier: { id: 'mod-a', name: 'Bonus Die', dice: 'd6', type: 'test' } } },
    ]);
    expect(next[0].activeModifiers).toEqual([{ id: 'mod-a', name: 'Bonus Die', dice: 'd6', type: 'test' }]);
  });

  it('replaces modifier with same id (upsert)', () => {
    const els = [char('c1', [{ id: 'mod-a', name: 'Bonus Die', dice: 'd6' }])];
    const next = applyV2ActiveModifierMutations(els, [
      { type: 'appendActiveModifier', payload: { instanceId: 'c1', modifier: { id: 'mod-a', name: 'Bonus Die', dice: 'd8' } } },
    ]);
    expect(next[0].activeModifiers).toEqual([{ id: 'mod-a', name: 'Bonus Die', dice: 'd8' }]);
  });

  it('removeActiveModifier drops by id', () => {
    const els = [char('c1', [{ id: 'mod-a', name: 'Bonus Die', dice: 'd6' }])];
    const next = applyV2ActiveModifierMutations(els, [
      { type: 'removeActiveModifier', payload: { instanceId: 'c1', id: 'mod-a' } },
    ]);
    expect(next[0].activeModifiers).toEqual([]);
  });

  it('ignores non-character instanceIds and skips invalid append payloads', () => {
    const els = [{ instanceId: 'a1', elementType: 'adversary', name: 'Goblin' }, char('c1')];
    const next = applyV2ActiveModifierMutations(els, [
      { type: 'appendActiveModifier', payload: { instanceId: 'a1', modifier: { id: 'x', name: 'X' } } },
      { type: 'appendActiveModifier', payload: { instanceId: 'c1', modifier: { id: 'm1', name: 'M' } } },
      { type: 'appendActiveModifier', payload: { instanceId: 'c1', modifier: { id: '', name: 'bad' } } },
    ]);
    expect(next[0]).toEqual(els[0]);
    expect(next[1].activeModifiers).toEqual([{ id: 'm1', name: 'M' }]);
  });

  it('returns original array reference when mutations empty', () => {
    const els = [char('c1')];
    expect(applyV2ActiveModifierMutations(els, [])).toBe(els);
  });
});

describe('applyV2BannerMutations', () => {
  it('applies spendHope to hope on a character', () => {
    const activeElements = [
      { instanceId: 'c1', elementType: 'character', hope: 4, maxHope: 6 },
    ];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'spendHope', payload: { instanceId: 'c1', amount: 2 } }],
      'c1'
    );
    expect(skipped).toHaveLength(0);
    expect(updates).toEqual([{ instanceId: 'c1', updates: { hope: 2 } }]);
  });

  it('returns skipped for unknown mutation types', () => {
    const activeElements = [{ instanceId: 'c1', elementType: 'character', hope: 4, maxHope: 6 }];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'rerollDie', payload: { rollKey: 'damage' } }],
      'c1'
    );
    expect(updates).toHaveLength(0);
    expect(skipped.length).toBe(1);
  });

  it('applies setFeatureState on the owner character', () => {
    const activeElements = [{ instanceId: 'c1', elementType: 'character', featureState: {} }];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'setFeatureState', payload: { featureKey: 'Rally', key: 'granted', value: true } }],
      'c1'
    );
    expect(skipped).toHaveLength(0);
    expect(updates[0].updates.featureState.Rally).toEqual({ granted: true });
  });

  it('clears legacy element activeBeastform when Druid scoped activeBeastform is set to null', () => {
    const activeElements = [
      {
        instanceId: 'c1',
        elementType: 'character',
        featureState: { [SRD_CLASS_DRUID_SCOPE_KEY]: { activeBeastform: { beastformId: 'x' } } },
        activeBeastform: { name: 'Wolf' },
        selectedBeastformAdvantage: 'Keen',
      },
    ];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [
        {
          type: 'setFeatureState',
          payload: { featureKey: SRD_CLASS_DRUID_SCOPE_KEY, key: 'activeBeastform', value: null },
        },
      ],
      'c1'
    );
    expect(skipped).toHaveLength(0);
    expect(updates[0].updates.activeBeastform).toBeNull();
    expect(updates[0].updates.selectedBeastformAdvantage).toBeNull();
    expect(updates[0].updates.featureState[SRD_CLASS_DRUID_SCOPE_KEY].activeBeastform).toBeNull();
    expect(updates[0].updates.featureState[SRD_CLASS_DRUID_SCOPE_KEY].evolutionTraitKey).toBeNull();
  });

  it('applies gainHope', () => {
    const activeElements = [{ instanceId: 'c1', elementType: 'character', hope: 2, maxHope: 6 }];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'gainHope', payload: { instanceId: 'c1', amount: 2 } }],
      'c1'
    );
    expect(skipped).toHaveLength(0);
    expect(updates).toEqual([{ instanceId: 'c1', updates: { hope: 4 } }]);
  });

  it('applies markStress to an adversary (Warden Water splash, etc.)', () => {
    const activeElements = [
      { instanceId: 'adv-splash', elementType: 'adversary', currentStress: 0, maxStress: 6 },
    ];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'markStress', payload: { instanceId: 'adv-splash', amount: 1 } }],
      undefined
    );
    expect(skipped).toHaveLength(0);
    expect(updates).toEqual([{ instanceId: 'adv-splash', updates: { currentStress: 1 } }]);
  });

  it('applies clearStress to an adversary', () => {
    const activeElements = [
      { instanceId: 'adv-1', elementType: 'adversary', currentStress: 3, maxStress: 6 },
    ];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'clearStress', payload: { instanceId: 'adv-1', amount: 2 } }],
      undefined
    );
    expect(skipped).toHaveLength(0);
    expect(updates).toEqual([{ instanceId: 'adv-1', updates: { currentStress: 1 } }]);
  });

  it('clearStress applies when mutation instanceId matches library id (canonical table instanceId)', () => {
    const activeElements = [
      {
        instanceId: 'table-ally',
        id: 'lib-ally',
        elementType: 'character',
        currentStress: 3,
        maxStress: 6,
      },
    ];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [{ type: 'clearStress', payload: { instanceId: 'lib-ally', amount: 2 } }],
      'table-bard'
    );
    expect(skipped).toHaveLength(0);
    expect(updates).toEqual([{ instanceId: 'table-ally', updates: { currentStress: 1 } }]);
  });

  it('applies move mutation as v2PendingMove on the mover element', () => {
    const activeElements = [{ instanceId: 'adv-1', elementType: 'adversary', name: 'Goblin' }];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [
        {
          type: 'move',
          payload: {
            instanceId: 'adv-1',
            desiredCondition: 'In Melee range from attacker',
            description: 'Pull into Melee.',
            rollDbId: 1001,
            conditionFn: () => true,
          },
        },
      ],
      'c1'
    );
    expect(skipped).toHaveLength(0);
    expect(updates[0].updates.v2PendingMove).toMatchObject({
      rollDbId: 1001,
      moverInstanceId: 'adv-1',
      desiredCondition: 'In Melee range from attacker',
      description: 'Pull into Melee.',
      conditionMet: false,
    });
  });

  it('move mutation with freezeOtherInstanceId locks the other actor moveDisabledSources', () => {
    const activeElements = [
      { instanceId: 'c-att', elementType: 'character', name: 'Faun' },
      { instanceId: 'c-tgt', elementType: 'character', name: 'Goblin' },
    ];
    const { updates, skipped } = applyV2BannerMutations(
      activeElements,
      [
        {
          type: 'move',
          payload: {
            instanceId: 'c-att',
            desiredCondition: 'Very Close range',
            description: '',
            rollDbId: 42,
            conditionFn: () => true,
            freezeOtherInstanceId: 'c-tgt',
            freezeReason: 'Kick: pending map position',
          },
        },
      ],
      'c-att'
    );
    expect(skipped).toHaveLength(0);
    const byId = Object.fromEntries(updates.map((u) => [u.instanceId, u.updates]));
    expect(byId['c-att'].v2PendingMove).toMatchObject({
      rollDbId: 42,
      frozenInstanceId: 'c-tgt',
      frozenLockSource: 'Kick: pending map position',
    });
    expect(byId['c-tgt'].moveDisabledSources).toEqual(['Kick: pending map position']);
    expect(byId['c-tgt'].v2MoveLockRollDbId).toBe(42);
    expect(byId['c-tgt'].v2MoveLockSource).toBe('Kick: pending map position');
  });
});

// ---------------------------------------------------------------------------
// applyV2LifecycleMutations — rollDie shown on actionLoop (e.g. Rally clear stress)
// ---------------------------------------------------------------------------

describe('applyV2LifecycleMutations (rollDie + actionLoop)', () => {
  it('prepends formatted roll lines to actionLoop description', () => {
    const activeElements = [{ instanceId: 'c1', elementType: 'character', currentStress: 4 }];
    const { updates, actionLoopNotifications } = applyV2LifecycleMutations(
      activeElements,
      [
        { type: 'rollDie', payload: { notation: 'd6', results: [4], total: 4 } },
        { type: 'clearStress', payload: { instanceId: 'c1', amount: 4 } },
        {
          type: 'actionLoop',
          payload: {
            instanceId: 'c1',
            title: 'Rally',
            description: 'Long feature text.',
            rollUser: 'Finn',
          },
        },
      ],
      undefined
    );
    expect(updates).toEqual([{ instanceId: 'c1', updates: { currentStress: 0 } }]);
    expect(actionLoopNotifications).toHaveLength(1);
    expect(actionLoopNotifications[0].description).toBe('Rolled d6: **4**\n\nLong feature text.');
    expect(actionLoopNotifications[0]._v2RollDiePayloads).toEqual([
      { notation: 'd6', results: [4], total: 4 },
    ]);
  });

  it('does not pass rollDie to banner merge (no spurious skipped mutations)', () => {
    const { skipped } = applyV2LifecycleMutations(
      [{ instanceId: 'c1', elementType: 'character', currentStress: 0 }],
      [
        { type: 'rollDie', payload: { notation: 'd8', results: [3], total: 3 } },
        {
          type: 'actionLoop',
          payload: { instanceId: 'c1', title: 'X', description: 'Y', rollUser: 'Z' },
        },
      ],
      undefined
    );
    expect(skipped.map((m) => m.type)).not.toContain('rollDie');
  });

  it('emits a minimal actionLoop when rollDie + clearStress but no actionLoop (e.g. cross-sheet chip)', () => {
    const activeElements = [{ instanceId: 'c1', elementType: 'character', name: 'River', currentStress: 3 }];
    const { actionLoopNotifications } = applyV2LifecycleMutations(
      activeElements,
      [
        { type: 'rollDie', payload: { notation: 'd6', results: [5], total: 5 } },
        { type: 'clearStress', payload: { instanceId: 'c1', amount: 5 } },
      ],
      undefined
    );
    expect(actionLoopNotifications).toEqual([
      {
        instanceId: 'c1',
        title: 'Dice roll',
        description: 'Rolled d6: **5**',
        rollUser: 'River',
        _v2RollDiePayloads: [{ notation: 'd6', results: [5], total: 5 }],
      },
    ]);
  });
});

describe('formatV2RollDieMutationLine', () => {
  it('formats multi-die notation', () => {
    expect(
      formatV2RollDieMutationLine({
        type: 'rollDie',
        payload: { notation: '2d6', results: [4, 5], total: 9 },
      })
    ).toBe('Rolled 2d6: 4 + 5 = **9**');
  });
});

// ---------------------------------------------------------------------------
// applyV2LifecycleMutations — string conditions must not spread into characters
// ---------------------------------------------------------------------------

describe('applyV2LifecycleMutations (conditions)', () => {
  it('addCondition appends to comma-separated string without splitting prior text into letters', () => {
    const activeElements = [
      { instanceId: 'c1', elementType: 'character', conditions: 'Happy' },
    ];
    const { updates } = applyV2LifecycleMutations(
      activeElements,
      [{ type: 'addCondition', payload: { instanceId: 'c1', condition: 'Cloaked' } }],
      undefined
    );
    expect(updates).toEqual([{ instanceId: 'c1', updates: { conditions: 'Happy, Cloaked' } }]);
  });

  it('removeCondition removes one token from a string list', () => {
    const activeElements = [
      { instanceId: 'c1', elementType: 'character', conditions: 'Happy, Cloaked' },
    ];
    const { updates } = applyV2LifecycleMutations(
      activeElements,
      [{ type: 'removeCondition', payload: { instanceId: 'c1', condition: 'Cloaked' } }],
      undefined
    );
    expect(updates).toEqual([{ instanceId: 'c1', updates: { conditions: 'Happy' } }]);
  });

  it('addCondition resolves adversary when payload id matches element library id', () => {
    const activeElements = [
      { instanceId: 'inst-gob-1', id: 'srd-adv-goblin', elementType: 'adversary', conditions: '' },
    ];
    const { updates } = applyV2LifecycleMutations(
      activeElements,
      [{ type: 'addCondition', payload: { instanceId: 'srd-adv-goblin', condition: 'Vulnerable' } }],
      undefined
    );
    expect(updates).toEqual([{ instanceId: 'inst-gob-1', updates: { conditions: 'Vulnerable' } }]);
  });

  it('still supports legacy array conditions', () => {
    const activeElements = [
      { instanceId: 'c1', elementType: 'character', conditions: ['Happy'] },
    ];
    const { updates } = applyV2LifecycleMutations(
      activeElements,
      [{ type: 'addCondition', payload: { instanceId: 'c1', condition: 'Cloaked' } }],
      undefined
    );
    expect(updates).toEqual([{ instanceId: 'c1', updates: { conditions: 'Happy, Cloaked' } }]);
  });
});

// ---------------------------------------------------------------------------
// partitionV2BannerChipMutations — V2 banner chip → local vs server follow-up
// ---------------------------------------------------------------------------

describe('partitionV2BannerChipMutations', () => {
  it('routes Hope/Fear rerolls and addDamageRoll to server follow-ups; keeps resource mutations local', () => {
    const mutations = [
      { type: 'spendHope', payload: { instanceId: 'c1', amount: 1 } },
      { type: 'rerollDie', payload: { rollKey: 'action', dieType: 'hopeDie' } },
      { type: 'rerollDie', payload: { rollKey: 'action', dieType: 'fearDie' } },
      { type: 'addDamageRoll', payload: { name: 'Extra', dice: 'd6', targetInstanceIds: ['a1'] } },
      { type: 'rerollDie', payload: { rollKey: 'damage', dieType: 'damageDie', dieName: 'damage' } },
      { type: 'addRollStatic', payload: { rollKey: 'action', name: 'X', value: 2 } },
    ];
    const { localMutations, serverFollowups, engineRollDisplayOnly, unsupported } =
      partitionV2BannerChipMutations(mutations);
    expect(localMutations.map((m) => m.type)).toEqual(['spendHope']);
    expect(engineRollDisplayOnly.map((m) => m.type)).toEqual([]);
    expect(serverFollowups.map((f) => f.kind)).toEqual(['rerollDie', 'addDamage', 'patchActionRollAddStatic']);
    expect(serverFollowups[2].payload).toEqual({ value: 2, name: 'X' });
    expect(serverFollowups[0].dieType).toBe('Duality');
    expect(unsupported.map((m) => m.type)).toEqual(['rerollDie']);
    expect(unsupported[0].payload.dieType).toBe('damageDie');
  });

  it('merges adjacent Hope+Fear rerolls into one Duality follow-up (Faerie Luckbender-style)', () => {
    const mutations = [
      { type: 'spendHope', payload: { instanceId: 'c1', amount: 3 } },
      { type: 'rerollDie', payload: { rollKey: 'action', dieType: 'hopeDie' } },
      { type: 'rerollDie', payload: { rollKey: 'action', dieType: 'fearDie' } },
    ];
    const { serverFollowups, unsupported } = partitionV2BannerChipMutations(mutations);
    expect(serverFollowups).toHaveLength(1);
    expect(serverFollowups[0].kind).toBe('rerollDie');
    expect(serverFollowups[0].dieType).toBe('Duality');
    expect(unsupported).toHaveLength(0);
  });

  it('normalizeV2BannerChipMutations merges Hope then Fear and Fear then Hope', () => {
    const a = [
      { type: 'rerollDie', payload: { dieType: 'hopeDie' } },
      { type: 'rerollDie', payload: { dieType: 'fearDie' } },
    ];
    const b = [
      { type: 'rerollDie', payload: { dieType: 'fearDie' } },
      { type: 'rerollDie', payload: { dieType: 'hopeDie' } },
    ];
    expect(normalizeV2BannerChipMutations(a)).toEqual([
      { type: 'rerollDie', payload: { dieType: 'dualityDie', _mergedFrom: [a[0], a[1]] } },
    ]);
    expect(normalizeV2BannerChipMutations(b)).toEqual([
      { type: 'rerollDie', payload: { dieType: 'dualityDie', _mergedFrom: [b[0], b[1]] } },
    ]);
  });

  it('empty input yields empty partitions', () => {
    expect(partitionV2BannerChipMutations(null)).toEqual({
      localMutations: [],
      serverFollowups: [],
      engineRollDisplayOnly: [],
      unsupported: [],
    });
  });

  it('routes setRollOutcome to engineRollDisplayOnly (Fearless / Infernis — GMTableView applies via chipHopeConvertedIds)', () => {
    const { engineRollDisplayOnly, localMutations } = partitionV2BannerChipMutations([
      { type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'hope' } },
    ]);
    expect(engineRollDisplayOnly).toEqual([
      { type: 'setRollOutcome', payload: { rollKey: 'action', outcome: 'hope' } },
    ]);
    expect(localMutations).toEqual([]);
  });

  it('routes damage addRollDie to addDamage; action addRollDie to patchActionRollAddDie', () => {
    const { serverFollowups, engineRollDisplayOnly } = partitionV2BannerChipMutations([
      { type: 'addRollDie', payload: { rollKey: 'damage', name: 'Sneak Attack', die: '2d6' } },
      { type: 'addRollDie', payload: { rollKey: 'action', name: 'Aim', die: 'd6' } },
    ]);
    expect(serverFollowups).toHaveLength(2);
    expect(serverFollowups[0].kind).toBe('addDamage');
    expect(serverFollowups[0].payload).toEqual({ dice: '2d6', name: 'Sneak Attack' });
    expect(serverFollowups[1].kind).toBe('patchActionRollAddDie');
    expect(serverFollowups[1].payload).toEqual({ die: 'd6', name: 'Aim' });
    expect(engineRollDisplayOnly).toEqual([]);
  });

  it('routes addRollStatic action to patchActionRollAddStatic; damage to addDamage', () => {
    const { serverFollowups, engineRollDisplayOnly } = partitionV2BannerChipMutations([
      { type: 'addRollStatic', payload: { rollKey: 'action', name: 'Prayer', value: 3 } },
      { type: 'addRollStatic', payload: { rollKey: 'damage', name: 'PD', value: 2 } },
    ]);
    expect(serverFollowups).toHaveLength(2);
    expect(serverFollowups[0]).toEqual(
      expect.objectContaining({
        kind: 'patchActionRollAddStatic',
        payload: { value: 3, name: 'Prayer' },
      })
    );
    expect(serverFollowups[1]).toEqual(
      expect.objectContaining({
        kind: 'addDamage',
        payload: { dice: '2', name: 'PD' },
      })
    );
    expect(engineRollDisplayOnly).toEqual([]);
  });

  it('routes unknown rollKey addRollDie to engineRollDisplayOnly', () => {
    const { serverFollowups, engineRollDisplayOnly } = partitionV2BannerChipMutations([
      { type: 'addRollDie', payload: { rollKey: 'other', name: 'X', die: 'd6' } },
    ]);
    expect(serverFollowups).toEqual([]);
    expect(engineRollDisplayOnly).toHaveLength(1);
    expect(engineRollDisplayOnly[0].payload.rollKey).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// getEffectiveWeaponRange — Giant Reach: Melee → Very Close
// ---------------------------------------------------------------------------
// Rest cycle (GMTableView runRestCycleClear): activeModifiers with refreshOn
// ---------------------------------------------------------------------------

describe('rest cycle activeModifiers clearing', () => {
  it('drops modifiers tagged refreshOn rest when cyclesToClear includes rest', () => {
    const cyclesToClear = ['rest'];
    const mod = { id: 'example', type: 'evasion', value: 1, refreshOn: 'rest' };
    const kept = [mod].filter((m) => !cyclesToClear.includes(m.refreshOn));
    expect(kept).toHaveLength(0);
  });

  it('keeps modifiers without refreshOn (GM must use another mechanism to clear them)', () => {
    const cyclesToClear = ['rest'];
    const modMissingRefresh = { id: 'legacy', type: 'evasion', value: 2 };
    const kept = [modMissingRefresh].filter((m) => !cyclesToClear.includes(m.refreshOn));
    expect(kept).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe('getEffectiveWeaponRange', () => {
  const reachFeatures = [{ name: 'Reach' }];

  it('returns Very Close for Melee weapon when character has Reach (Giant)', () => {
    expect(getEffectiveWeaponRange({ range: 'Melee' }, reachFeatures)).toBe('Very Close');
  });

  it('applies Reach even when effectiveRange was prefetched to match range (sheet must still upgrade)', () => {
    expect(getEffectiveWeaponRange({ range: 'Melee', effectiveRange: 'Melee' }, reachFeatures)).toBe('Very Close');
  });

  it('returns weapon range unchanged when no Reach', () => {
    expect(getEffectiveWeaponRange({ range: 'Melee' }, [])).toBe('Melee');
    expect(getEffectiveWeaponRange({ range: 'Very Close' }, [])).toBe('Very Close');
    expect(getEffectiveWeaponRange({ range: 'Far' }, reachFeatures)).toBe('Far');
  });

  it('does not upgrade non-Melee when character has Reach', () => {
    expect(getEffectiveWeaponRange({ range: 'Very Close' }, reachFeatures)).toBe('Very Close');
    expect(getEffectiveWeaponRange({ range: 'Close' }, reachFeatures)).toBe('Close');
  });

  it('returns empty string for weapon without range', () => {
    expect(getEffectiveWeaponRange({}, reachFeatures)).toBe('');
    expect(getEffectiveWeaponRange(null, reachFeatures)).toBe('');
  });
});
