/**
 * OpenAI API **Standard** tier text-model estimates (USD per 1M tokens).
 * Source: https://developers.openai.com/api/docs/pricing
 *
 * Cached input uses `cachedInputPerM` when set; otherwise falls back to `inputPerM`.
 */

/** @typedef {{ inputPerM: number, cachedInputPerM: number | null, outputPerM: number }} OpenAiModelPricing */

/**
 * Built-in Standard tier table (exact API model id prefixes / ids).
 * Longer keys are matched first — see `resolveOpenAiPricing`.
 * @type {Record<string, OpenAiModelPricing>}
 */
export const OPENAI_STANDARD_PRICE_PER_MTOK = Object.freeze({
  'gpt-5.4-pro': { inputPerM: 30, cachedInputPerM: null, outputPerM: 180 },
  'gpt-5.4-mini': { inputPerM: 0.75, cachedInputPerM: 0.075, outputPerM: 4.5 },
  'gpt-5.4-nano': { inputPerM: 0.2, cachedInputPerM: 0.02, outputPerM: 1.25 },
  'gpt-5.4': { inputPerM: 2.5, cachedInputPerM: 0.25, outputPerM: 15 },
  'gpt-5.2-pro': { inputPerM: 21, cachedInputPerM: null, outputPerM: 168 },
  'gpt-5.2': { inputPerM: 1.75, cachedInputPerM: 0.175, outputPerM: 14 },
  'gpt-5.1': { inputPerM: 1.25, cachedInputPerM: 0.125, outputPerM: 10 },
  'gpt-5-mini': { inputPerM: 0.25, cachedInputPerM: 0.025, outputPerM: 2 },
  'gpt-5-nano': { inputPerM: 0.05, cachedInputPerM: 0.005, outputPerM: 0.4 },
  'gpt-5-pro': { inputPerM: 15, cachedInputPerM: null, outputPerM: 120 },
  'gpt-5': { inputPerM: 1.25, cachedInputPerM: 0.125, outputPerM: 10 },
  'gpt-4.1-mini': { inputPerM: 0.4, cachedInputPerM: 0.1, outputPerM: 1.6 },
  'gpt-4.1-nano': { inputPerM: 0.1, cachedInputPerM: 0.025, outputPerM: 0.4 },
  'gpt-4.1': { inputPerM: 2, cachedInputPerM: 0.5, outputPerM: 8 },
  'gpt-4o-2024-05-13': { inputPerM: 5, cachedInputPerM: null, outputPerM: 15 },
  'gpt-4o-mini': { inputPerM: 0.15, cachedInputPerM: 0.075, outputPerM: 0.6 },
  'gpt-4o': { inputPerM: 2.5, cachedInputPerM: 1.25, outputPerM: 10 },
  'gpt-4-turbo-2024-04-09': { inputPerM: 10, cachedInputPerM: null, outputPerM: 30 },
  'gpt-4-0125-preview': { inputPerM: 10, cachedInputPerM: null, outputPerM: 30 },
  'gpt-4-1106-vision-preview': { inputPerM: 10, cachedInputPerM: null, outputPerM: 30 },
  'gpt-4-1106-preview': { inputPerM: 10, cachedInputPerM: null, outputPerM: 30 },
  'gpt-4-32k': { inputPerM: 60, cachedInputPerM: null, outputPerM: 120 },
  'gpt-4-0613': { inputPerM: 30, cachedInputPerM: null, outputPerM: 60 },
  'gpt-4-0314': { inputPerM: 30, cachedInputPerM: null, outputPerM: 60 },
  'gpt-3.5-turbo-16k-0613': { inputPerM: 3, cachedInputPerM: null, outputPerM: 4 },
  'gpt-3.5-turbo-1106': { inputPerM: 1, cachedInputPerM: null, outputPerM: 2 },
  'gpt-3.5-turbo-0613': { inputPerM: 1.5, cachedInputPerM: null, outputPerM: 2 },
  'gpt-3.5-turbo-0125': { inputPerM: 0.5, cachedInputPerM: null, outputPerM: 1.5 },
  'gpt-3.5-turbo': { inputPerM: 0.5, cachedInputPerM: null, outputPerM: 1.5 },
  'gpt-3.5-0301': { inputPerM: 1.5, cachedInputPerM: null, outputPerM: 2 },
  'gpt-3.5-turbo-instruct': { inputPerM: 1.5, cachedInputPerM: null, outputPerM: 2 },
  'o1-pro': { inputPerM: 150, cachedInputPerM: null, outputPerM: 600 },
  'o1-mini': { inputPerM: 1.1, cachedInputPerM: 0.55, outputPerM: 4.4 },
  'o1': { inputPerM: 15, cachedInputPerM: 7.5, outputPerM: 60 },
  'o3-mini': { inputPerM: 1.1, cachedInputPerM: 0.55, outputPerM: 4.4 },
  'o3-pro': { inputPerM: 20, cachedInputPerM: null, outputPerM: 80 },
  'o3': { inputPerM: 2, cachedInputPerM: 0.5, outputPerM: 8 },
  'o4-mini': { inputPerM: 1.1, cachedInputPerM: 0.275, outputPerM: 4.4 },
  'babbage-002': { inputPerM: 0.4, cachedInputPerM: null, outputPerM: 0.4 },
  'davinci-002': { inputPerM: 2, cachedInputPerM: null, outputPerM: 2 },
});

function getSortedPricingKeys(map) {
  return Object.keys(map).sort((a, b) => b.length - a.length);
}

/**
 * @param {string | null | undefined} model
 * @param {Record<string, OpenAiModelPricing>} [map]
 * @returns {OpenAiModelPricing | null}
 */
export function resolveOpenAiPricing(model, map = OPENAI_STANDARD_PRICE_PER_MTOK) {
  if (model == null || typeof model !== 'string') return null;
  const id = model.trim().toLowerCase();
  if (!id) return null;

  const direct = map[id];
  if (direct) return direct;

  for (const key of getSortedPricingKeys(map)) {
    if (id === key || id.startsWith(key)) {
      return map[key];
    }
  }
  return null;
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function toTokenNumber(v) {
  if (v == null) return null;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string | null | undefined} json
 * @returns {Record<string, OpenAiModelPricing>}
 */
export function parseOpenAiPricingOverridesFromEnv(json) {
  if (!json || typeof json !== 'string' || !json.trim()) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    /** @type {Record<string, OpenAiModelPricing>} */
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string' || !k.trim()) continue;
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const inputPerM = typeof v.inputPerM === 'number' ? v.inputPerM : parseFloat(v.inputPerM);
      const outputPerM = typeof v.outputPerM === 'number' ? v.outputPerM : parseFloat(v.outputPerM);
      let cachedInputPerM = null;
      if (v.cachedInputPerM != null && v.cachedInputPerM !== '') {
        const c = typeof v.cachedInputPerM === 'number' ? v.cachedInputPerM : parseFloat(v.cachedInputPerM);
        cachedInputPerM = Number.isFinite(c) ? c : null;
      }
      if (!Number.isFinite(inputPerM) || !Number.isFinite(outputPerM)) continue;
      out[k.trim().toLowerCase()] = {
        inputPerM,
        cachedInputPerM,
        outputPerM,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Merges `OPENAI_STANDARD_PRICE_PER_MTOK` with `process.env.AI_USAGE_OPENAI_PRICING_JSON` overrides.
 * @returns {Record<string, OpenAiModelPricing>}
 */
export function buildOpenAiPricingMap() {
  const overrides = parseOpenAiPricingOverridesFromEnv(process.env.AI_USAGE_OPENAI_PRICING_JSON);
  return { ...OPENAI_STANDARD_PRICE_PER_MTOK, ...overrides };
}

/**
 * @param {{
 *   model?: string | null,
 *   prompt_tokens?: unknown,
 *   completion_tokens?: unknown,
 *   cached_prompt_tokens?: unknown,
 * }} row
 * @param {{ pricingMap?: Record<string, OpenAiModelPricing> }} [opts]
 * @returns {{ usd: number | null, reason?: string }}
 */
export function estimateOpenAiUsageCostUsd(row, opts = {}) {
  const pricingMap = opts.pricingMap ?? buildOpenAiPricingMap();
  const model = row.model;
  if (model == null || (typeof model === 'string' && !model.trim())) {
    return { usd: null, reason: 'no_model' };
  }

  const pricing = resolveOpenAiPricing(typeof model === 'string' ? model : String(model), pricingMap);
  if (!pricing) {
    return { usd: null, reason: 'unknown_model' };
  }

  const prompt = toTokenNumber(row.prompt_tokens) ?? 0;
  const completion = toTokenNumber(row.completion_tokens) ?? 0;
  const cachedRaw = toTokenNumber(row.cached_prompt_tokens);
  const cachedN = cachedRaw != null ? Math.max(0, cachedRaw) : 0;
  const uncached = Math.max(0, prompt - cachedN);

  const cachedRate = pricing.cachedInputPerM != null ? pricing.cachedInputPerM : pricing.inputPerM;

  const cost =
    (uncached / 1e6) * pricing.inputPerM + (cachedN / 1e6) * cachedRate + (completion / 1e6) * pricing.outputPerM;

  return { usd: cost };
}

/** Metadata for GET /api/admin/ai-usage */
export const AI_USAGE_PRICING_TIER = 'openai_standard';

export const AI_USAGE_PRICING_NOTE =
  'USD estimates use OpenAI Standard text pricing per model; x.ai image calls are not estimated unless token-based overrides are configured.';

/**
 * @param {object} row — aggregate row with provider, model, token sums
 * @param {{ pricingMap?: Record<string, OpenAiModelPricing> }} [opts]
 * @returns {number | null}
 */
export function estimateAiUsageAggregateCostUsd(row, opts = {}) {
  const provider = row.provider;
  if (provider === 'openai') {
    const { usd, reason } = estimateOpenAiUsageCostUsd(row, opts);
    if (reason === 'no_model' || reason === 'unknown_model') return null;
    return usd;
  }
  return null;
}

/**
 * @template T
 * @param {T[]} rows
 * @param {{ pricingMap?: Record<string, OpenAiModelPricing> }} [opts]
 * @returns {Array<T & { estimated_cost_usd: number | null }>}
 */
export function attachEstimatedCostsToAggregateRows(rows, opts = {}) {
  const pricingMap = opts.pricingMap ?? buildOpenAiPricingMap();
  return rows.map((row) => ({
    ...row,
    estimated_cost_usd: estimateAiUsageAggregateCostUsd(row, { pricingMap }),
  }));
}
