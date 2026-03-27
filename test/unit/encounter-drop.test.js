import { describe, it, expect } from 'vitest';
import { parseEncounterDropText } from '../../src/ocr-parse.js';

describe('parseEncounterDropText', () => {
  it('uses raw OCR text for notes', () => {
    const r = parseEncounterDropText('Line one\n\nLine two', 'note');
    expect(r.kind).toBe('note');
    expect(r.item.body).toContain('Line one');
    expect(r.item.name).toBe('Line one');
  });

  it('parses adversary regex fields from text', () => {
    const text = `
Goblin Raider
Tier 1 | Standard
HP 6 | Stress 3
Difficulty 12
Attack: Slash +3 | Melee | 1d6+1 phy
`;
    const r = parseEncounterDropText(text, 'adversary');
    expect(r.kind).toBe('adversary');
    expect(r.item.name).toBeTruthy();
    expect(r.item.hp_max).toBeGreaterThan(0);
  });

  it('parses environment from text', () => {
    const text = `
Haunted Grove
Tier 2 | Exploration
Impulses: fog rolls in
Potential Adversaries: Wolf
`;
    const r = parseEncounterDropText(text, 'environment');
    expect(r.kind).toBe('environment');
    expect(r.item.name).toBeTruthy();
    expect(r.item.type).toBeTruthy();
  });
});
