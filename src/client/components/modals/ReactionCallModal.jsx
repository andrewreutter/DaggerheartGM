import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { TRAIT_FULL } from '../CharacterDisplay.jsx';
import { TRAIT_KEYS } from '../../lib/character-calc.js';

const DEFAULT_DIFFICULTY = 10;
const MIN_DIFFICULTY = 5;
const MAX_DIFFICULTY = 30;

/**
 * GM picker: which characters make a reaction roll, which trait, and the Difficulty.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {object[]} props.characters — table character elements
 * @param {string[]} [props.seedInstanceIds]
 * @param {(payload: { targetInstanceIds: string[], trait: string, difficulty: number }) => void} props.onCall
 * @param {() => void} props.onClose
 */
export function ReactionCallModal({ open, characters = [], seedInstanceIds = [], onCall, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(seedInstanceIds));
  const [trait, setTrait] = useState('agility');
  const [difficulty, setDifficulty] = useState(DEFAULT_DIFFICULTY);

  const seedKey = (seedInstanceIds || []).join('\0');
  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(seedKey ? seedKey.split('\0') : []));
    setTrait('agility');
    setDifficulty(DEFAULT_DIFFICULTY);
  }, [open, seedKey]);

  const toggleId = (instanceId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const dcNum = Number(difficulty);
  const dcValid = Number.isFinite(dcNum) && dcNum >= MIN_DIFFICULTY && dcNum <= MAX_DIFFICULTY;
  const canSubmit = selectedIds.size > 0 && TRAIT_KEYS.includes(trait) && dcValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCall?.({
      targetInstanceIds: characters
        .filter((c) => selectedIds.has(c.instanceId))
        .map((c) => c.instanceId),
      trait,
      difficulty: Math.round(dcNum),
    });
  };

  return (
    <FullPageOverlay
      open={open}
      onClose={onClose}
      zIndexClass="z-[200]"
      maxWidthClass="max-w-md"
      heightClass="h-auto max-h-[min(88vh,640px)]"
      containerClassName="p-4 sm:p-6"
      ariaLabelledBy="reaction-call-title"
    >
      <FullPageOverlayHeader
        title="Call for Reaction"
        titleId="reaction-call-title"
        icon={Zap}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
        <fieldset className="min-h-0 flex-1 overflow-y-auto space-y-1.5">
          <legend className="text-xs font-semibold text-dh-muted uppercase tracking-wider mb-1.5">Characters</legend>
          {characters.length === 0 ? (
            <p className="text-sm text-dh-muted italic">No characters on the table.</p>
          ) : (
            characters.map((c) => {
              const checked = selectedIds.has(c.instanceId);
              return (
                <label
                  key={c.instanceId}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                    checked
                      ? 'border-sky-500/60 bg-sky-950/30 text-dh'
                      : 'border-dh-strong bg-dh-raised/40 text-dh hover:border-dh-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleId(c.instanceId)}
                    className="accent-sky-500"
                  />
                  <span className="truncate font-medium">{c.name || 'Unnamed'}</span>
                </label>
              );
            })
          )}
        </fieldset>

        <div>
          <div className="text-xs font-semibold text-dh-muted uppercase tracking-wider mb-1.5">Trait</div>
          <div className="grid grid-cols-3 gap-1.5">
            {TRAIT_KEYS.map((key) => {
              const selected = trait === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrait(key)}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    selected
                      ? 'border-sky-500 bg-sky-950/40 text-dh ring-1 ring-sky-500/40'
                      : 'border-dh-strong bg-dh-raised/40 text-dh-muted hover:text-dh hover:border-dh-muted'
                  }`}
                >
                  {TRAIT_FULL[key] || key}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-dh-muted uppercase tracking-wider">Difficulty</span>
          <input
            type="number"
            min={MIN_DIFFICULTY}
            max={MAX_DIFFICULTY}
            step={1}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-dh-strong bg-dh-raised px-3 py-2 text-sm text-dh outline-none focus:border-sky-500"
          />
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm border border-dh-strong bg-dh-surface text-dh-muted hover:text-dh hover:bg-dh-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-sky-700/70 bg-sky-950/50 text-sky-100 hover:bg-sky-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Call Reaction
          </button>
        </div>
      </form>
    </FullPageOverlay>
  );
}
