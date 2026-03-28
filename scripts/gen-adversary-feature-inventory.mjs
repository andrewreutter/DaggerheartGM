/**
 * Reads built SRD JSON `daggerheart-srd/.build/03_json/adversaries.json` and emits
 * `src/features-v2/generated/adversary-feature-inventory.json`:
 * unique (name, type) keys with counts and one representative adversary id each.
 *
 *   node scripts/gen-adversary-feature-inventory.mjs
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { makeSrdListId } from '../src/srd/srd-list-ids.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_JSON = join(ROOT, 'daggerheart-srd', '.build', '03_json', 'adversaries.json');
const OUT = join(ROOT, 'src', 'features-v2', 'generated', 'adversary-feature-inventory.json');

/** Same as `parseFeatureName` in `src/srd/parser.js`. */
function parseFeatureName(rawName) {
  const s = String(rawName || '');
  const lastDash = s.lastIndexOf(' - ');
  if (lastDash >= 0) {
    const name = s.slice(0, lastDash).trim();
    const typeRaw = s.slice(lastDash + 3).toLowerCase().trim();
    const type = ['action', 'reaction', 'passive'].includes(typeRaw) ? typeRaw : 'passive';
    return { name, type };
  }
  return { name: s.trim(), type: 'passive' };
}

function main() {
  let text = readFileSync(SRC_JSON, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) {
    throw new Error(`Expected array in ${SRC_JSON}`);
  }

  /** @type {Map<string, { name: string, type: string, count: number, representativeAdversaryId: string, representativeAdversaryName: string }>} */
  const map = new Map();

  for (const row of raw) {
    const advName = row.name || '';
    const adversaryId = makeSrdListId('adversaries', advName);
    const featureArr = row.feature;
    if (!Array.isArray(featureArr)) continue;

    for (const f of featureArr) {
      const rawName = f?.name || '';
      const { name, type } = parseFeatureName(rawName);
      if (!name) continue;
      const key = `${type}\0${name}`;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          name,
          type,
          count: 1,
          representativeAdversaryId: adversaryId,
          representativeAdversaryName: advName,
        });
      } else {
        cur.count += 1;
      }
    }
  }

  const entries = [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceRelative: 'daggerheart-srd/.build/03_json/adversaries.json',
    adversaryStatblockCount: raw.length,
    uniqueFeatureNameTypePairs: entries.length,
    entries,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT} (${entries.length} unique name+type pairs).`);
}

main();
