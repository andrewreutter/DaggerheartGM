import { describe, it, expect } from 'vitest';
import {
  APP_BUILD_ID_FALLBACK,
  SPA_HTML_CACHE_CONTROL,
  sanitizeAppBuildId,
  resolveAppBuildId,
  applyAppBuildIdToSpaHtml,
} from '../../src/server/app-build-id.js';

describe('sanitizeAppBuildId', () => {
  it('returns the fallback for empty, null, or unsafe values', () => {
    expect(sanitizeAppBuildId('')).toBe(APP_BUILD_ID_FALLBACK);
    expect(sanitizeAppBuildId(null)).toBe(APP_BUILD_ID_FALLBACK);
    expect(sanitizeAppBuildId('abc def')).toBe(APP_BUILD_ID_FALLBACK);
    expect(sanitizeAppBuildId('../etc/passwd')).toBe(APP_BUILD_ID_FALLBACK);
  });

  it('keeps hex SHAs and dotted deployment ids, truncated to 64', () => {
    expect(sanitizeAppBuildId('abc123def')).toBe('abc123def');
    expect(sanitizeAppBuildId('a'.repeat(80))).toBe('a'.repeat(64));
    expect(sanitizeAppBuildId('rel.1-2_3')).toBe('rel.1-2_3');
  });
});

describe('resolveAppBuildId', () => {
  it('prefers RAILWAY_GIT_COMMIT_SHA over SOURCE_COMMIT and deployment id', () => {
    expect(resolveAppBuildId({
      RAILWAY_GIT_COMMIT_SHA: 'aaa111',
      SOURCE_COMMIT: 'bbb222',
      RAILWAY_DEPLOYMENT_ID: 'ccc333',
    })).toBe('aaa111');
  });

  it('falls back through SOURCE_COMMIT then RAILWAY_DEPLOYMENT_ID then dev', () => {
    expect(resolveAppBuildId({ SOURCE_COMMIT: 'bbb222' })).toBe('bbb222');
    expect(resolveAppBuildId({ RAILWAY_DEPLOYMENT_ID: 'ccc333' })).toBe('ccc333');
    expect(resolveAppBuildId({})).toBe(APP_BUILD_ID_FALLBACK);
  });
});

describe('applyAppBuildIdToSpaHtml', () => {
  it('stamps styles.css and app.js including an existing query string', () => {
    const html = [
      '<link rel="stylesheet" href="/styles.css" />',
      '<script type="module" src="/app.js?v=library-preview-3"></script>',
    ].join('\n');
    const out = applyAppBuildIdToSpaHtml(html, 'deadbeef');
    expect(out).toContain('href="/styles.css?v=deadbeef"');
    expect(out).toContain('src="/app.js?v=deadbeef"');
    expect(out).not.toContain('library-preview-3');
  });

  it('sanitizes a hostile build id before interpolating', () => {
    const html = '<script src="/app.js"></script>';
    expect(applyAppBuildIdToSpaHtml(html, '"></script><script>')).toContain(`src="/app.js?v=${APP_BUILD_ID_FALLBACK}"`);
  });
});

describe('SPA_HTML_CACHE_CONTROL', () => {
  it('asks browsers to revalidate the document', () => {
    expect(SPA_HTML_CACHE_CONTROL).toMatch(/no-cache/);
  });
});
