/**
 * OpenAI-backed character draft from a natural-language concept (levels 1–10).
 * Ranking-first workflow:
 * compact catalog -> optional legal profile checks -> ranked package/card/preferences JSON -> server-built legal candidate(s).
 * Env: OPENAI_API_KEY, OPENAI_CHARACTER_MODEL?, OPENAI_CONCEPT_MODEL?
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logOpenAiChatCompletion } from './ai-usage-log.js';
import {
  buildCompactCharacterAiCatalog,
  fetchCharacterBuildProfile,
} from './character-ai-build-profile.js';
import {
  buildLookupMaps,
  resolveToId,
  validateCharacterAiDraftStrict,
} from './character-ai-resolve.js';
import { buildCharacterAiCandidatesFromRankings } from './character-ai-ranked-builder.js';
import { loadSrdDataForV2Engine } from './server/load-srd-engine-data.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CREATION_CONTEXT_PATH = join(__dirname, '..', 'docs', 'character-creation-llm-context.md');

const MAX_CHAT_ITERATIONS = 7;
const MAX_VALIDATION_FAILURES = 1;
const MAX_CUMULATIVE_OPENAI_TOKENS = 900000;
const FETCH_PROFILE_TOOL_NAME = 'fetch_character_build_profile';
const VALIDATE_DRAFT_TOOL_NAME = 'validate_character_build_draft';

export { buildCompactCharacterAiCatalog } from './character-ai-build-profile.js';

const OUTPUT_SCHEMA = `{
  "justification": "string — brief plain-language summary of how the concept maps to the package choices and ranked preferences",
  "primaryPackage": {
    "classId": "string — class id from catalog.classes",
    "subclassId": "string — subclass id for that class",
    "multiclassClassId": "string | null",
    "multiclassSubclassId": "string | null",
    "multiclassDomain": "string | null"
  },
  "alternatePackage": {
    "classId": "string — alternate class id that better preserves the ranked card preferences",
    "subclassId": "string — alternate subclass id for that class",
    "multiclassClassId": "string | null",
    "multiclassSubclassId": "string | null",
    "multiclassDomain": "string | null"
  } | null,
  "domainCardRanking": ["string — top 50 SRD domain-card ids ranked by concept fit across all ids in catalog.domainCardIndex"],
  "rankedCardRationale": [
    {
      "abilityId": "string — one of the ranked domain-card ids",
      "reason": "string — one short sentence on why this card fits the concept"
    }
  ],
  "startingCardRanking": ["string — optional ranked level-1 starting-card preferences"],
  "advancementPickTypeRanking": ["string — ranked advancement pick types such as traits, hp, stress, evasion, experience, domain_card, subclass_upgrade, multiclass, proficiency"],
  "character": {
    "name": "string",
    "pronouns": "string",
    "description": "string",
    "background": "string",
    "connectionText": "string",
    "ancestryIds": ["string — exactly one ancestry id from catalog.ancestries"],
    "communityId": "string — id from catalog.communities",
    "baseTraits": { "agility": number, "strength": number, "finesse": number, "instinct": number, "presence": number, "knowledge": number },
    "primaryWeaponId": "string — id from the fetched profile's weaponOptions",
    "secondaryWeaponId": "string | null if the primary weapon is two-handed",
    "armorId": "string — id from the fetched profile's armorOptions",
    "experiences": [{ "id": "optional stable string", "name": "string — include concept-relevant names for tier-entry rows at levels 2, 5, and 8 when you can", "score": number }],
    "experienceBonusChoices": { "Ancestry feature name": "experience row id or exact experience name — never ancestry ids or srd-abl-* ids" },
    "sheetDisplayNames": "optional. Use abilities to flavor off-theme card names with keys like ability-srd-abl-123",
    "companion": null | { "name", "species", "attackName", "evasion", "maxStress", "currentStress", "experiences" }
  }
}`;

const FETCH_CHARACTER_BUILD_PROFILE_TOOL = {
  type: 'function',
  function: {
    name: FETCH_PROFILE_TOOL_NAME,
    description:
      'Fetch the legal build profile for one primary class/subclass package, optionally with a multiclass package. Use this before choosing any domain cards or advancement rows. All committed domain card ids must come from this tool output.',
    parameters: {
      type: 'object',
      properties: {
        classId: { type: 'string', description: 'Primary class id from catalog.classes' },
        subclassId: { type: 'string', description: 'Primary subclass id from the chosen class summary' },
        targetLevel: { type: 'integer', minimum: 1, maximum: 10 },
        multiclassClassId: { type: 'string' },
        multiclassSubclassId: { type: 'string' },
        multiclassDomain: { type: 'string' },
      },
      required: ['classId', 'subclassId', 'targetLevel'],
    },
  },
};

const VALIDATE_CHARACTER_BUILD_DRAFT_TOOL = {
  type: 'function',
  function: {
    name: VALIDATE_DRAFT_TOOL_NAME,
    description:
      'Validate a candidate character draft against the app legality rules. Call this after fetch_character_build_profile and before final JSON. Repair any errors, validate again until ok is true, then return final JSON without changing mechanics.',
    parameters: {
      type: 'object',
      properties: {
        character: {
          type: 'object',
          description: 'Candidate character object matching OUTPUT_SCHEMA.character',
          additionalProperties: true,
        },
      },
      required: ['character'],
    },
  },
};

async function loadCreationContext() {
  try {
    const raw = (await readFile(CREATION_CONTEXT_PATH, 'utf8')).trim();
    return clipDebugText(raw, 2400);
  } catch {
    return 'Follow Daggerheart class, domain, multiclass, and advancement legality rules.';
  }
}

function parseToolArgs(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

function formatStrictIssues(issues) {
  const lines = [];
  for (const issue of issues || []) {
    if (!issue) continue;
    const path = issue.path ? `${issue.path}: ` : '';
    lines.push(`- ${path}${issue.message}`);
  }
  return lines.join('\n');
}

function normalizeRankedCardRationale(rawRationale, srdData, rankedAbilityIds, limit = 5) {
  const abilityMaps = buildLookupMaps(srdData.abilities);
  const rankedSet = new Set(rankedAbilityIds || []);
  const out = [];
  const seen = new Set();
  for (const entry of rawRationale || []) {
    if (!entry || typeof entry !== 'object') continue;
    const rawId = entry.abilityId ?? entry.id ?? entry.cardId;
    const abilityId = resolveToId(rawId, abilityMaps, {
      warn: () => {},
      kind: 'rankedCardRationale abilityId',
    });
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    if (!abilityId || !reason || seen.has(abilityId)) continue;
    if (rankedSet.size && !rankedSet.has(abilityId)) continue;
    const row = srdData.abilitiesById?.[abilityId];
    out.push({
      abilityId,
      name: row?.name || abilityId,
      domain: row?.domain || '',
      level: Number(row?.level) || 1,
      reason,
    });
    seen.add(abilityId);
    if (out.length >= limit) break;
  }
  return out;
}

function buildValidationToolPayload(strict) {
  const errors = Array.isArray(strict?.errors) ? strict.errors : [];
  const warnings = Array.isArray(strict?.warnings) ? strict.warnings : [];
  return {
    ok: !!strict?.ok,
    errors,
    warnings,
    normalizedCharacter: strict?.patch || null,
    guidance: strict?.ok
      ? 'Validation passed. Return the final JSON next without changing mechanics.'
      : 'Repair the draft, validate again, and only then return the final JSON.',
  };
}

function buildNoLegalBuildError(strict, state = {}) {
  const firstIssues = (strict?.errors || []).slice(0, 5).map((issue) => issue.message).filter(Boolean);
  const message = firstIssues.length
    ? `Could not produce a fully legal character build after ${MAX_VALIDATION_FAILURES} repair attempts. Remaining issues: ${firstIssues.join(' | ')}`
    : `Could not produce a fully legal character build after ${MAX_VALIDATION_FAILURES} repair attempts.`;
  const err = new Error(message);
  err.code = 'BAD_REQUEST';
  err.validation = strict?.errors || [];
  err.profileHistory = state.profileHistory || [];
  return err;
}

function summarizeProfileArgs(args) {
  if (!args || typeof args !== 'object') return null;
  return {
    classId: typeof args.classId === 'string' ? args.classId : null,
    subclassId: typeof args.subclassId === 'string' ? args.subclassId : null,
    targetLevel: Number(args.targetLevel) || null,
    multiclassClassId: typeof args.multiclassClassId === 'string' ? args.multiclassClassId : null,
    multiclassSubclassId: typeof args.multiclassSubclassId === 'string' ? args.multiclassSubclassId : null,
    multiclassDomain: typeof args.multiclassDomain === 'string' ? args.multiclassDomain : null,
  };
}

function logCharacterBuildObservability(state) {
  const line = {
    profiles: state.profileHistory,
    resultMode: state.resultMode || 'failed',
    validationFailures: state.validationFailures,
    successfulValidationCount: state.successfulValidationCount,
    salvagedPartialCount: state.salvagedPartialCount || 0,
    finalWarningCount: state.finalWarningCount,
    finalErrorCount: state.finalErrorCount,
    cumulativeOpenAiTokens: state.cumulativeOpenAiTokens,
  };
  console.info('[character-ai-build]', JSON.stringify(line));
}

function isCharacterAiDebugEnabled() {
  return process.env.CHARACTER_AI_DEBUG === '1' || process.env.AI_USAGE_DEBUG === '1';
}

function clipDebugText(value, max = 240) {
  if (value == null) return '';
  const s = String(value).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function logCharacterBuildDebug(event, payload) {
  if (!isCharacterAiDebugEnabled()) return;
  console.info('[character-ai-build-debug]', event, JSON.stringify(payload));
}

function buildFallbackJustification({ concept, patch, srdData }) {
  const level = Number(patch?.level) || 1;
  const className = patch?.classId ? srdData.classesById?.[patch.classId]?.name || patch.classId : 'character';
  const subclassName = patch?.subclassId ? srdData.subclassesById?.[patch.subclassId]?.name || patch.subclassId : '';
  const multiclassName = patch?.multiclassClassId
    ? srdData.classesById?.[patch.multiclassClassId]?.name || patch.multiclassClassId
    : '';
  const roleBits = [`Built a legal level ${level} ${className}`];
  if (subclassName) roleBits.push(`(${subclassName})`);
  roleBits.push(`for the concept "${clipDebugText(concept, 80)}".`);
  if (multiclassName) {
    const mcDomain = patch.multiclassDomain ? ` using ${patch.multiclassDomain}` : '';
    roleBits.push(`Used ${multiclassName}${mcDomain} multiclass support to preserve off-domain flavor while keeping the build legal.`);
  } else {
    roleBits.push('Kept the mechanics inside a single legal class profile.');
  }
  return roleBits.join(' ');
}

function canSalvagePartialCharacter(strict) {
  const patch = strict?.patch;
  const errors = Array.isArray(strict?.errors) ? strict.errors : [];
  if (!patch || !errors.length) return false;
  const hasCore =
    !!patch.classId &&
    !!patch.subclassId &&
    !!patch.communityId &&
    Array.isArray(patch.ancestryIds) &&
    patch.ancestryIds.length === 1 &&
    !!patch.primaryWeaponId &&
    !!patch.armorId &&
    Array.isArray(patch.abilityIds) &&
    patch.abilityIds.filter(Boolean).length === 2;
  if (!hasCore) return false;
  return errors.every((issue) => {
    const path = String(issue?.path || '');
    return path === 'advancements' || path.startsWith('advancements.');
  });
}

function buildConciseCharacterAiRules(targetLevel, creationMd) {
  return [
    `Target level is ${targetLevel}. Rank cards and package choices for a level ${targetLevel} build.`,
    'Return ranked preferences, not a fully authored advancement grid.',
    'Pick a primaryPackage that best matches the concept.',
    'If the top-ranked cards point off-domain, provide an alternatePackage that better preserves those card preferences.',
    `You may call ${FETCH_PROFILE_TOOL_NAME} before final JSON if you want to inspect legal package options.`,
    `Only call ${VALIDATE_DRAFT_TOOL_NAME} for core package sanity-checks; do not try to solve every advancement row yourself.`,
    'Below level 5, stay single-class.',
    'At level 5+, use legal multiclassing if the concept needs off-domain magic.',
    'Rank domain cards across all ids in catalog.domainCardIndex, not just the chosen package.',
    'Include rankedCardRationale for the most concept-important cards so the UI can explain the ranking.',
    'Rank advancement pick types by concept importance; the server will distribute them legally.',
    'Do not return advancements as the primary authored artifact.',
    'Use only ids returned by the compact catalog or fetched build profile.',
    'Experience references must use character.experiences row ids or exact row names only, never ancestry ids or domain ids.',
    'When target level reaches 2, 5, or 8, try to give the added tier-entry experience rows concept-relevant names. If unsure, leave them blank and the server will add a generic placeholder.',
    'When a legal card name feels off-theme, add a flavor alias in character.sheetDisplayNames.abilities using ability-<srd-abl-id> keys.',
    'Use sheetDisplayNames only for weapons/abilities when clearly valid.',
    creationMd ? `Supplemental rules summary: ${creationMd}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {string} concept
 * @param {{
 *   signal?: AbortSignal,
 *   targetLevel?: number,
 *   srdData?: object,
 *   creationContext?: string,
 *   fetchImpl?: typeof fetch,
 * }} [opts]
 * @returns {Promise<{ mode: 'single'|'choice', candidates: object[], justification: string, warnings: string[], overlapDiagnostics?: object, rankingRationale?: object[] }>}
 */
export async function buildCharacterAiFromConcept(concept, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY not configured');
    err.code = 'NO_OPENAI';
    throw err;
  }

  const trimmed = typeof concept === 'string' ? concept.trim() : '';
  if (!trimmed) {
    const err = new Error('concept is required');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const targetLevel = Math.max(1, Math.min(10, Math.round(Number(opts.targetLevel) || 1)));
  const srdData = opts.srdData || (await loadSrdDataForV2Engine());
  const creationMd = typeof opts.creationContext === 'string' ? opts.creationContext : await loadCreationContext();
  const fetchImpl = opts.fetchImpl || fetch;
  const model =
    process.env.OPENAI_CHARACTER_MODEL ||
    process.env.OPENAI_CONCEPT_MODEL ||
    'gpt-4o-mini';

  const catalog = buildCompactCharacterAiCatalog(srdData, { targetLevel });
  const conciseRules = buildConciseCharacterAiRules(targetLevel, creationMd);

  const tools = [FETCH_CHARACTER_BUILD_PROFILE_TOOL, VALIDATE_CHARACTER_BUILD_DRAFT_TOOL];
  const systemPrompt = `You are a Daggerheart TTRPG assistant building a level ${targetLevel} player character for an app that stores SRD ids.

The server will build the final legal sheet. Your job is to express concept preference clearly and use legal package ids.

CONCISE RULES:
${conciseRules}

COMPACT CATALOG (JSON):
${JSON.stringify(catalog)}

OUTPUT_SCHEMA:
${OUTPUT_SCHEMA}`;

  /** @type {object[]} */
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Character concept:\n${trimmed}` },
  ];

  const state = {
    profileHistory: [],
    resultMode: 'failed',
    validationFailures: 0,
    successfulValidationCount: 0,
    salvagedPartialCount: 0,
    finalWarningCount: 0,
    finalErrorCount: 0,
    finalJsonBlankResponses: 0,
    cumulativeOpenAiTokens: 0,
    seenProfileRequests: new Map(),
  };

  let parsed = null;
  let lastFinishReason = '';
  let sawProfileTool = false;

  for (let i = 0; i < MAX_CHAT_ITERATIONS; i++) {
    const allowTools = i < MAX_CHAT_ITERATIONS - 1;
    /** @type {Record<string, unknown>} */
    const requestBody = {
      model,
      messages,
      temperature: 0.25,
      max_tokens: Math.min(16384, 3200 + targetLevel * 500),
    };

    if (allowTools) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    } else {
      requestBody.response_format = { type: 'json_object' };
    }
    logCharacterBuildDebug('request', {
      iteration: i + 1,
      awaitingFinalJson: false,
      sawProfileTool,
      sawSuccessfulValidation: state.successfulValidationCount > 0,
      validationFailures: state.validationFailures,
      cumulativeOpenAiTokens: state.cumulativeOpenAiTokens,
      toolsEnabled: !!requestBody.tools,
      responseFormat: requestBody.response_format?.type || null,
      messageCount: messages.length,
    });

    const t0 = Date.now();
    const res = await fetchImpl(OPENAI_CHAT_URL, {
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
      logOpenAiChatCompletion('character_concept', json, {
        ok: false,
        errorCode: `http_${res.status}`,
        model,
        latencyMs,
      });
      const err = new Error(`OpenAI API error ${res.status}: ${json.error?.message || 'unknown'}`);
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    logOpenAiChatCompletion('character_concept', json, { ok: true, model, latencyMs });
    state.cumulativeOpenAiTokens += Number(json?.usage?.total_tokens || 0);

    const choice = json.choices?.[0];
    const msg = choice?.message;
    lastFinishReason = choice?.finish_reason || '';
    logCharacterBuildDebug('response', {
      iteration: i + 1,
      finishReason: lastFinishReason || null,
      awaitingFinalJson: false,
      contentChars: typeof msg?.content === 'string' ? msg.content.length : 0,
      contentPreview: clipDebugText(msg?.content, 180),
      totalTokensThisCall: Number(json?.usage?.total_tokens || 0),
      cumulativeOpenAiTokens: state.cumulativeOpenAiTokens,
      toolCalls: Array.isArray(msg?.tool_calls)
        ? msg.tool_calls.map((tc) => tc?.function?.name || tc?.type || 'unknown')
        : [],
    });

    if (state.cumulativeOpenAiTokens >= MAX_CUMULATIVE_OPENAI_TOKENS) {
      const err = new Error(
        `Character AI stopped after using ${state.cumulativeOpenAiTokens} OpenAI tokens without producing a usable ranking response.`,
      );
      err.code = 'BAD_REQUEST';
      throw err;
    }

    if (!msg) {
      const err = new Error('Empty choice from OpenAI');
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    const toolCalls = msg.tool_calls;
    if (allowTools && Array.isArray(toolCalls) && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const args = parseToolArgs(tc.function?.arguments);
        if (!args) {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: 'invalid JSON in tool arguments' }),
          });
          continue;
        }

        if (tc.type !== 'function' || !tc.function?.name) {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: `unsupported tool ${tc.type}` }),
          });
          continue;
        }

        if (tc.function.name === FETCH_PROFILE_TOOL_NAME) {
          const summary = summarizeProfileArgs(args);
          const cacheKey = JSON.stringify(summary || args);
          let payload = state.seenProfileRequests.get(cacheKey);
          if (!payload) {
            payload = fetchCharacterBuildProfile(args, srdData);
            state.seenProfileRequests.set(cacheKey, payload);
          }
          sawProfileTool = true;
          if (summary) state.profileHistory.push(summary);
          logCharacterBuildDebug('tool_fetch_profile', {
            iteration: i + 1,
            args: summary,
            ok: payload.ok,
            errorCount: payload.errors?.length || 0,
            duplicate: state.seenProfileRequests.get(cacheKey) === payload && state.profileHistory.filter((x) => JSON.stringify(x) === cacheKey).length > 1,
          });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(payload),
          });
          continue;
        }

        if (tc.function.name === VALIDATE_DRAFT_TOOL_NAME) {
          const candidate =
            args.character && typeof args.character === 'object'
              ? args.character
              : args && typeof args === 'object'
                ? args
                : null;
          let payload;
          if (!candidate) {
            payload = {
              ok: false,
              errors: [
                {
                  path: 'character',
                  code: 'missing_character',
                  message: `Provide either { "character": { ... } } or a raw character object when calling ${VALIDATE_DRAFT_TOOL_NAME}.`,
                },
              ],
              warnings: [],
              normalizedCharacter: null,
              guidance: 'Send a candidate character object if you want a core legality sanity-check.',
            };
          } else {
            const strict = validateCharacterAiDraftStrict(candidate, srdData, { targetLevel });
            payload = buildValidationToolPayload(strict);
            if (strict.ok) state.successfulValidationCount += 1;
          }
          logCharacterBuildDebug('tool_validate_draft', {
            iteration: i + 1,
            wrappedCharacterField: !!(args.character && typeof args.character === 'object'),
            ok: payload.ok,
            warningCount: payload.warnings?.length || 0,
            errorCount: payload.errors?.length || 0,
            topErrors: (payload.errors || []).slice(0, 3).map((issue) => issue.message),
          });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(payload),
          });
          continue;
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ ok: false, error: `unsupported tool ${tc.function.name}` }),
        });
      }
      continue;
    }

    messages.push({ role: 'assistant', content: msg.content ?? null });

    const rawContent = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (!rawContent) {
      state.finalJsonBlankResponses += 1;
      logCharacterBuildDebug('blank_content', {
        iteration: i + 1,
        awaitingFinalJson: false,
        blankCountAfterValidation: state.finalJsonBlankResponses,
      });
      messages.push({
        role: 'user',
        content: 'Reply with a single JSON object only (no markdown), matching OUTPUT_SCHEMA.',
      });
      continue;
    }

    try {
      parsed = JSON.parse(rawContent);
    } catch {
      messages.push({
        role: 'user',
        content: 'Your last message was not valid JSON. Reply with one JSON object only (no markdown), matching OUTPUT_SCHEMA.',
      });
      continue;
    }

    try {
      const built = buildCharacterAiCandidatesFromRankings(parsed, srdData, { targetLevel });
      const rankingRationale = normalizeRankedCardRationale(
        parsed?.rankedCardRationale,
        srdData,
        parsed?.domainCardRanking,
      );
      const justification =
        typeof parsed.justification === 'string' && parsed.justification.trim()
          ? parsed.justification.trim()
          : buildFallbackJustification({
              concept: trimmed,
              patch: built.candidates?.[0]?.patch,
              srdData,
            });
      const warnings = [...(built.warnings || [])];
      state.resultMode = built.mode;
      state.finalWarningCount = warnings.length + (built.candidates || []).reduce((sum, candidate) => sum + (candidate.warnings?.length || 0), 0);
      state.finalErrorCount = 0;
      logCharacterBuildDebug('final_json_accepted', {
        iteration: i + 1,
        mode: built.mode,
        candidateCount: built.candidates?.length || 0,
        warningCount: state.finalWarningCount,
      });
      logCharacterBuildObservability(state);
      return {
        ...built,
        justification,
        rankingRationale,
        warnings,
      };
    } catch (err) {
      state.validationFailures += 1;
      state.finalErrorCount = Array.isArray(err?.validation) ? err.validation.length : 1;
      logCharacterBuildDebug('final_json_invalid', {
        iteration: i + 1,
        finalJsonAttempts: i + 1,
        errorCount: state.finalErrorCount,
        topErrors: Array.isArray(err?.validation)
          ? err.validation.slice(0, 3).map((issue) => issue.message)
          : [err?.message || 'invalid ranking response'],
      });
      if (state.validationFailures > MAX_VALIDATION_FAILURES || err?.code !== 'BAD_REQUEST') {
        logCharacterBuildObservability(state);
        throw err;
      }
      parsed = null;
      messages.push({
        role: 'user',
        content: `Your ranking JSON was unusable for building a legal character. Repair the package or ranking fields and resend one JSON object only.\n${err?.message || 'Provide a usable primaryPackage, domainCardRanking, and advancementPickTypeRanking.'}`,
      });
    }
  }

  logCharacterBuildDebug('failure', {
    finishReason: lastFinishReason || null,
    sawProfileTool,
    sawSuccessfulValidation: state.successfulValidationCount > 0,
    awaitingFinalJson: false,
    validationFailures: state.validationFailures,
    blankFinalJsonResponses: state.finalJsonBlankResponses,
  });
  const err = new Error(
    `Failed to obtain character JSON from OpenAI (finish_reason=${lastFinishReason || 'unknown'})`,
  );
  err.code = 'OPENAI_ERROR';
  throw err;
}
