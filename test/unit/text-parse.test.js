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
  it('parses Adept Necromancer (stack-card: FEATURES, attack, experience, motives, HP track, no HP bleed into last feature)', () => {
    const { item } = parseStatBlock(ADEPT_NECROMANCER_TEXT, 'adversaries');
    expect(item.name).toBe('Adept Necromancer');
    expect(item.difficulty).toBe(14);
    expect(item.hp_max).toBe(7);
    expect(item.stress_max).toBe(4);
    expect(item.hp_thresholds).toEqual({ major: 8, severe: 14 });
    expect(item.motive).toContain('Corrupt');
    expect(item.motive).toContain('Resurrect');
    expect(item.attack).toMatchObject({
      name: 'Necrotic Blast',
      modifier: 3,
      range: 'Far',
      damage: '2d6',
      trait: 'Mag',
    });
    expect(item.experiences).toHaveLength(1);
    expect(item.experiences[0]).toMatchObject({ name: 'Forbidden Knowledge', modifier: 2 });
    expect(item.features).toHaveLength(4);
    expect(item.features.map((f) => [f.name, f.type])).toEqual([
      ['Dance of Death', 'action'],
      ['Beam of Decay', 'action'],
      ['Open the Gates of Death', 'action'],
      ['Your Life Is Mine', 'reaction'],
    ]);
    expect(item.features[0].description).toMatch(/Spend 2 Fear/);
    expect(item.features[1].description).toMatch(/Strength Reaction Roll/);
    expect(item.features[3].description).toMatch(/Countdown \(Loop 1d4\)/);
    expect(item.features[3].description).toMatch(/from this attack\./);
    expect(item.features[3].description).not.toMatch(/HP\s*&\s*STRESS/i);
    expect(item.features[3].description).not.toMatch(/\bMAJOR\b/);
  });

  /** Full stat block: tier line, piped difficulty row, ATK pipe row, multi-experience, Features with en dash. */
  const BASE_CAMP_WARDEN_TEXT = `Base Camp Warden
Tier 2 Social
A grizzled outdoorsman who oversees entry to Mount Fang
Motives & Tactics: Protect the mountain, Prevent civilian death, Prepare climbers
Difficulty: 14 | Thresholds: 8 / 16 | HP: 4 | Stress: 4
ATK: 0 | Shortbow: Far | 1d4+3 Physical
Experience: Dutiful warden +3, Mountaineer +2, Diplomatic +2
HP:
Stress:
Features

Don't go unprepared \u2013 Action: If the Base Camp Warden believes the party is unprepared for the climb he can recommend they come back properly equipped. Players should make an instinct check against his difficulty. On a failure they think they're probably prepared. On a success they will get a hint from the GM about proper preparations and will also gain 1 hope.

No, seriously, you will die \u2013 Action: If the warden uses Don't go unprepared and the party disregards his advice you may spend one fear to activate No, seriously, you will die. When this happens, each player marks a stress and then the Warden calls Reinforcements - use the Imperial Scout stat block for summoned reinforcements.

Reinforcements \u2013 Action: Once per scene, mark a Stress to summon 2d4 additional adversaries, which appear at Far range.`;

  it('parses Base Camp Warden (piped stats, ATK row, multi-experience, en-dash features)', () => {
    const { item } = parseStatBlock(BASE_CAMP_WARDEN_TEXT, 'adversaries');
    expect(item.name).toBe('Base Camp Warden');
    expect(item.tier).toBe(2);
    expect(item.role).toBe('social');
    expect(item.difficulty).toBe(14);
    expect(item.hp_max).toBe(4);
    expect(item.stress_max).toBe(4);
    expect(item.hp_thresholds).toEqual({ major: 8, severe: 16 });
    expect(item.motive).toContain('Protect the mountain');
    expect(item.description).toMatch(/grizzled outdoorsman.*Mount Fang/);
    expect(item.attack).toMatchObject({
      name: 'Shortbow',
      range: 'Far',
      modifier: 0,
      damage: '1d4+3',
      trait: 'Phy',
    });
    expect(item.experiences).toHaveLength(3);
    expect(item.experiences.map((e) => [e.name, e.modifier])).toEqual([
      ['Dutiful warden', 3],
      ['Mountaineer', 2],
      ['Diplomatic', 2],
    ]);
    expect(item.features).toHaveLength(3);
    expect(item.features.map((f) => f.name)).toEqual([
      "Don't go unprepared",
      'No, seriously, you will die',
      'Reinforcements',
    ]);
    expect(item.features.every((f) => f.type === 'action')).toBe(true);
    expect(item.features[0].description).toMatch(/instinct check against his difficulty/);
    expect(item.features[0].description).toMatch(/gain 1 hope/);
    expect(item.features[1].description).toMatch(/Imperial Scout/);
    expect(item.features[2].description).toMatch(/2d4 additional adversaries/);
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

  /** Full OCR-style reference card + duplicate instance rows (letter O as checkboxes). */
  const THISTLEFOLK_AMBUSHER_TEXT = `Thistlefolk Ambusher (Reference)

Dagger - Melee - 2d8+1 (phy) Minor 1 | Major 6 | Severe 10
Attack Modifier: +1 HP: 3

Difficulty: 13 Stress: 2

FEATURES

Ambush - Reaction: When the ambusher enters the scene without being
spotted first, they may immediately move into melee with a target and
make an attack against them. On a success, they strike with their dagger
for 2d8+4 (phy) damage.

"They come out of nowhere, striking with a practiced confidence."
Thistlefolk Ambusher #1

HP:O O O Stress: O O

Thistlefolk Ambusher #2

HP:O O O Stress: O O

Thistlefolk Ambusher #3

HP:O O O Stress: O O`;

  it('parses reference-card title line, dash attack row, (phy) damage, thresholds, and drops OCR circle junk', () => {
    const { item } = parseStatBlock(THISTLEFOLK_AMBUSHER_TEXT, 'adversaries');
    expect(item.name).toBe('Thistlefolk Ambusher (Reference)');
    expect(item.attack).toMatchObject({
      name: 'Dagger',
      range: 'Melee',
      damage: '2d8+1',
      trait: 'Phy',
      modifier: 1,
    });
    expect(item.hp_max).toBe(3);
    expect(item.stress_max).toBe(2);
    expect(item.difficulty).toBe(13);
    expect(item.hp_thresholds).toEqual({ major: 6, severe: 10 });
    expect(item.features).toHaveLength(1);
    expect(item.features[0].name).toBe('Ambush');
    expect(item.features[0].type).toBe('reaction');
    expect(item.features[0].description).toContain('2d8+4');
    expect(item.features[0].description).toContain('They come out of nowhere');
    expect(item.features[0].description).not.toMatch(/HP:\s*[Oo]/);
    expect(item.features[0].description).not.toContain('Thistlefolk Ambusher #');
  });

  it('derives HP and Stress from OCR circle lines when no numeric HP/Stress is present', () => {
    const block = `Shade Creeper
Rusty Blade - Melee - 1d6+1 (mag)
Difficulty: 11
Attack Modifier: +0

HP:O O O O
Stress:O O`;
    const { item } = parseStatBlock(block, 'adversaries');
    expect(item.name).toBe('Shade Creeper');
    expect(item.hp_max).toBe(4);
    expect(item.stress_max).toBe(2);
    expect(item.attack.damage).toBe('1d6+1');
    expect(item.attack.trait).toBe('Mag');
  });
});
