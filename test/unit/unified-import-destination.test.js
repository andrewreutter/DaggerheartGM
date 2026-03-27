import { describe, expect, it } from 'vitest';
import {
  resolveUnifiedImportDestination,
  shouldAddImportedRowToTable,
  shouldSaveItemForUnifiedImport,
} from '../../src/client/lib/unified-import-destination.js';

describe('unified-import-destination', () => {
  it('forces library-only when not on Game Table', () => {
    expect(resolveUnifiedImportDestination(false, 'both')).toEqual({
      dest: 'library',
      wantTable: false,
      wantLibrary: true,
    });
  });

  it('maps both / table / library to want flags on GM table', () => {
    expect(resolveUnifiedImportDestination(true, 'both')).toMatchObject({
      dest: 'both',
      wantTable: true,
      wantLibrary: true,
    });
    expect(resolveUnifiedImportDestination(true, 'table')).toMatchObject({
      dest: 'table',
      wantTable: true,
      wantLibrary: false,
    });
    expect(resolveUnifiedImportDestination(true, 'library')).toMatchObject({
      dest: 'library',
      wantTable: false,
      wantLibrary: true,
    });
  });

  it('skips save for adversary in table-only mode; still saves characters', () => {
    expect(shouldSaveItemForUnifiedImport('adversaries', 'table', false)).toBe(false);
    expect(shouldSaveItemForUnifiedImport('characters', 'table', false)).toBe(true);
  });

  it('adds to table only when GM wants table and collection is adversary/scene/env', () => {
    expect(shouldAddImportedRowToTable(true, 'adversaries', true)).toBe(true);
    expect(shouldAddImportedRowToTable(true, 'characters', true)).toBe(false);
    expect(shouldAddImportedRowToTable(false, 'adversaries', true)).toBe(false);
  });
});
