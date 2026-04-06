import { describe, expect, it } from 'vitest';
import { chooseAssistantCollections } from '../../src/library-ai.js';

describe('library AI collection routing', () => {
  it('routes rest questions to rules instead of broad fallback collections', () => {
    expect(chooseAssistantCollections("What's the difference between a short and a long rest?")).toEqual(['rules']);
  });

  it('routes campaign questions to campaign frames', () => {
    expect(chooseAssistantCollections('Which campaign frame is the most tech-oriented?')).toEqual(['campaign_frames']);
  });

  it('falls back to broad coverage when no heuristic matches', () => {
    expect(chooseAssistantCollections('Tell me about cool options')).toContain('rules');
    expect(chooseAssistantCollections('Tell me about cool options')).toContain('domains');
  });
});
