import { describe, it, expect } from 'vitest';
import {
  isDedicatedProblemDatabase,
  isProblemDatabaseConfigured,
  listProblemDatabaseMigrationFiles,
  resolveProblemDatabaseUrl,
} from '../../src/problem-database-url.js';

describe('resolveProblemDatabaseUrl', () => {
  it('uses PROBLEM_DATABASE_URL when it is set', () => {
    expect(resolveProblemDatabaseUrl({
      PROBLEM_DATABASE_URL: 'postgres://problems',
      DATABASE_URL: 'postgres://main',
    })).toBe('postgres://problems');
  });

  it('falls back to DATABASE_URL when PROBLEM_DATABASE_URL is missing', () => {
    expect(resolveProblemDatabaseUrl({
      DATABASE_URL: 'postgres://main',
    })).toBe('postgres://main');
  });

  it('falls back to DATABASE_URL when PROBLEM_DATABASE_URL is blank', () => {
    expect(resolveProblemDatabaseUrl({
      PROBLEM_DATABASE_URL: '   ',
      DATABASE_URL: 'postgres://main',
    })).toBe('postgres://main');
  });

  it('returns null when neither URL is set', () => {
    expect(resolveProblemDatabaseUrl({})).toBe(null);
  });
});

describe('isProblemDatabaseConfigured', () => {
  it('is true when either URL is present', () => {
    expect(isProblemDatabaseConfigured({ PROBLEM_DATABASE_URL: 'postgres://problems' })).toBe(true);
    expect(isProblemDatabaseConfigured({ DATABASE_URL: 'postgres://main' })).toBe(true);
    expect(isProblemDatabaseConfigured({})).toBe(false);
  });
});

describe('isDedicatedProblemDatabase', () => {
  it('is true only when PROBLEM_DATABASE_URL is set and differs from DATABASE_URL', () => {
    expect(isDedicatedProblemDatabase({
      PROBLEM_DATABASE_URL: 'postgres://problems',
      DATABASE_URL: 'postgres://main',
    })).toBe(true);
    expect(isDedicatedProblemDatabase({
      PROBLEM_DATABASE_URL: 'postgres://same',
      DATABASE_URL: 'postgres://same',
    })).toBe(false);
    expect(isDedicatedProblemDatabase({
      DATABASE_URL: 'postgres://main',
    })).toBe(false);
    expect(isDedicatedProblemDatabase({
      PROBLEM_DATABASE_URL: 'postgres://problems',
    })).toBe(true);
  });
});

describe('listProblemDatabaseMigrationFiles', () => {
  it('keeps only bug_reports SQL files, sorted', () => {
    expect(listProblemDatabaseMigrationFiles([
      '035_bug_reports_status.sql',
      '033_bug_reports.sql',
      '001_init.sql',
      '034_bug_reports_resolved.sql',
      'readme.md',
    ])).toEqual([
      '033_bug_reports.sql',
      '034_bug_reports_resolved.sql',
      '035_bug_reports_status.sql',
    ]);
  });
});
