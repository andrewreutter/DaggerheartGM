import { CustomSelect } from './CustomSelect.jsx';
import {
  traitMarksForBandExcludingLevel,
  traitMarksFromSiblingPicksOnLevelRow,
} from '../../lib/advancement-rules.js';

const TRAIT_LABELS = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

const TRAIT_KEYS_ORDER = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

/**
 * One trait grid for every `traits` advancement slot in a tier band (multiple levels).
 * Click removes from the owning pick, or adds to the first pick in band order that can accept it.
 */
export function AdvancementTraitsCombined({
  fills,
  advancements,
  characterLevel,
  /** Character level at which picks may be edited; earlier level rows are read-only. */
  editableLevel,
  band,
  traitKeys,
  patchPickAtLevel,
}) {
  const keys = traitKeys || TRAIT_KEYS_ORDER;
  const order = TRAIT_KEYS_ORDER.filter((k) => keys.includes(k)).concat(keys.filter((k) => !TRAIT_KEYS_ORDER.includes(k)));
  const cl = Number(characterLevel) || 1;
  const el = Number(editableLevel) || 1;
  const rowEditable = (fill) => Number(fill.level) === el;

  const getPick = (fill) => {
    const row = advancements?.[String(fill.level)] || {};
    const picks = row.picks || [];
    return picks[fill.pickIndex] || null;
  };

  const canAddTraitToFill = (fill, traitKey) => {
    if (!rowEditable(fill)) return false;
    const p = getPick(fill);
    if (!p || p.type !== 'traits') return false;
    if ((p.traits || []).length >= 2) return false;
    if ((p.traits || []).includes(traitKey)) return false;
    const row = advancements[String(fill.level)] || {};
    const rowPicks = [...(row.picks || [])];
    while (rowPicks.length < 2) rowPicks.push(null);
    const marksBand = traitMarksForBandExcludingLevel(advancements, cl, band, fill.level);
    const marksSibling = traitMarksFromSiblingPicksOnLevelRow(rowPicks, fill.pickIndex);
    const marks = [...new Set([...marksBand, ...marksSibling])];
    return !marks.includes(traitKey);
  };

  const findOwnerFill = (traitKey) =>
    fills.find((f) => (getPick(f)?.traits || []).includes(traitKey)) || null;

  const onTraitClick = (traitKey) => {
    const owner = findOwnerFill(traitKey);
    if (owner) {
      if (!rowEditable(owner)) return;
      const p = getPick(owner);
      const traits = (p.traits || []).filter((x) => x !== traitKey);
      patchPickAtLevel(owner.level, owner.pickIndex, { ...p, traits });
      return;
    }
    for (const f of fills) {
      if (canAddTraitToFill(f, traitKey)) {
        const p = getPick(f);
        const traits = [...(p?.traits || []), traitKey].slice(0, 2);
        patchPickAtLevel(f.level, f.pickIndex, { ...p, traits });
        return;
      }
    }
  };

  return (
    <div className="mt-1 grid grid-cols-3 sm:grid-cols-6 gap-1 w-full max-w-xl">
      {order.map((t) => {
        const owner = findOwnerFill(t);
        const selected = !!owner;
        const badgeLevel = owner ? owner.level : null;
        const lockedPast = selected && owner && !rowEditable(owner);
        const canAdd = !selected && fills.some((f) => canAddTraitToFill(f, t));
        const usedElsewhere = !selected && !canAdd;
        const disabled = usedElsewhere || lockedPast;
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            title={
              lockedPast
                ? `Level ${badgeLevel} — read-only (not your current level)`
                : usedElsewhere
                  ? `Marked in this tier (not available for another +1 Traits pick)`
                  : selected
                    ? `Level ${badgeLevel} — click to clear`
                    : `Mark ${TRAIT_LABELS[t] || t}`
            }
            onClick={() => {
              if (disabled) return;
              onTraitClick(t);
            }}
            className={`relative text-[10px] px-1 py-1 rounded border transition-colors min-h-[2rem] flex flex-col items-center justify-center gap-0.5 ${
              selected
                ? 'bg-sky-900/60 border-sky-500 text-sky-100'
                : usedElsewhere
                  ? 'bg-dh-inset/50 border-dh-border/60 text-dh-muted cursor-not-allowed opacity-80'
                  : 'bg-dh-raised border-dh-border text-dh-muted hover:border-sky-600'
            } ${lockedPast ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            <span className="leading-tight text-center font-medium">{TRAIT_LABELS[t] || t}</span>
            {badgeLevel != null ? (
              <span className="text-[9px] font-bold tabular-nums text-sky-300/90 leading-none">L{badgeLevel}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sub-choice UI for a single advancement pick (no type selector). Used by sheet-style tier columns.
 *
 * @param {Record<string, number>} [traitLevelByKeyElsewhere] — levels where each trait was marked by other picks (badges)
 * @param {number} [pickLevel] — character level for this pick row (badge on current selection)
 * @param {boolean} [readOnly] — disable sub-choices (e.g. past level rows)
 */
export function AdvancementPickDetail({
  pick,
  onChange,
  experiences = [],
  domainAbilityOptions = [],
  allSelectedDomainCardIds = new Set(),
  abilitiesById = {},
  traitKeys,
  /** Trait keys marked elsewhere in the band / sibling picks (not selectable unless already selected). */
  traitMarks = [],
  traitLevelByKeyElsewhere = {},
  pickLevel,
  readOnly = false,
}) {
  const keys = traitKeys || TRAIT_KEYS_ORDER;
  if (!pick?.type) return null;

  if (pick.type === 'traits') {
    const marks = traitMarks || [];
    const order = TRAIT_KEYS_ORDER.filter((k) => keys.includes(k)).concat(keys.filter((k) => !TRAIT_KEYS_ORDER.includes(k)));
    return (
      <div className="mt-1 grid grid-cols-3 sm:grid-cols-6 gap-1 w-full max-w-xl">
        {order.map((t) => {
          const selected = (pick.traits || []).includes(t);
          const usedElsewhere = marks.includes(t) && !selected;
          const canToggle =
            selected || ((pick.traits || []).length < 2 && !usedElsewhere);
          const badgeLevel = selected && pickLevel != null ? pickLevel : traitLevelByKeyElsewhere?.[t];
          return (
            <button
              key={t}
              type="button"
              disabled={usedElsewhere}
              title={
                usedElsewhere
                  ? `Marked at level ${traitLevelByKeyElsewhere?.[t] ?? '?'} (not available this pick)`
                  : selected
                    ? `Selected at level ${pickLevel ?? '—'} — click to clear`
                    : `Mark ${TRAIT_LABELS[t] || t}`
              }
              onClick={() => {
                if (usedElsewhere || !canToggle) return;
                const traits = selected
                  ? (pick.traits || []).filter((x) => x !== t)
                  : [...(pick.traits || []), t].slice(0, 2);
                onChange({ ...pick, traits });
              }}
              className={`relative text-[10px] px-1 py-1 rounded border transition-colors min-h-[2rem] flex flex-col items-center justify-center gap-0.5 ${
                selected
                  ? 'bg-sky-900/60 border-sky-500 text-sky-100'
                  : usedElsewhere
                    ? 'bg-dh-inset/50 border-dh-border/60 text-dh-muted cursor-not-allowed opacity-80'
                    : 'bg-dh-raised border-dh-border text-dh-muted hover:border-sky-600'
              }`}
            >
              <span className="leading-tight text-center font-medium">{TRAIT_LABELS[t] || t}</span>
              {badgeLevel != null ? (
                <span className="text-[9px] font-bold tabular-nums text-sky-300/90 leading-none">L{badgeLevel}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  if (pick.type === 'experience') {
    const expList = experiences.filter((e) => e.id);
    const expOpts = [null, ...expList.map((e) => e.id)];
    return (
      <div className="mt-1 flex flex-wrap gap-2 items-center">
        <CustomSelect
          value={pick.experienceIds?.[0] ?? null}
          onChange={(id) => {
            const b = pick.experienceIds?.[1];
            if (b && id === b) return;
            onChange({ ...pick, experienceIds: [id, pick.experienceIds?.[1] ?? null] });
          }}
          options={expOpts}
          getOptionKey={(id) => id ?? '__e1__'}
          getOptionLabel={(id) => {
            if (!id) return 'Experience +1 (first)…';
            return experiences.find((e) => e.id === id)?.name || id;
          }}
          placeholder="First experience…"
          className="text-xs min-w-[10rem] flex-1 sm:max-w-[14rem]"
          disabled={readOnly}
        />
        <CustomSelect
          value={pick.experienceIds?.[1] ?? null}
          onChange={(id) => {
            const a = pick.experienceIds?.[0];
            if (a && id === a) return;
            onChange({ ...pick, experienceIds: [pick.experienceIds?.[0] ?? null, id] });
          }}
          options={expOpts.filter((id) => id !== pick.experienceIds?.[0])}
          getOptionKey={(id) => id ?? '__e2__'}
          getOptionLabel={(id) => {
            if (!id) return 'Experience +1 (second, distinct)…';
            return experiences.find((e) => e.id === id)?.name || id;
          }}
          placeholder="Second experience…"
          className="text-xs min-w-[10rem] flex-1 sm:max-w-[14rem]"
          disabled={readOnly}
        />
      </div>
    );
  }

  if (pick.type === 'domain_card') {
    const selectedId = pick.abilityId || null;
    return (
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <CustomSelect
          value={selectedId}
          onChange={(id) => onChange({ ...pick, abilityId: id || undefined })}
          disabled={readOnly}
          options={domainAbilityOptions
            .filter((a) => !allSelectedDomainCardIds.has(a.id) || a.id === selectedId)
            .map((a) => a.id)}
          getOptionKey={(id) => id}
          getOptionLabel={(id) => {
            const a = abilitiesById?.[id];
            return a ? `${a.name} (Lvl ${a.level}, ${a.domain})` : id;
          }}
          getOptionDescription={(id) => abilitiesById?.[id]?.description}
          placeholder="Select a domain card..."
          className="text-sm min-w-[12rem] flex-1 sm:max-w-md"
        />
      </div>
    );
  }

  return null;
}
