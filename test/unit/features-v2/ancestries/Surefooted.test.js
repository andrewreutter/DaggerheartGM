import { describe, it, expect } from 'vitest';
import { Surefooted } from '../../../../src/features-v2/ancestries/Goblin.js';
import { runIntent, mockRoll } from '../helpers.js';

describe('Surefooted', () => {
  it('has a name and description', () => {
    expect(Surefooted.name).toBe('Surefooted');
    expect(typeof Surefooted.description).toBe('string');
    expect(Surefooted.description.length).toBeGreaterThan(0);
  });

  it('has an onIntent hook', () => {
    expect(typeof Surefooted.hooks).toBe('object');
    expect(Surefooted.hooks.onIntent).toBeDefined();
  });

  it('queues removeDisadvantageDie mutation on an Agility roll', () => {
    const result = runIntent(Surefooted, {
      rolls: mockRoll({ actionDice: [{ name: 'Stumble', die: 'd6', _disadvantage: true }] }),
    });

    expect(result.mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeDisadvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Stumble' }),
      })
    );
  });

  it('removes all disadvantage dice', () => {
    const result = runIntent(Surefooted, {
      rolls: mockRoll({
        actionDice: [
          { name: 'Stumble', die: 'd6', _disadvantage: true },
          { name: 'Dark', die: 'd6', _disadvantage: true },
        ],
      }),
    });

    const removeOps = result.mutations.filter((m) => m.type === 'removeDisadvantageDie');
    expect(removeOps).toHaveLength(2);
    expect(removeOps.map(m => m.payload.name)).toContain('Stumble');
    expect(removeOps.map(m => m.payload.name)).toContain('Dark');
  });

  it('does not remove advantage dice', () => {
    const result = runIntent(Surefooted, {
      rolls: mockRoll({
        actionDice: [
          { name: 'Edge', die: 'd6', _advantage: true },
          { name: 'Stumble', die: 'd6', _disadvantage: true },
        ],
      }),
    });

    const removeOps = result.mutations.filter((m) => m.type === 'removeDisadvantageDie');
    expect(removeOps).toHaveLength(1);
  });

  it('does nothing when there are no disadvantage dice', () => {
    const result = runIntent(Surefooted, {
      rolls: mockRoll({ actionDice: [] }),
    });

    expect(result.mutations.filter((m) => m.type === 'removeDisadvantageDie')).toHaveLength(0);
  });

  it('does not remove disadvantage dice on a non-Agility roll', () => {
    const result = runIntent(Surefooted, {
      rolls: mockRoll({ actionDice: [{ name: 'Stumble', die: 'd6', _disadvantage: true }] }),
      action: { traitKey: 'Strength' },
    });

    expect(result.mutations.filter((m) => m.type === 'removeDisadvantageDie')).toHaveLength(0);
  });

  it('does not remove disadvantage dice when there is no action', () => {
    const result = runIntent(Surefooted, {
      rolls: mockRoll({ actionDice: [{ name: 'Stumble', die: 'd6', _disadvantage: true }] }),
      action: { traitKey: undefined },
    });

    expect(result.mutations.filter((m) => m.type === 'removeDisadvantageDie')).toHaveLength(0);
  });
});
