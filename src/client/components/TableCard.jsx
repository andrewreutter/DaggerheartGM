import { MapPinned, Users } from 'lucide-react';

function CharacterNameChips({ names }) {
  const list = Array.isArray(names) ? names.filter((n) => typeof n === 'string' && n.trim()) : [];
  if (list.length === 0) {
    return <p className="text-[11px] text-dh-muted">No characters yet</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="max-w-full truncate text-[10px] px-1.5 py-0.5 rounded-full bg-dh-raised border border-dh-border text-dh-muted"
          title={name}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

export function tableCardTitle(name) {
  return (name && name.trim() && name !== 'New Table') ? name : 'Game Table';
}

/** 16:9 table preview card used on the authenticated home and the anonymous Public Games shot. */
export function TableCard({ title, subtitle, characterCount, characterNames, previewUrl, onClick }) {
  const count = Number.isFinite(characterCount)
    ? characterCount
    : (Array.isArray(characterNames) ? characterNames.length : 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full text-left rounded-xl border border-dh-border bg-dh-canvas/40 hover:bg-dh-hover/60 hover:border-dh-strong overflow-hidden transition-colors"
    >
      <div className="aspect-video bg-dh-raised/60 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <MapPinned size={28} className="text-dh-muted" aria-hidden />
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="font-semibold text-dh truncate">{title}</p>
            {subtitle && <p className="text-xs text-dh-muted truncate mt-0.5">{subtitle}</p>}
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-dh-muted">
            <Users size={12} aria-hidden />
            {count}
          </span>
        </div>
        <CharacterNameChips names={characterNames} />
      </div>
    </button>
  );
}
