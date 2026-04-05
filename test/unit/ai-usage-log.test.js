import { describe, it, expect } from 'vitest';
import { buildOpenAiChatUsageEvent, AI_USAGE_BUILDERS } from '../../src/ai-usage-log.js';

describe('buildOpenAiChatUsageEvent', () => {
  it('maps OpenAI usage and cached prompt tokens', () => {
    const json = {
      id: 'chatcmpl-1',
      model: 'gpt-4o-mini',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 40 },
      },
    };
    const row = buildOpenAiChatUsageEvent('character_concept', json, { latencyMs: 1234, ok: true });
    expect(row).toMatchObject({
      builder: 'character_concept',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cachedPromptTokens: 40,
      ok: true,
      errorCode: null,
      latencyMs: 1234,
      requestId: 'chatcmpl-1',
    });
  });

  it('records HTTP-style failures with explicit error code', () => {
    const row = buildOpenAiChatUsageEvent('encounter_plan', { error: { message: 'bad' } }, {
      ok: false,
      errorCode: 'http_429',
      model: 'gpt-4o-mini',
      latencyMs: 99,
    });
    expect(row.ok).toBe(false);
    expect(row.errorCode).toBe('http_429');
    expect(row.promptTokens).toBeNull();
  });
});

describe('AI_USAGE_BUILDERS', () => {
  it('lists known builder labels', () => {
    expect(AI_USAGE_BUILDERS).toContain('character_concept');
    expect(AI_USAGE_BUILDERS).toContain('image_generate');
  });
});
