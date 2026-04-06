import { getUnifiedItems } from './db.js';
import { logOpenAiChatCompletion } from './ai-usage-log.js';
import { unifiedListConfig } from './unified-list-config.js';
import { filterFeatureCatalog } from './v2-feature-catalog.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENAI_LIBRARY_MODEL || process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini';
const SEMANTIC_CANDIDATE_LIMIT = 80;
const SEMANTIC_RESULT_LIMIT = 30;
const ASSISTANT_COLLECTIONS = [
  'abilities',
  'adversaries',
  'ancestries',
  'armor',
  'beastforms',
  'campaign_frames',
  'classes',
  'communities',
  'consumables',
  'domains',
  'environments',
  'features',
  'items',
  'rules',
  'subclasses',
  'weapons',
];

function normalizeQueryTerms(raw) {
  return String(raw || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function flattenValue(value, depth = 0) {
  if (value == null || depth > 3) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => flattenValue(entry, depth + 1)).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !key.startsWith('_') && key !== 'id' && key !== 'imageUrl' && key !== '_additionalImages')
      .map(([, entry]) => flattenValue(entry, depth + 1))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export function buildLibraryAiText(item, collection) {
  if (!item || typeof item !== 'object') return '';
  const preferredKeys = [
    'name',
    'description',
    'excerpt',
    'breadcrumb',
    'chapter',
    'pitch',
    'tone',
    'themes',
    'touchstones',
    'overview',
    'principles',
    'distinctions',
    'inciting_incident',
    'campaign_mechanics',
    'session_zero_questions',
    'body',
    'features',
    'foundation_features',
    'specialization_features',
    'mastery_features',
    'class_features',
    'hope_feature',
    'attack',
    'traits',
    'background_questions',
    'connections',
    'class_items',
    'cards',
    'potential_adversaries',
  ];
  const preferred = preferredKeys
    .map((key) => flattenValue(item[key]))
    .filter(Boolean)
    .join('\n');
  const fallback = flattenValue(item);
  return [collection, preferred || fallback].filter(Boolean).join('\n').trim();
}

function truncateText(raw, max = 700) {
  const text = String(raw || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

export function lexicalScoreLibraryItem(query, item, collection) {
  const text = buildLibraryAiText(item, collection).toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  const terms = normalizeQueryTerms(query);
  if (terms.length === 0) return 0;
  let score = 0;
  for (const term of terms) {
    if (name.includes(term)) score += 8;
    if (text.includes(term)) score += 3;
  }
  if (text.includes(String(query || '').toLowerCase().trim())) score += 12;
  score += Math.min(4, Number(item?.popularity || ((item?.clone_count || 0) + (item?.play_count || 0))) / 10);
  return score;
}

function fallbackSemanticRank(query, items, collection, limit = SEMANTIC_RESULT_LIMIT) {
  return [...items]
    .sort((a, b) => lexicalScoreLibraryItem(query, b, collection) - lexicalScoreLibraryItem(query, a, collection))
    .slice(0, limit);
}

function preselectSemanticCandidates(query, items, collection, maxCandidates = SEMANTIC_CANDIDATE_LIMIT) {
  const scored = items.map((item) => ({
    item,
    score: lexicalScoreLibraryItem(query, item, collection),
  }));
  scored.sort((a, b) => b.score - a.score);
  const positive = scored.filter((row) => row.score > 0);
  const base = positive.length > 0 ? positive : scored;
  return base.slice(0, maxCandidates).map((row) => row.item);
}

function parseJsonContent(content) {
  if (!content) return null;
  const trimmed = String(content).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function openAiJson(builder, { systemPrompt, userPrompt, maxTokens = 1200 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const started = Date.now();
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    logOpenAiChatCompletion(builder, json, {
      ok: false,
      errorCode: json?.error?.code || `HTTP_${res.status}`,
      latencyMs: Date.now() - started,
      model: DEFAULT_MODEL,
    });
    return null;
  }
  logOpenAiChatCompletion(builder, json, {
    ok: true,
    latencyMs: Date.now() - started,
    model: json?.model || DEFAULT_MODEL,
  });
  return parseJsonContent(json?.choices?.[0]?.message?.content || '');
}

function buildPromptCandidates(items, collection) {
  return items.map((item) => ({
    id: item.id,
    name: item.name || item.id,
    collection,
    source: item._source || 'srd',
    text: truncateText(buildLibraryAiText(item, collection), 650),
  }));
}

export async function semanticFilterLibraryItems(query, items, collection, {
  limit = SEMANTIC_RESULT_LIMIT,
} = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return { items, semanticApplied: false };
  const shortlist = preselectSemanticCandidates(trimmed, items, collection);
  if (shortlist.length === 0) return { items: [], semanticApplied: true };

  const promptItems = buildPromptCandidates(shortlist, collection);
  const json = await openAiJson('library_semantic_filter', {
    systemPrompt: [
      'You rank library search results for a Daggerheart app.',
      'Only keep candidates that semantically match the user query.',
      'Prefer broad meaning matches, fantasy analogies, rules intent, and thematic similarity.',
      'Return strict JSON: {"matches":[{"id":"...","score":0-100,"reason":"short"}]}.',
      `Return at most ${limit} matches.`,
    ].join(' '),
    userPrompt: JSON.stringify({
      query: trimmed,
      collection,
      candidates: promptItems,
    }),
    maxTokens: 1400,
  });

  const ids = Array.isArray(json?.matches)
    ? json.matches
      .map((row) => (row && typeof row.id === 'string' ? row.id : null))
      .filter(Boolean)
    : [];
  if (ids.length === 0) {
    return { items: fallbackSemanticRank(trimmed, shortlist, collection, limit), semanticApplied: true };
  }

  const byId = new Map(shortlist.map((item) => [item.id, item]));
  const ranked = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) ranked.push(item);
    if (ranked.length >= limit) break;
  }
  return {
    items: ranked.length > 0 ? ranked : fallbackSemanticRank(trimmed, shortlist, collection, limit),
    semanticApplied: true,
  };
}

async function loadAssistantCollectionItems(appId, userId, collection, scope = {}) {
  if (collection === 'features') {
    return filterFeatureCatalog({
      search: '',
      featScope: [],
      tiers: [],
      sort: 'name',
      offset: 0,
      limit: 2000,
    }).items;
  }

  const cfg = unifiedListConfig(collection);
  const result = await getUnifiedItems(appId, userId, collection, {
    includeMine: scope.includeMine !== false,
    includePublic: scope.includePublic !== false,
    includeSrd: scope.includeSrd !== false,
    includeHod: !!scope.includeHod,
    search: '',
    tierMax: null,
    tiers: [],
    typeField: cfg.typeField,
    typeValues: [],
    extraTypeField: cfg.extraTypeField,
    extraTypeValues: [],
    tierExprSql: cfg.tierExprSql,
    sort: 'popularity',
    offset: 0,
    limit: 250,
  });
  return result.items.map((item) => ({
    ...item,
    popularity: (item.clone_count || 0) + (item.play_count || 0),
  }));
}

export function chooseAssistantCollections(question, scopeCollection) {
  if (scopeCollection && scopeCollection !== 'all') return [scopeCollection];
  const q = String(question || '').toLowerCase();
  const picks = new Set();
  if (/\b(rest|stress|hp|trait|swim|difficulty|hope|armor)\b/.test(q)) picks.add('rules');
  if (/\b(spiderman|spider|domain card|card|spell|ability)\b/.test(q)) {
    picks.add('abilities');
    picks.add('domains');
    picks.add('features');
  }
  if (/\b(adversary|enemy|monster|creature|trees|forest|woods)\b/.test(q)) {
    picks.add('adversaries');
    picks.add('environments');
  }
  if (/\b(campaign|frame|setting|tech|technology)\b/.test(q)) picks.add('campaign_frames');
  if (picks.size > 0) return [...picks];
  return ASSISTANT_COLLECTIONS;
}

function buildAssistantHandoffActions(question, references) {
  const actions = [];
  const trimmed = String(question || '').trim();
  if (!trimmed) return actions;

  actions.push({
    label: 'Open in Library',
    tab: 'all',
    semantic: trimmed,
  });

  const counts = new Map();
  for (const ref of references || []) {
    if (!ref?.collection) continue;
    counts.set(ref.collection, (counts.get(ref.collection) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  if (top && top !== 'all') {
    actions.push({
      label: `Open ${top.replace(/_/g, ' ')}`,
      tab: top,
      semantic: trimmed,
    });
  }
  return actions;
}

function collectionIntentBonus(question, collection) {
  const q = String(question || '').toLowerCase();
  if (
    collection === 'rules'
    && /\b(rest|stress|hp|trait|swim|difficulty|hope|armor|damage|healing|downtime|move|roll|slot|character)\b/.test(q)
  ) {
    return 40;
  }
  if (collection === 'campaign_frames' && /\b(campaign|frame|setting|tech|technology|tone|theme)\b/.test(q)) {
    return 35;
  }
  if ((collection === 'abilities' || collection === 'domains') && /\b(domain|card|spell|spiderman|spider|web|swing)\b/.test(q)) {
    return 25;
  }
  return 0;
}

function buildFallbackAssistantAnswer(shortlisted) {
  if (!Array.isArray(shortlisted) || shortlisted.length === 0) {
    return "I couldn't confidently answer that from the current library material.";
  }
  const top = shortlisted[0];
  const summary = truncateText(
    top.item?.description
      || top.item?.excerpt
      || top.item?.pitch
      || top.item?.overview
      || buildLibraryAiText(top.item, top.collection),
    240
  );
  const label = top.item?.name || top.item?.id || 'Top match';
  if (!summary) return `Best reference: **${label}**`;
  return `Best reference: **${label}**\n\n${summary}`;
}

export async function answerLibraryQuestion(question, {
  appId,
  userId,
  scope = {},
} = {}) {
  const trimmed = String(question || '').trim();
  if (!trimmed) {
    return {
      answerMarkdown: '',
      references: [],
      handoffActions: [],
      warnings: ['Question is required.'],
    };
  }

  const collections = chooseAssistantCollections(trimmed, scope.collection);
  const loaded = await Promise.all(collections.map(async (collection) => {
    try {
      const items = await loadAssistantCollectionItems(appId, userId, collection, scope);
      return { collection, items };
    } catch {
      return { collection, items: [] };
    }
  }));

  const candidateRows = loaded.flatMap(({ collection, items }) =>
    items.map((item) => ({
      collection,
      item,
      score: lexicalScoreLibraryItem(trimmed, item, collection) + collectionIntentBonus(trimmed, collection),
    }))
  );

  candidateRows.sort((a, b) => b.score - a.score);
  const shortlisted = candidateRows.slice(0, 40);
  if (shortlisted.length === 0) {
    return {
      answerMarkdown: "I couldn't find matching library material for that yet.",
      references: [],
      handoffActions: [{ label: 'Open in Library', tab: 'all', semantic: trimmed }],
      warnings: ['No structured matches found.'],
    };
  }

  const promptCandidates = shortlisted.map(({ collection, item }) => ({
    id: `${collection}:${item.id}`,
    collection,
    name: item.name || item.id,
    text: truncateText(buildLibraryAiText(item, collection), 700),
  }));

  const json = await openAiJson('library_assistant_answer', {
    systemPrompt: [
      'You are a Daggerheart library assistant.',
      'Answer using only the provided candidate snippets.',
      'If the candidates are incomplete, say so briefly in warnings.',
      'Return strict JSON with keys: answerMarkdown, warnings, referenceIds.',
      'referenceIds must be an array of candidate ids like "collection:itemId".',
      'Keep the answer concise and directly useful.',
    ].join(' '),
    userPrompt: JSON.stringify({
      question: trimmed,
      candidates: promptCandidates,
    }),
    maxTokens: 1800,
  });

  const idSet = new Set(Array.isArray(json?.referenceIds) ? json.referenceIds.filter((id) => typeof id === 'string') : []);
  const explicitReferences = shortlisted
    .filter(({ collection, item }) => idSet.has(`${collection}:${item.id}`))
    .slice(0, 8)
    .map(({ collection, item }) => ({ collection, item }));
  const references = explicitReferences.length > 0
    ? explicitReferences
    : shortlisted.slice(0, 5).map(({ collection, item }) => ({ collection, item }));

  const answerMarkdown = typeof json?.answerMarkdown === 'string' && json.answerMarkdown.trim()
    ? json.answerMarkdown.trim()
    : buildFallbackAssistantAnswer(shortlisted);

  const warnings = Array.isArray(json?.warnings)
    ? json.warnings.filter((msg) => typeof msg === 'string' && msg.trim())
    : [];
  if (!json?.answerMarkdown) {
    warnings.push('Showing fallback references because a cited prose answer was not available.');
  }

  return {
    answerMarkdown,
    references,
    handoffActions: buildAssistantHandoffActions(trimmed, references),
    warnings,
  };
}
