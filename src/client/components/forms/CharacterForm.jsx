import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Loader2, Shield, Swords, Star } from 'lucide-react';
import { FormRow } from './FormRow.jsx';
import { CustomSelect } from './CustomSelect.jsx';
import { GuideFeatureCard } from '../features/GuideFeatureCard.jsx';
import { useCharacterSrdData } from '../../lib/useCharacterSrdData.js';
import {
  recomputeCharacter, tierFromLevel, TRAIT_KEYS, TRAIT_POOL,
  resolveWeapon, resolveArmor, parseArmorThresholds, getEffectiveWeaponRange,
} from '../../lib/character-calc.js';
import { generateId } from '../../lib/helpers.js';
import { getAncestryExperienceBonus } from '../../lib/ancestry-experience-bonus.js';
import { v2ClassSubclassFeatureDescriptorsByName } from '../../lib/v2-class-subclass-feature-descriptors.js';
import { collectEditorCardsForCharacter } from '../../lib/build-feature-card-model.js';
import { DeclarativeSchemaEditorCard } from '../DeclarativeSchemaCard.jsx';
import { CharacterAiConceptStrip } from '../CharacterAiConceptStrip.jsx';

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

function pickRandom(arr) {
  if (!arr?.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function WeaponOption({ weapon, isRecommended, showBurden, ancestryFeatures }) {
  const featureNames = (weapon.features || []).map(f => f.name).filter(Boolean);
  const displayRange = getEffectiveWeaponRange(weapon, ancestryFeatures) || weapon.range;
  return (
    <div className="flex items-center gap-1.5 w-full min-w-0">
      {isRecommended && <Star size={10} className="text-emerald-400 shrink-0 fill-emerald-400" />}
      <span className={`font-medium truncate ${isRecommended ? 'text-emerald-100' : ''}`}>{weapon.name}</span>
      <span className={`text-[10px] rounded px-1 py-0.5 border shrink-0 font-semibold ${
        isRecommended ? 'bg-emerald-900/60 border-emerald-600/60 text-emerald-200' : 'bg-dh-raised border-dh-border text-dh-muted'
      }`}>{weapon.trait}</span>
      <span className="text-[11px] text-dh font-semibold tabular-nums shrink-0">{weapon.damage}</span>
      {displayRange && <span className="text-[11px] text-dh-muted shrink-0">{displayRange}</span>}
      {featureNames.length > 0 && featureNames.map(fn => (
        <span key={fn} className="text-[9px] rounded px-1 py-0.5 bg-violet-900/50 border border-violet-700/50 text-violet-300 shrink-0">{fn}</span>
      ))}
      {showBurden && (
        <span className={`text-[9px] shrink-0 ${weapon.burden === 'Two-Handed' ? 'text-amber-400' : 'text-dh-muted'}`}>
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

const WEAPON_SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'range', label: 'Range' },
  { value: 'feature', label: 'Feature' },
];

// Range band order for sort (Melee first → Very Far last); matches map-range bands
const RANGE_BAND_ORDER = { melee: 0, 'very close': 1, close: 2, far: 3, 'very far': 4 };
function weaponRangeOrder(weapon, ancestryFeatures) {
  const rangeStr = (getEffectiveWeaponRange(weapon, ancestryFeatures) || weapon.range || '').trim().toLowerCase();
  return RANGE_BAND_ORDER[rangeStr] ?? 999;
}

function WeaponSelect({ value, onChange, weapons, traits, placeholder, disabled, showBurden, ancestryFeatures, sortOrder = 'name', groupTraitOptimized = true }) {
  const best = highestTraitNames(traits);
  const sorted = useMemo(() => {
    const copy = [...weapons];
    const compare = (a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      if (sortOrder === 'range') {
        const oa = weaponRangeOrder(a, ancestryFeatures);
        const ob = weaponRangeOrder(b, ancestryFeatures);
        return oa !== ob ? oa - ob : a.name.localeCompare(b.name);
      }
      if (sortOrder === 'feature') {
        const fa = (a.features?.[0]?.name || '').localeCompare(b.features?.[0]?.name || '');
        return fa !== 0 ? fa : a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    };
    if (groupTraitOptimized) {
      const optimized = copy.filter(w => best.includes((w.trait || '').toLowerCase()));
      const rest = copy.filter(w => !best.includes((w.trait || '').toLowerCase()));
      optimized.sort(compare);
      rest.sort(compare);
      return [...optimized, ...rest];
    }
    copy.sort(compare);
    return copy;
  }, [weapons, best, sortOrder, groupTraitOptimized, ancestryFeatures]);

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
        return w ? <WeaponOption weapon={w} isRecommended={isRec(w)} showBurden={showBurden} ancestryFeatures={ancestryFeatures} /> : id;
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

/**
 * Rich markdown for CustomSelect hover tooltips: mechanical summary first, then full SRD text.
 * Base evasion and starting HP come from the class row (`computeEvasion` / `computeMaxHp` in character-calc).
 */
function composeOptionTooltip(statsMarkdown, description) {
  const stats = (statsMarkdown || '').trim();
  const body = (description || '').trim();
  if (!stats && !body) return undefined;
  if (!stats) return body;
  if (!body) return stats;
  return `${stats}\n\n---\n\n${body}`;
}

function classStatsMarkdown(c) {
  if (!c) return '';
  const lines = [];
  const hp = c.starting_hp != null ? c.starting_hp : '—';
  const eva = c.starting_evasion != null ? c.starting_evasion : '—';
  lines.push(`**Starting HP:** ${hp} · **Base evasion:** ${eva}`);
  const doms = (c.domains || []).filter(Boolean);
  if (doms.length) lines.push(`**Domains:** ${doms.join(', ')}`);
  if (c.hope_feature?.name) {
    const hf = c.hope_feature;
    let block = `**Hope feature:** ${hf.name}`;
    if (hf.description?.trim()) block += `\n\n${hf.description.trim()}`;
    lines.push(block);
  }
  if (c.class_items?.trim()) lines.push(`**Class items:** ${c.class_items.trim()}`);
  if (c.suggested_traits?.trim()) lines.push(`**Suggested trait spread:** \`${c.suggested_traits.trim()}\``);
  return lines.join('\n\n');
}

function subclassStatsMarkdown(sc) {
  if (!sc) return '';
  const lines = [];
  if (sc.spellcast_trait) lines.push(`**Spellcast trait:** ${sc.spellcast_trait}`);
  const foundation = (sc.foundation_features || []).map((f) => f.name).filter(Boolean);
  if (foundation.length) lines.push(`**Foundation features:** ${foundation.join(', ')}`);
  return lines.join('\n\n');
}

function ancestryStatsMarkdown(a) {
  if (!a) return '';
  const lines = [];
  const bonus = getAncestryExperienceBonus(a.name);
  if (bonus) {
    lines.push(
      `**Creation bonus:** +${bonus.amount} to one experience's score (via **${bonus.featureName}**)`,
    );
  }
  const featNames = (a.features || []).map((f) => f.name).filter(Boolean);
  if (featNames.length) lines.push(`**Ancestry features:** ${featNames.join(', ')}`);
  return lines.join('\n\n');
}

function communityStatsMarkdown(c) {
  if (!c) return '';
  const lines = [];
  if (c.traits?.trim()) lines.push(`**Trait guidance:** ${c.traits.trim()}`);
  const featNames = (c.features || []).map((f) => f.name).filter(Boolean);
  if (featNames.length) lines.push(`**Community features:** ${featNames.join(', ')}`);
  return lines.join('\n\n');
}

/** Minimal form for `recomputeCharacter` when previewing SRD options in dropdown tooltips. */
function buildMinimalPreviewForm(overrides = {}) {
  return {
    name: '',
    pronouns: '',
    description: '',
    level: 1,
    classId: null,
    subclassId: null,
    ancestryIds: [],
    communityId: null,
    baseTraits: {},
    armorId: null,
    primaryWeaponId: null,
    secondaryWeaponId: null,
    experiences: [{ name: '', score: 2, id: 'preview-exp-stub' }],
    abilityIds: [null, null],
    advancements: {},
    background: '',
    connectionText: '',
    companion: null,
    ...overrides,
  };
}

const PREVIEW_EL_STUB = { instanceId: null, elementType: 'character', name: '' };

function SrdPreviewFeatureCards({ rows }) {
  if (!rows?.length) return null;
  return (
    <div className="mt-2 space-y-1.5 border-t border-dh-border/80 pt-2">
      <div className="text-[10px] font-semibold text-dh-muted uppercase tracking-wide">Features</div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <GuideFeatureCard
            key={row.id || `${row.name}-${row.type}-${i}`}
            featRow={row}
            featureKey={row.id || `preview-${row.name}-${i}`}
            el={PREVIEW_EL_STUB}
            open
            onToggle={() => {}}
            interactionMode="preview"
          />
        ))}
      </div>
    </div>
  );
}

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
 * Props: value (full formData) + onChange(newFormData); optional onAiBusyChange(busy) for modal close guards.
 * Optional autoRunAiConcept: when set (e.g. Game Table opened editor with a pending concept), runs one AI build like the strip.
 */
export function CharacterForm({
  value,
  onChange,
  onAiBusyChange,
  autoRunAiConcept,
  onAutoRunAiConceptConsumed,
  autoRunSessionKey = '',
}) {
  const { srdData, loading: srdLoading } = useCharacterSrdData();
  const isControlled = value !== undefined;

  const [localData, setLocalData] = useState({
    name: '', pronouns: '', description: '', level: 1,
    classId: null, subclassId: null, ancestryIds: [], communityId: null,
    baseTraits: {}, armorId: null, primaryWeaponId: null, secondaryWeaponId: null,
    experiences: [{ name: '', score: 2, id: generateId() }, { name: '', score: 2, id: generateId() }],
    abilityIds: [], advancements: {}, background: '', connectionText: '', companion: null,
  });
  const [weaponSortOrder, setWeaponSortOrder] = useState('name');
  const [weaponGroupTraitOptimized, setWeaponGroupTraitOptimized] = useState(true);

  const [aiBusy, setAiBusy] = useState(false);
  const aiStripRef = useRef(null);

  const formData = isControlled ? value : localData;
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const previewRowsCacheRef = useRef({ srd: null, map: new Map() });
  if (previewRowsCacheRef.current.srd !== srdData) {
    previewRowsCacheRef.current = { srd: srdData, map: new Map() };
  }

  const renderClassTooltipExtra = useCallback(
    (classId) => {
      if (!srdData || !classId) return null;
      const map = previewRowsCacheRef.current.map;
      const k = `class:${classId}`;
      if (!map.has(k)) {
        const merged = recomputeCharacter(buildMinimalPreviewForm({ classId }), srdData);
        const rows = merged.activeFeatures.filter((f) => f.type === 'class');
        const c = srdData.classesById[classId];
        const full = [...rows];
        if (c?.hope_feature?.name) {
          const hf = c.hope_feature;
          const hooks = v2ClassSubclassFeatureDescriptorsByName[hf.name] || {};
          full.push({
            name: hf.name,
            description: hf.description || '',
            ...hooks,
            type: 'class',
            source: c.name,
            sourceType: 'class',
          });
        }
        map.set(k, full);
      }
      const full = map.get(k);
      return full?.length ? <SrdPreviewFeatureCards rows={full} /> : null;
    },
    [srdData],
  );

  const renderSubclassTooltipExtra = useCallback(
    (subId) => {
      if (!srdData || !subId || !formData.classId) return null;
      const map = previewRowsCacheRef.current.map;
      const lv = formData.level ?? 1;
      const k = `sub:${formData.classId}:${subId}:${lv}`;
      if (!map.has(k)) {
        const merged = recomputeCharacter(
          buildMinimalPreviewForm({ classId: formData.classId, subclassId: subId, level: lv }),
          srdData,
        );
        map.set(k, merged.activeFeatures.filter((f) => f.type === 'subclass'));
      }
      const rows = map.get(k);
      return rows?.length ? <SrdPreviewFeatureCards rows={rows} /> : null;
    },
    [srdData, formData.classId, formData.level],
  );

  const renderAncestryTooltipExtra = useCallback(
    (aId) => {
      if (!srdData || !aId) return null;
      const map = previewRowsCacheRef.current.map;
      const k = `anc:${aId}`;
      if (!map.has(k)) {
        const merged = recomputeCharacter(buildMinimalPreviewForm({ ancestryIds: [aId] }), srdData);
        map.set(k, merged.activeFeatures.filter((f) => f.type === 'ancestry'));
      }
      const rows = map.get(k);
      return rows?.length ? <SrdPreviewFeatureCards rows={rows} /> : null;
    },
    [srdData],
  );

  const renderCommunityTooltipExtra = useCallback(
    (cId) => {
      if (!srdData || !cId) return null;
      const map = previewRowsCacheRef.current.map;
      const k = `com:${cId}`;
      if (!map.has(k)) {
        const merged = recomputeCharacter(buildMinimalPreviewForm({ communityId: cId }), srdData);
        map.set(k, merged.activeFeatures.filter((f) => f.type === 'community'));
      }
      const rows = map.get(k);
      return rows?.length ? <SrdPreviewFeatureCards rows={rows} /> : null;
    },
    [srdData],
  );

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

  const editorCardsAfterSubclass = useMemo(() => {
    if (!srdData) return [];
    return collectEditorCardsForCharacter(formData).filter(
      ({ shape }) => shape?.anchors?.afterSelector === 'subclassId',
    );
  }, [formData, srdData]);

  // Beastbound companion always has at least two experience slots (two blank rows).
  useEffect(() => {
    if (selectedSubclass?.name !== 'Beastbound' || !formData.companion) return;
    const comp = formData.companion;
    const exps = comp.experiences || [];
    if (exps.length >= 2) return;
    const padded = [...exps];
    while (padded.length < 2) padded.push({ name: '', score: 2, id: generateId() });
    update({ ...formData, companion: { ...comp, experiences: padded } });
  }, [selectedSubclass?.name, formData.companion]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleFillOutAutomatically = useCallback(() => {
    const best = highestTraitNames(formData.traits);
    const favored = (w) => best.includes((w.trait || '').toLowerCase());

    const primaryWeapons = weaponOptions.filter(w => w.primary_or_secondary !== 'Secondary');
    const primaryFavored = primaryWeapons.filter(favored);
    const primaryCandidates = primaryFavored.length ? primaryFavored : primaryWeapons;
    const primaryWeapon = pickRandom(primaryCandidates);
    const primaryWeaponId = primaryWeapon?.id ?? null;
    const isTwoHanded = primaryWeapon?.burden === 'Two-Handed';

    let secondaryWeaponId = null;
    if (!isTwoHanded) {
      const secondaryWeapons = weaponOptions.filter(w => w.primary_or_secondary !== 'Primary');
      const secondaryFavored = secondaryWeapons.filter(favored);
      const secondaryCandidates = secondaryFavored.length ? secondaryFavored : secondaryWeapons;
      const secondaryWeapon = pickRandom(secondaryCandidates);
      secondaryWeaponId = secondaryWeapon?.id ?? null;
    }

    const randomArmor = pickRandom(armorOptions);
    const armorId = randomArmor?.id ?? null;

    const domains = selectedClass?.domains || [];
    const byDomain = {};
    for (const a of abilityOptions) {
      const d = a.domain || '';
      if (!byDomain[d]) byDomain[d] = [];
      byDomain[d].push(a);
    }
    const abilityIds = [];
    const used = new Set();
    for (let i = 0; i < 2; i++) {
      const domainName = domains[i];
      const abilities = byDomain[domainName] || [];
      const available = abilities.filter(a => !used.has(a.id));
      const chosen = pickRandom(available);
      if (chosen) used.add(chosen.id);
      abilityIds.push(chosen?.id ?? null);
    }

    const experiences = (formData.experiences || []).map((exp, i) => ({
      ...exp,
      name: `Experience ${i + 1} - choose during play`,
    }));

    const ancestryId = formData.ancestryIds?.[0];
    const ancestryName = ancestryId ? srdData?.ancestriesById?.[ancestryId]?.name : null;
    const expBonus = ancestryName ? getAncestryExperienceBonus(ancestryName) : null;
    let experienceBonusChoices = formData.experienceBonusChoices;
    if (expBonus) {
      const expIds = (formData.experiences || []).map(e => e.id).filter(Boolean);
      const chosenExpId = pickRandom(expIds) ?? expIds[0] ?? null;
      experienceBonusChoices = { ...(formData.experienceBonusChoices || {}), [expBonus.featureName]: chosenExpId };
    }

    let companion = formData.companion;
    if (selectedSubclass?.name === 'Beastbound' && companion) {
      const compExps = (companion.experiences || []).map((exp, i) => ({
        ...exp,
        name: `Experience ${i + 1} - choose during play`,
      }));
      companion = {
        ...companion,
        name: companion.name || 'Companion',
        species: companion.species || 'To be determined during play',
        attackName: companion.attackName || 'Attack',
        experiences: compExps,
      };
    }

    set({
      primaryWeaponId,
      secondaryWeaponId,
      armorId,
      abilityIds,
      experiences,
      ...(expBonus ? { experienceBonusChoices } : {}),
      ...(companion != null ? { companion } : {}),
      background: 'To be determined during play.',
      connectionText: 'To be determined during play.',
      description: formData.description || 'A 1st level character ready for adventure.',
    });
  }, [formData, weaponOptions, armorOptions, abilityOptions, selectedClass, selectedSubclass, srdData, set]);

  const handleRandomizeBigFour = useCallback(() => {
    const newClass = pickRandom(classOptions);
    if (!newClass) return;
    const subNames = newClass.subclasses || [];
    const newSubclassOptions = (srdData?.subclasses || []).filter(sc => subNames.includes(sc.name));
    const newSubclass = pickRandom(newSubclassOptions);
    const newAncestry = pickRandom(ancestryOptions);
    const newCommunity = pickRandom(communityOptions);
    const suggestedTraits = parseSuggestedTraits(newClass.suggested_traits);
    const patch = {
      classId: newClass.id,
      subclassId: newSubclass?.id ?? null,
      ancestryIds: newAncestry ? [newAncestry.id] : [],
      communityId: newCommunity?.id ?? null,
      abilityIds: [null, null],
      ...(suggestedTraits ? { baseTraits: suggestedTraits } : {}),
    };
    if (newSubclass?.name === 'Beastbound' && formData.companion == null) {
      patch.companion = {
        name: '', species: '', attackName: '', evasion: 10, maxStress: 3, currentStress: 0,
        experiences: [{ name: '', score: 2, id: generateId() }, { name: '', score: 2, id: generateId() }],
      };
    }
    set(patch);
  }, [classOptions, ancestryOptions, communityOptions, srdData, formData.companion, set]);

  if (srdLoading) {
    return <div className="p-4 text-dh-muted text-sm">Loading SRD data...</div>;
  }

  return (
    <div className="space-y-5 p-1 relative">
      <CharacterAiConceptStrip
        ref={aiStripRef}
        getMergeBase={() => formDataRef.current}
        onComplete={(recomputed) => update(recomputed)}
        onAiBusyChange={(busy) => {
          setAiBusy(busy);
          onAiBusyChange?.(busy);
        }}
        showBuildButtonSpinner={false}
        initialConcept={autoRunAiConcept}
        initialConceptKey={autoRunSessionKey}
        autoSubmitKey={
          autoRunAiConcept?.trim()
            ? `${autoRunSessionKey}:${autoRunAiConcept.trim()}`
            : undefined
        }
        onPendingConsumed={onAutoRunAiConceptConsumed}
      />

      <div className="relative">
        {aiBusy ? (
          <>
            <div
              className="absolute inset-0 z-10 min-h-[200px] rounded-md bg-dh-canvas/60 backdrop-blur-[1px] pointer-events-none"
              aria-hidden
            />
            <div className="absolute inset-0 z-20 flex items-start justify-center pt-20 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-dh-strong bg-dh-surface px-4 py-3 shadow-xl">
                <Loader2 size={22} className="animate-spin text-violet-400 shrink-0" aria-hidden />
                <span className="text-sm text-dh-muted">Building character…</span>
                <button
                  type="button"
                    onClick={() => {
                      aiStripRef.current?.cancel();
                    }}
                  className="text-sm font-medium px-2.5 py-1 rounded-md border border-dh-border text-dh hover:bg-dh-raised transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : null}
        <div className={aiBusy ? 'pointer-events-none select-none opacity-[0.68]' : ''}>
      {/* ── Name and Identity ── */}
      <FormRow label="Name">
        <input
          type="text"
          value={formData.name || ''}
          onChange={e => set({ name: e.target.value })}
          className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none"
          placeholder="Character name"
        />
      </FormRow>

      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Pronouns">
          <input
            type="text"
            value={formData.pronouns || ''}
            onChange={e => set({ pronouns: e.target.value })}
            className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none"
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
          className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none resize-y"
          placeholder="A brief description..."
        />
      </FormRow>

      {level === 1 && (
        <button
          type="button"
          onClick={handleRandomizeBigFour}
          className="w-full py-2 px-4 rounded border text-sm font-medium transition-colors bg-sky-900/60 border-sky-700 text-sky-200 hover:bg-sky-800 hover:border-sky-600"
        >
          Randomize Class, Subclass, Ancestry, and Community
        </button>
      )}

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
          getOptionDescription={(id) => {
            const c = srdData?.classesById?.[id];
            return composeOptionTooltip(classStatsMarkdown(c), c?.description);
          }}
          renderTooltipExtra={renderClassTooltipExtra}
          tooltipWide
          placeholder="Select a class..."
        />
        {selectedClass && (
          <div className="mt-1 text-[11px] text-dh-muted space-y-0.5">
            <div>
              Domains: <span className="text-violet-300">{(selectedClass.domains || []).join(', ')}</span>
              {' · '}
              Starting HP: <span className="text-red-300">{selectedClass.starting_hp}</span>
              {' · '}
              Evasion: <span className="text-cyan-300">{selectedClass.starting_evasion}</span>
              {selectedClass.hope_feature && (
                <>
                  {' · '}
                  Hope: <span className="text-dh-hope">{selectedClass.hope_feature.name}</span>
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
          onChange={id => {
            const newSub = id ? srdData?.subclassesById?.[id] : null;
            const patch = { subclassId: id };
            if (newSub?.name === 'Beastbound' && (formData.companion == null)) {
              patch.companion = {
                name: '', species: '', attackName: '', evasion: 10, maxStress: 3, currentStress: 0,
                experiences: [{ name: '', score: 2, id: generateId() }, { name: '', score: 2, id: generateId() }],
              };
            }
            set(patch);
          }}
          options={subclassOptions.map(sc => sc.id)}
          getOptionKey={id => id}
          getOptionLabel={id => srdData?.subclassesById?.[id]?.name || id}
          getOptionDescription={(id) => {
            const sc = srdData?.subclassesById?.[id];
            return composeOptionTooltip(subclassStatsMarkdown(sc), sc?.description);
          }}
          renderTooltipExtra={renderSubclassTooltipExtra}
          tooltipWide
          placeholder={selectedClass ? 'Select a subclass...' : 'Select a class first'}
          disabled={!selectedClass}
        />
        {selectedSubclass?.spellcast_trait && (
          <div className="mt-1 text-[11px] text-dh-muted">
            Spellcast trait: <span className="dh-text-spellcast-header-sub">{selectedSubclass.spellcast_trait}</span>
          </div>
        )}
      </FormRow>

      {editorCardsAfterSubclass.map(({ feature, shape }) => (
        <FormRow key={shape.id} label={feature.name}>
          <DeclarativeSchemaEditorCard
            featureName={feature.name}
            jsonSchema={shape.jsonSchema}
            bind={shape.bind}
            formCharacter={formData}
            setCharacter={(next) => update(next)}
          />
        </FormRow>
      ))}

      {/* ── Ancestry ── */}
      <FormRow label="Ancestry">
        <CustomSelect
          value={formData.ancestryIds?.[0] || null}
          onChange={id => set({ ancestryIds: id ? [id] : [] })}
          options={ancestryOptions.map(a => a.id)}
          getOptionKey={id => id}
          getOptionLabel={id => srdData?.ancestriesById?.[id]?.name || id}
          getOptionDescription={(id) => {
            const a = srdData?.ancestriesById?.[id];
            return composeOptionTooltip(ancestryStatsMarkdown(a), a?.description);
          }}
          renderTooltipExtra={renderAncestryTooltipExtra}
          tooltipWide
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
          getOptionDescription={(id) => {
            const c = srdData?.communitiesById?.[id];
            return composeOptionTooltip(communityStatsMarkdown(c), c?.description);
          }}
          renderTooltipExtra={renderCommunityTooltipExtra}
          tooltipWide
          placeholder="Select a community..."
        />
      </FormRow>

      {level === 1 && (
        <button
          type="button"
          onClick={handleFillOutAutomatically}
          disabled={!formData.classId || !formData.subclassId || !formData.ancestryIds?.[0] || !formData.communityId}
          title={!(formData.classId && formData.subclassId && formData.ancestryIds?.[0] && formData.communityId) ? 'Select class, subclass, ancestry, and community to enable' : undefined}
          className="w-full py-2 px-4 rounded border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-sky-900/60 border-sky-700 text-sky-200 hover:bg-sky-800 hover:border-sky-600 disabled:hover:bg-sky-900/60 disabled:hover:border-sky-700"
        >
          Random remaining selections
        </button>
      )}

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
                <span className="text-xs text-dh-muted w-20">{TRAIT_LABELS[trait]}</span>
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
        const formAncestryFeatures = (formData.ancestryIds || [])
          .flatMap(id => (srdData?.ancestriesById?.[id]?.features || []).map(f => ({ name: f.name })));
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-dh-muted">Sort:</span>
              <select
                value={weaponSortOrder}
                onChange={e => setWeaponSortOrder(e.target.value)}
                className="bg-dh-raised border border-dh-border rounded px-2 py-1 text-dh text-xs focus:border-sky-500 focus:outline-none"
              >
                {WEAPON_SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-dh cursor-pointer">
                <input
                  type="checkbox"
                  checked={weaponGroupTraitOptimized}
                  onChange={e => setWeaponGroupTraitOptimized(e.target.checked)}
                  className="rounded border-dh-strong bg-dh-raised text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs">Trait-optimized first</span>
              </label>
            </div>
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
                  ancestryFeatures={formAncestryFeatures}
                  sortOrder={weaponSortOrder}
                  groupTraitOptimized={weaponGroupTraitOptimized}
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
                  ancestryFeatures={formAncestryFeatures}
                  sortOrder={weaponSortOrder}
                  groupTraitOptimized={weaponGroupTraitOptimized}
                />
                {isTwoHanded && (
                  <div className="mt-1 text-[10px] text-dh-muted">Two-handed primary uses both hands</div>
                )}
              </FormRow>
            </div>
          </div>
        );
      })()}

      {/* ── Experiences ── */}
      {(() => {
        const ancestryId = formData.ancestryIds?.[0];
        const ancestryName = ancestryId ? srdData?.ancestriesById?.[ancestryId]?.name : null;
        const expBonus = ancestryName ? getAncestryExperienceBonus(ancestryName) : null;
        const chosenExpId = expBonus ? formData.experienceBonusChoices?.[expBonus.featureName] : null;
        return (
          <FormRow label="Experiences">
            <div className="space-y-1.5">
              {(formData.experiences || []).map((exp, i) => {
                const isChosen = expBonus && exp.id === chosenExpId;
                // Form data is already recomputed (update() sends recomputeCharacter output); show score as-is to avoid double-adding bonus
                const displayScore = exp.score ?? 2;
                return (
                  <div key={exp.id || i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={exp.name || ''}
                      onChange={e => {
                        const exps = [...(formData.experiences || [])];
                        exps[i] = { ...exps[i], name: e.target.value };
                        set({ experiences: exps });
                      }}
                      className="flex-1 bg-dh-raised border border-dh-border rounded px-2 py-1 text-sm text-dh focus:border-sky-500 focus:outline-none"
                      placeholder="Experience name"
                    />
                    <span className="text-sm font-bold text-sky-400 tabular-nums w-8 text-center shrink-0" title={isChosen ? `${ancestryName} bonus +${expBonus.amount}` : undefined}>
                      +{displayScore}
                    </span>
                    <button
                      onClick={() => {
                        const exps = (formData.experiences || []).filter((_, j) => j !== i);
                        set({ experiences: exps });
                      }}
                      className="text-dh-muted hover:text-red-400 text-sm"
                    >×</button>
                  </div>
                );
              })}
              <button
                onClick={() => set({ experiences: [...(formData.experiences || []), { name: '', score: 2, id: generateId() }] })}
                className="text-xs text-sky-400 hover:text-sky-300"
              >+ Add Experience</button>
            </div>
          </FormRow>
        );
      })()}

      {/* ── Experience bonus (ancestry, e.g. Clank Purposeful Design) ── */}
      {(() => {
        const ancestryId = formData.ancestryIds?.[0];
        const ancestryName = ancestryId ? srdData?.ancestriesById?.[ancestryId]?.name : null;
        const expBonus = ancestryName ? getAncestryExperienceBonus(ancestryName) : null;
        if (!expBonus) return null;
        const { amount, featureName } = expBonus;
        const experiences = formData.experiences || [];
        const options = experiences.filter(e => e.id).map(e => e.id);
        const value = formData.experienceBonusChoices?.[featureName] ?? null;
        return (
          <FormRow label={`${ancestryName} ${featureName}: which experience gets +${amount}?`}>
            <CustomSelect
              value={value}
              onChange={id => set({ experienceBonusChoices: { ...(formData.experienceBonusChoices || {}), [featureName]: id ?? null } })}
              options={[null, ...options]}
              getOptionKey={id => id ?? '__none__'}
              getOptionLabel={id => id ? (experiences.find(e => e.id === id)?.name || id) : 'Select an experience…'}
              getOptionDescription={id => id ? (experiences.find(e => e.id === id)?.name ? `+${amount} bonus` : '') : ''}
              placeholder="Select an experience…"
              className="text-sm"
            />
          </FormRow>
        );
      })()}

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
                      <span className="text-[10px] text-dh-muted shrink-0">{ability.type}</span>
                    )}
                    {displaySlots.length > MIN_DOMAIN_CARD_SLOTS && (
                      <button
                        onClick={() => {
                          const ids = displaySlots.filter((_, j) => j !== i);
                          set({ abilityIds: ids });
                        }}
                        className="text-dh-muted hover:text-red-400 text-sm"
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
                <div key={lvl} className="border border-dh-border rounded bg-dh-raised/40 overflow-hidden">
                  <button
                    onClick={() => setOpenAdvancements(prev => ({ ...prev, [advKey]: !isOpen }))}
                    className="w-full px-2 py-1.5 flex items-center gap-2 hover:bg-dh-hover/40 transition-colors text-left"
                  >
                    {isOpen ? <ChevronDown size={11} className="text-dh-muted" /> : <ChevronRight size={11} className="text-dh-muted" />}
                    <span className="text-xs font-semibold text-dh">Level {lvl}</span>
                    {isTierAchievement && (
                      <span className="text-[9px] bg-amber-900/50 text-amber-300 border border-amber-800/50 rounded px-1">Tier Achievement</span>
                    )}
                    <span className="text-[10px] text-dh-muted ml-auto">{(adv.picks || []).length} pick{(adv.picks || []).length !== 1 ? 's' : ''}</span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2 space-y-2 border-t border-dh-border">
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
                        <label className="text-[10px] text-dh-muted block mb-0.5">Domain Card</label>
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
          className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none resize-y"
          placeholder="Character background..."
        />
      </FormRow>
      <FormRow label="Connections">
        <textarea
          value={formData.connectionText || ''}
          onChange={e => set({ connectionText: e.target.value })}
          rows={2}
          className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh focus:border-sky-500 focus:outline-none resize-y"
          placeholder="Connection to other characters..."
        />
      </FormRow>
        </div>
      </div>
    </div>
  );
}

const TIER_ACHIEVEMENT_LEVELS = [2, 5, 8];

function AdvancementPick({ label, pick, onChange, tier }) {
  const currentType = pick?.type || null;

  return (
    <div className="mt-1">
      <label className="text-[10px] text-dh-muted block mb-0.5">{label}</label>
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
                      ? 'bg-dh-raised border-dh-border text-dh-muted hover:border-sky-600'
                      : 'bg-dh-raised border-dh-border text-dh-muted cursor-not-allowed'
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
