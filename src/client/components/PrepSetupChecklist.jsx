import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, useInsertionEffect } from 'react';
import { createPortal } from 'react-dom';
import { Map as MapIcon, Users, Play, CheckSquare, Square } from 'lucide-react';
import {
  isPrepBuildStepDone,
  isPrepInviteStepDone,
  isPrepSessionActive,
} from '../lib/battle-map-totm-hint.js';

/**
 * Floating GM prep checklist (Build / Invite / Play), anchored like the old Prep
 * mode banner so Play sits at `bottom-[7rem]`. Cards check+fade when completed;
 * starting the session dismisses all.
 */

const PREP_PULSE_CSS = `
@keyframes prep-pulse-build {
  0%,100% { box-shadow:0 0 0 0 rgb(167 139 250/0);   filter:brightness(1);   transform:scale(1); }
  50%      { box-shadow:0 0 0 6px rgb(167 139 250/.65),0 0 18px 2px rgb(167 139 250/.25); filter:brightness(1.4); transform:scale(1.06); }
}
@keyframes prep-pulse-invite {
  0%,100% { box-shadow:0 0 0 0 rgb(250 204 21/0);   filter:brightness(1);   transform:scale(1); }
  50%      { box-shadow:0 0 0 6px rgb(250 204 21/.55),0 0 18px 2px rgb(250 204 21/.2); filter:brightness(1.4); transform:scale(1.06); }
}
@keyframes prep-pulse-play {
  0%,100% { box-shadow:0 0 0 0 rgb(52 211 153/0);   filter:brightness(1);   transform:scale(1); }
  50%      { box-shadow:0 0 0 6px rgb(52 211 153/.55),0 0 18px 2px rgb(52 211 153/.2); filter:brightness(1.4); transform:scale(1.06); }
}
body[data-prep-highlight="build"]  [data-prep-target="build"]  { animation:prep-pulse-build  1.3s ease-in-out infinite; transform-origin:center; }
body[data-prep-highlight="invite"] [data-prep-target="invite"] { animation:prep-pulse-invite 1.3s ease-in-out infinite; transform-origin:center; }
body[data-prep-highlight="play"]   [data-prep-target="play"]   { animation:prep-pulse-play   1.3s ease-in-out infinite; transform-origin:center; }
`;

const CARD_SHELL =
  'w-full max-w-[min(420px,calc(100vw-2rem))] rounded-xl border-2 px-5 py-3 shadow-2xl bg-dh-canvas/95 backdrop-blur-md text-left flex items-start gap-3 cursor-default';

const CHECK_MS = 480;
const FADE_MS = 900;

const STEP_META = {
  build: {
    title: 'Build',
    Icon: MapIcon,
    instructionsLines: [
      'Load an existing Scene or build a new one with the + Add buttons in the Encounter panel.',
      'Paste, drop, or upload a map image, or leave it empty for theater of the mind.',
    ],
    className: 'text-violet-100 border-violet-400/80',
    checkboxClass: 'text-violet-300',
    highlight: 'build',
  },
  invite: {
    title: 'Invite',
    Icon: Users,
    instructionsLines: [
      'Open Players and generate an invite link to share with your group.',
      'Ask them to add characters to the table, or add characters yourself and assign them to players later.',
    ],
    className: 'text-yellow-100 border-yellow-400/80',
    checkboxClass: 'text-yellow-300',
    highlight: 'invite',
  },
  play: {
    title: 'Play',
    Icon: Play,
    instructionsLines: [
      "You're in prep mode — you can still adjust the map, notes, and Fear.",
      'When you\'re ready, click Start Session in the Encounter panel to roll, use features, and apply damage.',
    ],
    className: 'text-emerald-200 border-emerald-400/80',
    checkboxClass: 'text-emerald-400',
    highlight: 'play',
  },
};

const STEP_ORDER = ['build', 'invite', 'play'];

function setBodyPrepHighlight(key) {
  if (typeof document === 'undefined') return;
  if (key) document.body.dataset.prepHighlight = key;
  else delete document.body.dataset.prepHighlight;
}

function PrepSetupCard({ stepKey, doneVisual, onHoverStart, onHoverEnd }) {
  const meta = STEP_META[stepKey];
  const { title, Icon, instructionsLines = [], className, checkboxClass } = meta;
  const CheckIcon = doneVisual ? CheckSquare : Square;
  return (
    <div
      className={`${CARD_SHELL} ${className} pointer-events-auto`}
      onMouseEnter={() => onHoverStart(meta.highlight)}
      onMouseLeave={onHoverEnd}
    >
      <Icon size={22} className="shrink-0 mt-0.5 opacity-90" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold tracking-wide mb-1">{title}</div>
        <div className="text-[12px] leading-snug opacity-90 space-y-0.5">
          {instructionsLines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>
      <CheckIcon
        size={28}
        strokeWidth={doneVisual ? 2.5 : 2}
        className={`shrink-0 mt-0.5 transition-all duration-300 ${checkboxClass} ${
          doneVisual ? 'opacity-100 scale-110' : 'opacity-50 scale-100'
        }`}
        aria-hidden
      />
      <span className="sr-only">{doneVisual ? `${title} complete` : `${title} incomplete`}</span>
    </div>
  );
}

/**
 * @param {{
 *   tableStateReady: boolean,
 *   maps?: object[],
 *   mapConfigHasImage?: boolean,
 *   activeElements?: object[],
 *   sessionCountdowns?: object[],
 *   inviteLink?: object|null,
 *   sessionStarted?: boolean,
 * }} props
 */
export function PrepSetupChecklist({
  tableStateReady = false,
  maps = [],
  mapConfigHasImage = false,
  activeElements = [],
  sessionCountdowns = [],
  inviteLink = null,
  sessionStarted = true,
}) {
  const buildComplete = isPrepBuildStepDone({
    maps,
    mapConfigHasImage,
    activeElements,
    sessionCountdowns,
  });
  const inviteComplete = isPrepInviteStepDone({ inviteLink });
  const sessionActive = isPrepSessionActive({ sessionStarted });

  const want = useMemo(
    () => ({
      build: !sessionActive && !buildComplete,
      invite: !sessionActive && !inviteComplete,
      play: !sessionActive,
    }),
    [sessionActive, buildComplete, inviteComplete],
  );

  // Inject pulse keyframes directly so Tailwind's attribute-selector purge can't strip them.
  useInsertionEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'prep-pulse-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = PREP_PULSE_CSS;
    document.head.appendChild(el);
  }, []);

  /** @type {React.MutableRefObject<null | Record<string, boolean>>} */
  const visibleAtLoadRef = useRef(null);
  /** @type {React.MutableRefObject<Set<string>>} */
  const dismissingRef = useRef(new Set());
  /**
   * phase: hidden | appearing | shown | checking | fading
   *  hidden    → not rendered
   *  appearing → rendered at zero size/opacity; transitions to shown
   *  shown     → fully visible
   *  checking  → checkbox checked visual, about to fade
   *  fading    → collapsing toward hidden
   */
  const [phase, setPhase] = useState({
    build: 'hidden',
    invite: 'hidden',
    play: 'hidden',
  });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const timersRef = useRef([]);

  useEffect(() => () => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    setBodyPrepHighlight(null);
  }, []);

  // Snapshot which cards are needed once table state is ready; mount them as shown.
  useLayoutEffect(() => {
    if (!tableStateReady || visibleAtLoadRef.current) return;
    const snap = {
      build: want.build,
      invite: want.invite,
      play: want.play,
    };
    visibleAtLoadRef.current = snap;
    setPhase({
      build: snap.build ? 'shown' : 'hidden',
      invite: snap.invite ? 'shown' : 'hidden',
      play: snap.play ? 'shown' : 'hidden',
    });
  }, [tableStateReady, want]);

  // Drive appear + dismiss animations whenever want changes.
  useEffect(() => {
    if (!visibleAtLoadRef.current) return;

    for (const key of STEP_ORDER) {
      const curPhase = phaseRef.current[key];

      if (want[key]) {
        // Card should be visible. Re-appear if currently hidden (session never started).
        if (sessionActive) continue;
        if (dismissingRef.current.has(key)) continue;
        if (curPhase !== 'hidden') continue;

        // Start at zero size/opacity, then transition to shown after a frame.
        setPhase((prev) => ({ ...prev, [key]: 'appearing' }));
        const t = setTimeout(() => {
          setPhase((p) => (p[key] === 'appearing' ? { ...p, [key]: 'shown' } : p));
        }, 30);
        timersRef.current.push(t);
      } else {
        // Card should be hidden.
        if (dismissingRef.current.has(key)) continue;

        // Cancel a mid-appear and go straight to hidden.
        if (curPhase === 'appearing') {
          setPhase((prev) => ({ ...prev, [key]: 'hidden' }));
          continue;
        }

        // Only animate dismiss when the card is actually visible.
        if (curPhase !== 'shown') continue;

        dismissingRef.current.add(key);
        setPhase((prev) => ({ ...prev, [key]: 'checking' }));
        const t1 = setTimeout(() => {
          setPhase((p) => (p[key] === 'checking' ? { ...p, [key]: 'fading' } : p));
          const t2 = setTimeout(() => {
            setPhase((p) => ({ ...p, [key]: 'hidden' }));
            dismissingRef.current.delete(key);
          }, FADE_MS);
          timersRef.current.push(t2);
        }, CHECK_MS);
        timersRef.current.push(t1);
      }
    }
  }, [want, sessionActive]);


  const onHoverStart = useCallback((key) => setBodyPrepHighlight(key), []);
  const onHoverEnd = useCallback(() => setBodyPrepHighlight(null), []);

  if (typeof document === 'undefined') return null;

  const visibleKeys = STEP_ORDER.filter((k) => phase[k] !== 'hidden');
  if (visibleKeys.length === 0) return null;

  return createPortal(
    <div
      className="select-none pointer-events-none fixed left-1/2 bottom-[7rem] z-[52] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex flex-col justify-end gap-0"
      role="status"
      aria-label="Table setup"
    >
      {STEP_ORDER.map((key) => {
        const p = phase[key];
        if (p === 'hidden') return null;
        // collapsed = invisible/zero-height (both fading out and appearing in)
        const collapsed = p === 'fading' || p === 'appearing';
        const doneVisual = p === 'checking' || p === 'fading';
        return (
          <div
            key={key}
            className={`overflow-hidden transition-[max-height,margin] duration-[900ms] ease-out ${
              collapsed ? 'max-h-0 mb-0' : 'max-h-[20rem] mb-3'
            }`}
          >
            <div
              className={`transition-opacity duration-[900ms] ease-out ${
                collapsed ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <PrepSetupCard
                stepKey={key}
                doneVisual={doneVisual}
                onHoverStart={onHoverStart}
                onHoverEnd={onHoverEnd}
              />
            </div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
