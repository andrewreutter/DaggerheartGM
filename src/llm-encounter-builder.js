/**
 * OpenAI encounter plan: pick library adversaries/environments by id, optional synthetic fallbacks.
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getUnifiedItems } from './db.js';
import { ROLE_BP_COST, ROLES } from './game-constants.js';
import { truncDesc } from './encounter-ai-catalog.js';
import {
  collectBudgetFieldsWarnings,
  normalizeAdversaryAdds,
  normalizeEnvironmentAdds,
  normalizeSyntheticAdversaryRequest,
  normalizeSyntheticEnvironmentRequest,
  validateFullEncounterPlan,
} from './encounter-ai-resolve.js';
import { resolveEncounterPlanAndBuildHomebrew } from './encounter-plan-resolve.js';
import { parseHttpBooleanLoose } from './parse-http-bool.js';
import { logOpenAiChatCompletion } from './ai-usage-log.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTEXT_PATH = join(__dirname, '..', 'docs', 'encounter-builder-llm-context.md');
const CATALOG_LIMIT = 420;

const MAX_ENCOUNTER_AI_ATTEMPTS = 3;

const OUTPUT_SCHEMA = `{
  "justification": "string — 2–4 sentences: why these picks fit the Encounter concept (tone, terrain, foe types). Name catalog ids and counts you output; do not describe retries or edits",
  "estimatedBp": "integer — MUST equal total BP of adversaryAdds plus needsSyntheticAdversaries (minion rule in catalog.minionBp)",
  "bpBreakdown": [ { "id": "string — catalog adversary id or minion_pool", "count": "number", "role": "string", "bp": "integer" } ],
  "adversaryAdds": [ { "id": "string — from catalog.adversaries[].id", "count": "number", "tier": "1–4 — must match the stat block you intend", "role": "string — ROLES value for this pick", "nameHint": "optional string — short name if helpful for disambiguation" } ],
  "environmentAdds": [ { "id": "string — from catalog.environments[].id", "count": 1, "tier": "1–4", "type": "traversal | exploration | social | event", "nameHint": "optional string" } ],
  "needsSyntheticEnvironment": null | { "concept": "string", "tier": 1, "type": "exploration" },
  "needsSyntheticAdversaries": [ { "concept": "string", "tier": 1, "role": "standard", "count": 1 } ]
}`;

function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase().trim();
  return ROLES.includes(r) ? r : 'standard';
}

function bpHintForRole(role, partySize) {
  const r = normalizeRole(role);
  if (r === 'minion') {
    return `minion: 1 BP per group of ${Math.max(1, partySize)} minions`;
  }
  const c = ROLE_BP_COST[r] ?? ROLE_BP_COST.standard;
  return `${c} BP each`;
}

/**
 * Prefer same tier as party, then lower tiers (higher lower tier before very low).
 * @param {object[]} items — full adversary rows with id, tier, role, name
 * @param {number} partyTier
 */
export function sortAdversariesForEncounterCatalog(items, partyTier) {
  const pt = Math.min(4, Math.max(1, parseInt(String(partyTier), 10) || 1));
  return [...items].sort((a, b) => {
    const ta = Math.min(4, Math.max(1, parseInt(a.tier, 10) || 1));
    const tb = Math.min(4, Math.max(1, parseInt(b.tier, 10) || 1));
    const sameA = ta === pt;
    const sameB = tb === pt;
    if (sameA !== sameB) return sameA ? -1 : 1;
    if (ta !== tb) return tb - ta;
    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
  });
}

export function sortEnvironmentsForEncounterCatalog(items, partyTier) {
  return sortAdversariesForEncounterCatalog(items, partyTier);
}

function compactAdvPick(a, partySize) {
  const tier = Math.min(4, Math.max(1, parseInt(a.tier, 10) || 1));
  const role = normalizeRole(a.role);
  return {
    id: a.id,
    name: truncDesc(a.name || ''),
    tier,
    role,
    bp: bpHintForRole(role, partySize),
  };
}

function compactEnvPick(e) {
  const tier = Math.min(4, Math.max(1, parseInt(e.tier, 10) || 1));
  const type = String(e.type || 'exploration').toLowerCase();
  return {
    id: e.id,
    name: truncDesc(e.name || ''),
    tier,
    type,
  };
}

/**
 * When `includePublic` is false, exclude other users' public listings from the
 * LLM catalog (defensive; also avoids `!!"false"` mishandling upstream).
 * @param {object[]} items
 * @param {boolean} includePublic
 */
export function filterEncounterCatalogBySource(items, includePublic) {
  if (includePublic) return items;
  return items.filter((x) => x?._source !== 'public');
}

async function loadContext() {
  try {
    return (await readFile(CONTEXT_PATH, 'utf8')).trim();
  } catch {
    return 'Battle budget: base = (3 × party size) + 2; spend Battle Points (BP) on adversary roles per guide. Environments do not cost BP. Prefer at least one environment when the table has none.';
  }
}

/**
 * @param {object} ctx
 * @returns {boolean}
 */
function encounterPlanNeedsFinish(ctx) {
  const {
    adversaryAdds,
    environmentAdds,
    needsSyntheticAdversaries,
    needsSyntheticEnvironment,
    adversaryIdSet,
    environmentIdSet,
  } = ctx;
  const unknownAdv = adversaryAdds.some((r) => !adversaryIdSet.has(r.id));
  const unknownEnv = environmentAdds.some((r) => !environmentIdSet.has(r.id));
  const hasSynthAdv = (needsSyntheticAdversaries || []).length > 0;
  const hasSynthEnv = !!needsSyntheticEnvironment;
  return unknownAdv || unknownEnv || hasSynthAdv || hasSynthEnv;
}

/**
 * @param {object} plan
 * @param {object} catalogCtx
 */
async function runEncounterResolveAndHomebrew(plan, catalogCtx, encounterConcept, signal) {
  const resolved = await resolveEncounterPlanAndBuildHomebrew({
    encounterConcept,
    adversaryAdds: plan.adversaryAdds,
    environmentAdds: plan.environmentAdds,
    needsSyntheticAdversaries: plan.needsSyntheticAdversaries || [],
    needsSyntheticEnvironment: plan.needsSyntheticEnvironment,
    advCatalog: catalogCtx.advSorted,
    envCatalog: catalogCtx.envSorted,
    adversaryIdSet: catalogCtx.adversaryIdSet,
    environmentIdSet: catalogCtx.environmentIdSet,
    signal,
  });

  const val = validateFullEncounterPlan({
    adversaryAdds: resolved.adversaryAdds,
    environmentAdds: resolved.environmentAdds,
    needsSyntheticAdversaries: resolved.needsSyntheticAdversaries,
    adversaryIdSet: catalogCtx.adversaryIdSet,
    environmentIdSet: catalogCtx.environmentIdSet,
    remainingBattlePoints: catalogCtx.remainingBattlePoints,
    partySize: catalogCtx.partySize,
    adversaryMetaById: catalogCtx.adversaryMetaById,
  });

  return {
    ...resolved,
    validationWarnings: val.warnings,
    finalAdds: val,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.appId
 * @param {string} opts.userId
 * @param {number} opts.partySize
 * @param {number} opts.partyTier
 * @param {number} opts.remainingBattlePoints
 * @param {boolean} opts.includePublic
 * @param {boolean} opts.hasEnvironmentOnTable
 * @param {{ role: string, tier: number, count: number, name?: string }[]} opts.tableAdversarySummary
 * @param {'plan'|'finish'|'full'} [opts.step] — plan = LLM only; finish = resolve + homebrew from encounterPlan; full = both in one request
 * @param {object} [opts.encounterPlan] — required when step === 'finish'
 */
export async function buildEncounterAiFromConcept(concept, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY not configured');
    err.code = 'NO_OPENAI';
    throw err;
  }

  const trimmed = typeof concept === 'string' ? concept.trim() : '';
  const step = opts.step ?? 'full';

  if (step === 'finish') {
    if (!trimmed) {
      const err = new Error('concept is required');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const plan = opts.encounterPlan;
    if (!plan || typeof plan !== 'object') {
      const err = new Error('encounterPlan is required when step is finish');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const partySize = Math.min(12, Math.max(1, parseInt(String(opts.partySize ?? '4'), 10) || 4));
    const partyTier = Math.min(4, Math.max(1, parseInt(String(opts.partyTier ?? '1'), 10) || 1));
    const remainingBattlePoints = Math.max(0, parseInt(String(opts.remainingBattlePoints ?? '0'), 10) || 0);
    const includePublic = parseHttpBooleanLoose(opts.includePublic, false);

    const catalogCtx = await loadEncounterCatalogContext({
      appId: opts.appId,
      userId: opts.userId,
      partyTier,
      includePublic,
      partySize,
      remainingBattlePoints,
      hasEnvironmentOnTable: !!opts.hasEnvironmentOnTable,
      tableAdversarySummary: Array.isArray(opts.tableAdversarySummary) ? opts.tableAdversarySummary : [],
    });

    const resolved = await runEncounterResolveAndHomebrew(plan, catalogCtx, trimmed, opts.signal);
    const justification = typeof plan.justification === 'string' ? plan.justification.trim() : '';
    const warnings = [...(resolved.warnings || []), ...resolved.validationWarnings];

    return {
      justification,
      warnings,
      adversaryAdds: resolved.finalAdds.adversaryAdds,
      environmentAdds: resolved.finalAdds.environmentAdds,
      needsSyntheticAdversaries: resolved.finalAdds.needsSyntheticAdversaries,
      needsSyntheticEnvironment: resolved.finalAdds.needsSyntheticEnvironment,
      homebrewAdversaryPatches: resolved.homebrewAdversaryPatches,
      homebrewEnvironmentPatch: resolved.homebrewEnvironmentPatch,
      homebrewReport: resolved.homebrewReport,
      encounterStep: 'finish',
      _debug: { adversaryCatalogSize: catalogCtx.advSorted.length, environmentCatalogSize: catalogCtx.envSorted.length },
    };
  }

  if (!trimmed) {
    const err = new Error('concept is required');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const partySize = Math.min(12, Math.max(1, parseInt(String(opts.partySize ?? '4'), 10) || 4));
  const partyTier = Math.min(4, Math.max(1, parseInt(String(opts.partyTier ?? '1'), 10) || 1));
  const remainingBattlePoints = Math.max(0, parseInt(String(opts.remainingBattlePoints ?? '0'), 10) || 0);
  const includePublic = parseHttpBooleanLoose(opts.includePublic, false);
  const hasEnvironmentOnTable = !!opts.hasEnvironmentOnTable;
  const tableAdversarySummary = Array.isArray(opts.tableAdversarySummary) ? opts.tableAdversarySummary : [];

  const catalogCtx = await loadEncounterCatalogContext({
    appId: opts.appId,
    userId: opts.userId,
    partyTier,
    includePublic,
    partySize,
    remainingBattlePoints,
    hasEnvironmentOnTable,
    tableAdversarySummary,
  });

  const {
    catalog,
    adversaryMetaById,
    adversaryIdSet,
    environmentIdSet,
    advSorted,
    envSorted,
  } = catalogCtx;

  const ctx = await loadContext();

  const budgetExactRule =
    remainingBattlePoints === 0
      ? '- **Spend BP:** catalog.remainingBattlePoints is **0**. **adversaryAdds** and **needsSyntheticAdversaries** must cost **0 BP** total (empty or only free — there is no free non-minion; use empty arrays). You may still add **environmentAdds** (0 BP).'
      : `- **Spend BP:** Total BP from **adversaryAdds** plus **needsSyntheticAdversaries** must equal **exactly** catalog.remainingBattlePoints (${remainingBattlePoints}), not less and not more. Environments cost 0 BP.`;

  const systemPrompt = `You are a Daggerheart GM assistant planning an encounter using **only** library ids from the JSON catalog.

RULES:
- Output **only** JSON matching the schema. **adversaryAdds** and **environmentAdds** rows include **tier** and **role** (adversaries) or **type** (environments) so the app can validate picks and generate fallbacks. Never embed full stat blocks, hp, attacks, or nested objects.
- **Battle Points (BP):** Non-minion roles pay a flat cost **per individual** (Social/Support 1; Horde/Ranged/Skulk/Standard 2; Leader 3; Bruiser 4; Solo 5). **Minions are different:** add all minion **count** values together, then minion BP = **ceil(sum / partySize)** — one BP buys a **group** of partySize minions, not one BP per minion. See **catalog.minionBp** for the exact rule and examples. Do **not** multiply minion headcount by 1 BP each.
${budgetExactRule}
- **estimatedBp** and **bpBreakdown:** Set **estimatedBp** to the integer total BP (catalog + synthetic adversaries). Optional **bpBreakdown** lines must sum to that same integer.
- **Justification:** Tie picks to the **Encounter concept / goals** (tone, setting, what the PCs face). Say **why** each group fits that theme (e.g. undead for a crypt, ambush predators for a road). Still **name the catalog ids and counts** you output so the story matches the JSON. Do **not** describe budget retries, prior attempts, or edits (“increased count…”) — write as a fresh plan. Do not claim creatures that are not in your JSON rows.
- **Tier preference:** When choosing adversaries, strongly prefer **tier === partyTier** entries (they appear first in catalog.adversaries). Only use lower-tier adversaries when needed for budget or concept fit.
- **Environments:** Do not cost BP. **environmentAdds** ids must be copied **exactly** from catalog.environments[].id — never invent ids. If catalog.hasEnvironmentOnTable is false, include at least one environmentAdds row **unless** no environment in catalog fits — then set needsSyntheticEnvironment.
- **Synthetic fallbacks:** If the concept requires a specific adversary not representable from catalog ids, add an entry to needsSyntheticAdversaries (concept + tier + role + count). Count those toward the BP total. If you need a bespoke environment, use needsSyntheticEnvironment.
- Merge duplicate adversary ids into one row with summed count.

CONTEXT:
${ctx}

CATALOG (JSON):
${JSON.stringify(catalog)}

OUTPUT: Return ONLY valid JSON (no markdown) matching:
${OUTPUT_SCHEMA}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Encounter concept / goals:\n${trimmed}` },
  ];

  let lastRawContent = '';

  const allowUnknownInValidation = step === 'plan';

  for (let attempt = 0; attempt < MAX_ENCOUNTER_AI_ATTEMPTS; attempt++) {
    const requestBody = {
      model: process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.35,
    };

    const modelUsed = process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini';
    const t0 = Date.now();
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: opts.signal,
    });

    const latencyMs = Date.now() - t0;
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      logOpenAiChatCompletion('encounter_plan', json, {
        ok: false,
        errorCode: `http_${res.status}`,
        model: modelUsed,
        latencyMs,
      });
      const err = new Error(`OpenAI API error ${res.status}: ${json.error?.message || 'unknown'}`);
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    logOpenAiChatCompletion('encounter_plan', json, { ok: true, model: modelUsed, latencyMs });
    const rawContent = json.choices?.[0]?.message?.content;
    if (!rawContent) {
      const err = new Error('Empty response from OpenAI');
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (e) {
      const err = new Error(`Failed to parse OpenAI JSON: ${e.message}`);
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    lastRawContent = rawContent;

    let adversaryAdds = normalizeAdversaryAdds(parsed.adversaryAdds, partyTier);
    let environmentAdds = normalizeEnvironmentAdds(parsed.environmentAdds, partyTier);

    const synAdvRaw = Array.isArray(parsed.needsSyntheticAdversaries) ? parsed.needsSyntheticAdversaries : [];
    let needsSyntheticAdversaries = synAdvRaw.map(normalizeSyntheticAdversaryRequest).filter(Boolean);

    const needsSyntheticEnvironment = normalizeSyntheticEnvironmentRequest(parsed.needsSyntheticEnvironment);

    const val = validateFullEncounterPlan({
      adversaryAdds,
      environmentAdds,
      needsSyntheticAdversaries,
      adversaryIdSet,
      environmentIdSet,
      remainingBattlePoints,
      partySize,
      adversaryMetaById,
      filterUnknownAdversaryIds: !allowUnknownInValidation,
      filterUnknownEnvironmentIds: !allowUnknownInValidation,
    });
    const budgetFieldWarnings = collectBudgetFieldsWarnings(parsed, val.totalBp);
    const warnings = [...val.warnings, ...budgetFieldWarnings];

    const targetBp = remainingBattlePoints;
    const exact = targetBp === 0 ? val.totalBp === 0 : val.totalBp === targetBp;

    if (exact) {
      const justification = typeof parsed.justification === 'string' ? parsed.justification.trim() : '';

      const planPayload = {
        justification,
        adversaryAdds: val.adversaryAdds,
        environmentAdds: val.environmentAdds,
        needsSyntheticAdversaries: val.needsSyntheticAdversaries,
        needsSyntheticEnvironment,
        estimatedBp: parsed.estimatedBp,
        warnings,
      };

      const needsFinish = encounterPlanNeedsFinish({
        adversaryAdds: val.adversaryAdds,
        environmentAdds: val.environmentAdds,
        needsSyntheticAdversaries: val.needsSyntheticAdversaries,
        needsSyntheticEnvironment,
        adversaryIdSet,
        environmentIdSet,
      });

      if (step === 'plan') {
        return {
          encounterStep: 'plan',
          requiresFinish: needsFinish,
          encounterPlan: planPayload,
          justification,
          warnings,
          adversaryAdds: val.adversaryAdds,
          environmentAdds: val.environmentAdds,
          needsSyntheticAdversaries: val.needsSyntheticAdversaries,
          needsSyntheticEnvironment,
          _debug: { adversaryCatalogSize: advSorted.length, environmentCatalogSize: envSorted.length },
        };
      }

      if (step === 'full' && needsFinish) {
        const resolved = await runEncounterResolveAndHomebrew(planPayload, catalogCtx, trimmed, opts.signal);
        const allWarnings = [...warnings, ...resolved.warnings, ...resolved.validationWarnings];
        const val2 = resolved.finalAdds;
        return {
          justification,
          warnings: allWarnings,
          adversaryAdds: val2.adversaryAdds,
          environmentAdds: val2.environmentAdds,
          needsSyntheticAdversaries: val2.needsSyntheticAdversaries,
          needsSyntheticEnvironment: val2.needsSyntheticEnvironment,
          homebrewAdversaryPatches: resolved.homebrewAdversaryPatches,
          homebrewEnvironmentPatch: resolved.homebrewEnvironmentPatch,
          homebrewReport: resolved.homebrewReport,
          encounterStep: 'full',
          _debug: { adversaryCatalogSize: advSorted.length, environmentCatalogSize: envSorted.length },
        };
      }

      return {
        justification,
        warnings,
        adversaryAdds: val.adversaryAdds,
        environmentAdds: val.environmentAdds,
        needsSyntheticAdversaries: val.needsSyntheticAdversaries,
        needsSyntheticEnvironment,
        encounterStep: 'full',
        _debug: { adversaryCatalogSize: advSorted.length, environmentCatalogSize: envSorted.length },
      };
    }

    if (attempt >= MAX_ENCOUNTER_AI_ATTEMPTS - 1) {
      warnings.push(
        `Could not reach exact budget after ${MAX_ENCOUNTER_AI_ATTEMPTS} attempts; using ${val.totalBp} of ${targetBp} BP.`,
      );
      const justification = typeof parsed.justification === 'string' ? parsed.justification.trim() : '';
      return {
        justification,
        warnings,
        adversaryAdds: val.adversaryAdds,
        environmentAdds: val.environmentAdds,
        needsSyntheticAdversaries: val.needsSyntheticAdversaries,
        needsSyntheticEnvironment,
        encounterStep: step === 'plan' ? 'plan' : 'full',
        _debug: { adversaryCatalogSize: advSorted.length, environmentCatalogSize: envSorted.length },
      };
    }

    const used = val.totalBp;
    const hint =
      used < targetBp
        ? `Add more adversaries from the catalog (prefer tier === partyTier), increase counts, or add needsSyntheticAdversaries until the total reaches ${targetBp} BP.`
        : `Reduce counts or remove adversaries until the total is exactly ${targetBp} BP.`;

    messages.push({ role: 'assistant', content: lastRawContent });
    messages.push({
      role: 'user',
      content: `Budget correction: you MUST spend exactly ${targetBp} BP on adversaryAdds plus needsSyntheticAdversaries combined (environments are 0 BP). Your last JSON used ${used} BP. ${hint} Recalculate minion BP as ceil(total minion headcount ÷ partySize). Update estimatedBp and bpBreakdown to match. justification must tie picks to the encounter concept and list only ids/counts in your new JSON (no “retry” or edit narration).`,
    });
  }

  throw new Error('Encounter AI loop exited unexpectedly');
}

/**
 * @param {object} p
 */
async function loadEncounterCatalogContext(p) {
  const partyTier = p.partyTier;
  const { items: rawAdvFetched, totalCount: advTotal } = await getUnifiedItems(p.appId, p.userId, 'adversaries', {
    includeMine: true,
    includeSrd: true,
    includePublic: p.includePublic,
    tierMax: partyTier,
    sort: 'popularity',
    offset: 0,
    limit: CATALOG_LIMIT,
  });
  const { items: rawEnvFetched, totalCount: envTotal } = await getUnifiedItems(p.appId, p.userId, 'environments', {
    includeMine: true,
    includeSrd: true,
    includePublic: p.includePublic,
    tierMax: partyTier,
    sort: 'popularity',
    offset: 0,
    limit: CATALOG_LIMIT,
  });
  const rawAdv = filterEncounterCatalogBySource(rawAdvFetched, p.includePublic);
  const rawEnv = filterEncounterCatalogBySource(rawEnvFetched, p.includePublic);

  const advSorted = sortAdversariesForEncounterCatalog(rawAdv, partyTier).slice(0, CATALOG_LIMIT);
  const envSorted = sortEnvironmentsForEncounterCatalog(rawEnv, partyTier).slice(0, CATALOG_LIMIT);

  const catalog = {
    partyTier,
    partySize: p.partySize,
    remainingBattlePoints: p.remainingBattlePoints,
    hasEnvironmentOnTable: p.hasEnvironmentOnTable,
    tableAdversarySummary: p.tableAdversarySummary,
    minionBp: {
      rule: 'Sum every minion count across adversaryAdds, then BP = ceil(totalMinions / partySize).',
      examplePartySize4:
        '8 minions (any mix of minion ids) = ceil(8/4)=2 BP — not 8 BP. 5 minions = ceil(5/4)=2 BP.',
    },
    catalogNote:
      'adversaries are ordered: same tier as partyTier first, then lower tiers. Prefer picks from the start of the list when multiple options fit.',
    adversaries: advSorted.map((a) => compactAdvPick(a, p.partySize)),
    environments: envSorted.map(compactEnvPick),
    catalogStats: {
      adversariesListed: advSorted.length,
      adversariesTotalMatchingTier: advTotal,
      environmentsListed: envSorted.length,
      environmentsTotalMatchingTier: envTotal,
    },
  };

  const adversaryMetaById = new Map(advSorted.map((a) => [a.id, { role: a.role, tier: a.tier }]));
  const adversaryIdSet = new Set(advSorted.map((a) => a.id));
  const environmentIdSet = new Set(envSorted.map((e) => e.id));

  return {
    catalog,
    adversaryMetaById,
    adversaryIdSet,
    environmentIdSet,
    advSorted,
    envSorted,
    partySize: p.partySize,
    remainingBattlePoints: p.remainingBattlePoints,
  };
}
