/**
 * OCR + parse fixture test runner.
 *
 * Finds all *.png / *.jpg files under test/fixtures/{adversaries,environments}/,
 * runs each through every registered OCR engine independently, parses the OCR
 * text via parseStatBlock, and diffs the result against the matching
 * .expected.json file.
 *
 * Prints a per-engine scorecard showing which fields were correctly extracted.
 *
 * Usage:
 *   node test/parse-fixtures.js [--engine tesseract] [--engine easyocr]
 *
 * If no --engine flags are given, all available engines are used.
 * If EasyOCR is not installed, it is automatically skipped.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');
const COLLECTIONS = ['adversaries', 'environments'];
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ---------------------------------------------------------------------------
// CLI: optional --engine filter
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const engineFilter = new Set();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--engine' && args[i + 1]) {
    engineFilter.add(args[i + 1]);
    i++;
  }
}

// ---------------------------------------------------------------------------
// Load engines directly (bypass ocrBuffer orchestration so each engine is
// scored independently)
// ---------------------------------------------------------------------------
async function loadEngines() {
  const mods = await Promise.all([
    import('../src/ocr-engines/tesseract.js'),
    import('../src/ocr-engines/easyocr.js'),
  ]);

  return mods.filter(e => {
    if (engineFilter.size > 0 && !engineFilter.has(e.name)) return false;
    if (!e.isAvailable()) {
      console.log(`  [skip] Engine "${e.name}" not available.`);
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Fixture discovery
// ---------------------------------------------------------------------------
function findFixtures() {
  const fixtures = [];
  for (const collection of COLLECTIONS) {
    const dir = join(FIXTURES_DIR, collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!IMAGE_EXTS.has(extname(file).toLowerCase())) continue;
      const stem = basename(file, extname(file));
      const expectedPath = join(dir, `${stem}.expected.json`);
      if (!existsSync(expectedPath)) {
        console.warn(`  [warn] No expected.json for ${file} — skipping.`);
        continue;
      }
      fixtures.push({
        imagePath: join(dir, file),
        expectedPath,
        collection,
        name: stem,
      });
    }
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Field comparison helpers
// ---------------------------------------------------------------------------

/**
 * Extract the comparable fields from a parse result for a given expected spec.
 * Returns { matched: number, total: number, details: [{field, expected, got, ok}] }
 */
function compareFields(item, expected, collection) {
  const results = [];

  // Fields to check — skip _comment and collection (metadata)
  const SKIP = new Set(['_comment', 'collection']);

  for (const [field, expectedVal] of Object.entries(expected)) {
    if (SKIP.has(field)) continue;

    const got = item[field];
    let ok = false;
    let detail = { field, expected: expectedVal, got };

    if (field === 'features') {
      // Check each feature name + type
      const expFeatures = expectedVal;
      const gotFeatures = Array.isArray(got) ? got : [];
      const matchCount = expFeatures.filter(ef =>
        gotFeatures.some(gf =>
          gf.name?.toLowerCase() === ef.name?.toLowerCase() &&
          gf.type?.toLowerCase() === ef.type?.toLowerCase()
        )
      ).length;
      ok = matchCount === expFeatures.length;
      detail.expected = `${expFeatures.length} features`;
      detail.got = `${gotFeatures.length} features (${matchCount}/${expFeatures.length} matched)`;

    } else if (field === 'potential_adversaries') {
      const expNames = (expectedVal || []).map(a => a.name.toLowerCase());
      const gotNames = (Array.isArray(got) ? got : []).map(a => (a.name || '').toLowerCase());
      ok = expNames.every(n => gotNames.some(g => g.includes(n) || n.includes(g)));
      detail.expected = expNames.join(', ');
      detail.got = gotNames.join(', ');

    } else if (field === 'name') {
      // Name is often not OCR-extractable (display font); don't fail on it, just report
      ok = typeof got === 'string' && got.toLowerCase().includes(expectedVal.toLowerCase().split(' ')[0]);
      detail.note = '(title font often unreadable via OCR — informational only)';

    } else if (field === 'description' || field === 'impulses') {
      // Fuzzy match: check that at least the first meaningful phrase is present
      const needle = expectedVal.replace(/\.\.\..*$/, '').trim().toLowerCase().slice(0, 20);
      ok = typeof got === 'string' && got.toLowerCase().includes(needle);
      detail.expected = expectedVal.slice(0, 50) + (expectedVal.length > 50 ? '...' : '');
      detail.got = (got || '').slice(0, 50) + ((got || '').length > 50 ? '...' : '');

    } else if (typeof expectedVal === 'number') {
      ok = got === expectedVal;

    } else if (typeof expectedVal === 'string') {
      ok = (got || '').toLowerCase() === expectedVal.toLowerCase();

    } else {
      ok = JSON.stringify(got) === JSON.stringify(expectedVal);
    }

    results.push({ ...detail, ok });
  }

  const matched = results.filter(r => r.ok).length;
  return { matched, total: results.length, details: results };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n=== DaggerheartGM OCR Fixture Tests ===\n');

  const [engines, fixtures] = await Promise.all([
    loadEngines(),
    Promise.resolve(findFixtures()),
  ]);

  if (engines.length === 0) {
    console.error('No engines available to test.');
    process.exit(1);
  }
  if (fixtures.length === 0) {
    console.error(`No fixtures found under ${FIXTURES_DIR}.`);
    process.exit(1);
  }

  console.log(`Engines: ${engines.map(e => e.name).join(', ')}`);
  console.log(`Fixtures: ${fixtures.length}\n`);

  // Results accumulator: engineName -> { totalMatched, totalFields, fixtureResults[] }
  const summary = {};
  for (const engine of engines) {
    summary[engine.name] = { totalMatched: 0, totalFields: 0, fixtures: [] };
  }

  // Run all fixtures through all engines
  for (const fixture of fixtures) {
    console.log(`── ${fixture.collection}/${fixture.name}`);

    const buf = readFileSync(fixture.imagePath);
    const expected = JSON.parse(readFileSync(fixture.expectedPath, 'utf8'));
    const collection = expected.collection || fixture.collection;

    for (const engine of engines) {
      process.stdout.write(`   [${engine.name}] recognizing... `);
      const startMs = Date.now();

      let engineResult;
      try {
        engineResult = await engine.recognize(buf);
      } catch (err) {
        console.log(`FAILED (${err.message})`);
        summary[engine.name].fixtures.push({ name: fixture.name, error: err.message });
        continue;
      }

      const elapsed = Date.now() - startMs;
      process.stdout.write(`${elapsed}ms `);

      // Import parseStatBlock here to avoid circular-ish issues at module load time
      const { parseStatBlock } = await import('../src/text-parse.js');
      const parseResult = parseStatBlock(engineResult.text, collection);

      const { matched, total, details } = compareFields(parseResult.item, expected, collection);
      const score = `${matched}/${total}`;
      const pct = total > 0 ? Math.round(matched / total * 100) : 0;

      console.log(`→ ${score} fields (${pct}%) | parse confidence: ${parseResult.confidence.toFixed(2)}`);

      // Print field details
      for (const d of details) {
        const icon = d.ok ? '✓' : '✗';
        if (!d.ok) {
          console.log(`      ${icon} ${d.field}: expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.got)}${d.note ? ' ' + d.note : ''}`);
        } else {
          console.log(`      ${icon} ${d.field}${d.note ? ' ' + d.note : ''}`);
        }
      }

      summary[engine.name].totalMatched += matched;
      summary[engine.name].totalFields += total;
      summary[engine.name].fixtures.push({ name: fixture.name, matched, total, confidence: parseResult.confidence });
    }

    // If multiple engines ran, also show the merged production result via ocrBuffer
    if (engines.length > 1) {
      process.stdout.write(`   [merged] production ocrBuffer... `);
      const { ocrBuffer } = await import('../src/ocr-parse.js');
      const startMs = Date.now();
      const ocrResult = await ocrBuffer(buf, { collection });
      const elapsed = Date.now() - startMs;
      process.stdout.write(`${elapsed}ms `);

      if (ocrResult.parsedResult) {
        const { item, confidence, missing } = ocrResult.parsedResult;
        const { matched, total, details } = compareFields(item, expected, collection);
        const pct = total > 0 ? Math.round(matched / total * 100) : 0;
        console.log(`→ ${matched}/${total} fields (${pct}%) | merged confidence: ${confidence.toFixed(2)}`);
        for (const d of details) {
          const icon = d.ok ? '✓' : '✗';
          if (!d.ok) {
            console.log(`      ${icon} ${d.field}: expected ${JSON.stringify(d.expected)}, got ${JSON.stringify(d.got)}${d.note ? ' ' + d.note : ''}`);
          } else {
            console.log(`      ${icon} ${d.field}${d.note ? ' ' + d.note : ''}`);
          }
        }
        summary['merged'] = summary['merged'] || { totalMatched: 0, totalFields: 0, fixtures: [] };
        summary['merged'].totalMatched += matched;
        summary['merged'].totalFields += total;
        summary['merged'].fixtures.push({ name: fixture.name, matched, total, confidence });
      } else {
        console.log('no stat block detected');
      }
    }
    console.log();
  }

  // Print scorecard
  console.log('=== SCORECARD ===\n');
  const engineNames = engines.map(e => e.name);
  const allNames = [...engineNames, ...(summary['merged'] ? ['merged'] : [])];
  for (const name of allNames) {
    const s = summary[name];
    const pct = s.totalFields > 0 ? Math.round(s.totalMatched / s.totalFields * 100) : 0;
    const label = name === 'merged' ? `${name} (production)` : name;
    console.log(`  ${label}: ${s.totalMatched}/${s.totalFields} fields (${pct}%)`);
  }

  // Winner
  if (allNames.length > 1) {
    console.log();
    const best = [...allNames].sort((a, b) => {
      const sa = summary[a];
      const sb = summary[b];
      return (sb.totalMatched / sb.totalFields) - (sa.totalMatched / sa.totalFields);
    })[0];
    const bestLabel = best === 'merged' ? 'merged (production)' : best;
    console.log(`  → Best overall: ${bestLabel}`);
  }

  console.log();

  // Shut down engines
  await Promise.all(engines.map(e => e.terminate().catch(() => {})));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
