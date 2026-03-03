/**
 * LLM-powered parsing of Reddit posts into structured Daggerheart game data.
 *
 * Uses GPT-4o vision to handle both text descriptions and image-based stat blocks.
 * Images are classified as:
 *   statblock  — contains game stats to extract into structured fields
 *   artwork    — creature/location art to keep as imageUrl on the item
 *   combined   — contains both; extract stats AND use as imageUrl
 *
 * Env var: OPENAI_API_KEY (required; module fails gracefully if not set)
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

// ---------------------------------------------------------------------------
// Schema descriptions embedded in the prompt
// ---------------------------------------------------------------------------

const ADVERSARY_SCHEMA = `{
  "name": "string",
  "tier": 1 | 2 | 3 | 4,
  "role": "bruiser" | "horde" | "leader" | "minion" | "ranged" | "skulk" | "social" | "solo" | "standard" | "support",
  "description": "string — background/flavour text",
  "motive": "string — motives and tactics",
  "difficulty": number (default 10),
  "hp_max": number (default 6),
  "stress_max": number (default 3),
  "hp_thresholds": { "major": number | null, "severe": number | null },
  "attack": {
    "name": "string",
    "range": "Melee" | "Very Close" | "Close" | "Far" | "Very Far",
    "modifier": number,
    "trait": "Phy" | "Mag" | "Dir",
    "damage": "string (e.g. '2d8', '1d12+2')"
  },
  "experiences": [ { "id": "uuid-string", "name": "string", "modifier": number } ],
  "features": [ { "id": "uuid-string", "name": "string", "type": "passive" | "action" | "reaction", "description": "string" } ],
  "imageUrl": "string | null — URL of an artwork image (not the stat block itself)"
}`;

const ENVIRONMENT_SCHEMA = `{
  "name": "string",
  "tier": 1 | 2 | 3 | 4,
  "type": "traversal" | "exploration" | "social" | "event",
  "description": "string — background/flavour text",
  "difficulty": number (default 10),
  "potential_adversaries": [ { "name": "string" } ],
  "features": [ { "id": "uuid-string", "name": "string", "type": "passive" | "action" | "reaction", "description": "string" } ],
  "imageUrl": "string | null — URL of an artwork image (not the stat block itself)"
}`;

// ---------------------------------------------------------------------------
// Build the system prompt for a given collection
// ---------------------------------------------------------------------------

function buildSystemPrompt(collection) {
  const isEnv = collection === 'environments';
  const schema = isEnv ? ENVIRONMENT_SCHEMA : ADVERSARY_SCHEMA;
  const typeName = isEnv ? 'environment' : 'adversary';

  return `You are a Daggerheart TTRPG data extractor. Your task is to extract structured game data from Reddit posts about homebrew ${typeName}s.

Posts may include text descriptions, markdown stat blocks, or images of formatted stat cards.

OUTPUT: Return ONLY a single valid JSON object matching this schema (no markdown, no explanation):
${schema}

IMAGE HANDLING:
- If an image contains a formatted stat block (game statistics, HP, attacks, features, abilities), extract all data from it into the JSON fields.
- If an image is artwork (a character illustration, creature drawing, or location art with no stat text), set "imageUrl" to that image's URL so the artwork can be displayed.
- If an image contains BOTH a stat block and artwork in the same image, extract the stats AND set "imageUrl" to the image's URL.
- If multiple images are present, prefer the most detailed stat block for extraction and the most visually appealing artwork for "imageUrl".

DATA RULES:
- Generate a random UUID-like string (e.g. "f3a1b2c4-d5e6-7890-ab12-cd34ef56gh78") for each "id" field in features and experiences.
- If a field is missing or unclear, use sensible defaults: tier defaults to 1, difficulty to 10, hp_max to 6, stress_max to 3.
- Infer tier from described power level if not stated (tier 1 = common/weak, 4 = legendary/boss).
- "motive" should be a concise summary of the creature's goals and tactics (1–3 sentences).
- For environments, "type" can be inferred: traversal = movement/navigation challenges, exploration = discovery/investigation, social = NPCs/interaction, event = time-pressure scenario.
- Return null for "imageUrl" if no artwork image is found.
- For numbers that appear as text (e.g. "six"), convert to digits.`;
}

// ---------------------------------------------------------------------------
// Public: parse a Reddit post into structured item data using GPT-4o
// ---------------------------------------------------------------------------

/**
 * Parse Reddit post text and images into a structured Daggerheart adversary or environment.
 *
 * @param {object} opts
 * @param {string}   opts.text       - Post selftext (markdown body)
 * @param {string[]} opts.imageUrls  - Array of image URLs from the post
 * @param {string}   opts.collection - 'adversaries' | 'environments'
 * @param {string}   [opts.title]    - Post title (prepended to text for context)
 * @returns {{ item: object, artworkUrl: string|null }}
 */
export async function parseRedditPost({ text, imageUrls = [], collection = 'adversaries', title = '' } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const systemPrompt = buildSystemPrompt(collection);

  // Build user message: text first, then images
  const contentParts = [];

  const fullText = [title && `Title: ${title}`, text && `Post text:\n${text}`]
    .filter(Boolean)
    .join('\n\n');

  if (fullText.trim()) {
    contentParts.push({ type: 'text', text: fullText });
  }

  // Include up to 8 images to keep cost reasonable
  for (const url of imageUrls.slice(0, 8)) {
    contentParts.push({
      type: 'image_url',
      image_url: { url, detail: 'high' },
    });
  }

  if (contentParts.length === 0) {
    throw new Error('No content to parse (no text and no images)');
  }

  const requestBody = {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contentParts },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 2500,
    temperature: 0.1,
  };

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${res.status}: ${errBody.error?.message || 'unknown'}`);
  }

  const json = await res.json();
  const rawContent = json.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    throw new Error(`Failed to parse OpenAI JSON response: ${e.message}`);
  }

  // Ensure all features and experiences have UUIDs
  if (Array.isArray(parsed.features)) {
    parsed.features = parsed.features.map(f => ({ ...f, id: f.id || crypto.randomUUID() }));
  }
  if (Array.isArray(parsed.experiences)) {
    parsed.experiences = parsed.experiences.map(e => ({ ...e, id: e.id || crypto.randomUUID() }));
  }

  // Clamp tier to valid range
  if (typeof parsed.tier === 'number') {
    parsed.tier = Math.max(1, Math.min(4, Math.round(parsed.tier)));
  } else {
    parsed.tier = 1;
  }

  // Extract the artwork URL (kept separate from the structured item fields)
  const artworkUrl = parsed.imageUrl || null;
  delete parsed.imageUrl;

  return {
    item: { ...parsed, _source: 'reddit' },
    artworkUrl,
  };
}
