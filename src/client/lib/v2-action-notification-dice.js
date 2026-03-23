/**
 * Build server-shaped `subItems` from V2 engine `rollDie` mutation payloads for DiceRoller 3D animation.
 * Shapes mirror `rollFromText` / `appendDiceRoll` rows (pre, input, result, details, post).
 *
 * @param {Array<{ notation?: string, results?: number[], total?: number }>} payloads
 * @returns {Array<{ pre: string, input: string, result: string, details: string, post: string }>}
 */
export function buildSubItemsFromV2RollDiePayloads(payloads) {
  if (!Array.isArray(payloads) || payloads.length === 0) return [];
  const out = [];
  for (const p of payloads) {
    if (!p || typeof p !== 'object') continue;
    const notation = String(p.notation || 'd6').trim();
    const results = Array.isArray(p.results) ? p.results : [];
    const total =
      p.total != null ? Number(p.total) : results.length ? results.reduce((a, b) => a + b, 0) : NaN;
    if (Number.isNaN(total)) continue;

    const input = normalizeRollDieInput(notation, results.length);
    const details = formatRollDieDetails(results, total);
    out.push({
      pre: 'Die',
      input,
      result: String(total),
      details,
      post: '',
    });
  }
  return out;
}

/** Normalize `d6` / `1d6` / `2d6` style notation for parseDiceExpr. */
function normalizeRollDieInput(notation, dieCount) {
  const n = String(notation || 'd6').trim();
  if (/^\d*d\d+$/i.test(n)) return n;
  if (/^d\d+$/i.test(n)) return dieCount > 1 ? `${dieCount}${n}` : `1${n}`;
  return '1d6';
}

/** Parenthetical details string for parseSubDetails (single die: "(4)", multiple: "(3+4)" style). */
function formatRollDieDetails(results, total) {
  if (results.length === 0) return `(${total})`;
  if (results.length === 1) return `(${results[0]})`;
  return `(${results.join('+')})`;
}

/**
 * @param {{ _v2RollDiePayloads?: Array<{ notation?: string, results?: number[], total?: number }> }} actionLoopPayload
 * @returns {{ subItems?: object[], _v2AnimateDice?: true }}
 */
export function v2RollDieExtrasFromActionLoopPayload(actionLoopPayload) {
  const payloads = actionLoopPayload?._v2RollDiePayloads;
  if (!Array.isArray(payloads) || payloads.length === 0) return {};
  const subItems = buildSubItemsFromV2RollDiePayloads(payloads);
  if (subItems.length === 0) return {};
  return { subItems, _v2AnimateDice: true };
}
