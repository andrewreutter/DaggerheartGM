/**
 * Open-spotlight hint — same slot as the idle-pause / Play setup cards
 * (`bottom-[7rem]`, `z-[52]`). Shown while the session is live and no one holds
 * the spotlight. Portaled to `document.body` from `app.jsx`.
 */
export function ChooseSpotlightBanner() {
  return (
    <div
      className="select-none pointer-events-none fixed left-1/2 bottom-[7rem] z-[52] max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2"
      role="status"
      aria-label="Choose Spotlight"
    >
      <div className="px-5 py-3 rounded-xl shadow-2xl text-left border-2 backdrop-blur-sm text-yellow-100 border-yellow-400/35 bg-yellow-400/10">
        <div className="text-base font-bold text-yellow-50 mb-1">Choose Spotlight</div>
        <p className="text-[12px] text-yellow-100/90 leading-snug">
          Select a Player or GM Spotlight. Numbers indicate the number of rolls made since their last Spotlight.
        </p>
      </div>
    </div>
  );
}
