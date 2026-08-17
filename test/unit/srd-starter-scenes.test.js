/**
 * Unit tests for src/srd-starter-scenes.js (pure helpers — no DB, no Supabase).
 */
import { describe, it, expect } from 'vitest';
import { computeBudget, computeSceneBudget } from '../../src/client/lib/battle-points.js';
import {
  STARTER_SCENE_PARTY_SIZE,
  STARTER_SCENE_MAP_ID,
  STARTER_SCENE_VIEW_ID,
  DEFAULT_STARTER_TABLE_BATTLE_MODS,
  makeSrdSceneId,
  makeStarterEnvironmentInstanceId,
  makeStarterAdversaryInstanceId,
  escapeXml,
  buildScenePlaceholderSvg,
  selectAdversariesForStarterScene,
  buildSrdStarterScene,
  buildSrdStarterScenes,
  shouldGenerateStarterScene,
  STARTER_SCENE_EXCLUDED_ENV_IDS,
  STARTER_SCENE_EXCLUDED_SCENE_IDS,
  STARTER_SCENE_CACHE_SOURCE,
  shouldSkipAdminEditedStarterScene,
} from '../../src/srd-starter-scenes.js';

const REQUIRED_SCENE_KEYS = [
  'id',
  'name',
  'description',
  'maps',
  'mapViews',
  'gmActiveViewId',
  'activeElements',
  'tableBattleMods',
  'sessionCountdowns',
  'conditionsHistory',
  'partySize',
  'partyTier',
  'tier',
  'bp',
];

function bear(overrides = {}) {
  return {
    id: 'srd-adv-bear',
    name: 'Bear',
    role: 'bruiser',
    tier: 1,
    hp_max: 7,
    difficulty: 14,
    ...overrides,
  };
}

function wolf(overrides = {}) {
  return {
    id: 'srd-adv-dire-wolf',
    name: 'Dire Wolf',
    role: 'standard',
    tier: 1,
    hp_max: 5,
    ...overrides,
  };
}

function merchant(overrides = {}) {
  return {
    id: 'srd-adv-merchant',
    name: 'Merchant',
    role: 'social',
    tier: 1,
    hp_max: 3,
    ...overrides,
  };
}

function soloBoss(overrides = {}) {
  return {
    id: 'srd-adv-ancient-dragon',
    name: 'Ancient Dragon',
    role: 'solo',
    tier: 4,
    hp_max: 20,
    ...overrides,
  };
}

function groveEnv(overrides = {}) {
  return {
    id: 'srd-env-abandoned-grove',
    name: 'Abandoned Grove',
    description: 'A quiet stand of trees.',
    tier: 1,
    type: 'exploration',
    potential_adversaries: [
      { adversaryId: 'srd-adv-bear', name: 'Bear' },
      { adversaryId: 'srd-adv-dire-wolf', name: 'Dire Wolf' },
    ],
    ...overrides,
  };
}

const defaultLookup = {
  'srd-adv-bear': bear(),
  'srd-adv-dire-wolf': wolf(),
  'srd-adv-merchant': merchant(),
  'srd-adv-ancient-dragon': soloBoss(),
};

function buildOpts(overrides = {}) {
  return {
    adversaryById: defaultLookup,
    mapImageUrl: 'https://cdn.example/map-images/srd-public/placeholder.svg',
    ...overrides,
  };
}

describe('makeSrdSceneId', () => {
  it('slugifies the environment name with the srd-scene- prefix', () => {
    expect(makeSrdSceneId('Abandoned Grove')).toBe('srd-scene-abandoned-grove');
    expect(makeSrdSceneId("A Soldier's Bond")).toBe('srd-scene-a-soldier-s-bond');
  });
});

describe('buildScenePlaceholderSvg', () => {
  it('emits an 800×600 SVG with the environment name', () => {
    const svg = buildScenePlaceholderSvg('Abandoned Grove');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain('fill="#1a1a2e"');
    expect(svg).toContain('fill="#e2c97e"');
    expect(svg).toContain('Abandoned Grove');
  });

  it('escapes XML in the environment name', () => {
    const svg = buildScenePlaceholderSvg('Grove & <Hall> "X"');
    expect(svg).toContain('Grove &amp; &lt;Hall&gt; &quot;X&quot;');
    expect(svg).not.toContain('Grove & <Hall>');
    expect(escapeXml(`<foo>`)).toBe('&lt;foo&gt;');
  });
});

describe('selectAdversariesForStarterScene', () => {
  it('keeps only entries whose adversaryId exists in the lookup', () => {
    const selected = selectAdversariesForStarterScene(
      [
        { adversaryId: 'srd-adv-bear', name: 'Bear' },
        { adversaryId: 'srd-adv-ghost', name: 'Ghost' },
        { name: 'Nameless' },
      ],
      defaultLookup,
    );
    expect(selected.map((a) => a.id)).toEqual(['srd-adv-bear']);
  });

  it('returns an empty list for Any / empty potential_adversaries', () => {
    expect(selectAdversariesForStarterScene([], defaultLookup)).toEqual([]);
    expect(selectAdversariesForStarterScene(null, defaultLookup)).toEqual([]);
  });

  it('skips see-"…" junk and Any-named rows even if an id is present', () => {
    const selected = selectAdversariesForStarterScene(
      [
        { adversaryId: 'srd-adv-bear', name: 'see "Castle on a Hill"' },
        { adversaryId: 'srd-adv-dire-wolf', name: 'Any' },
      ],
      defaultLookup,
    );
    expect(selected).toEqual([]);
  });

  it('stops before exceeding the party-size-4 budget (14 BP)', () => {
    const many = [
      { adversaryId: 'srd-adv-ancient-dragon', name: 'Ancient Dragon' },
      { adversaryId: 'srd-adv-bear', name: 'Bear' },
      { adversaryId: 'srd-adv-dire-wolf', name: 'Dire Wolf' },
      { adversaryId: 'srd-adv-merchant', name: 'Merchant' },
    ];
    // Extra copies of the same ids (lookup is 1:1) — simulate a long candidate list
    // by adding more unique expensive rows via an extended lookup.
    const bruiser2 = { id: 'srd-adv-ogre', name: 'Ogre', role: 'bruiser', tier: 2, hp_max: 8 };
    const bruiser3 = { id: 'srd-adv-troll', name: 'Troll', role: 'bruiser', tier: 2, hp_max: 8 };
    const lookup = { ...defaultLookup, [bruiser2.id]: bruiser2, [bruiser3.id]: bruiser3 };
    const selected = selectAdversariesForStarterScene(
      [
        ...many,
        { adversaryId: bruiser2.id, name: bruiser2.name },
        { adversaryId: bruiser3.id, name: bruiser3.name },
      ],
      lookup,
    );
    const bp = computeSceneBudget(
      { activeElements: selected.map((a, i) => ({ ...a, elementType: 'adversary', instanceId: `i-${i}` })) },
      STARTER_SCENE_PARTY_SIZE,
    ).bp;
    expect(bp).toBeLessThanOrEqual(computeBudget(4));
    expect(bp).toBeLessThanOrEqual(14);
  });

  it('prefers different roles before duplicate roles', () => {
    const extraBruiser = { id: 'srd-adv-ogre', name: 'Ogre', role: 'bruiser', tier: 1, hp_max: 8 };
    const lookup = { ...defaultLookup, [extraBruiser.id]: extraBruiser };
    const selected = selectAdversariesForStarterScene(
      [
        { adversaryId: 'srd-adv-bear', name: 'Bear' },
        { adversaryId: extraBruiser.id, name: extraBruiser.name },
        { adversaryId: 'srd-adv-dire-wolf', name: 'Dire Wolf' },
      ],
      lookup,
    );
    expect(selected.map((a) => a.id)).toEqual(['srd-adv-bear', 'srd-adv-dire-wolf', extraBruiser.id]);
  });
});

describe('buildSrdStarterScene', () => {
  it('builds one scene per environment in a fixture list', () => {
    const environments = [
      groveEnv(),
      groveEnv({
        id: 'srd-env-busy-port',
        name: 'Busy Port',
        description: 'Ships and shouting.',
        potential_adversaries: [{ adversaryId: 'srd-adv-merchant', name: 'Merchant' }],
      }),
    ];
    const scenes = buildSrdStarterScenes(environments, buildOpts());
    expect(scenes).toHaveLength(2);
    expect(scenes.map((s) => s.id)).toEqual(['srd-scene-abandoned-grove', 'srd-scene-busy-port']);
    expect(scenes.map((s) => s.name)).toEqual(['Abandoned Grove', 'Busy Port']);
  });

  it('skips Ambushed and Ambushers environments (keeps other envs)', () => {
    expect(STARTER_SCENE_EXCLUDED_ENV_IDS).toEqual(['srd-env-ambushed', 'srd-env-ambushers']);
    expect(STARTER_SCENE_EXCLUDED_SCENE_IDS).toEqual(['srd-scene-ambushed', 'srd-scene-ambushers']);
    expect(shouldGenerateStarterScene({ id: 'srd-env-ambushed', name: 'Ambushed' })).toBe(false);
    expect(shouldGenerateStarterScene({ id: 'srd-env-ambushers', name: 'Ambushers' })).toBe(false);
    expect(shouldGenerateStarterScene(groveEnv())).toBe(true);

    const environments = [
      groveEnv(),
      groveEnv({
        id: 'srd-env-ambushed',
        name: 'Ambushed',
        description: 'An ambush.',
        potential_adversaries: [],
      }),
      groveEnv({
        id: 'srd-env-ambushers',
        name: 'Ambushers',
        description: 'The party ambushes.',
        potential_adversaries: [],
      }),
      groveEnv({
        id: 'srd-env-busy-port',
        name: 'Busy Port',
        description: 'Ships and shouting.',
        potential_adversaries: [{ adversaryId: 'srd-adv-merchant', name: 'Merchant' }],
      }),
    ];
    const scenes = buildSrdStarterScenes(environments, buildOpts());
    expect(scenes).toHaveLength(2);
    expect(scenes.map((s) => s.id)).toEqual(['srd-scene-abandoned-grove', 'srd-scene-busy-port']);
    expect(scenes.map((s) => s.name)).toEqual(['Abandoned Grove', 'Busy Port']);
    expect(scenes.some((s) => s.id === 'srd-scene-ambushed' || s.name === 'Ambushed')).toBe(false);
    expect(scenes.some((s) => s.id === 'srd-scene-ambushers' || s.name === 'Ambushers')).toBe(false);
  });

  it('uses stable scene and instance ids across re-runs', () => {
    const env = groveEnv();
    const a = buildSrdStarterScene(env, buildOpts());
    const b = buildSrdStarterScene(env, buildOpts());
    expect(a.id).toBe('srd-scene-abandoned-grove');
    expect(a.id).toBe(b.id);
    expect(a.activeElements.map((el) => el.instanceId)).toEqual(b.activeElements.map((el) => el.instanceId));
    expect(a.activeElements[0].instanceId).toBe(makeStarterEnvironmentInstanceId(a.id));
    expect(a.activeElements[1].instanceId).toBe(
      makeStarterAdversaryInstanceId(a.id, 'srd-adv-bear', 0),
    );
  });

  it('has every required table-shape key', () => {
    const scene = buildSrdStarterScene(groveEnv(), buildOpts());
    for (const key of REQUIRED_SCENE_KEYS) {
      expect(scene, `missing ${key}`).toHaveProperty(key);
    }
    expect(scene._source).toBe('dt');
    expect(STARTER_SCENE_CACHE_SOURCE).toBe('dt');
    expect(scene.id).toMatch(/^srd-scene-/);
    expect(scene.maps[0].id).toBe(STARTER_SCENE_MAP_ID);
    expect(scene.maps[0].mapImageUrl).toBe(buildOpts().mapImageUrl);
    expect(scene.maps[0].mapSizeFt).toBe(250);
    expect(scene.maps[0].mapDimension).toBe('width');
    expect(scene.maps[0].shareWithPlayers).toBe(true);
    expect(scene.mapViews[0].id).toBe(STARTER_SCENE_VIEW_ID);
    expect(scene.mapViews[0].mapId).toBe(STARTER_SCENE_MAP_ID);
    expect(scene.mapViews[0].broadcastToPlayers).toBe(true);
    expect(scene.mapViews[0].locked).toBe(false);
    expect(scene.gmActiveViewId).toBe(STARTER_SCENE_VIEW_ID);
    expect(scene.tableBattleMods).toEqual(DEFAULT_STARTER_TABLE_BATTLE_MODS);
    expect(scene.partySize).toBe(STARTER_SCENE_PARTY_SIZE);
    expect(scene.partyTier).toBe(1);
    expect(scene.sessionCountdowns).toEqual([]);
    expect(scene.conditionsHistory).toEqual([]);
  });

  it('stamps tier and bp via computeSceneBudget and keeps bp ≤ 14', () => {
    const scene = buildSrdStarterScene(groveEnv(), buildOpts());
    const computed = computeSceneBudget(scene, 4);
    expect(scene.bp).toBe(computed.bp);
    expect(scene.tier).toBe(computed.tier);
    expect(scene.bp).toBeLessThanOrEqual(14);
    // Bear (bruiser=4) + Dire Wolf (standard=2) = 6
    expect(scene.bp).toBe(6);
  });

  it('embeds only resolvable adversaries with full data and runtime tracks', () => {
    const env = groveEnv({
      potential_adversaries: [
        { adversaryId: 'srd-adv-bear', name: 'Bear' },
        { adversaryId: 'srd-adv-ghost', name: 'Ghost' },
        { name: 'Nameless' },
      ],
    });
    const scene = buildSrdStarterScene(env, buildOpts());
    const advs = scene.activeElements.filter((el) => el.elementType === 'adversary');
    expect(advs).toHaveLength(1);
    expect(advs[0].id).toBe('srd-adv-bear');
    expect(advs[0].name).toBe('Bear');
    expect(advs[0].role).toBe('bruiser');
    expect(advs[0].hp_max).toBe(7);
    expect(advs[0].currentHp).toBe(7);
    expect(advs[0].currentStress).toBe(0);
    expect(advs[0].conditions).toBe('');
  });

  it('produces an environment-only scene when all links fail', () => {
    const env = groveEnv({
      potential_adversaries: [
        { adversaryId: 'srd-adv-ghost', name: 'Ghost' },
        { adversaryId: 'srd-adv-see-castle', name: 'see "Castle"' },
      ],
    });
    const scene = buildSrdStarterScene(env, buildOpts());
    expect(scene.activeElements).toHaveLength(1);
    expect(scene.activeElements[0].elementType).toBe('environment');
    expect(scene.activeElements[0].name).toBe('Abandoned Grove');
    expect(scene.bp).toBe(0);
    expect(scene.tier).toBe(1);
  });

  it('treats Any (empty parsed list) as an environment-only scene', () => {
    const scene = buildSrdStarterScene(groveEnv({ potential_adversaries: [] }), buildOpts());
    expect(scene.activeElements.filter((el) => el.elementType === 'adversary')).toEqual([]);
    expect(scene.activeElements[0].elementType).toBe('environment');
  });

  it('deep-clones environment and adversary data (value semantics)', () => {
    const env = groveEnv();
    const lookup = { 'srd-adv-bear': bear(), 'srd-adv-dire-wolf': wolf() };
    const scene = buildSrdStarterScene(env, buildOpts({ adversaryById: lookup }));
    env.name = 'MUTATED';
    lookup['srd-adv-bear'].name = 'MUTATED BEAR';
    expect(scene.name).toBe('Abandoned Grove');
    expect(scene.activeElements[0].name).toBe('Abandoned Grove');
    const adv = scene.activeElements.find((el) => el.elementType === 'adversary' && el.id === 'srd-adv-bear');
    expect(adv.name).toBe('Bear');
  });
});

describe('shouldSkipAdminEditedStarterScene', () => {
  it('skips when _adminEditedAt is set unless force', () => {
    expect(shouldSkipAdminEditedStarterScene({ _adminEditedAt: '2026-08-16T00:00:00.000Z' })).toBe(true);
    expect(shouldSkipAdminEditedStarterScene({ _adminEditedAt: '2026-08-16T00:00:00.000Z' }, { force: true })).toBe(false);
    expect(shouldSkipAdminEditedStarterScene({})).toBe(false);
    expect(shouldSkipAdminEditedStarterScene(null)).toBe(false);
  });
});
