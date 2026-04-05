/**
 * OpenAI-backed adversary draft from a natural-language concept.
 * Env: OPENAI_API_KEY, OPENAI_CONCEPT_MODEL (default gpt-4o-mini)
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getCollection } from './srd/index.js';
import { ROLES } from './game-constants.js';
import { buildCompactAdversaryAiCatalog } from './encounter-ai-catalog.js';
import { resolveAdversaryAiDraft } from './adversary-ai-resolve.js';
import { logOpenAiChatCompletion } from './ai-usage-log.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTEXT_PATH = join(__dirname, '..', 'docs', 'adversary-creation-llm-context.md');

const ADVERSARY_SCHEMA = `{
  "justification": "string — brief summary of tier/role and concept fit",
  "adversary": {
    "name": "string",
    "motive": "string",
    "description": "string",
    "tier": 1,
    "role": "one of catalog.axes.roles",
    "difficulty": 10,
    "hp_max": 6,
    "hp_thresholds": { "major": 0, "severe": 0 },
    "stress_max": 4,
    "attack": {
      "name": "string",
      "range": "Melee | Very Close | Close | Far | Very Far",
      "modifier": 0,
      "trait": "Phy | Mag | Dir",
      "damage": "string dice expression e.g. 2d6+3"
    },
    "experiences": [ { "name": "string", "modifier": 2 } ],
    "features": [ { "name": "string", "type": "action | reaction | passive", "description": "string markdown ok" } ]
  }
}`;

async function loadContext() {
  try {
    return (await readFile(CONTEXT_PATH, 'utf8')).trim();
  } catch {
    return 'Build adversaries using guide baselines in catalog.guideBaselines; SRD examples are for tone only.';
  }
}

function parseTier(t) {
  const x = typeof t === 'number' ? t : parseInt(String(t ?? ''), 10);
  if (Number.isNaN(x) || x < 1 || x > 4) return null;
  return x;
}

function parseRole(r) {
  const x = String(r || '').toLowerCase().trim();
  return ROLES.includes(x) ? x : null;
}

/**
 * @param {string} concept
 * @param {{ signal?: AbortSignal, tier: number, role: string }} opts — tier/role come from the editor (required)
 * @returns {Promise<{ patch: object, justification: string, warnings: string[] }>}
 */
export async function buildAdversaryAiFromConcept(concept, opts = {}) {
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

  const tier = parseTier(opts.tier);
  const role = parseRole(opts.role);
  if (tier == null || role == null) {
    const err = new Error('tier (1–4) and role are required');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const adversaries = await getCollection('adversaries');
  const catalog = buildCompactAdversaryAiCatalog(adversaries || [], { focusTier: tier, focusRole: role });
  const ctx = await loadContext();

  const systemPrompt = `You are a Daggerheart GM tool assistant creating a **new** adversary stat block.

RULES:
- **Fixed tier & role:** The user already chose tier=${tier} and role=${role}. Your JSON MUST set \`adversary.tier\` to ${tier} and \`adversary.role\` to "${role}" exactly.
- **Numeric stats (critical):** Use \`catalog.guideBaselines["${tier}:${role}"]\` for difficulty, HP, thresholds, stress, attack modifier, and damage — NOT raw SRD example numbers. SRD rows in the catalog illustrate **tone and complexity**; the app follows the RightKnight-style guide encoded in those baselines.
- **PRIMARY examples:** \`catalog.examplesByTierRole\` — full cards for this tier AND role only. Match overall density.
- **SECONDARY (features & experiences only):** \`featureAndExperienceExamplesByTier\` and \`featureAndExperienceExamplesByRole\` — borrow **wording patterns** only; do not copy another role's combat numbers.
- **Minions:** thresholds may be 0; HP is typically 1.
- Provide at least 1–3 features with clear action/reaction/passive typing and markdown-friendly descriptions.
- Provide 1–3 experiences with name and modifier (usually 1–3).

CONTEXT:
${ctx}

CATALOG (JSON):
${JSON.stringify(catalog)}

OUTPUT: Return ONLY valid JSON (no markdown) matching:
${ADVERSARY_SCHEMA}`;

  const requestBody = {
    model: process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Adversary concept (tier ${tier}, ${role}):\n${trimmed}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 3500,
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
    logOpenAiChatCompletion('adversary_concept', json, {
      ok: false,
      errorCode: `http_${res.status}`,
      model: modelUsed,
      latencyMs,
    });
    const err = new Error(`OpenAI API error ${res.status}: ${json.error?.message || 'unknown'}`);
    err.code = 'OPENAI_ERROR';
    throw err;
  }

  logOpenAiChatCompletion('adversary_concept', json, { ok: true, model: modelUsed, latencyMs });
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

  const justification = typeof parsed.justification === 'string' ? parsed.justification.trim() : '';
  const draft = parsed.adversary && typeof parsed.adversary === 'object' ? parsed.adversary : parsed;

  const { patch, warnings } = resolveAdversaryAiDraft(draft, { lockTier: tier, lockRole: role });
  return { patch, justification, warnings };
}
