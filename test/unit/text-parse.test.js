import { describe, it, expect } from 'vitest';
import { parseStatBlock } from '../../src/text-parse.js';

/** Stack-card style: labels on their own lines; features use "Name - Type" without a colon. */
const ADEPT_NECROMANCER_TEXT = `ADEPT NECROMANCER
Difficulty: 14
Attack: +3
Necrotic Blast: Far | 2d6 mag
Experience:
Forbidden Knowledge +2
Motives & Tactics:
Corrupt, Decay, Resurrect
FEATURES
Dance of Death - Action 
Spend 2 Fear to spotlight up to five allies. Attacks they make while spotlighted in this way deal half damage.
Beam of Decay - Action 
Mark a Stress to cause all targets within Far range to make a Strength Reaction Roll. Targets who fail take 1d8+2 magic damage and you gain a Fear. A target who marks 2 or more HP must also mark a Stress and becomes Vulnerable until they roll with Hope.
Open the Gates of Death - Action 
Spend a Fear to summon a Zombie Pack, which appears at Close range and immediately takes the spotlight.
Your Life Is Mine - Reaction 
Countdown (Loop 1d4). When the Necromancer has marked 4 or more of their HP, activate the countdown. When it triggers, deal 1d6+2 direct magic damage to a target within Close range. The Necromancer then clears a number of Stress or HP equal to the number of HP marked by the target from this attack.
HP & STRESS
MINOR
1 HP
8
MAJOR
2 HP
14
SEVERE
3 HP
HP:
7
STRESS:
4`;

describe('parseStatBlock (adversaries)', () => {
  it('parses FEATURES when Action/Reaction has no trailing colon (stack-card layout)', () => {
    const { item } = parseStatBlock(ADEPT_NECROMANCER_TEXT, 'adversaries');
    expect(item.features).toHaveLength(4);
    expect(item.features.map((f) => f.name)).toEqual([
      'Dance of Death',
      'Beam of Decay',
      'Open the Gates of Death',
      'Your Life Is Mine',
    ]);
    expect(item.features[0].type).toBe('action');
    expect(item.features[3].type).toBe('reaction');
    expect(item.features[0].description).toMatch(/Spend 2 Fear/);
    expect(item.features[1].description).toMatch(/Strength Reaction Roll/);
    expect(item.features[3].description).toMatch(/Countdown/);
  });

  it('parses Experience and Motives & Tactics with line breaks after labels', () => {
    const { item } = parseStatBlock(ADEPT_NECROMANCER_TEXT, 'adversaries');
    expect(item.experiences).toHaveLength(1);
    expect(item.experiences[0].name).toBe('Forbidden Knowledge');
    expect(item.experiences[0].modifier).toBe(2);
    expect(item.motive).toContain('Corrupt');
    expect(item.motive).toContain('Resurrect');
  });

  it('parses HP thresholds when values appear on the line before MAJOR / SEVERE labels', () => {
    const { item } = parseStatBlock(ADEPT_NECROMANCER_TEXT, 'adversaries');
    expect(item.hp_thresholds).toEqual({ major: 8, severe: 14 });
  });

  it('parses attack name on the line after "Attack: +N" (stack-card layout)', () => {
    const { item } = parseStatBlock(ADEPT_NECROMANCER_TEXT, 'adversaries');
    expect(item.attack).toMatchObject({
      name: 'Necrotic Blast',
      modifier: 3,
      range: 'Far',
      damage: '2d6',
      trait: 'Mag',
    });
  });

  it('parses Features with en dash (U+2013) and blank lines between entries', () => {
    const block = `Base Camp Warden
Tier 2 Social
A grizzled outdoorsman
Motives & Tactics: Protect
Difficulty: 14 | Thresholds: 8 / 16 | HP: 4 | Stress: 4
ATK: 0 | Shortbow: Far | 1d4+3 Physical
Experience: Dutiful warden +3
HP:
Stress:
Features

Don't go unprepared \u2013 Action: If the warden warns the party, roll.

No, seriously, you will die \u2013 Action: Spend one fear to activate this.

Reinforcements \u2013 Action: Once per scene, mark a Stress.`;
    const { item } = parseStatBlock(block, 'adversaries');
    expect(item.name).toBe('Base Camp Warden');
    expect(item.features).toHaveLength(3);
    expect(item.features.map((f) => f.name)).toEqual([
      "Don't go unprepared",
      'No, seriously, you will die',
      'Reinforcements',
    ]);
    expect(item.features.every((f) => f.type === 'action')).toBe(true);
  });

  it('parses attack when ATTACK is a header line and name starts the next line', () => {
    const block = `WRAITH
Difficulty: 12
Attack: +2
ATTACK
Withering Touch: Melee | 1d8+1 mag
HP:
5`;
    const { item } = parseStatBlock(block, 'adversaries');
    expect(item.attack).toMatchObject({
      name: 'Withering Touch',
      modifier: 2,
      range: 'Melee',
      damage: '1d8+1',
      trait: 'Mag',
    });
  });
});
