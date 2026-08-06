// Shared 3D dice color themes + group-render helper for @3d-dice/dice-box-threejs.
// Used by DiceRoller.jsx (real Duality/damage/action rolls) and ManualDiceBuilder.jsx
// (live previews in the Action Log dice builder) so both draw dice with the same
// Daggerheart color language.

export const HOPE_COLORSET = {
  name: 'dh_hope',
  foreground: '#451a03',
  background: '#f59e0b',
  outline: '#b45309',
  texture: 'none',
  material: 'glass',
};

export const FEAR_COLORSET = {
  name: 'dh_fear',
  foreground: '#ffffff',
  background: '#9333ea',
  outline: '#6b21a8',
  texture: 'none',
  material: 'glass',
};

export const DAMAGE_COLORSET = {
  name: 'dh_damage',
  foreground: '#ffffff',
  background: '#dc2626',
  outline: '#991b1b',
  texture: 'none',
  material: 'glass',
};

export const DEFAULT_COLORSET = {
  name: 'dh_default',
  foreground: '#1e293b',
  background: '#e2e8f0',
  outline: '#94a3b8',
  texture: 'none',
  material: 'glass',
};

export function getColorsetForLabel(label) {
  const l = (label || '').toLowerCase();
  if (/hope/i.test(l))       return HOPE_COLORSET;
  if (/fear/i.test(l))       return FEAR_COLORSET;
  if (/damage|dmg/i.test(l)) return DAMAGE_COLORSET;
  return DEFAULT_COLORSET;
}

/** Build notation for a single group: "2d6@3,5" or "1d12@7" (plain "2d6" when no explicit values). */
export function groupNotation(g) {
  const dice = `${g.qty}d${g.sides}`;
  if (g.values) return `${dice}@${g.values.join(',')}`;
  return dice;
}

// ── Percentile (d100) helpers ─────────────────────────────────────────────────
// dice-box-threejs ships built-in `d100` and `d10` die-type presets that match
// the standard two-d10 percentile convention:
//   d100  — shape d10, faces "10","20",…,"90","00" (the "tens" die)
//   d10   — faces "1",…,"9","0"                    (the "ones" die)
// swapDiceFace auto-converts a bare 0-9 digit to the right face per type:
//   d100: 0→100 ("00"), 1-9→digit*10
//   d10:  0→10  ("0"),  1-9 unchanged
// So passing the raw tens/ones digit (0-9) reproduces the correct face label
// for any 1-100 roll value, with no extra assets or textures.

/**
 * Decompose a 1-100 percentile roll value into its tens digit and ones digit (0-9 each).
 * v=100 → { tensDigit: 0, onesDigit: 0 } which the library reads as "00"+"0" = 100.
 */
export function decomposeD100Digits(value) {
  const v = Number(value) || 0;
  const m = ((v % 100) + 100) % 100; // maps 100→0, 1-99→themselves
  return { tensDigit: Math.floor(m / 10), onesDigit: m % 10 };
}

/**
 * Build the two 3D dice groups (tens + ones) for one or more percentile roll values
 * (each value must be in 1-100). Returns groups ready for `renderColoredDiceGroups`.
 * @param {number[]} values - real 1-100 roll results (one per d100 die rolled)
 * @param {{ label?: string|null }} [opts]
 */
export function buildD100Groups(values, { label = null } = {}) {
  const tensValues = [];
  const onesValues = [];
  for (const v of values) {
    const { tensDigit, onesDigit } = decomposeD100Digits(v);
    tensValues.push(tensDigit);
    onesValues.push(onesDigit);
  }
  return [
    { label, qty: tensValues.length, sides: 100, values: tensValues },
    { label, qty: onesValues.length, sides: 10,  values: onesValues },
  ];
}

/**
 * Spawn and animate a set of colored dice groups on a live DiceBox instance.
 * `groups`: [{ qty, sides, label, values? }] — `values` (optional) pins each die's face
 * to a specific result (used for real rolls); omit `values` to let physics settle randomly
 * (used for cosmetic previews).
 */
export async function renderColoredDiceGroups(db, groups) {
  if (!db || !groups?.length) return;

  const colorSets = await Promise.all(
    groups.map(g => db.DiceColors.makeColorSet(getColorsetForLabel(g.label)))
  );

  db.clearDice();

  const allVectors = [];
  const groupRanges = [];

  for (let i = 0; i < groups.length; i++) {
    db.DiceFactory.applyColorSet(colorSets[i]);
    db.colorData = colorSets[i];

    const startPos = {
      x: (Math.random() * 2 - 0.5) * db.display.currentWidth,
      y: -(Math.random() * 2 - 0.5) * db.display.currentHeight,
    };
    const dist = Math.sqrt(startPos.x ** 2 + startPos.y ** 2) + 100;
    const force = (Math.random() + 3) * dist * db.strength;
    const nv = db.getNotationVectors(groupNotation(groups[i]), startPos, force, dist);
    if (!nv?.vectors?.length) continue;

    const startIdx = db.diceList.length;
    for (const vec of nv.vectors) {
      db.spawnDice(vec);
      allVectors.push(vec);
    }
    groupRanges.push({ nv, startIdx, count: nv.vectors.length });
  }

  if (!db.diceList.length) return;

  db.simulateThrow();
  db.steps = 0;
  db.iteration = 0;

  for (let i = 0; i < db.diceList.length; i++) {
    if (db.diceList[i]) db.spawnDice(allVectors[i], db.diceList[i]);
  }

  for (const { nv, startIdx } of groupRanges) {
    if (nv.result?.length) {
      for (let j = 0; j < nv.result.length; j++) {
        const die = db.diceList[startIdx + j];
        if (die && die.getLastValue().value !== nv.result[j]) {
          db.swapDiceFace(die, nv.result[j]);
        }
      }
    }
  }

  return new Promise((resolve) => {
    db.rolling = true;
    db.running = Date.now();
    db.last_time = 0;
    db.animateThrow(db.running, () => {
      resolve();
    });
  });
}
