import { resolveMapArtistCredit } from '../lib/map-artist.js';

const CREDIT_CLASS =
  'pointer-events-auto max-w-[14rem] truncate rounded border border-dh-border/80 bg-dh-raised/90 px-1.5 py-0.5 text-[10px] leading-tight text-dh-muted shadow-md';

/**
 * Bottom-right inset: "Map by {artist}". Links out when `artistUrl` is a safe http(s) URL.
 * @param {{ map?: { artist?: string, artistUrl?: string } | null }} props
 */
export function MapArtistCredit({ map }) {
  const credit = resolveMapArtistCredit(map);
  if (!credit) return null;
  const label = `Map by ${credit.artist}`;
  if (credit.href) {
    return (
      <a
        href={credit.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${CREDIT_CLASS} hover:text-dh hover:border-dh-strong`}
        title={label}
      >
        {label}
      </a>
    );
  }
  return (
    <div className={CREDIT_CLASS} title={label}>
      {label}
    </div>
  );
}
