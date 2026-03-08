import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import DiceBox from '@3d-dice/dice-box-threejs';

const SUPPORTED_SIDES = new Set([4, 6, 8, 10, 12, 20]);

// ── Daggerheart die color themes ────────────────────────────────────────────

const HOPE_COLORSET = {
  name: 'dh_hope',
  foreground: '#451a03',
  background: '#f59e0b',
  outline: '#b45309',
  texture: 'none',
  material: 'glass',
};

const FEAR_COLORSET = {
  name: 'dh_fear',
  foreground: '#ffffff',
  background: '#9333ea',
  outline: '#6b21a8',
  texture: 'none',
  material: 'glass',
};

const DAMAGE_COLORSET = {
  name: 'dh_damage',
  foreground: '#ffffff',
  background: '#dc2626',
  outline: '#991b1b',
  texture: 'none',
  material: 'glass',
};

const DEFAULT_COLORSET = {
  name: 'dh_default',
  foreground: '#1e293b',
  background: '#e2e8f0',
  outline: '#94a3b8',
  texture: 'none',
  material: 'glass',
};

function getColorsetForLabel(label) {
  const l = (label || '').toLowerCase();
  if (/hope/i.test(l))       return HOPE_COLORSET;
  if (/fear/i.test(l))       return FEAR_COLORSET;
  if (/damage|dmg/i.test(l)) return DAMAGE_COLORSET;
  return DEFAULT_COLORSET;
}

// ── Notation parsing helpers ────────────────────────────────────────────────

function parseDiceExpr(input) {
  if (!input) return null;
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec((input || '').trim());
  if (!m) return null;
  return {
    qty:      parseInt(m[1] || '1', 10),
    sides:    parseInt(m[2], 10),
    modifier: m[3] ? parseInt(m[3], 10) : 0,
  };
}

function parseDetailsValues(details, expectedQty) {
  if (!details) return null;
  const s = String(details).replace(/[()[\]\s]/g, '');
  const parts = s.split('+').map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 0);
  if (parts.length !== expectedQty) return null;
  return parts;
}

export function parseRollDice(subItems) {
  const groups = [];
  for (const sub of (subItems || [])) {
    const parsed = parseDiceExpr(sub.input);
    if (!parsed || !SUPPORTED_SIDES.has(parsed.sides)) continue;

    const total = parseInt(sub.result, 10) || 0;

    let values = parseDetailsValues(sub.details, parsed.qty);
    if (!values && parsed.qty === 1) {
      const faceValue = total - parsed.modifier;
      if (faceValue >= 1 && faceValue <= parsed.sides) {
        values = [faceValue];
      }
    }

    groups.push({
      qty:      parsed.qty,
      sides:    parsed.sides,
      modifier: parsed.modifier,
      values,
      result:   total,
      label:    (sub.pre || '').trim(),
    });
  }
  return groups;
}

// Build notation for a single group: "2d6@3,5" or "1d12@7"
function groupNotation(g) {
  const dice = `${g.qty}d${g.sides}`;
  if (g.values) return `${dice}@${g.values.join(',')}`;
  return dice;
}

// Sum all non-damage sub-item results (fallback for generic rolls without a top-level total).
function computeActionTotal(subItems) {
  let total = 0;
  for (const sub of (subItems || [])) {
    if (/damage/i.test(sub.pre || '')) continue;
    const v = parseInt(sub.result, 10);
    if (!isNaN(v)) total += v;
  }
  return total;
}

// Extract a clean label for the banner from a sub-item's pre text.
// Hope/Fear dice get simplified to just "Hope" / "Fear".
function extractBannerLabel(pre) {
  const t = (pre || '').trim();
  if (/\bhope\b/i.test(t)) return 'Hope';
  if (/\bfear\b/i.test(t)) return 'Fear';
  return t;
}

// Parse a dice sub-item into display parts: { notation, dieValue, modifier, total, type }.
// Returns null if the input isn't a recognisable dice expression.
function parseDiceSub(sub) {
  if (!sub || !sub.input) return null;
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec((sub.input || '').trim());
  if (!m) return null;
  const qty      = parseInt(m[1] || '1', 10);
  const sides    = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3], 10) : 0;
  const total    = parseInt(sub.result, 10);

  // Try to read die face from the details string, e.g. "(7)" or "(3+4)".
  let dieValue = total - modifier;
  if (sub.details) {
    const raw = String(sub.details).replace(/[()[\]\s]/g, '');
    const dv  = parseInt(raw.split('+')[0], 10);
    if (!isNaN(dv) && dv >= 1 && dv <= sides) dieValue = dv;
  }

  // Take first lowercase-only word from post as the damage type (e.g. "phy", "mag").
  // Capitalised words (e.g. "Melee", "Range") are range descriptors and are skipped.
  const postWords = (sub.post || '').trim().split(/\s+/);
  const type = (postWords[0] && /^[a-z]+$/.test(postWords[0])) ? postWords[0] : '';

  return { notation: `${qty}d${sides}`, dieValue, modifier, total, type };
}

// ── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ lg = false }) {
  const sz = lg ? 'w-5 h-5 border-2' : 'w-3 h-3 border-2';
  return (
    <span
      className={`inline-block ${sz} rounded-full border-current border-t-transparent animate-spin`}
      style={{ verticalAlign: lg ? '-4px' : '-2px' }}
    />
  );
}

// ── Result Banner ───────────────────────────────────────────────────────────

function ResultBanner({ roll, hasMore, resolved, onDismiss, onDragStart, onDragEnd }) {
  const { dominant, total, characterName, rollUser } = roll;
  const displayName = characterName || rollUser || '';

  const hasDHLabels   = (roll.subItems || []).some(s => /hope/i.test(s.pre || ''))
                     && (roll.subItems || []).some(s => /fear/i.test(s.pre || ''));
  const isDaggerheart = dominant != null || hasDHLabels;
  const isCritical    = dominant === 'critical';
  const isHope        = dominant === 'hope' || isCritical;

  const actionItems = (roll.subItems || []).filter(s => !/damage/i.test(s.pre || ''));
  const damageSub   = (roll.subItems || []).find(s => /damage/i.test(s.pre || '') && s.input);
  // Always parse structure; spinners replace individual numbers when !resolved.
  const dmg         = parseDiceSub(damageSub);
  const hasDamage   = resolved && dmg != null;


  // DH rolls: label + numeric value for each non-damage sub-item.
  const dhParts = isDaggerheart
    ? actionItems
        .map(s => ({ label: extractBannerLabel(s.pre), value: parseInt(s.result, 10) }))
        .filter(p => p.label && (resolved ? (!isNaN(p.value) && p.value !== 0) : true))
    : [];

  // Generic rolls: parsed dice detail for the first action expression.
  const genericActionSub = !isDaggerheart
    ? actionItems.find(s => /d\d/i.test(s.input || ''))
    : null;
  const genericAction = parseDiceSub(genericActionSub);
  const genericTotal  = total ?? computeActionTotal(roll.subItems);

  // Color schemes for DH (hope/fear) vs generic rolls.
  // Stay neutral until resolved so the hope/fear color doesn't spoil the result.
  const neutralScheme = { card: 'bg-slate-900/90 border-2 border-sky-500/60 text-sky-100', ghost: 'bg-slate-900/70 border-2 border-sky-500/40', detail: 'text-sky-200/60' };
  const scheme = (!resolved || !isDaggerheart)
    ? neutralScheme
    : isHope
      ? { card: 'bg-amber-900/90 border-2 border-amber-400 text-amber-50', ghost: 'bg-amber-900/70 border-2 border-amber-400/50', detail: 'text-amber-400/80' }
      : { card: 'bg-purple-950/90 border-2 border-purple-500/60 text-purple-100', ghost: 'bg-purple-950/70 border-2 border-purple-500/40', detail: 'text-purple-200/60' };

  return (
    <div
      className="dice-result-banner select-none cursor-pointer"
      style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'auto' }}
      onClick={onDismiss}
      title={hasDamage ? 'Drag damage to a target · click to dismiss' : 'Click to dismiss'}
    >
      {/* Inline wrapper so the ghost can be positioned relative to the card */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {/* Ghost card — visible when another roll is queued */}
        {hasMore && (
          <div
            className={`absolute rounded-xl ${scheme.ghost}`}
            style={{ inset: 0, transform: 'translate(6px, 6px)', zIndex: 0 }}
          />
        )}

        {/* Main card */}
        <div
          className={`relative px-5 py-3 rounded-xl shadow-2xl text-center min-w-[220px] ${scheme.card}`}
          style={{ zIndex: 1 }}
        >
          {displayName && (
            <div className="text-[11px] uppercase tracking-widest opacity-70 mb-1.5">{displayName}</div>
          )}

          {/* ── Action line ── */}
          <div className="flex items-baseline justify-center flex-wrap gap-x-1 leading-snug">
            {isDaggerheart ? (
              <>
                {dhParts.length > 0 && (
                  <span className={`text-[11px] ${scheme.detail}`}>
                    {dhParts.map((p, i) => (
                      <span key={i}>
                        {i > 0 && (isNaN(p.value) || p.value >= 0 ? ' + ' : ' \u2212 ')}
                        {p.label} {resolved ? Math.abs(p.value) : <Spinner />}
                      </span>
                    ))}
                    {' ='}
                  </span>
                )}
                <span className="text-2xl font-black tabular-nums ml-1">
                  {resolved ? total : <Spinner lg />}
                </span>
                <span className="text-sm font-semibold opacity-80 ml-0.5">
                  {resolved
                    ? (isCritical ? '✦ Critical!' : isHope ? 'with Hope' : 'with Fear')
                    : <Spinner lg />}
                </span>
              </>
            ) : genericAction ? (
              <>
                <span className={`text-[11px] ${scheme.detail}`}>
                  {genericAction.notation} {resolved ? genericAction.dieValue : <Spinner />}
                  {genericAction.modifier !== 0 && (
                    <> {genericAction.modifier > 0 ? '+' : '\u2212'} {Math.abs(genericAction.modifier)}</>
                  )}
                  {' ='}
                </span>
                <span className="text-2xl font-black tabular-nums ml-1">
                  {resolved ? genericAction.total : <Spinner lg />}
                </span>
              </>
            ) : (
              <span className="text-2xl font-black tabular-nums">
                {resolved ? genericTotal : <Spinner lg />}
              </span>
            )}
          </div>

          {/* ── Damage line — draggable to apply damage to a target ── */}
          {dmg && (
            <>
              <div
                className={`flex items-baseline justify-center flex-wrap gap-x-1 mt-1.5 leading-snug rounded px-1 -mx-1 transition-colors ${hasDamage ? 'cursor-grab active:cursor-grabbing hover:bg-red-900/30' : ''}`}
                draggable={hasDamage}
                onDragStart={hasDamage ? (e) => {
                  e.dataTransfer.setData('text/plain', String(dmg.total));
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragStart?.(roll, dmg.total);
                } : undefined}
                onDragEnd={hasDamage ? () => onDragEnd?.() : undefined}
              >
                <span className="text-[11px] text-red-300/60">
                  {dmg.notation} {resolved ? dmg.dieValue : <Spinner />}
                  {dmg.modifier !== 0 && (
                    <> {dmg.modifier > 0 ? '+' : '\u2212'} {Math.abs(dmg.modifier)}</>
                  )}
                  {' ='}
                </span>
                <span className="text-lg font-black tabular-nums text-red-300 ml-1">
                  {resolved ? dmg.total : <Spinner />}
                </span>
                {dmg.type && (
                  <span className="text-sm font-semibold text-red-300/80 ml-0.5">{dmg.type}</span>
                )}
                <span className="text-sm font-semibold text-red-300/80">damage</span>
              </div>
              {resolved && (
                <div className="text-[10px] text-red-300/40 mt-1.5 text-center leading-none pointer-events-none">
                  ↕ drag to apply
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DiceRoller ──────────────────────────────────────────────────────────────

export const DiceRoller = forwardRef(function DiceRoller({ roll, onComplete, onDragStart, onDragEnd, disableDismiss = false }, ref) {
  const containerRef    = useRef(null);
  const containerIdRef  = useRef(`dice-canvas-container-${Date.now()}`);
  const diceBoxRef      = useRef(null);
  const initDoneRef     = useRef(false);
  const queueRef        = useRef([]);
  const animatingRef    = useRef(false);
  const animDoneRef     = useRef(false); // true once animateGroups resolves for the current item
  const onCompleteRef   = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const [banner, setBanner]               = useState(null);
  const [bannerResolved, setBannerResolved] = useState(false);
  const [queueLen, setQueueLen]             = useState(0);

  // Called when dragging the banner to a target — same sequence as a click dismiss.
  function dismissBanner() {
    const current = queueRef.current[0];
    setBanner(null);
    setBannerResolved(false);
    diceBoxRef.current?.clearDice();
    queueRef.current.shift();
    setQueueLen(queueRef.current.length);
    animatingRef.current = false;
    animDoneRef.current = false;
    if (current) onCompleteRef.current?.(current);
    processQueue();
  }

  useImperativeHandle(ref, () => ({ dismiss: dismissBanner }), []);

  async function animateGroups(groups) {
    const db = diceBoxRef.current;
    if (!db) return;

    // Pre-create all colorsets (may involve async texture loading on first use)
    const colorSets = await Promise.all(
      groups.map(g => db.DiceColors.makeColorSet(getColorsetForLabel(g.label)))
    );

    // Bypass roll()/add() — they use a global colorset and add() clears dice
    // mid-animation. Instead, drive the internal spawn→simulate→animate pipeline
    // directly so every group's dice fly simultaneously with correct colors.
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
      db.animateThrow(db.running, () => resolve());
    });
  }

  function startAnimation(groups) {
    animateGroups(groups)
      .then(() => {
        animDoneRef.current = true;
        // Only resolve spinners now if we have real (non-optimistic) data.
        // If still optimistic, resolution is deferred until the _update arrives.
        if (!queueRef.current[0]?._optimistic) setBannerResolved(true);
        setQueueLen(queueRef.current.length);
      })
      .catch(() => {
        animatingRef.current = false;
        setBanner(null);
        setBannerResolved(false);
        queueRef.current.shift();
        setQueueLen(queueRef.current.length);
        onCompleteRef.current?.(queueRef.current[0]);
        processQueue();
      });
  }

  function processQueue() {
    if (animatingRef.current || !queueRef.current.length) return;
    const current = queueRef.current[0];
    const groups  = parseRollDice(current.subItems);

    if (!groups.length && !current._optimistic) {
      queueRef.current.shift();
      setQueueLen(queueRef.current.length);
      onCompleteRef.current?.(current);
      processQueue();
      return;
    }

    animatingRef.current = true;
    animDoneRef.current = false;
    // Show banner with spinners immediately — numbers resolve when animation ends.
    setBanner(current);
    setBannerResolved(false);

    // For optimistic rolls, show the banner now but defer dice animation until
    // real Rolz data arrives via _update — we don't have actual die values yet.
    if (current._optimistic) return;

    if (!initDoneRef.current) return;

    startAnimation(groups);
  }

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.id = containerIdRef.current;

    const db = new DiceBox(`#${containerIdRef.current}`, {
      assetPath:          '/dice-threejs/',
      gravity_multiplier: 400,
      light_intensity:    0.8,
      baseScale:          100,
      strength:           1,
      sounds:             false,
      shadows:            false,
      theme_surface:      'green-felt',
      theme_colorset:     'white',
      theme_material:     'glass',
      onRollComplete:     () => {},
      onAddDiceComplete:  () => {},
    });

    db.initialize()
      .then(() => {
        if (db.desk) db.desk.visible = false;
        initDoneRef.current = true;
        diceBoxRef.current  = db;
        // If a non-optimistic roll arrived before init completed, its banner is
        // already showing — kick off the dice animation now. Optimistic rolls wait
        // for real data via _update, so don't start animation for those.
        if (animatingRef.current && queueRef.current.length && !queueRef.current[0]._optimistic) {
          const groups = parseRollDice(queueRef.current[0].subItems);
          if (groups.length) startAnimation(groups);
        } else if (!animatingRef.current) {
          processQueue();
        }
      })
      .catch(err => console.error('[DiceRoller] init failed:', err));

    return () => {
      diceBoxRef.current = null;
      initDoneRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!roll) return;
    if (roll._update) {
      // Replace the optimistic placeholder with confirmed Rolz data in-place.
      if (queueRef.current.length > 0 && queueRef.current[0]._optimistic) {
        const realRoll = { ...roll, _update: false, _optimistic: false };
        queueRef.current[0] = realRoll;
        setBanner(realRoll);
        // Now kick off the dice animation with real values.
        const groups = parseRollDice(realRoll.subItems);
        if (groups.length && initDoneRef.current) {
          startAnimation(groups);
        } else if (!groups.length) {
          // No parseable dice — just resolve the banner immediately.
          setBannerResolved(true);
        }
      }
      return;
    }
    queueRef.current.push(roll);
    setQueueLen(queueRef.current.length);
    processQueue();
  }, [roll]);

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {banner && (
        <ResultBanner
          roll={banner}
          hasMore={queueLen > 1}
          resolved={bannerResolved}
          onDismiss={disableDismiss ? undefined : dismissBanner}
          onDragStart={disableDismiss ? undefined : onDragStart}
          onDragEnd={disableDismiss ? undefined : onDragEnd}
        />
      )}
    </div>
  );
});
