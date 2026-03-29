/**
 * OpenAI-backed level-1 character draft from a natural-language concept.
 * Env: OPENAI_API_KEY
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadSrdDataForV2Engine } from './server/load-srd-engine-data.js';
import { resolveCharacterAiDraft } from './character-ai-resolve.js';
import { CHARACTER_AI_EXPERIENCE_EXAMPLES } from './character-ai-experience-examples.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CREATION_CONTEXT_PATH = join(__dirname, '..', 'docs', 'character-creation-llm-context.md');

const DESC_MAX = 140;

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
 * @param {object} srdData
 */
export function buildCompactCharacterAiCatalog(srdData) {
  const tierCap = 1;

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

  return {
    classes,
    subclasses,
    ancestries,
    communities,
    armor,
    weapons,
    experienceExamples: CHARACTER_AI_EXPERIENCE_EXAMPLES,
  };
}

const OUTPUT_SCHEMA = `{
  "justification": "string — brief plain-language summary of your picks",
  "character": {
    "name": "string",
    "pronouns": "string",
    "description": "string",
    "background": "string",
    "connectionText": "string",
    "classId": "string — MUST be an id from catalog.classes[].id OR the exact class name",
    "subclassId": "string — id or name from catalog.subclasses",
    "ancestryIds": ["string — id or ancestry name"],
    "communityId": "string — id or community name",
    "baseTraits": { "agility": number, "strength": number, "finesse": number, "instinct": number, "presence": number, "knowledge": number },
    "primaryWeaponId": "string — id or weapon name (tier 1 list)",
    "secondaryWeaponId": "string | null — omit or null if primary is two-handed",
    "armorId": "string — id or armor name (tier 1 list)",
    "abilityIds": ["string", "string — two DISTINCT ids or names from THAT class's level1DomainCards ONLY (see catalog.classes[] for the class you picked)"],
    "experiences": [ { "id": "optional string", "name": "string", "score": number }, { "name": "string", "score": number } ],
    "experienceBonusChoices": { "Ancestry feature name": "experience id OR experience name" },
    "companion": null | {
      "name": "string",
      "species": "string",
      "attackName": "string",
      "evasion": number,
      "maxStress": number,
      "currentStress": number,
      "experiences": [ { "name": "string", "score": number } ]
    }
  }
}`;

async function loadCreationContext() {
  try {
    return (await readFile(CREATION_CONTEXT_PATH, 'utf8')).trim();
  } catch {
    return 'Level 1 Daggerheart character; follow SRD class/subclass/domain rules.';
  }
}

/**
 * @param {string} concept
 * @param {{ signal?: AbortSignal }} [opts]
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

  const srdData = await loadSrdDataForV2Engine();
  const catalog = buildCompactCharacterAiCatalog(srdData);
  const creationMd = await loadCreationContext();

  const systemPrompt = `You are a Daggerheart TTRPG assistant building a **level 1** player character for an app that stores SRD reference ids.

RULES:
- Use ONLY classes, subclasses, ancestries, communities, armor, and weapons from the JSON catalog below.
- Prefer canonical \`srd-*\` **ids** from the catalog for every reference field. If unsure, use the exact **name** string from the catalog (the app will resolve names).
- Subclass must be legal for the chosen class (see catalog.classes[].subclasses name list; match subclass by id or name).
- **Domain cards (critical):** After you pick \`classId\`, find that class in \`catalog.classes\` and **only** choose \`abilityIds\` from that class's \`level1DomainCards\` array (two **different** abilities). Those are the only level-1 spell cards this class can take. Do not pick a card just because it fits the character flavor if it belongs to another domain (e.g. Valor cards for a non-Valor class).
- **Experiences:** Provide **exactly two** entries in \`experiences\`, each with \`name\` (short phrase) and \`score\` (usually **2** at creation). Mirror the tone of \`catalog.experienceExamples\`: one phrase skewed toward **action, danger, or combat-adjacent** situations; one toward **exploration, social, or craft / everyday life** — not two that are both only combat.
- **baseTraits** must use the standard creation pool: one +2, two +1, two 0, one −1 across the six keys (unless you copy the class suggested_traits spread from the catalog for that class).
- **Weapons**: tier 1 only. If primary is two-handed, set secondaryWeaponId to null.
- **companion** is ONLY for Beastbound subclass; otherwise null.

CREATION CONTEXT:
${creationMd}

CATALOG (JSON):
${JSON.stringify(catalog)}

OUTPUT: Return ONLY valid JSON matching this shape (no markdown):
${OUTPUT_SCHEMA}`;

  const requestBody = {
    model: process.env.OPENAI_CHARACTER_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Character concept:\n${trimmed}` },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2500,
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
  const draft =
    parsed.character && typeof parsed.character === 'object' ? parsed.character : { ...parsed };
  delete draft.justification;

  const { patch, warnings } = resolveCharacterAiDraft(draft, srdData);
  return { patch, justification, warnings };
}
