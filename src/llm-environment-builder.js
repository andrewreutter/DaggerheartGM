/**
 * OpenAI-backed environment draft from a natural-language concept.
 * Env: OPENAI_API_KEY, OPENAI_CONCEPT_MODEL (default gpt-4o-mini)
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getCollection } from './srd/index.js';
import { ENV_TYPES } from './game-constants.js';
import { buildCompactEnvironmentAiCatalog } from './encounter-ai-catalog.js';
import { resolveEnvironmentAiDraft } from './environment-ai-resolve.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTEXT_PATH = join(__dirname, '..', 'docs', 'environment-creation-llm-context.md');

const ENV_SCHEMA = `{
  "justification": "string — brief summary of type/tier and concept fit",
  "environment": {
    "name": "string",
    "description": "string",
    "impulses": "string",
    "tier": 1,
    "type": "traversal | exploration | social | event",
    "difficulty": 10,
    "potential_adversaries": [ { "name": "string" } ],
    "features": [ { "name": "string", "type": "action | reaction | passive", "description": "string" } ]
  }
}`;

async function loadContext() {
  try {
    return (await readFile(CONTEXT_PATH, 'utf8')).trim();
  } catch {
    return 'Build environments with tier-appropriate danger; use catalog examples for structure.';
  }
}

function parseTier(t) {
  const x = typeof t === 'number' ? t : parseInt(String(t ?? ''), 10);
  if (Number.isNaN(x) || x < 1 || x > 4) return null;
  return x;
}

function parseEnvType(ty) {
  const x = String(ty || '').toLowerCase().trim();
  return ENV_TYPES.includes(x) ? x : null;
}

/**
 * @param {string} concept
 * @param {{ signal?: AbortSignal, tier: number, type: string }} opts — tier/type come from the editor (required)
 * @returns {Promise<{ patch: object, justification: string, warnings: string[] }>}
 */
export async function buildEnvironmentAiFromConcept(concept, opts = {}) {
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
  const type = parseEnvType(opts.type);
  if (tier == null || type == null) {
    const err = new Error('tier (1–4) and type are required');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const environments = await getCollection('environments');
  const catalog = buildCompactEnvironmentAiCatalog(environments || [], { focusTier: tier, focusType: type });
  const ctx = await loadContext();

  const systemPrompt = `You are a Daggerheart GM tool assistant creating a **new** environment.

RULES:
- **Fixed tier & type:** The user already chose tier=${tier} and type=${type}. Your JSON MUST set \`environment.tier\` to ${tier} and \`environment.type\` to "${type}" exactly.
- **PRIMARY examples:** \`catalog.examplesByTierType\` — full cards for this tier AND type only. Match structure and feature density.
- **SECONDARY (features only):** \`featurePreviewsByTier\` and \`featurePreviewsByType\` — borrow **wording patterns** for features; do not assume stats from SRD examples apply to your draft.
- \`difficulty\` is a static DC-style number (often 8–18) appropriate to tier.
- \`potential_adversaries\`: list of { name } placeholders or names that could appear here (strings are ok in JSON as name-only rows).
- Provide impulses (GM-facing) and 2–5 features.

CONTEXT:
${ctx}

CATALOG (JSON):
${JSON.stringify(catalog)}

OUTPUT: Return ONLY valid JSON (no markdown) matching:
${ENV_SCHEMA}`;

  const requestBody = {
    model: process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Environment concept (tier ${tier}, ${type}):\n${trimmed}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 3500,
    temperature: 0.35,
  };

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: opts.signal,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const err = new Error(`OpenAI API error ${res.status}: ${errBody.error?.message || 'unknown'}`);
    err.code = 'OPENAI_ERROR';
    throw err;
  }

  const json = await res.json();
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
  const draft = parsed.environment && typeof parsed.environment === 'object' ? parsed.environment : parsed;

  const { patch, warnings } = resolveEnvironmentAiDraft(draft, { lockTier: tier, lockType: type });
  return { patch, justification, warnings };
}
