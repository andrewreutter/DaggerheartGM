/**
 * SRD item — Lorekeeper (roll table 23)
 *
 * Store up to three hostile creatures in the book; +1 to action rolls against those creatures.
 */

import { when, isActing } from '../engine/when.js';

const NAMES_KEY = 'lorekeeperNames';

function normCreatureName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function storedNames(table) {
  const raw = table.feature.get(NAMES_KEY);
  return Array.isArray(raw) ? raw : [];
}

function lorekeeperTargetMatches(table) {
  const names = new Set(storedNames(table));
  if (names.size === 0) return false;
  for (const t of table.action?.targets ?? []) {
    if (!t?.isAdversary) continue;
    if (names.has(normCreatureName(t.name))) return true;
  }
  return false;
}

export const Lorekeeper = {
  name: 'Lorekeeper',
  description:
    'You can store the name and details of up to three hostile creatures inside this book. You gain a +1 bonus to action rolls against those creatures.',
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.rolls?.action != null,
      (t) => t.action?.isDualityRoll === true,
      lorekeeperTargetMatches,
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Lorekeeper', value: 1 });
      }
    ),
  },
  chips: [
    {
      name: 'Record hostile creature in Lorekeeper',
      placements: ['card'],
      description:
        'Choose a hostile creature on the table. Add its name to your Lorekeeper (up to three). You gain +1 to action rolls against recorded creatures.',
      selectTargets: (table) => {
        const have = new Set(storedNames(table));
        return (table.adversaries ?? []).filter((a) => !have.has(normCreatureName(a.name)));
      },
      isDisabled: (table) =>
        storedNames(table).length >= 3 ? 'Lorekeeper already holds three names (remove one first).' : false,
      onUse(table, chipState) {
        const ids = chipState?.get?.('selectedTargetIds') ?? [];
        const id = ids[0];
        if (!id) return;
        const actor = table.actors.find((a) => a.instanceId === id);
        if (!actor?.isAdversary) return;
        const nm = normCreatureName(actor.name);
        if (!nm) return;
        const cur = [...storedNames(table)];
        if (cur.length >= 3) return;
        if (cur.includes(nm)) return;
        cur.push(nm);
        table.feature.set(NAMES_KEY, cur);
      },
    },
  ],
};
