import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveOpenAiPricing,
  estimateOpenAiUsageCostUsd,
  parseOpenAiPricingOverridesFromEnv,
  buildOpenAiPricingMap,
} from '../../src/ai-usage-pricing.js';

describe('resolveOpenAiPricing', () => {
  it('resolves exact model id', () => {
    const p = resolveOpenAiPricing('gpt-4o-mini');
    expect(p?.inputPerM).toBe(0.15);
    expect(p?.cachedInputPerM).toBe(0.075);
    expect(p?.outputPerM).toBe(0.6);
  });

  it('matches longest prefix for dated snapshots', () => {
    const p = resolveOpenAiPricing('gpt-4o-mini-2024-07-18');
    expect(p?.inputPerM).toBe(0.15);
  });

  it('returns null for unknown model', () => {
    expect(resolveOpenAiPricing('not-a-real-model-xyz')).toBeNull();
  });
});

describe('estimateOpenAiUsageCostUsd', () => {
  it('computes gpt-4o-mini cost with cached split', () => {
    // 100 prompt, 40 cached => 60 uncached input; 50 completion
    const { usd } = estimateOpenAiUsageCostUsd({
      model: 'gpt-4o-mini',
      prompt_tokens: 100,
      cached_prompt_tokens: 40,
      completion_tokens: 50,
    });
    const expected =
      (60 / 1e6) * 0.15 + (40 / 1e6) * 0.075 + (50 / 1e6) * 0.6;
    expect(usd).toBeCloseTo(expected, 10);
  });

  it('returns null for unknown model', () => {
    const { usd, reason } = estimateOpenAiUsageCostUsd({
      model: 'unknown-model-zz',
      prompt_tokens: 100,
      completion_tokens: 10,
    });
    expect(usd).toBeNull();
    expect(reason).toBe('unknown_model');
  });

  it('returns null when model missing', () => {
    const { usd, reason } = estimateOpenAiUsageCostUsd({
      prompt_tokens: 10,
      completion_tokens: 1,
    });
    expect(usd).toBeNull();
    expect(reason).toBe('no_model');
  });

  it('merges AI_USAGE_OPENAI_PRICING_JSON overrides', () => {
    vi.stubEnv(
      'AI_USAGE_OPENAI_PRICING_JSON',
      JSON.stringify({
        'custom-model': { inputPerM: 1, cachedInputPerM: 0.5, outputPerM: 2 },
      })
    );
    const map = buildOpenAiPricingMap();
    const { usd } = estimateOpenAiUsageCostUsd(
      { model: 'custom-model', prompt_tokens: 1_000_000, completion_tokens: 0 },
      { pricingMap: map }
    );
    expect(usd).toBeCloseTo(1, 6);
    vi.unstubAllEnvs();
  });
});

describe('parseOpenAiPricingOverridesFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses valid JSON', () => {
    const m = parseOpenAiPricingOverridesFromEnv(
      JSON.stringify({ 'my-model': { inputPerM: 2, cachedInputPerM: null, outputPerM: 3 } })
    );
    expect(m['my-model']?.inputPerM).toBe(2);
    expect(m['my-model']?.outputPerM).toBe(3);
  });

  it('returns empty on invalid JSON', () => {
    expect(parseOpenAiPricingOverridesFromEnv('not json')).toEqual({});
  });
});
