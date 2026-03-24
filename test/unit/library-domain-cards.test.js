import { describe, it, expect } from 'vitest';
import {
  normalizeKey,
  resolveAbilityForDomainOption,
  expandDomainCardEntries,
} from '../../src/client/lib/library-domain-cards.js';

describe('library-domain-cards', () => {
  const srdData = {
    abilities: [
      {
        id: 'srd-abl-fireball',
        name: 'Fireball',
        domain: 'Arcana',
        level: 3,
        type: 'Action',
        recall_cost: 2,
        description: 'Boom.',
      },
      {
        id: 'srd-abl-other',
        name: 'Other',
        domain: 'Blade',
        level: 1,
        type: 'Action',
        recall_cost: 0,
        description: 'X',
      },
    ],
    abilitiesById: {
      'srd-abl-fireball': {
        id: 'srd-abl-fireball',
        name: 'Fireball',
        domain: 'Arcana',
        level: 3,
        type: 'Action',
        recall_cost: 2,
        description: 'Boom.',
      },
    },
  };

  it('normalizeKey trims and lowercases', () => {
    expect(normalizeKey('  Arcana ')).toBe('arcana');
  });

  it('resolveAbilityForDomainOption matches string name + domain', () => {
    expect(resolveAbilityForDomainOption('Fireball', 'Arcana', srdData)?.id).toBe('srd-abl-fireball');
    expect(resolveAbilityForDomainOption('fireball', 'arcana', srdData)?.id).toBe('srd-abl-fireball');
    expect(resolveAbilityForDomainOption('Nope', 'Arcana', srdData)).toBeNull();
  });

  it('resolveAbilityForDomainOption resolves by id object', () => {
    expect(resolveAbilityForDomainOption({ id: 'srd-abl-fireball' }, 'Arcana', srdData)?.name).toBe('Fireball');
  });

  it('expandDomainCardEntries maps options to abilities or raw fallback', () => {
    const domainItem = {
      name: 'Arcana',
      cards: [
        { level: 1, options: ['Nope'] },
        { level: 3, options: ['Fireball', { id: 'srd-abl-fireball' }] },
      ],
    };
    const { sections } = expandDomainCardEntries(domainItem, srdData);
    expect(sections).toHaveLength(2);
    expect(sections[0].entries[0]).toEqual({ raw: 'Nope' });
    expect(sections[1].entries[0].ability?.id).toBe('srd-abl-fireball');
    expect(sections[1].entries[1].ability?.id).toBe('srd-abl-fireball');
  });
});
