import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TableCard, tableCardTitle } from './TableCard.jsx';

/**
 * Marketing screenshot series on the unauthenticated home page.
 * Add entries here — screenshot slides use the same width and keep their own aspect ratio.
 * The last Public Games shot renders live public table cards instead of a PNG.
 */
export const HOME_FEATURE_SHOTS = [
  {
    id: 'character-builder',
    title: 'Character Builder',
    image: '/assets/home/character-builder.png',
    imageAlt: 'Character builder with name, portrait, class, subclass, ancestry, community, traits, armor, weapons, experiences, and domain cards',
    bullets: [
      'Create a random character with just a click, a name, and experiences. Adjust to taste.',
      'Character sheet updates as you adjust, so you can see the changes in real time.',
      'Level up just as easily with full support up to 10th level',
    ],
  },
  {
    id: 'action-first-character-sheet',
    title: 'Action-First Character Sheet',
    image: '/assets/home/action-first-character-sheet.png',
    imageAlt: 'Two-column character sheet with Hope, defense tracks, click-to-roll traits, weapons, feature actions, and domain card loadout',
    bullets: [
      'Sheet is organized around actions, so you can see the moves you actually use.',
      'Click a Trait, Spellcast, or a Weapon to roll it on the table.',
      'Mechanical support for every class, subclass, ancestry, and community feature.',
    ],
  },
  {
    id: 'table-built-for-daggerheart',
    title: 'Table built for Daggerheart',
    image: '/assets/home/table-built-for-daggerheart.png',
    imageAlt: 'Battle map with drawn room outline, placed door image, range bands, a 15-foot measure, altitude markers, and a hidden adversary token',
    bullets: [
      'Draw on the map — scribbles, brush, shapes, and eraser — and drop images you can move and resize.',
      'Range bands and a tape in feet show Melee through Very Far. Altitude stems mark height, so a 15′ climb is on the table.',
      'Hide adversaries from players with the eye toggle. They stay on your map until you reveal them.',
    ],
  },
  {
    id: 'dice-roller-and-action-log',
    title: 'Dice Roller and Action Log',
    image: '/assets/home/dice-roller-and-action-log.png',
    imageAlt: 'Manual dice builder with a 3D preview tray, Duality and polyhedral steppers, trait chips, a Roll button, and a color-coded action log of Hope, Fear, damage, and session events',
    bullets: [
      'Build a roll with Duality and any mix of d4 through d100. The 3D tray shows the dice you are about to throw.',
      'Add a trait like Agility or Strength, save a favorite, then hit Roll — the same dice tumble on the table.',
      'The log keeps every roll and action: Hope and Fear in color, damage, stress, and session beats, with times.',
    ],
  },
  {
    id: 'spotlight-management',
    title: 'Spotlight Management',
    image: '/assets/home/spotlight-management.png',
    imageAlt: 'Character tray with yellow Spotlight beams and turn-count badges',
    bullets: [
      'Click a beam to give Spotlight to that character — they take the next voluntary action.',
      'Numbers show how many turns it has been since they last held Spotlight.',
      'When Spotlight is open, the characters who have waited longest glow as a hint.',
      'Player rolls stay gated until they hold Spotlight, so the table stays in order.',
    ],
  },
  {
    id: 'gm-moves',
    title: 'GM Moves',
    image: '/assets/home/gm-moves.png',
    imageAlt: 'GM Moves overlay with Default Moves, Passives and Reactions, Fear Actions, and Actions',
    bullets: [
      'Default Moves stay on hand, plus every passive, Fear action, and attack from what is on the table.',
      'Click Off-Camera to reveal more actions from off-camera adversaries and environments.',
      'Click an attack to roll it at the table.',
    ],
  },
  {
    id: 'map-and-camera-management',
    title: 'Map and Camera Management',
    image: '/assets/home/map-and-camera-management.png',
    imageAlt: 'Maps and cameras overlay with named maps, size in feet, artist credit, and saved camera views',
    bullets: [
      'Keep every map and its named cameras in one overlay — floors, overviews, and close-ups.',
      'Set exact size in feet so tokens and range stay true to the table.',
      'Credit the artist with a name and link, shown on the map.',
      'Hover a camera to preview it; click to switch the table. Broadcast so players share your framing.',
    ],
  },
  {
    id: 'public-games',
    kind: 'publicTables',
    title: 'Public Games',
    imageAlt: 'Public table card with map preview, GM name, and party character chips',
    bullets: [
      'GMs can mark a table Public. The three most recently updated games show up here.',
      'Each card has a live map preview, the GM’s name, and the party.',
      'Click a card to watch. Sign in when you want to join as a player or start a table.',
    ],
  },
];

/** Shared image width for every homepage screenshot. Height follows the file’s aspect ratio. */
const SHOT_IMAGE_CLASS = 'w-full max-w-[36rem] h-auto rounded-lg border border-dh-border shadow-xl';

function HomeFeatureBulletList({ bullets }) {
  return (
    <ul className="text-dh-muted text-sm text-left space-y-2 list-none">
      {bullets.map((line) => (
        <li key={line} className="flex gap-2">
          <span className="text-red-500 mt-0.5 shrink-0">•</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export const HOME_FEATURE_CAROUSEL_INTERVAL_MS = 5000;

/** Wrap a carousel index by `delta` steps. Returns 0 when `length` is not a positive finite number. */
export function wrapHomeFeatureShotIndex(index, length, delta = 1) {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const start = Number.isFinite(index) ? Math.trunc(index) : 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  return ((start + step) % length + length) % length;
}

/** Dwell on Public Games long enough to cycle every live public table card. */
export function homeFeatureCarouselDwellMs(shot, publicTableCount) {
  if (shot?.kind === 'publicTables' && Number.isFinite(publicTableCount) && publicTableCount > 1) {
    return HOME_FEATURE_CAROUSEL_INTERVAL_MS * Math.trunc(publicTableCount);
  }
  return HOME_FEATURE_CAROUSEL_INTERVAL_MS;
}

/** Uniform scale that fits `content` inside `container`. Allows upscaling. Returns 1 when any side is not a positive finite size. */
export function computeScaleToFit(contentWidth, contentHeight, containerWidth, containerHeight) {
  const dims = [contentWidth, contentHeight, containerWidth, containerHeight];
  if (dims.some((n) => !Number.isFinite(n) || n <= 0)) return 1;
  return Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
}

function HomePublicTablesShot({ tables, tableIndex, reduceMotion, onOpenTable }) {
  const fadeClass = reduceMotion ? '' : 'transition-opacity duration-700';
  const frameRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const hasCards = Array.isArray(tables) && tables.length > 0;

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content || !hasCards) return undefined;
    const update = () => {
      setScale(computeScaleToFit(
        content.offsetWidth,
        content.offsetHeight,
        frame.clientWidth,
        frame.clientHeight,
      ));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    ro.observe(content);
    return () => ro.disconnect();
  }, [hasCards, tables]);

  if (!Array.isArray(tables)) {
    return (
      <div data-testid="home-public-tables-shot" className="h-full w-full" />
    );
  }
  if (tables.length === 0) {
    return (
      <div
        data-testid="home-public-tables-shot"
        className="flex items-center justify-center h-full px-6 text-dh-muted text-sm text-center"
      >
        No public tables right now.
      </div>
    );
  }
  const safeIndex = wrapHomeFeatureShotIndex(tableIndex, tables.length, 0);
  return (
    <div
      data-testid="home-public-tables-shot"
      className="h-full w-full p-4 box-border"
    >
      <div ref={frameRef} className="h-full w-full flex items-center justify-center overflow-hidden">
        <div
          ref={contentRef}
          className="w-[20rem] shrink-0"
          style={{ transform: `scale(${scale})` }}
        >
          <div className="grid">
            {tables.map((table, i) => (
              <div
                key={table.id}
                className={`col-start-1 row-start-1 ${fadeClass} ${i === safeIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                aria-hidden={i !== safeIndex}
              >
                <TableCard
                  title={tableCardTitle(table.name)}
                  subtitle={table.gmName ? `GM: ${table.gmName}` : null}
                  characterCount={table.characterCount}
                  characterNames={table.characterNames}
                  previewUrl={table.previewUrl}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTable?.(table.id);
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeFeatureCarousel({ shots, publicTables, publicTableIndex, onOpenTable }) {
  const [index, setIndex] = useState(0);
  const [rotationEpoch, setRotationEpoch] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', syncMotion);
    return () => mq.removeEventListener('change', syncMotion);
  }, []);

  useEffect(() => {
    if (shots.length < 2) return undefined;
    const dwell = homeFeatureCarouselDwellMs(shots[index], Array.isArray(publicTables) ? publicTables.length : 0);
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((i) => wrapHomeFeatureShotIndex(i, shots.length, 1));
    }, dwell);
    return () => window.clearInterval(id);
  }, [shots, index, publicTables, rotationEpoch]);

  const current = shots[index];
  if (!current) return null;

  const select = (nextIndex) => {
    setIndex(wrapHomeFeatureShotIndex(nextIndex, shots.length, 0));
    setRotationEpoch((n) => n + 1);
  };
  const step = (delta) => {
    setIndex((i) => wrapHomeFeatureShotIndex(i, shots.length, delta));
    setRotationEpoch((n) => n + 1);
  };

  const scrollToShot = () => {
    document.getElementById(`home-shot-${current.id}`)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const fadeClass = reduceMotion ? '' : 'transition-opacity duration-700';

  return (
    <section
      data-testid="home-feature-carousel"
      aria-roledescription="carousel"
      aria-label="Feature highlights"
      className="w-full max-w-3xl mx-auto"
    >
      <div className="grid mb-4">
        {shots.map((shot, i) => (
          <p
            key={shot.id}
            className={`col-start-1 row-start-1 text-2xl font-bold text-dh tracking-wide text-center ${fadeClass} ${i === index ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={i !== index}
          >
            {shot.title}
          </p>
        ))}
      </div>
      <div>
        <div className="relative">
          <div
            className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-dh-border bg-dh-canvas shadow-xl cursor-pointer"
            onClick={scrollToShot}
          >
            {shots.map((shot, i) => (
              shot.kind === 'publicTables' ? (
                <div
                  key={shot.id}
                  className={`absolute inset-0 ${fadeClass} ${i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  aria-hidden={i !== index}
                >
                  <HomePublicTablesShot
                    tables={publicTables}
                    tableIndex={publicTableIndex}
                    reduceMotion={reduceMotion}
                    onOpenTable={onOpenTable}
                  />
                </div>
              ) : (
                <img
                  key={shot.id}
                  src={shot.image}
                  alt={i === index ? shot.imageAlt : ''}
                  aria-hidden={i !== index}
                  className={`absolute inset-0 w-full h-full object-contain ${fadeClass} ${i === index ? 'opacity-100' : 'opacity-0'}`}
                />
              )
            ))}
          </div>
          {shots.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Previous feature"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Next feature"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
        <div className="grid mt-4 w-full max-w-lg mx-auto">
          {shots.map((shot, i) => (
            <div
              key={shot.id}
              className={`col-start-1 row-start-1 ${fadeClass} ${i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={i !== index}
            >
              <HomeFeatureBulletList bullets={shot.bullets} />
            </div>
          ))}
        </div>
        {shots.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {shots.map((shot, i) => (
              <button
                key={shot.id}
                type="button"
                aria-current={i === index ? 'true' : undefined}
                aria-label={`Show ${shot.title}`}
                onClick={() => select(i)}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-red-500' : 'w-2 bg-dh-muted/50 hover:bg-dh-muted'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function HomeFeatureShots({ navigate }) {
  const [publicTables, setPublicTables] = useState(null);
  const [publicTableIndex, setPublicTableIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', syncMotion);
    return () => mq.removeEventListener('change', syncMotion);
  }, []);

  useEffect(() => {
    let cancelled = false;
    import('../lib/api.js')
      .then(({ fetchPublicTables }) => fetchPublicTables())
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows.slice(0, 3) : [];
        setPublicTables(list);
        setPublicTableIndex(0);
      })
      .catch(() => {
        if (!cancelled) {
          setPublicTables([]);
          setPublicTableIndex(0);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!Array.isArray(publicTables) || publicTables.length < 2) return undefined;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setPublicTableIndex((i) => wrapHomeFeatureShotIndex(i, publicTables.length, 1));
    }, HOME_FEATURE_CAROUSEL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [publicTables]);

  const onOpenTable = (tableId) => {
    if (tableId && navigate) navigate(`/table/${tableId}`);
  };

  if (HOME_FEATURE_SHOTS.length === 0) return null;
  return (
    <div className="w-full max-w-5xl mt-16 pt-12 border-t border-dh-border/70">
      <HomeFeatureCarousel
        shots={HOME_FEATURE_SHOTS}
        publicTables={publicTables}
        publicTableIndex={publicTableIndex}
        onOpenTable={onOpenTable}
      />
      {HOME_FEATURE_SHOTS.map((shot) => (
        <section
          key={shot.id}
          id={`home-shot-${shot.id}`}
          className="flex flex-col items-center gap-6 mt-16 pt-16 border-t border-dh-border/40 scroll-mt-20"
        >
          <div className="w-full max-w-lg">
            <h2 className="text-2xl font-bold text-dh tracking-wide mb-3">{shot.title}</h2>
            <HomeFeatureBulletList bullets={shot.bullets} />
          </div>
          {shot.kind === 'publicTables' ? (
            <div className="w-full max-w-[36rem] aspect-[16/10] rounded-lg border border-dh-border shadow-xl bg-dh-canvas overflow-hidden">
              <HomePublicTablesShot
                tables={publicTables}
                tableIndex={publicTableIndex}
                reduceMotion={reduceMotion}
                onOpenTable={onOpenTable}
              />
            </div>
          ) : (
            <img
              src={shot.image}
              alt={shot.imageAlt}
              className={SHOT_IMAGE_CLASS}
            />
          )}
        </section>
      ))}
    </div>
  );
}
