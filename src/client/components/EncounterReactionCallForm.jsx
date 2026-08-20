import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { TRAIT_FULL } from './CharacterDisplay.jsx';
import { TRAIT_KEYS } from '../lib/character-calc.js';
import { CustomSelect } from './forms/CustomSelect.jsx';
import { DifficultySlider } from './DifficultySlider.jsx';
import {
  REACTION_CALL_DEFAULT_DIFFICULTY,
  REACTION_CALL_DEFAULT_TRAIT,
  REACTION_CALL_MAX_DIFFICULTY,
  REACTION_CALL_MIN_DIFFICULTY,
  shapeReactionCallPayload,
} from '../lib/reaction-call-form.js';

/**
 * Left-of-aside Call for Reaction form (Trait → Characters → Difficulty).
 *
 * @param {object} props
 * @param {object[]} props.characters — table character elements
 * @param {string[]} [props.seedInstanceIds]
 * @param {(payload: { targetInstanceIds: string[], trait: string, difficulty: number, traitOverrides: Record<string, string> }) => void} props.onCall
 */
export function EncounterReactionCallForm({
  characters = [],
  seedInstanceIds = [],
  onCall,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(seedInstanceIds));
  const [trait, setTrait] = useState(REACTION_CALL_DEFAULT_TRAIT);
  const [difficulty, setDifficulty] = useState(REACTION_CALL_DEFAULT_DIFFICULTY);
  const [traitOverrides, setTraitOverrides] = useState({});

  const seedKey = (seedInstanceIds || []).join('\0');
  useEffect(() => {
    setSelectedIds(new Set(seedKey ? seedKey.split('\0') : []));
    setTrait(REACTION_CALL_DEFAULT_TRAIT);
    setDifficulty(REACTION_CALL_DEFAULT_DIFFICULTY);
    setTraitOverrides({});
  }, [seedKey]);

  const toggleId = (instanceId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) {
        next.delete(instanceId);
        setTraitOverrides((o) => {
          if (!(instanceId in o)) return o;
          const nextO = { ...o };
          delete nextO[instanceId];
          return nextO;
        });
      } else {
        next.add(instanceId);
      }
      return next;
    });
  };

  const dcNum = Number(difficulty);
  const dcValid = Number.isFinite(dcNum)
    && dcNum >= REACTION_CALL_MIN_DIFFICULTY
    && dcNum <= REACTION_CALL_MAX_DIFFICULTY;
  const canSubmit = selectedIds.size > 0 && TRAIT_KEYS.includes(trait) && dcValid;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCall?.(shapeReactionCallPayload({
      selectedIds,
      characters,
      trait,
      difficulty: dcNum,
      traitOverrides,
    }));
  };

  return (
    <form
      data-testid="encounter-reaction-call-form"
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Zap size={16} className="shrink-0 text-sky-300" />
        <h3 className="text-base font-bold text-dh">Call for Reaction</h3>
      </div>

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

      <fieldset className="min-h-0 space-y-1.5">
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
                  className="accent-sky-500 shrink-0"
                />
                <span className="truncate font-medium min-w-0 flex-1">{c.name || 'Unnamed'}</span>
                {checked && (
                  <div
                    className="w-[7.5rem] shrink-0"
                    onClick={(e) => e.preventDefault()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <CustomSelect
                      value={traitOverrides[c.instanceId] ?? null}
                      onChange={(v) => {
                        setTraitOverrides((prev) => {
                          const next = { ...prev };
                          if (!v || v === trait) delete next[c.instanceId];
                          else next[c.instanceId] = v;
                          return next;
                        });
                      }}
                      options={TRAIT_KEYS}
                      getOptionLabel={(key) => TRAIT_FULL[key] || key}
                      placeholder="Default"
                      truncateClosedLabel
                    />
                  </div>
                )}
              </label>
            );
          })
        )}
      </fieldset>

      <DifficultySlider
        id="reaction-call-difficulty"
        value={difficulty}
        onChange={setDifficulty}
        labelClassName="text-xs font-semibold text-dh-muted uppercase tracking-wider"
        testIdPrefix="reaction-call-difficulty"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full px-3 py-1.5 rounded-lg text-sm font-semibold border border-sky-700/70 bg-sky-950/50 text-sky-100 hover:bg-sky-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Call Reaction
      </button>
    </form>
  );
}
