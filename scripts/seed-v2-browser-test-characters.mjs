#!/usr/bin/env node
/**
 * Upserts the seven "V2 browser test plan" PCs into `items` (characters) and
 * adds them to the primary game table (`tableId` === GM Firebase UID).
 *
 * Required env:
 *   DATABASE_URL  — Postgres URI (same as the app — the script uses src/db.js)
 *
 * Optional:
 *   DH_GM_UID     — Firebase user id; if omitted, inferred from DB (primary table_state: id = user_id).
 *   APP_ID        — defaults to daggerheart-gm-tool
 *
 * Idempotent: fixed library UUIDs per character; table elements for those IDs are replaced each run.
 */

import { warmCache, getCollection } from '../src/srd/index.js';
import { recomputeCharacter } from '../src/client/lib/character-calc.js';
import { upsertItem, getTableStateById, stripCharacterElementsForDb, getPool } from '../src/db.js';

const APP_ID = process.env.APP_ID || 'daggerheart-gm-tool';

/**
 * The running server knows your uid from Firebase (`req.uid`). This script has no session, so we
 * need either DH_GM_UID or a single primary table_state row to infer it.
 */
async function resolveGmUid(appId) {
  const explicit = process.env.DH_GM_UID?.trim();
  if (explicit) return explicit;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT user_id FROM items
     WHERE app_id = $1 AND collection = 'table_state' AND id = user_id`,
    [appId]
  );

  if (rows.length === 1) {
    const uid = rows[0].user_id;
    console.log(`[seed] DH_GM_UID not set; using primary table owner from DB: ${uid}`);
    return uid;
  }

  if (rows.length === 0) {
    console.error(`
Could not infer your Firebase user id.

  Set DH_GM_UID in .env, or open the app once so your primary table_state row exists
  (same DATABASE_URL as this script).
`);
    process.exit(1);
  }

  console.error(
    `Multiple primary table_state owners in DB (${rows.length}). Set DH_GM_UID in .env to choose one.`
  );
  process.exit(1);
}

function buildLookup(items) {
  const byId = {};
  for (const item of items || []) {
    if (item?.id) byId[item.id] = item;
  }
  return byId;
}

async function buildSrdData() {
  await warmCache();
  const srdData = {
    classesById: buildLookup(await getCollection('classes')),
    subclassesById: buildLookup(await getCollection('subclasses')),
    ancestriesById: buildLookup(await getCollection('ancestries')),
    communitiesById: buildLookup(await getCollection('communities')),
    armorById: buildLookup(await getCollection('armor')),
    weaponsById: buildLookup(await getCollection('weapons')),
    abilitiesById: buildLookup(await getCollection('abilities')),
    domainsById: buildLookup(await getCollection('domains')),
    beastformsById: buildLookup(await getCollection('beastforms')),
  };
  return srdData;
}

const TRAITS = {
  standard: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
};

function exp(idA, nameA, idB, nameB) {
  return [
    { id: idA, name: nameA, score: 2 },
    { id: idB, name: nameB, score: 2 },
  ];
}

/** @type {{ id: string, raw: object, instanceId: string }[]} */
const CAST = [
  {
    id: 'f2b00000-0000-4000-8000-000000000001',
    instanceId: 'f2b00000-0000-4000-8000-000000000101',
    raw: {
      name: 'Aria',
      classId: 'srd-cls-druid',
      subclassId: 'srd-sub-beastbound',
      ancestryIds: ['srd-anc-faun'],
      communityId: 'srd-com-wildborne',
      level: 1,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-quarterstaff',
      armorId: 'srd-arm-leather-armor',
      abilityIds: ['srd-abl-rune-ward', 'srd-abl-cinder-grasp'],
      experiences: exp('aria-e1', 'River Guide', 'aria-e2', 'Herbal Lore'),
      companion: {
        name: 'Brush',
        species: 'Wolf',
        attackName: 'Bite',
        experiences: [
          { id: 'aria-c1', name: 'Track', score: 2 },
          { id: 'aria-c2', name: 'Hunt', score: 2 },
        ],
      },
    },
  },
  {
    id: 'f2b00000-0000-4000-8000-000000000002',
    instanceId: 'f2b00000-0000-4000-8000-000000000102',
    raw: {
      name: 'Brix',
      classId: 'srd-cls-bard',
      subclassId: 'srd-sub-troubadour',
      ancestryIds: ['srd-anc-human'],
      communityId: 'srd-com-highborne',
      level: 1,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-rapier',
      secondaryWeaponId: 'srd-wpn-shortsword',
      armorId: 'srd-arm-gambeson-armor',
      abilityIds: ['srd-abl-inspirational-words', 'srd-abl-book-of-ava'],
      experiences: exp('brix-e1', 'Court Intrigue', 'brix-e2', 'Street Performance'),
    },
  },
  {
    id: 'f2b00000-0000-4000-8000-000000000003',
    instanceId: 'f2b00000-0000-4000-8000-000000000103',
    raw: {
      name: 'Cass',
      classId: 'srd-cls-seraph',
      subclassId: 'srd-sub-divine-wielder',
      ancestryIds: ['srd-anc-halfling'],
      communityId: 'srd-com-seaborne',
      level: 2,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-mace',
      armorId: 'srd-arm-elundrian-chain-armor',
      abilityIds: ['srd-abl-bare-bones', 'srd-abl-mending-touch'],
      experiences: exp('cass-e1', 'Shipwright', 'cass-e2', 'Temple Acolyte'),
    },
  },
  {
    id: 'f2b00000-0000-4000-8000-000000000004',
    instanceId: 'f2b00000-0000-4000-8000-000000000104',
    raw: {
      name: 'Dara',
      classId: 'srd-cls-warrior',
      subclassId: 'srd-sub-stalwart',
      ancestryIds: ['srd-anc-drakona'],
      communityId: 'srd-com-orderborne',
      level: 2,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-greatsword',
      armorId: 'srd-arm-irontree-breastplate-armor',
      abilityIds: ['srd-abl-whirlwind', 'srd-abl-deft-maneuvers'],
      experiences: exp('dara-e1', 'Mercenary Company', 'dara-e2', 'Siege Survivor'),
    },
  },
  {
    id: 'f2b00000-0000-4000-8000-000000000005',
    instanceId: 'f2b00000-0000-4000-8000-000000000105',
    raw: {
      name: 'Echo',
      classId: 'srd-cls-rogue',
      subclassId: 'srd-sub-nightwalker',
      ancestryIds: ['srd-anc-katari'],
      communityId: 'srd-com-underborne',
      level: 1,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-dagger',
      armorId: 'srd-arm-leather-armor',
      abilityIds: ['srd-abl-pick-and-pull', 'srd-abl-deft-deceiver'],
      experiences: exp('echo-e1', 'Urban Infiltration', 'echo-e2', 'Poison Lore'),
    },
  },
  {
    id: 'f2b00000-0000-4000-8000-000000000006',
    instanceId: 'f2b00000-0000-4000-8000-000000000106',
    raw: {
      name: 'Finn',
      classId: 'srd-cls-wizard',
      subclassId: 'srd-sub-elemental-origin',
      ancestryIds: ['srd-anc-clank'],
      communityId: 'srd-com-wanderborne',
      level: 1,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-mage-orb',
      armorId: 'srd-arm-leather-armor',
      abilityIds: ['srd-abl-book-of-ava', 'srd-abl-bolt-beacon'],
      experiences: exp('finn-e1', 'Tinker', 'finn-e2', 'Scholar'),
      experienceBonusChoices: { 'Purposeful Design': 'finn-e1' },
      elementalOriginElement: 'fire',
    },
  },
  {
    id: 'f2b00000-0000-4000-8000-000000000007',
    instanceId: 'f2b00000-0000-4000-8000-000000000107',
    raw: {
      name: 'Gideon',
      classId: 'srd-cls-guardian',
      subclassId: 'srd-sub-warden-of-renewal',
      ancestryIds: ['srd-anc-human'],
      communityId: 'srd-com-orderborne',
      level: 2,
      baseTraits: TRAITS.standard,
      advancements: {},
      primaryWeaponId: 'srd-wpn-battleaxe',
      armorId: 'srd-arm-full-fortified-armor',
      abilityIds: ['srd-abl-i-am-your-shield', 'srd-abl-get-back-up'],
      experiences: exp('gid-e1', 'Shield Wall Veteran', 'gid-e2', 'Field Medic'),
    },
  },
];

const SEED_LIBRARY_IDS = new Set(CAST.map((c) => c.id));

function tableElementFromSavedCharacter(row, instanceId) {
  const maxHp = row.maxHp ?? 6;
  const maxStress = row.maxStress ?? 6;
  const maxHope = row.maxHope ?? 6;
  const maxArmor = row.maxArmor ?? 0;
  return {
    instanceId,
    elementType: 'character',
    id: row.id,
    name: row.name,
    currentHp: maxHp,
    currentStress: 0,
    hope: maxHope,
    currentArmor: maxArmor,
    conditions: [],
    tokenX: null,
    tokenY: null,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const gmUid = await resolveGmUid(APP_ID);

  const srdData = await buildSrdData();

  /** @type {{ toSave: object, instanceId: string }[]} */
  const saved = [];
  for (const { id, raw, instanceId } of CAST) {
    const merged = { ...raw, id };
    const recomputed = recomputeCharacter(merged, srdData);
    const toSave = { ...recomputed, id };
    await upsertItem(APP_ID, gmUid, 'characters', id, toSave, false);
    saved.push({ toSave, instanceId });
    console.log(`[seed] Upserted character library: ${toSave.name} (${id})`);
  }

  const tableId = gmUid;
  let row = await getTableStateById(APP_ID, tableId);
  if (!row) {
    console.error(
      `[seed] No table_state row for id=${tableId}. Create your primary table once in the app (or POST /api/my-tables), then re-run.`
    );
    process.exit(1);
  }

  if (row.userId !== gmUid) {
    console.error(`[seed] table_state ${tableId} is owned by ${row.userId}, expected ${gmUid}`);
    process.exit(1);
  }

  const prev = row.data || {};
  const elementsIn = prev.elements || prev.activeElements || [];
  const filtered = elementsIn.filter((el) => {
    if (el?.elementType !== 'character') return true;
    if (el.id && SEED_LIBRARY_IDS.has(el.id)) return false;
    return true;
  });

  const newElements = saved.map(({ toSave, instanceId }) => tableElementFromSavedCharacter(toSave, instanceId));

  const nextState = {
    ...prev,
    elements: [...filtered, ...newElements],
  };
  const stripped = {
    ...nextState,
    elements: stripCharacterElementsForDb(nextState.elements),
  };

  await upsertItem(APP_ID, gmUid, 'table_state', tableId, stripped, false);
  console.log(`[seed] Updated table_state ${tableId} with ${newElements.length} character element(s).`);
  console.log('[seed] Done. Open Game Table with V2 sheet enabled to exercise the plan (see test/v2-browser-test-plan.md).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
