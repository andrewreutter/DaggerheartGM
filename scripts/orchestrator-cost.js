/**
 * Cursor Cloud Agents cost estimation for scripts/orchestrate.js.
 *
 * Prefers API-reported USD when present on GET /v0/agents/:id JSON; otherwise
 * uses ORCHESTRATOR_MODEL_COST_USD_JSON merged with built-in defaults for the
 * stock CLI model names. Update defaults from your Cursor dashboard usage.
 */

/** Built-in fallbacks for default --model / --val-model CLI strings (USD per completed agent). */
export const DEFAULT_MODEL_COST_USD = Object.freeze({
  'claude-4.6-opus-high-thinking': 0.42,
  'claude-4.6-opus-high-thinking-fast': 0.15,
});

const warnedUnknownModels = new Set();

/**
 * @param {string | undefined} json - ORCHESTRATOR_MODEL_COST_USD_JSON
 * @returns {Record<string, number>}
 */
export function parseModelCostMapFromEnv(json) {
  if (!json || typeof json !== 'string' || !json.trim()) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = typeof v === 'number' ? v : parseFloat(v);
      if (typeof k === 'string' && k && Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * @param {{ envJson?: string }} [opts]
 * @returns {Record<string, number>}
 */
export function buildModelCostMap(opts = {}) {
  const fromEnv = parseModelCostMapFromEnv(opts.envJson ?? process.env.ORCHESTRATOR_MODEL_COST_USD_JSON);
  return { ...DEFAULT_MODEL_COST_USD, ...fromEnv };
}

/**
 * @param {{ model?: string, mode?: string }} entry
 * @param {string} implFixUnblockModel - --model default
 * @param {string} valModel - --val-model default
 */
export function inferModelForEntry(entry, implFixUnblockModel, valModel) {
  if (entry?.model && String(entry.model).trim()) return String(entry.model).trim();
  if (entry?.mode === 'val') return valModel;
  return implFixUnblockModel;
}

/**
 * Best-effort extraction of billed USD from Cursor agent JSON (shape may change).
 * @param {object | null | undefined} agent
 * @returns {number | null}
 */
export function extractApiCostUsd(agent) {
  if (!agent || typeof agent !== 'object') return null;

  const pick = (v) => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  };

  const direct = [
    agent.costUsd,
    agent.totalCostUsd,
    agent.cost_usd,
    agent.estimatedCostUsd,
    agent.usageCostUsd,
    agent.billedUsd,
  ];
  for (const n of direct) {
    const x = pick(n);
    if (x !== null) return x;
  }

  const billing = agent.billing;
  if (billing && typeof billing === 'object') {
    const b = [billing.totalUsd, billing.amountUsd, billing.costUsd, billing.usd];
    for (const n of b) {
      const x = pick(n);
      if (x !== null) return x;
    }
  }

  const usage = agent.usage;
  if (usage && typeof usage === 'object') {
    const u = [usage.totalCostUsd, usage.costUsd, usage.cost_usd];
    for (const n of u) {
      const x = pick(n);
      if (x !== null) return x;
    }
  }

  return null;
}

/**
 * @param {{
 *   entry: { model?: string, mode?: string },
 *   agentPayload: object | null | undefined,
 *   durationMs?: number,
 *   implFixUnblockModel: string,
 *   valModel: string,
 *   modelCostMap?: Record<string, number>,
 * }} args
 * @returns {{ estimatedCostUsd: number, costSource: 'api' | 'env' | 'unknown', model: string }}
 */
export function estimateOrchestratorCost(args) {
  const {
    entry,
    agentPayload,
    implFixUnblockModel,
    valModel,
    modelCostMap = buildModelCostMap(),
  } = args;

  const model = inferModelForEntry(entry, implFixUnblockModel, valModel);

  const apiUsd = extractApiCostUsd(agentPayload);
  if (apiUsd !== null) {
    return { estimatedCostUsd: apiUsd, costSource: 'api', model };
  }

  if (Object.prototype.hasOwnProperty.call(modelCostMap, model)) {
    const v = modelCostMap[model];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      return { estimatedCostUsd: v, costSource: 'env', model };
    }
  }

  if (!warnedUnknownModels.has(model)) {
    warnedUnknownModels.add(model);
    console.warn(
      `[orchestrator] No API cost and no ORCHESTRATOR_MODEL_COST_USD_JSON entry for model "${model}" — ` +
        `using $0.00 (set ORCHESTRATOR_MODEL_COST_USD_JSON or add to defaults).`
    );
  }

  return { estimatedCostUsd: 0, costSource: 'unknown', model };
}

export function sumSessionCostUsd(state) {
  const hist = state?.completionHistory;
  if (!Array.isArray(hist) || hist.length === 0) return 0;
  let sum = 0;
  for (const h of hist) {
    const n = h?.estimatedCostUsd;
    if (typeof n === 'number' && Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 10000) / 10000;
}

/** Test helper: clear unknown-model warnings between tests. */
export function resetUnknownModelWarningsForTests() {
  warnedUnknownModels.clear();
}
