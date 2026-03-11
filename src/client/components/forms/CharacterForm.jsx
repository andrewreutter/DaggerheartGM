import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Shield, Swords, Star } from 'lucide-react';
import { FormRow } from './FormRow.jsx';
import { CustomSelect } from './CustomSelect.jsx';
import { useCharacterSrdData } from '../../lib/useCharacterSrdData.js';
import {
  recomputeCharacter, tierFromLevel, TRAIT_KEYS, TRAIT_POOL,
  resolveWeapon, resolveArmor, parseArmorThresholds,
} from '../../lib/character-calc.js';
import { generateId } from '../../lib/helpers.js';

const TRAIT_LABELS = {
  agility: 'Agility', strength: 'Strength', finesse: 'Finesse',
  instinct: 'Instinct', presence: 'Presence', knowledge: 'Knowledge',
};

const TRAIT_ABBREV = {
  agility: 'AGI', strength: 'STR', finesse: 'FIN',
  instinct: 'INS', presence: 'PRE', knowledge: 'KNO',
};

const TRAIT_KEYS_ORDER = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge'];

function highestTraitNames(traits) {
  if (!traits) return [];
  let max = -Infinity;
  for (const k of TRAIT_KEYS_ORDER) {
    const v = traits[k] ?? 0;
    if (v > max) max = v;
  }
  if (max === -Infinity) return [];
  return TRAIT_KEYS_ORDER.filter(k => (traits[k] ?? 0) === max);
}

function WeaponOption({ weapon, isRecommended, showBurden }) {
  const featureNames = (weapon.features || []).map(f => f.name).filter(Boolean);
  return (
    <div className="flex items-center gap-1.5 w-full min-w-0">
      {isRecommended && <Star size={10} className="text-emerald-400 shrink-0 fill-emerald-400" />}
      <span className={`font-medium truncate ${isRecommended ? 'text-emerald-100' : ''}`}>{weapon.name}</span>
      <span className={`text-[10px] rounded px-1 py-0.5 border shrink-0 font-semibold ${
        isRecommended ? 'bg-emerald-900/60 border-emerald-600/60 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-400'
      }`}>{weapon.trait}</span>
      <span className="text-[11px] text-yellow-300/80 tabular-nums shrink-0">{weapon.damage}</span>
      <span className="text-[11px] text-slate-500 shrink-0">{weapon.range}</span>
      {featureNames.length > 0 && featureNames.map(fn => (
        <span key={fn} className="text-[9px] rounded px-1 py-0.5 bg-violet-900/50 border border-violet-700/50 text-violet-300 shrink-0">{fn}</span>
      ))}
      {showBurden && (
        <span className={`text-[9px] shrink-0 ${weapon.burden === 'Two-Handed' ? 'text-amber-400' : 'text-slate-600'}`}>
          {weapon.burden === 'Two-Handed' ? '2H' : '1H'}
        </span>
      )}
    </div>
  );
}

function WeaponValueChip({ weapon, isRecommended, showBurden }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="font-medium text-sm truncate">{weapon.name}</span>
      <span className={`text-[10px] rounded px-1 py-0.5 border shrink-0 font-semibold ${
        isRecommended ? 'bg-emerald-900/60 border-emerald-600/60 text-emerald-200' : 'bg-sky-900/60 border-sky-700/50 text-sky-200'
      }`}>{weapon.trait}</span>
      {showBurden && weapon.burden === 'Two-Handed' && (
        <span className="text-[10px] text-amber-400 shrink-0">2H</span>
      )}
    </div>
  );
}

function WeaponSelect({ value, onChange, weapons, traits, placeholder, disabled, showBurden }) {
  const best = highestTraitNames(traits);
  const sorted = useMemo(() => {
    const copy = [...weapons];
    copy.sort((a, b) => {
      const aMatch = best.includes((a.trait || '').toLowerCase()) ? 0 : 1;
      const bMatch = best.includes((b.trait || '').toLowerCase()) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [weapons, best]);

  const isRec = useCallback(w => best.includes((w?.trait || '').toLowerCase()), [best]);

  const weaponById = useMemo(() => {
    const map = {};
    for (const w of weapons) map[w.id] = w;
    return map;
  }, [weapons]);

  const getWeaponDescription = useCallback((id) => {
    const w = weaponById[id];
    if (!w?.features?.length) return undefined;
    return w.features
      .filter(f => f.name && f.description)
      .map(f => `${f.name}: ${f.description}`)
      .join('\n\n') || undefined;
  }, [weaponById]);

  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={sorted.map(w => w.id)}
      getOptionKey={id => id}
      getOptionLabel={id => weaponById[id]?.name || id}
      getOptionDescription={getWeaponDescription}
      renderOption={(id) => {
        const w = weaponById[id];
        return w ? <WeaponOption weapon={w} isRecommended={isRec(w)} showBurden={showBurden} /> : id;
      }}
      renderValue={(id) => {
        const w = weaponById[id];
        return w ? <WeaponValueChip weapon={w} isRecommended={isRec(w)} showBurden={showBurden} /> : id;
      }}
      placeholder={placeholder}
      disabled={disabled}
      dropdownClassName="min-w-[340px]"
    />
  );
}

/**
 * Parse a suggested_traits string like "0, -1, +1, 0, +2, +1" into a baseTraits map.
 */
function parseSuggestedTraits(str) {
  if (!str) return null;
  const parts = str.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 6 || parts.some(isNaN)) return null;
  const result = {};
  TRAIT_KEYS_ORDER.forEach((k, i) => { result[k] = parts[i]; });
  return result;
}

/** Minimum domain card slots to always show when a class is selected. */
const MIN_DOMAIN_CARD_SLOTS = 2;

const ADVANCEMENT_TYPES = [
  { value: 'traits', label: '+1 to two Traits' },
  { value: 'hp', label: '+1 Max HP' },
  { value: 'stress', label: '+1 Max Stress' },
  { value: 'evasion', label: '+1 Evasion' },
  { value: 'experience', label: '+1 Experience' },
  { value: 'proficiency', label: '+1 Proficiency (×2 cost)', doubleCost: true },
  { value: 'domain_card', label: 'Extra Domain Card' },
  { value: 'subclass_upgrade', label: 'Subclass Upgrade' },
];

/**
 * Controlled-mode character builder form.
 * Props: value (full formData) + onChange(newFormData)
 */
export function CharacterForm({ value, onChange }) {
  const { srdData, loading: srdLoading } = useCharacterSrdData();
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: '', pronouns: '', description: '', level: 1,
    classId: null, subclassId: null, ancestryIds: [], communityId: null,
    baseTraits: {}, armorId: null, primaryWeaponId: null, secondaryWeaponId: null,
    experiences: [{ name: '', score: 2, id: generateId() }, { name: '', score: 2, id: generateId() }],
    abilityIds: [], advancements: {}, background: '', connectionText: '',
  });

  const formData = isControlled ? value : localData;

  const update = (newData) => {
    const recomputed = srdData ? recomputeCharacter(newData, srdData) : newData;
    if (isControlled) {
      onChange(recomputed);
    } else {
      setLocalData(recomputed);
    }
  };

  const set = (patch) => update({ ...formData, ...patch });

  // When SRD data first loads, recompute so derived stats (evasion, traits, etc.)
  // reflect current equipment even if the DB record predates armor/weapon feature automation.
  const initialRecomputeDone = useRef(false);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  useEffect(() => {
    if (!srdData || initialRecomputeDone.current) return;
    initialRecomputeDone.current = true;
    const recomputed = recomputeCharacter(formDataRef.current, srdData);
    if (isControlled) {
      onChange(recomputed);
    } else {
      setLocalData(recomputed);
    }
  }, [srdData]); // eslint-disable-line react-hooks/exhaustive-deps

  const level = formData.level ?? 1;
  const tier = tierFromLevel(level);

  // Class options
  const classOptions = useMemo(() => (srdData?.classes || []).sort((a, b) => a.name.localeCompare(b.name)), [srdData]);
  const selectedClass = srdData?.classesById?.[formData.classId] || null;

  // Subclass options filtered by selected class
  const subclassOptions = useMemo(() => {
    if (!selectedClass || !srdData) return [];
    const subNames = selectedClass.subclasses || [];
    return (srdData.subclasses || []).filter(sc => subNames.includes(sc.name));
  }, [selectedClass, srdData]);
  const selectedSubclass = srdData?.subclassesById?.[formData.subclassId] || null;

  // Ancestry options
  const ancestryOptions = useMemo(() => (srdData?.ancestries || []).sort((a, b) => a.name.localeCompare(b.name)), [srdData]);

  // Community options
  const communityOptions = useMemo(() => (srdData?.communities || []).sort((a, b) => a.name.localeCompare(b.name)), [srdData]);

  // Armor options filtered by tier
  const armorOptions = useMemo(() => {
    if (!srdData) return [];
    return (srdData.armor || []).filter(a => (a.tier || 1) <= tier).sort((a, b) => a.name.localeCompare(b.name));
  }, [srdData, tier]);

  // Weapon options filtered by tier
  const weaponOptions = useMemo(() => {
    if (!srdData) return [];
    return (srdData.weapons || []).filter(w => (w.tier || 1) <= tier).sort((a, b) => a.name.localeCompare(b.name));
  }, [srdData, tier]);

  // Domain card options filtered by class domains and level
  const abilityOptions = useMemo(() => {
    if (!srdData || !selectedClass) return [];
    const domains = selectedClass.domains || [];
    return (srdData.abilities || [])
      .filter(a => domains.includes(a.domain) && (a.level || 1) <= level)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [srdData, selectedClass, level]);

  // All currently selected domain card IDs across all slots (base + advancements)
  const allSelectedDomainCardIds = useMemo(() => {
    const ids = new Set();
    for (const id of (formData.abilityIds || [])) {
      if (id) ids.add(id);
    }
    for (const adv of Object.values(formData.advancements || {})) {
      if (adv.domainCardId) ids.add(adv.domainCardId);
    }
    return ids;
  }, [formData.abilityIds, formData.advancements]);

  // Trait assignment
  const baseTraits = formData.baseTraits || {};
  const assignedValues = TRAIT_KEYS.map(k => baseTraits[k]).filter(v => v != null);
  const availablePool = [...TRAIT_POOL];
  for (const v of assignedValues) {
    const idx = availablePool.indexOf(v);
    if (idx >= 0) availablePool.splice(idx, 1);
  }

  // Advancement sections state
  const [openAdvancements, setOpenAdvancements] = useState({});

  if (srdLoading) {
    return <div className="p-4 text-slate-400 text-sm">Loading SRD data...</div>;
  }

  return (
    <div className="space-y-5 p-1">
      {/* ── Name and Identity ── */}
      <FormRow label="Name">
        <input
          type="text"
          value={formData.name || ''}
          onChange={e => set({ name: e.target.value })}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
          placeholder="Character name"
        />
      </FormRow>

      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Pronouns">
          <input
            type="text"
            value={formData.pronouns || ''}
            onChange={e => set({ pronouns: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none"
            placeholder="they/them"
          />
        </FormRow>
        <FormRow label="Level">
          <div className="flex items-center gap-2">
            <CustomSelect
              value={level}
              onChange={n => set({ level: n })}
              options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              getOptionKey={n => String(n)}
              getOptionLabel={n => String(n)}
              className="w-20"
            />
            <span className="text-[10px] font-bold text-sky-400/70 bg-sky-900/50 border border-sky-800/50 rounded px-1.5 py-0.5">T{tier}</span>
          </div>
        </FormRow>
      </div>

      <FormRow label="Description">
        <textarea
          value={formData.description || ''}
          onChange={e => set({ description: e.target.value })}
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none resize-y"
          placeholder="A brief description..."
        />
      </FormRow>

      {/* ── Class ── */}
      <FormRow label="Class">
        <CustomSelect
          value={formData.classId || null}
          onChange={newClassId => {
            const newClass = newClassId ? srdData?.classesById?.[newClassId] : null;
            const suggestedTraits = newClass ? parseSuggestedTraits(newClass.suggested_traits) : null;
            const patch = { classId: newClassId, subclassId: null, abilityIds: [null, null] };
            if (suggestedTraits) patch.baseTraits = suggestedTraits;
            set(patch);
          }}
          options={classOptions.map(c => c.id)}
          getOptionKey={id => id}
          getOptionLabel={id => srdData?.classesById?.[id]?.name || id}
          getOptionDescription={id => srdData?.classesById?.[id]?.description}
          placeholder="Select a class..."
        />
        {selectedClass && (
          <div className="mt-1 text-[11px] text-slate-400 space-y-0.5">
            <div>
              Domains: <span className="text-violet-300">{(selectedClass.domains || []).join(', ')}</span>
              {' · '}
              Starting HP: <span className="text-red-300">{selectedClass.starting_hp}</span>
              {' · '}
              Evasion: <span className="text-cyan-300">{selectedClass.starting_evasion}</span>
              {selectedClass.hope_feature && (
                <>
                  {' · '}
                  Hope: <span className="text-amber-300">{selectedClass.hope_feature.name}</span>
                </>
              )}
            </div>
            {selectedClass.suggested_traits && (
              <div className="text-sky-400/60">Suggested traits applied — adjust below if desired</div>
            )}
          </div>
        )}
      </FormRow>

      {/* ── Subclass ── */}
      <FormRow label="Subclass">
        <CustomSelect
          value={formData.subclassId || null}
          onChange={id => set({ subclassId: id })}
          options={subclassOptions.map(sc => sc.id)}
          getOptionKey={id => id}
          getOptionLabel={id => srdData?.subclassesById?.[id]?.name || id}
          getOptionDescription={id => srdData?.subclassesById?.[id]?.description}
          placeholder={selectedClass ? 'Select a subclass...' : 'Select a class first'}
          disabled={!selectedClass}
        />
        {selectedSubclass?.spellcast_trait && (
          <div className="mt-1 text-[11px] text-slate-400">
            Spellcast trait: <span className="text-sky-300">{selectedSubclass.spellcast_trait}</span>
          </div>
        )}
      </FormRow>

      {/* ── Ancestry ── */}
      <FormRow label="Ancestry">
        <CustomSelect
          value={formData.ancestryIds?.[0] || null}
          onChange={id => set({ ancestryIds: id ? [id] : [] })}
          options={ancestryOptions.map(a => a.id)}
          getOptionKey={id => id}
          getOptionLabel={id => srdData?.ancestriesById?.[id]?.name || id}
          getOptionDescription={id => srdData?.ancestriesById?.[id]?.description}
          placeholder="Select an ancestry..."
        />
      </FormRow>

      {/* ── Community ── */}
      <FormRow label="Community">
        <CustomSelect
          value={formData.communityId || null}
          onChange={id => set({ communityId: id })}
          options={communityOptions.map(c => c.id)}
          getOptionKey={id => id}
          getOptionLabel={id => srdData?.communitiesById?.[id]?.name || id}
          getOptionDescription={id => srdData?.communitiesById?.[id]?.description}
          placeholder="Select a community..."
        />
      </FormRow>

      {/* ── Traits ── */}
      <FormRow label="Traits">
        <div className="grid grid-cols-3 gap-2">
          {TRAIT_KEYS.map(trait => {
            const currentVal = baseTraits[trait];
            const isAssigned = currentVal != null;
            const numericOptions = isAssigned
              ? [...new Set([currentVal, ...availablePool])].sort((a, b) => b - a)
              : availablePool.filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => b - a);
            const traitOptions = [null, ...numericOptions];

            return (
              <div key={trait} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-20">{TRAIT_LABELS[trait]}</span>
                <CustomSelect
                  value={isAssigned ? currentVal : null}
                  onChange={v => {
                    const newBaseTraits = { ...baseTraits };
                    if (v == null) {
                      delete newBaseTraits[trait];
                    } else {
                      newBaseTraits[trait] = v;
                    }
                    set({ baseTraits: newBaseTraits });
                  }}
                  options={traitOptions}
                  getOptionKey={v => v == null ? '__none__' : String(v)}
                  getOptionLabel={v => v == null ? '—' : (v > 0 ? `+${v}` : String(v))}
                  placeholder="—"
                  className="flex-1"
                />
                {formData.traits?.[trait] != null && formData.traits[trait] !== (baseTraits[trait] ?? 0) && (
                  <span className="text-[10px] text-sky-400">→ {formData.traits[trait] > 0 ? '+' : ''}{formData.traits[trait]}</span>
                )}
              </div>
            );
          })}
        </div>
      </FormRow>

      {/* ── Equipment: Armor ── */}
      <FormRow label="Armor">
        <CustomSelect
          value={formData.armorId || null}
          onChange={id => set({ armorId: id })}
          options={[null, ...armorOptions.map(a => a.id)]}
          getOptionKey={id => id || '__none__'}
          getOptionLabel={id => {
            if (!id) return 'No armor';
            const a = srdData?.armorById?.[id];
            if (!a) return id;
            const feat = a.features?.[0];
            const base = `${a.name} (Score ${a.base_score}, ${a.base_thresholds})`;
            return feat ? `${base} — ${feat.name}: ${feat.description}` : base;
          }}
          placeholder="No armor"
        />
      </FormRow>

      {/* ── Equipment: Weapons ── */}
      {(() => {
        const selectedPrimary = srdData?.weaponsById?.[formData.primaryWeaponId];
        const isTwoHanded = selectedPrimary?.burden === 'Two-Handed';
        return (
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Primary Weapon">
              <WeaponSelect
                value={formData.primaryWeaponId || null}
                onChange={newId => {
                  const newWeapon = newId ? srdData?.weaponsById?.[newId] : null;
                  const patch = { primaryWeaponId: newId };
                  if (newWeapon?.burden === 'Two-Handed') patch.secondaryWeaponId = null;
                  set(patch);
                }}
                weapons={weaponOptions.filter(w => w.primary_or_secondary !== 'Secondary')}
                traits={formData.traits}
                placeholder="Select primary..."
                showBurden
              />
            </FormRow>
            <FormRow label="Secondary Weapon">
              <WeaponSelect
                value={formData.secondaryWeaponId || null}
                onChange={newId => set({ secondaryWeaponId: newId })}
                weapons={isTwoHanded ? [] : weaponOptions.filter(w => w.primary_or_secondary !== 'Primary')}
                traits={formData.traits}
                placeholder={isTwoHanded ? 'N/A (two-handed)' : 'Select secondary...'}
                disabled={isTwoHanded}
              />
              {isTwoHanded && (
                <div className="mt-1 text-[10px] text-slate-500">Two-handed primary uses both hands</div>
              )}
            </FormRow>
          </div>
        );
      })()}

      {/* ── Experiences ── */}
      <FormRow label="Experiences">
        <div className="space-y-1.5">
          {(formData.experiences || []).map((exp, i) => (
            <div key={exp.id || i} className="flex items-center gap-2">
              <input
                type="text"
                value={exp.name || ''}
                onChange={e => {
                  const exps = [...(formData.experiences || [])];
                  exps[i] = { ...exps[i], name: e.target.value };
                  set({ experiences: exps });
                }}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:border-sky-500 focus:outline-none"
                placeholder="Experience name"
              />
              <span className="text-sm font-bold text-sky-400 tabular-nums w-8 text-center shrink-0">
                +{exp.score ?? 2}
              </span>
              <button
                onClick={() => {
                  const exps = (formData.experiences || []).filter((_, j) => j !== i);
                  set({ experiences: exps });
                }}
                className="text-slate-500 hover:text-red-400 text-sm"
              >×</button>
            </div>
          ))}
          <button
            onClick={() => set({ experiences: [...(formData.experiences || []), { name: '', score: 2, id: generateId() }] })}
            className="text-xs text-sky-400 hover:text-sky-300"
          >+ Add Experience</button>
        </div>
      </FormRow>

      {/* ── Domain Cards ── */}
      {selectedClass && (
        <FormRow label="Domain Cards">
          <div className="space-y-1.5">
            {(() => {
              // Always show at least MIN_DOMAIN_CARD_SLOTS rows when a class is selected.
              const rawIds = formData.abilityIds || [];
              const displaySlots = [...rawIds];
              while (displaySlots.length < MIN_DOMAIN_CARD_SLOTS) displaySlots.push(null);
              return displaySlots.map((aId, i) => {
                const ability = aId ? srdData?.abilitiesById?.[aId] : null;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <CustomSelect
                      value={aId || null}
                      onChange={id => {
                        const ids = [...displaySlots];
                        ids[i] = id;
                        set({ abilityIds: ids });
                      }}
                      options={[null, ...abilityOptions.filter(a => !allSelectedDomainCardIds.has(a.id) || a.id === aId).map(a => a.id)]}
                      getOptionKey={id => id || '__none__'}
                      getOptionLabel={id => {
                        if (!id) return 'Select a card...';
                        const a = srdData?.abilitiesById?.[id];
                        return a ? `${a.name} (Lvl ${a.level}, ${a.domain})` : id;
                      }}
                      getOptionDescription={id => {
                        if (!id) return undefined;
                        return srdData?.abilitiesById?.[id]?.description;
                      }}
                      placeholder="Select a card..."
                      className="flex-1"
                    />
                    {ability && (
                      <span className="text-[10px] text-slate-500 shrink-0">{ability.type}</span>
                    )}
                    {displaySlots.length > MIN_DOMAIN_CARD_SLOTS && (
                      <button
                        onClick={() => {
                          const ids = displaySlots.filter((_, j) => j !== i);
                          set({ abilityIds: ids });
                        }}
                        className="text-slate-500 hover:text-red-400 text-sm"
                      >×</button>
                    )}
                  </div>
                );
              });
            })()}
            <button
              onClick={() => {
                const rawIds = formData.abilityIds || [];
                const displaySlots = [...rawIds];
                while (displaySlots.length < MIN_DOMAIN_CARD_SLOTS) displaySlots.push(null);
                set({ abilityIds: [...displaySlots, null] });
              }}
              className="text-xs text-sky-400 hover:text-sky-300"
            >+ Add Domain Card</button>
          </div>
        </FormRow>
      )}

      {/* ── Advancements (level >= 2) ── */}
      {level >= 2 && (
        <FormRow label="Advancements">
          <div className="space-y-1">
            {Array.from({ length: level - 1 }, (_, i) => i + 2).map(lvl => {
              const isTierAchievement = TIER_ACHIEVEMENT_LEVELS.includes(lvl);
              const advKey = String(lvl);
              const adv = (formData.advancements || {})[advKey] || { picks: [] };
              const isOpen = openAdvancements[advKey] ?? false;

              return (
                <div key={lvl} className="border border-slate-700 rounded bg-slate-800/40 overflow-hidden">
                  <button
                    onClick={() => setOpenAdvancements(prev => ({ ...prev, [advKey]: !isOpen }))}
                    className="w-full px-2 py-1.5 flex items-center gap-2 hover:bg-slate-700/40 transition-colors text-left"
                  >
                    {isOpen ? <ChevronDown size={11} className="text-slate-500" /> : <ChevronRight size={11} className="text-slate-500" />}
                    <span className="text-xs font-semibold text-slate-300">Level {lvl}</span>
                    {isTierAchievement && (
                      <span className="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-800/50 rounded px-1">Tier Achievement</span>
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">{(adv.picks || []).length} pick{(adv.picks || []).length !== 1 ? 's' : ''}</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-2 border-t border-slate-700">
                      {/* Pick 1 */}
                      <AdvancementPick
                        label="Pick 1"
                        pick={(adv.picks || [])[0]}
                        onChange={pick => {
                          const picks = [...(adv.picks || [])];
                          picks[0] = pick;
                          const newAdvs = { ...(formData.advancements || {}), [advKey]: { ...adv, picks } };
                          set({ advancements: newAdvs });
                        }}
                        tier={tierFromLevel(lvl)}
                      />
                      {/* Pick 2 */}
                      <AdvancementPick
                        label="Pick 2"
                        pick={(adv.picks || [])[1]}
                        onChange={pick => {
                          const picks = [...(adv.picks || [])];
                          picks[1] = pick;
                          const newAdvs = { ...(formData.advancements || {}), [advKey]: { ...adv, picks } };
                          set({ advancements: newAdvs });
                        }}
                        tier={tierFromLevel(lvl)}
                      />
                      {/* Domain card for this level */}
                      <div className="mt-1">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Domain Card</label>
                        <CustomSelect
                          value={adv.domainCardId || null}
                          onChange={id => {
                            const newAdvs = { ...(formData.advancements || {}), [advKey]: { ...adv, domainCardId: id } };
                            set({ advancements: newAdvs });
                          }}
                          options={[null, ...abilityOptions.filter(a => !allSelectedDomainCardIds.has(a.id) || a.id === adv.domainCardId).map(a => a.id)]}
                          getOptionKey={id => id || '__none__'}
                          getOptionLabel={id => {
                            if (!id) return 'None';
                            const a = srdData?.abilitiesById?.[id];
                            return a ? `${a.name} (Lvl ${a.level}, ${a.domain})` : id;
                          }}
                          getOptionDescription={id => {
                            if (!id) return undefined;
                            return srdData?.abilitiesById?.[id]?.description;
                          }}
                          placeholder="None"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FormRow>
      )}

      {/* ── Background and Connections ── */}
      <FormRow label="Background">
        <textarea
          value={formData.background || ''}
          onChange={e => set({ background: e.target.value })}
          rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none resize-y"
          placeholder="Character background..."
        />
      </FormRow>
      <FormRow label="Connections">
        <textarea
          value={formData.connectionText || ''}
          onChange={e => set({ connectionText: e.target.value })}
          rows={2}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none resize-y"
          placeholder="Connection to other characters..."
        />
      </FormRow>
    </div>
  );
}

const TIER_ACHIEVEMENT_LEVELS = [2, 5, 8];

function AdvancementPick({ label, pick, onChange, tier }) {
  const currentType = pick?.type || null;

  return (
    <div className="mt-1">
      <label className="text-[10px] text-slate-500 block mb-0.5">{label}</label>
      <CustomSelect
        value={currentType}
        onChange={type => {
          if (!type) { onChange(null); return; }
          const newPick = { type };
          if (type === 'traits') newPick.traits = [];
          onChange(newPick);
        }}
        options={[null, ...ADVANCEMENT_TYPES.map(at => at.value)]}
        getOptionKey={v => v || '__none__'}
        getOptionLabel={v => {
          if (!v) return 'Select advancement...';
          const at = ADVANCEMENT_TYPES.find(t => t.value === v);
          return at ? at.label : v;
        }}
        placeholder="Select advancement..."
      />
      {currentType === 'traits' && pick && (
        <div className="mt-1 flex flex-wrap gap-1">
          {TRAIT_KEYS.map(t => {
            const selected = (pick.traits || []).includes(t);
            const canSelect = selected || (pick.traits || []).length < 2;
            return (
              <button
                key={t}
                onClick={() => {
                  const traits = selected
                    ? (pick.traits || []).filter(x => x !== t)
                    : [...(pick.traits || []), t].slice(0, 2);
                  onChange({ ...pick, traits });
                }}
                disabled={!canSelect && !selected}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  selected
                    ? 'bg-sky-900/60 border-sky-600 text-sky-200'
                    : canSelect
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-sky-600'
                      : 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                }`}
              >
                {TRAIT_LABELS[t]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
