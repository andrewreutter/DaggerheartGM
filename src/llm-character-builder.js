/**
 * OpenAI-backed character draft from a natural-language concept (levels 1–10).
 * Compact catalog → model shortlist → fetch_character_builder_details tool → final JSON.
 * Env: OPENAI_API_KEY
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadSrdDataForV2Engine } from './server/load-srd-engine-data.js';
import { resolveCharacterAiDraft } from './character-ai-resolve.js';
import { CHARACTER_AI_EXPERIENCE_EXAMPLES } from './character-ai-experience-examples.js';
import {
  CHARACTER_BUILDER_DETAIL_COLLECTIONS,
  fetchCharacterBuilderDetails,
} from './character-ai-builder-fetch-details.js';
import { logOpenAiChatCompletion } from './ai-usage-log.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CREATION_CONTEXT_PATH = join(__dirname, '..', 'docs', 'character-creation-llm-context.md');

const DESC_MAX = 140;

const MAX_CHAT_ITERATIONS = 14;
const FETCH_TOOL_NAME = 'fetch_character_builder_details';

function truncDesc(text) {
  if (text == null) return '';
  const s = String(text).replace(/\s+/g, ' ').trim();
  if (s.length <= DESC_MAX) return s;
  return `${s.slice(0, DESC_MAX - 1)}…`;
}

/**
 * Level-1 domain spell cards legal for this class (only its two class domains).
 * @param {object} classRow
 * @param {object[]} allAbilities
 */
function level1DomainCardsForClass(classRow, allAbilities) {
  const doms = new Set(classRow.domains || []);
  return (allAbilities || [])
    .filter((a) => (a.level || 1) <= 1 && doms.has(a.domain))
    .map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
    }));
}

/**
 * Domain abilities for this class up to `maxSpellLevel` (for advancement browsing).
 * @param {object} classRow
 * @param {object[]} allAbilities
 * @param {number} maxSpellLevel
 */
function domainCardsForClassUpToLevel(classRow, allAbilities, maxSpellLevel) {
  const doms = new Set(classRow.domains || []);
  const cap = Math.max(1, Math.min(10, Number(maxSpellLevel) || 1));
  return (allAbilities || [])
    .filter((a) => (a.level || 1) <= cap && doms.has(a.domain))
    .map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
      level: a.level || 1,
    }));
}

/**
 * @param {object} srdData
 * @param {{ targetLevel?: number }} [opts]
 */
export function buildCompactCharacterAiCatalog(srdData, opts = {}) {
  const targetLevel = Math.max(1, Math.min(10, Math.round(Number(opts.targetLevel) || 1)));
  const tierCap = targetLevel;

  const mapRow = (item, extra = {}) => ({
    id: item.id,
    name: item.name,
    description: truncDesc(item.description),
    ...extra,
  });

  const allAbilities = srdData.abilities || [];

  const classes = (srdData.classes || []).map((c) =>
    mapRow(c, {
      domains: c.domains || [],
      subclasses: c.subclasses || [],
      suggested_traits: c.suggested_traits || '',
      level1DomainCards: level1DomainCardsForClass(c, allAbilities),
      domainCardsUpToTargetLevel: domainCardsForClassUpToLevel(c, allAbilities, targetLevel),
    }),
  );

  const subclasses = (srdData.subclasses || []).map((sc) => mapRow(sc));

  const ancestries = (srdData.ancestries || []).map((a) => mapRow(a));
  const communities = (srdData.communities || []).map((c) => mapRow(c));

  const armor = (srdData.armor || [])
    .filter((a) => (a.tier || 1) <= tierCap)
    .map((a) => mapRow(a, { tier: a.tier || 1 }));

  const weapons = (srdData.weapons || [])
    .filter((w) => (w.tier || 1) <= tierCap)
    .map((w) =>
      mapRow(w, {
        tier: w.tier || 1,
        trait: w.trait,
        burden: w.burden,
        primary_or_secondary: w.primary_or_secondary,
      }),
    );

  const abilitiesIndex = (allAbilities || []).map((a) => ({
    id: a.id,
    name: a.name,
    domain: a.domain,
    level: a.level || 1,
  }));

  return {
    targetLevel,
    classes,
    subclasses,
    ancestries,
    communities,
    armor,
    weapons,
    abilitiesIndex,
    experienceExamples: CHARACTER_AI_EXPERIENCE_EXAMPLES,
  };
}

const OUTPUT_SCHEMA = `{
  "justification": "string — brief plain-language summary; if level > 1, note tier unlocks (spell levels, subclass upgrades, multiclass, gear tier)",
  "character": {
    "name": "string",
    "pronouns": "string",
    "description": "string",
    "background": "string",
    "connectionText": "string",
    "level": "number 1–10 — must equal the user's requested target build level",
    "classId": "string — id from catalog.classes or exact class name",
    "subclassId": "string — id or name from catalog.subclasses",
    "ancestryIds": ["string"],
    "communityId": "string",
    "baseTraits": { "agility": number, "strength": number, "finesse": number, "instinct": number, "presence": number, "knowledge": number },
    "primaryWeaponId": "string — tier ≤ target level (see catalog.weapons)",
    "secondaryWeaponId": "string | null if two-handed primary",
    "armorId": "string — tier ≤ target level",
    "abilityIds": ["string", "string — two DISTINCT level-1 cards from that class's level1DomainCards only (srd-abl-*)"],
    "experiences": [{ "id": "optional stable string if referenced from advancements", "name": "string", "score": number }],
    "experienceBonusChoices": { "Ancestry feature name": "experience row id or exact experience name — NOT srd-abl-*" },
    "multiclassClassId": "string | null",
    "multiclassSubclassId": "string | null",
    "multiclassDomain": "string | null — if multiclass class has two domains, set to one of them",
    "advancements": "{ \\"2\\": { \\"domainCardId\\", \\"picks\\": [pick,pick], \\"domainTrade?\\": {fromId,toId} }, ... \\"10\\" }",
    "advancementPickShape": "{type} traits|hp|stress|evasion|experience|proficiency|domain_card|subclass_upgrade|multiclass — proficiency & multiclass use pick[0] only (both slots). traits:{type,traits:[key,key]} experience:{type,experienceIds:[rowIdOrName,rowIdOrName]} — character.experiences ids or names, NEVER srd-abl-*. domain_card:{type,abilityId}. domainCardId: spell level ≤ level row L for primary domains. Levels 2–4: no proficiency, subclass_upgrade, multiclass. Multiclass: level 5+ only.",
    "sheetDisplayNames": "optional { weapons, abilities, features } — abilities: ability-<srd-abl-id> for owned cards; features: guide entry.key or feat__<source_slug>__<feature_slug> using underscores only (see CREATION CONTEXT)",
    "companion": null | { "name", "species", "attackName", "evasion", "maxStress", "currentStress", "experiences" }
  }
}`;

const FETCH_CHARACTER_BUILDER_DETAILS_TOOL = {
  type: 'function',
  function: {
    name: FETCH_TOOL_NAME,
    description:
      'Load full SRD rows (feature text, hope features, weapon tags, domain card rules, etc.) for specific catalog ids. Call before the final character JSON. Shortlist ~2× what you will use — include alternates for classes/subclasses, domain abilities (level-1 and higher for target level), gear, multiclass candidates. Max 120 items per call; call again if truncated or you need more.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'SRD rows to hydrate in full',
          maxItems: 120,
          items: {
            type: 'object',
            properties: {
              collection: {
                type: 'string',
                enum: CHARACTER_BUILDER_DETAIL_COLLECTIONS,
              },
              id: { type: 'string', description: 'Canonical srd-* id from the catalog' },
            },
            required: ['collection', 'id'],
          },
        },
      },
      required: ['items'],
    },
  },
};

async function loadCreationContext() {
  try {
    return (await readFile(CREATION_CONTEXT_PATH, 'utf8')).trim();
  } catch {
    return 'Level 1 Daggerheart character; follow SRD class/subclass/domain rules.';
  }
}

/**
 * @param {string} concept
 * @param {{ signal?: AbortSignal, targetLevel?: number }} [opts]
 * @returns {Promise<{ patch: object, justification: string, warnings: string[] }>}
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

  const srdData = await loadSrdDataForV2Engine();
  const catalog = buildCompactCharacterAiCatalog(srdData, { targetLevel });
  const creationMd = await loadCreationContext();
  const model = process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini';

  const levelHint =
    targetLevel <= 1
      ? '**level 1**'
      : `**level ${targetLevel}** (include \`character.level\`: ${targetLevel}, full \`advancements\` for levels 2–${targetLevel}, and enough \`experiences\` rows for tier entries through that level)`;

  const shortlistHint =
    targetLevel <= 1
      ? 'plausible alternates (several classes/subclasses, extra level-1 domain cards from each class’s **level1DomainCards**, several tier-1 weapons/armor).'
      : `scale the shortlist up: candidate classes/subclasses; for domain spells use only each class’s **domainCardsUpToTargetLevel** (and multiclass class’s list if multiclassing) — do **not** use **abilitiesIndex** to pick committed cards (it lists all domains). Higher-tier gear (tier ≤ ${targetLevel}), multiclass candidates, plus alternates (~2× what you will commit).`;

  const systemPrompt = `You are a Daggerheart TTRPG assistant building a ${levelHint} player character for an app that stores SRD reference ids.

TARGET BUILD LEVEL: **${targetLevel}** (user-selected). Set \`character.level\` to this number.

WORKFLOW (required for quality):
1. Call the tool **${FETCH_TOOL_NAME}** with \`items: [{ collection, id }, ...]\` using canonical \`srd-*\` ids from the JSON catalog below. ${shortlistHint} Maximum **120** entries per tool call; you may invoke the tool **multiple times** if you hit the cap or need more ids.
2. Read the tool results (full mechanics: class hope feature, subclass feature text, weapon tags/burdens, ability descriptions, etc.).
3. Output **one** final JSON object matching OUTPUT_SCHEMA (no markdown fences). Do **not** call the tool in the same turn as the final JSON.

RULES:
- Use ONLY classes, subclasses, ancestries, communities, armor, and weapons from the JSON catalog below for your final picks. **Domain cards** (\`srd-abl-*\`): every \`abilityIds\`, \`domainCardId\`, and \`domain_card\` ability must belong to the **primary class’s two domains** (see \`catalog.classes[classIdx].domains\`) and appear in that class’s \`level1DomainCards\` or \`domainCardsUpToTargetLevel\` — **do not** choose spells from global \`abilitiesIndex\` by name unless they also appear in those **per-class** lists (otherwise the app rejects them). If the concept needs spells from domains A and B, **pick a class whose \`domains\` are those two**, or use **multiclass** at level 5+ with \`multiclassDomain\` per CREATION CONTEXT. Never put \`srd-abl-*\` inside \`experience\` picks or \`experienceBonusChoices\` (those use **experience row** ids or names from \`character.experiences\`).
- Prefer canonical \`srd-*\` **ids** from the catalog for every reference field. If unsure, use the exact **name** string from the catalog (the app will resolve names).
- **Subclass** must be one of the **exact** names (or ids) in \`catalog.classes[<your resolved class>].subclasses\` for that class — no invented or other-system names.
- **Starting domain cards:** \`abilityIds\` must be two **distinct** entries from that class's \`level1DomainCards\` only (level-1 spells in that class’s domains — not arbitrary rows from \`abilitiesIndex\`).
- **Experiences:** Row count must match the app's tier rules for \`character.level\` (e.g. level 10 ⇒ **5** rows — see CREATION CONTEXT). Each row: \`name\` + \`score\` (usually 2 at creation). Assign stable \`id\` strings on rows you reference from \`advancements\`. Spread tone per \`catalog.experienceExamples\`.
- **baseTraits:** standard creation pool: one +2, two +1, two 0, one −1 (or class \`suggested_traits\`).
- **Weapons/armor:** tier ≤ **${targetLevel}** as listed in the catalog. If primary is two-handed, set secondaryWeaponId to null.
- **Advancements (level ≥ 2):** For each level L from 2 to \`character.level\`, fill \`advancements[String(L)]\` with \`domainCardId\` (new \`srd-abl-*\` card; for primary class domains, card spell level ≤ **L**) and two \`picks\` unless the first pick is \`proficiency\` or \`multiclass\` (then only one pick object). For \`experience\` picks, \`experienceIds\` must be two distinct **experience row** ids or names — not domain abilities. Follow tier/band rules in CREATION CONTEXT.
- **Multiclass:** If you use a \`multiclass\` advancement pick (level 5+ only), set \`multiclassClassId\`, \`multiclassSubclassId\`, and \`multiclassDomain\` when that class has two domains.
- **companion** only for Beastbound subclass; otherwise null.
- **sheetDisplayNames** (optional): \`weapons\`, \`abilities\`, and \`features\`. Ability keys: \`ability-<srd-abl-id>\` for any owned domain card. Feature nicknames: guide \`entry.key\` or squashed \`feat__<source_slug>__<feature_slug>\` with **underscores** (not hyphens) — see CREATION CONTEXT.

CREATION CONTEXT:
${creationMd}

CATALOG (JSON):
${JSON.stringify(catalog)}

OUTPUT: Your final assistant message must be ONLY valid JSON matching this shape:
${OUTPUT_SCHEMA}`;

  /** @type {object[]} */
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Character concept:\n${trimmed}` },
  ];

  let parsed = null;
  let lastFinishReason = '';

  for (let i = 0; i < MAX_CHAT_ITERATIONS; i++) {
    const allowTools = i < MAX_CHAT_ITERATIONS - 1;
    /** @type {Record<string, unknown>} */
    const requestBody = {
      model,
      messages,
      temperature: 0.35,
      max_tokens: Math.min(16384, 3600 + targetLevel * 600),
    };

    if (allowTools) {
      requestBody.tools = [FETCH_CHARACTER_BUILDER_DETAILS_TOOL];
      requestBody.tool_choice = 'auto';
    } else {
      requestBody.response_format = { type: 'json_object' };
    }

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
    const errBody = await res.json().catch(() => ({}));

    if (!res.ok) {
      logOpenAiChatCompletion('character_concept', errBody, {
        ok: false,
        errorCode: `http_${res.status}`,
        model,
        latencyMs,
      });
      const err = new Error(`OpenAI API error ${res.status}: ${errBody.error?.message || 'unknown'}`);
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    logOpenAiChatCompletion('character_concept', errBody, { ok: true, model, latencyMs });

    const choice = errBody.choices?.[0];
    const msg = choice?.message;
    lastFinishReason = choice?.finish_reason || '';

    if (!msg) {
      const err = new Error('Empty choice from OpenAI');
      err.code = 'OPENAI_ERROR';
      throw err;
    }

    const toolCalls = msg.tool_calls;
    if (allowTools && Array.isArray(toolCalls) && toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: msg.content != null && String(msg.content).trim() !== '' ? msg.content : null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        if (tc.type !== 'function' || tc.function?.name !== FETCH_TOOL_NAME) {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({
              error: `unsupported tool ${tc.function?.name || tc.type}`,
            }),
          });
          continue;
        }

        let args = { items: [] };
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: 'invalid JSON in tool arguments' }),
          });
          continue;
        }

        const payload = fetchCharacterBuilderDetails(args.items, srdData);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(payload),
        });
      }
      continue;
    }

    messages.push({ role: 'assistant', content: msg.content ?? null });

    const rawContent = typeof msg.content === 'string' ? msg.content.trim() : '';
    if (rawContent) {
      try {
        parsed = JSON.parse(rawContent);
        break;
      } catch {
        messages.push({
          role: 'user',
          content:
            'Your last message was not valid JSON. Reply with a single JSON object only (no markdown), matching OUTPUT_SCHEMA from the system message.',
        });
        continue;
      }
    }

    messages.push({
      role: 'user',
      content:
        'Provide the final character as a single JSON object only (no markdown), matching OUTPUT_SCHEMA from the system message.',
    });
  }

  if (!parsed) {
    const err = new Error(
      `Failed to obtain character JSON from OpenAI (finish_reason=${lastFinishReason || 'unknown'})`,
    );
    err.code = 'OPENAI_ERROR';
    throw err;
  }

  const justification = typeof parsed.justification === 'string' ? parsed.justification.trim() : '';
  const draft =
    parsed.character && typeof parsed.character === 'object' ? parsed.character : { ...parsed };
  delete draft.justification;

  const { patch, warnings } = resolveCharacterAiDraft(draft, srdData, { targetLevel });
  return { patch, justification, warnings };
}
