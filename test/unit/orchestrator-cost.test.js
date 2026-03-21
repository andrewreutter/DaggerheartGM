/**
 * Unit tests for scripts/orchestrator-cost.js (orchestrator Cloud Agent cost estimation).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseModelCostMapFromEnv,
  buildModelCostMap,
  extractApiCostUsd,
  estimateOrchestratorCost,
  sumSessionCostUsd,
  resetUnknownModelWarningsForTests,
  DEFAULT_MODEL_COST_USD,
} from '../../scripts/orchestrator-cost.js';

describe('parseModelCostMapFromEnv', () => {
  it('parses valid JSON object', () => {
    expect(parseModelCostMapFromEnv('{"a": 1, "b": 0.5}')).toEqual({ a: 1, b: 0.5 });
  });

  it('ignores invalid JSON', () => {
    expect(parseModelCostMapFromEnv('not json')).toEqual({});
  });

  it('ignores non-objects', () => {
    expect(parseModelCostMapFromEnv('[1,2]')).toEqual({});
  });
});

describe('buildModelCostMap', () => {
  it('merges env over defaults', () => {
    const m = buildModelCostMap({
      envJson: `{"${Object.keys(DEFAULT_MODEL_COST_USD)[0]}": 9.99}`,
    });
    expect(m[Object.keys(DEFAULT_MODEL_COST_USD)[0]]).toBe(9.99);
  });
});

describe('extractApiCostUsd', () => {
  it('reads top-level costUsd', () => {
    expect(extractApiCostUsd({ costUsd: 1.25 })).toBe(1.25);
  });

  it('reads billing.totalUsd', () => {
    expect(extractApiCostUsd({ billing: { totalUsd: 2 } })).toBe(2);
  });

  it('reads numeric strings', () => {
    expect(extractApiCostUsd({ costUsd: '3.5' })).toBe(3.5);
  });

  it('returns null when absent', () => {
    expect(extractApiCostUsd({ status: 'FINISHED' })).toBe(null);
  });
});

describe('estimateOrchestratorCost', () => {
  beforeEach(() => {
    resetUnknownModelWarningsForTests();
  });

  it('prefers API cost when present', () => {
    const r = estimateOrchestratorCost({
      entry: { mode: 'impl', model: 'any-model' },
      agentPayload: { costUsd: 0.88 },
      durationMs: 1000,
      implFixUnblockModel: 'claude-4.6-opus-high-thinking',
      valModel: 'claude-4.6-opus-high-thinking-fast',
      modelCostMap: { 'any-model': 0.1 },
    });
    expect(r.estimatedCostUsd).toBe(0.88);
    expect(r.costSource).toBe('api');
    expect(r.model).toBe('any-model');
  });

  it('uses env map when no API cost', () => {
    const r = estimateOrchestratorCost({
      entry: { mode: 'impl', model: 'claude-4.6-opus-high-thinking' },
      agentPayload: {},
      durationMs: 1000,
      implFixUnblockModel: 'claude-4.6-opus-high-thinking',
      valModel: 'claude-4.6-opus-high-thinking-fast',
      modelCostMap: buildModelCostMap({ envJson: '' }),
    });
    expect(r.costSource).toBe('env');
    expect(r.estimatedCostUsd).toBe(DEFAULT_MODEL_COST_USD['claude-4.6-opus-high-thinking']);
  });

  it('infers val model from mode when entry.model missing', () => {
    const r = estimateOrchestratorCost({
      entry: { mode: 'val' },
      agentPayload: {},
      durationMs: 1000,
      implFixUnblockModel: 'claude-4.6-opus-high-thinking',
      valModel: 'claude-4.6-opus-high-thinking-fast',
      modelCostMap: buildModelCostMap({ envJson: '' }),
    });
    expect(r.model).toBe('claude-4.6-opus-high-thinking-fast');
    expect(r.costSource).toBe('env');
  });

  it('returns unknown with $0 for unrecognized model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = estimateOrchestratorCost({
      entry: { mode: 'impl', model: 'unknown-model-xyz' },
      agentPayload: {},
      durationMs: 1000,
      implFixUnblockModel: 'claude-4.6-opus-high-thinking',
      valModel: 'claude-4.6-opus-high-thinking-fast',
      modelCostMap: {},
    });
    expect(r.estimatedCostUsd).toBe(0);
    expect(r.costSource).toBe('unknown');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('sumSessionCostUsd', () => {
  it('sums completion history', () => {
    const total = sumSessionCostUsd({
      completionHistory: [
        { estimatedCostUsd: 0.1 },
        { estimatedCostUsd: 0.2 },
      ],
    });
    expect(total).toBe(0.3);
  });

  it('handles empty history', () => {
    expect(sumSessionCostUsd({ completionHistory: [] })).toBe(0);
  });
});
