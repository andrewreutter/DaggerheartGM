#!/usr/bin/env node
/**
 * Mechanical checks for V2 features/tests that validation agents often repeat.
 * Does NOT replace phrase-by-phrase SRD review or full CONV reasoning — see
 * docs/agent-prompts/validation-agent.md ("What each layer covers").
 *
 * Exit 0 = no issues; exit 1 = violations printed to stderr.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const issues = [];

function walkJsFiles(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkJsFiles(p, out);
    else if (e.isFile() && e.name.endsWith('.js')) out.push(p);
  }
}

/** Feature modules: named exports only (CONV-004). Barrels and data excluded. */
const SKIP_DEFAULT_CHECK = new Set([
  'index.js',
  'registry.js',
  'srd-data.js',
  'marry.js',
]);

function isFeatureModulePath(rel) {
  if (rel.startsWith('engine' + '/') || rel === 'registry.js' || rel === 'index.js') {
    return false;
  }
  const base = rel.split('/').pop();
  if (SKIP_DEFAULT_CHECK.has(base)) return false;
  return rel.endsWith('.js');
}

function checkFeatureFiles() {
  const base = join(ROOT, 'src/features-v2');
  const files = [];
  walkJsFiles(base, files);

  for (const abs of files) {
    const rel = relative(join(ROOT, 'src/features-v2'), abs).replace(/\\/g, '/');
    if (!isFeatureModulePath(rel)) continue;

    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }

    if (/\bexport\s+default\b/.test(text)) {
      issues.push(`${rel}: CONV-004 — unexpected "export default" in a feature module (use named exports)`);
    }
  }
}

/** CONV-002 smell: direct raw element mutation */
function checkNoRawMutation() {
  const base = join(ROOT, 'src/features-v2');
  const files = [];
  walkJsFiles(base, files);

  for (const abs of files) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (/\._raw\b/.test(text) || /\btable\.me\._raw\b/.test(text)) {
      issues.push(`${rel}: CONV-002 — avoid mutating ._raw; use table.me / queued mutations`);
    }
  }
}

/** CONV-008 — tests must not use loose truthiness for mutation checks */
function checkV2Tests() {
  const base = join(ROOT, 'test/unit/features-v2');
  if (!existsSync(base)) return;

  const files = [];
  walkJsFiles(base, files);

  for (const abs of files) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (/\btoBeTruthy\s*\(/.test(text) || /\btoBeFalsy\s*\(/.test(text)) {
      issues.push(`${rel}: CONV-008 — use specific matchers instead of toBeTruthy/toBeFalsy for mutation checks`);
    }
  }
}

/** Legacy IoC: features-v2 must not import from src/features/ (non-v2) */
function checkNoLegacyFeaturesImport() {
  const base = join(ROOT, 'src/features-v2');
  const files = [];
  walkJsFiles(base, files);

  for (const abs of files) {
    const rel = relative(ROOT, abs).replace(/\\/g, '/');
    let text;
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/);
      if (!m) continue;
      const p = m[1];
      if (p.includes('features-v2')) continue;
      if (p.includes('/features/') || /^features\//.test(p)) {
        issues.push(`${rel}: do not import from legacy src/features/ — use features-v2 + engine APIs`);
        break;
      }
    }
  }
}

checkFeatureFiles();
checkNoRawMutation();
checkNoLegacyFeaturesImport();
checkV2Tests();

if (issues.length) {
  console.error('validate-v2-conventions-preflight: failed\n');
  for (const line of issues) console.error(`  • ${line}`);
  console.error(`\n${issues.length} issue(s).`);
  process.exit(1);
}

console.log('validate-v2-conventions-preflight: ok');
