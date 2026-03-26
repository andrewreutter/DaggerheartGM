import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLibraryItemImageUrls } from '../../lib/library-item-image-urls.js';

export { getLibraryItemImageUrls } from '../../lib/library-item-image-urls.js';

/** Modal: top-right float + optional carousel + opens lightbox. Card: inline first image only. */
export function LibraryItemImageThumb({ item, variant = 'modal', compact = false, onOpenLightbox }) {
  const urls = getLibraryItemImageUrls(item);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [item?.id]);
  if (urls.length === 0) return null;

  const isCard = variant === 'card';
  const safeIdx = isCard ? 0 : idx % urls.length;
  const hasCarousel = !isCard && urls.length > 1;

  return (
    <div
      className={
        isCard
          ? compact
            ? 'h-8 w-8 shrink-0 overflow-hidden rounded border border-dh-border/80 pointer-events-none'
            : 'h-[2.8125rem] w-[2.8125rem] shrink-0 overflow-hidden rounded border border-dh-border/80 pointer-events-none'
          : 'absolute top-0 right-0 z-10 h-32 w-32 shrink-0 overflow-hidden rounded-bl-xl cursor-pointer group'
      }
      onClick={!isCard ? () => onOpenLightbox?.(urls[safeIdx]) : undefined}
    >
      <img
        src={urls[safeIdx]}
        alt={item?.name || ''}
        className={`h-full w-full object-cover ${isCard ? '' : 'opacity-90'}`}
      />
      {hasCarousel && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((safeIdx - 1 + urls.length) % urls.length);
            }}
            className="absolute left-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((safeIdx + 1) % urls.length);
            }}
            className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronRight size={12} />
          </button>
          <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
                className={`h-1 w-1 rounded-full transition-colors ${i === safeIdx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
