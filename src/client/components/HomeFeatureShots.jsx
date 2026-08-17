/**
 * Marketing screenshot series on the unauthenticated home page.
 * Add entries here — every image uses the same width and keeps its own aspect ratio.
 */
export const HOME_FEATURE_SHOTS = [
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
      'Grouped by source — environments first, then adversaries — so you can scan in Encounter order.',
      'Moves whose tokens sit outside the current camera fold under Off camera.',
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
];

/** Shared image width for every homepage screenshot. Height follows the file’s aspect ratio. */
const SHOT_IMAGE_CLASS = 'w-full max-w-[36rem] h-auto rounded-lg border border-dh-border shadow-xl';

export function HomeFeatureShots() {
  if (HOME_FEATURE_SHOTS.length === 0) return null;
  return (
    <div className="w-full max-w-5xl mt-16 pt-12 border-t border-dh-border/70 space-y-16">
      {HOME_FEATURE_SHOTS.map((shot) => (
        <section key={shot.id} className="flex flex-col items-center gap-6">
          <div className="w-full max-w-lg">
            <h2 className="text-2xl font-bold text-dh tracking-wide mb-3">{shot.title}</h2>
            <ul className="text-dh-muted text-sm text-left space-y-2 list-none">
              {shot.bullets.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-red-500 mt-0.5 shrink-0">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <img
            src={shot.image}
            alt={shot.imageAlt}
            className={SHOT_IMAGE_CLASS}
          />
        </section>
      ))}
    </div>
  );
}
