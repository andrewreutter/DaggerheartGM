import { describe, expect, it } from 'vitest';
import { getCollection } from '../../src/srd/parser.js';

describe('SRD extra collections', () => {
  it('loads campaign frames into structured records', async () => {
    const frames = await getCollection('campaign_frames');
    expect(Array.isArray(frames)).toBe(true);
    expect(frames.length).toBeGreaterThan(0);

    const witherwild = frames.find((item) => item.name === 'THE WITHERWILD');
    expect(witherwild).toBeTruthy();
    expect(witherwild.complexity).toBe(1);
    expect(witherwild.pitch).toContain('Fanewick');
    expect(witherwild.inciting_incident).toContain('Fanewraith');
    expect(witherwild.session_zero_questions).toContain('dangerous animal');
    expect(witherwild._source).toBe('srd');
  });

  it('loads rules chunks with breadcrumb and body text', async () => {
    const rules = await getCollection('rules');
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(100);

    const first = rules[0];
    expect(typeof first.id).toBe('string');
    expect(typeof first.name).toBe('string');
    expect(typeof first.breadcrumb).toBe('string');
    expect(Array.isArray(first.breadcrumb_titles)).toBe(true);
    expect(typeof first.body).toBe('string');
    expect(first._source).toBe('srd');
  });
});
