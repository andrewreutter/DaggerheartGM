import { insertAiUsageEvent } from './db.js';

/**
 * Known builder labels (for admin UI filter); new surfaces may add rows ad hoc.
 * @type {readonly string[]}
 */
export const AI_USAGE_BUILDERS = Object.freeze([
  'character_concept',
  'adversary_concept',
  'environment_concept',
  'encounter_plan',
  'reddit_llm_parse',
  'image_generate',
  'image_edit',
]);

/**
 * @param {{
 *   appId?: string,
 *   builder: string,
 *   provider: 'openai' | 'xai',
 *   model?: string | null,
 *   promptTokens?: number | null,
 *   completionTokens?: number | null,
 *   cachedPromptTokens?: number | null,
 *   totalTokens?: number | null,
 *   latencyMs?: number | null,
 *   ok: boolean,
 *   errorCode?: string | null,
 *   requestId?: string | null,
 * }} evt
 */
export function logAiUsage(evt) {
  if (process.env.AI_USAGE_DEBUG === '1') {
    console.debug('[ai-usage]', evt.builder, evt.provider, evt.model, evt);
  }
  if (!process.env.DATABASE_URL) return;

  const appId = evt.appId ?? process.env.APP_ID ?? 'daggerheart-gm-tool';
  const row = {
    appId,
    builder: evt.builder,
    provider: evt.provider,
    model: evt.model ?? null,
    promptTokens: evt.promptTokens ?? null,
    completionTokens: evt.completionTokens ?? null,
    cachedPromptTokens: evt.cachedPromptTokens ?? null,
    totalTokens: evt.totalTokens ?? null,
    latencyMs: evt.latencyMs ?? null,
    ok: evt.ok,
    errorCode: evt.errorCode ?? null,
    requestId: evt.requestId ?? null,
  };

  insertAiUsageEvent(row).catch((err) => {
    console.error('[ai-usage] persist failed:', err?.message || err);
  });
}

/**
 * Pure shape for tests / inspection (same fields as `logAiUsage` minus appId defaulting).
 * @param {string} builder
 * @param {object | null | undefined} responseJson
 * @param {{ ok?: boolean, errorCode?: string | null, model?: string | null, latencyMs?: number | null, requestId?: string | null }} [opts]
 */
export function buildOpenAiChatUsageEvent(builder, responseJson, opts = {}) {
  const usage = responseJson?.usage;
  const ok = opts.ok !== false;
  return {
    builder,
    provider: 'openai',
    model: opts.model ?? responseJson?.model ?? null,
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens: usage?.completion_tokens ?? null,
    cachedPromptTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
    ok,
    errorCode: opts.errorCode ?? null,
    latencyMs: opts.latencyMs ?? null,
    requestId: opts.requestId ?? responseJson?.id ?? null,
  };
}

/**
 * Record one OpenAI Chat Completions response (success or HTTP error body).
 * @param {string} builder
 * @param {object | null | undefined} responseJson — parsed JSON body
 * @param {{ ok?: boolean, errorCode?: string | null, model?: string | null, latencyMs?: number | null, requestId?: string | null }} [opts]
 */
export function logOpenAiChatCompletion(builder, responseJson, opts = {}) {
  logAiUsage(buildOpenAiChatUsageEvent(builder, responseJson, opts));
}

/**
 * x.ai image APIs — token usage is often absent; still log latency + outcome.
 * @param {'image_generate'|'image_edit'} builder
 * @param {{ ok: boolean, latencyMs: number, model?: string | null, errorCode?: string | null, usage?: object | null }} info
 */
export function logXaiImageUsage(builder, info) {
  const u = info.usage && typeof info.usage === 'object' ? info.usage : null;
  const pt = u?.prompt_tokens ?? u?.input_tokens ?? null;
  const ct = u?.completion_tokens ?? u?.output_tokens ?? null;
  const tt = u?.total_tokens ?? null;
  logAiUsage({
    builder,
    provider: 'xai',
    model: info.model ?? null,
    promptTokens: typeof pt === 'number' ? pt : null,
    completionTokens: typeof ct === 'number' ? ct : null,
    cachedPromptTokens: null,
    totalTokens: typeof tt === 'number' ? tt : null,
    ok: info.ok,
    errorCode: info.errorCode ?? null,
    latencyMs: info.latencyMs,
    requestId: null,
  });
}
