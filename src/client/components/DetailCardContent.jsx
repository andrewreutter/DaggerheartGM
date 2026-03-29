import { X, Dices, Link2, Zap } from 'lucide-react';
import { stripHtml } from '../lib/helpers.js';
import { GuideFeatureCard } from './features/GuideFeatureCard.jsx';
import { normalizePotentialAdversaries } from './forms/EnvironmentForm.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { ConditionsTextInput } from './ConditionsTextInput.jsx';
import { applyDamageBoost } from '../lib/battle-points.js';
import { libraryTierBodyLine, libraryTierSubtitleText } from '../lib/library-tier-subtitle.js';
import { TierShieldBadge } from './TierShieldBadge.jsx';
import { CheckboxTrack } from './CheckboxTrack.jsx';

export {
  CheckboxTrack,
  getCheckboxTrackPreset,
  CHECKBOX_TRACK_PRESETS,
  CHECKBOX_TRACK_EMPTY_ICON,
} from './CheckboxTrack.jsx';

const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

/** Stub element so `GuideFeatureCard` runs in Library-style preview (no instance / no V2 table hooks). */
const ADV_ENV_FEATURE_EL_STUB = { instanceId: null, elementType: 'character', name: '' };

function normalizeAdvEnvFeatureRow(feat, parentEl, collection) {
  if (!feat || typeof feat !== 'object') return null;
  if (feat.name == null && feat.title == null) return null;
  const row = { ...feat };
  if (row.name == null && row.title != null) row.name = row.title;
  if (row.description == null) row.description = '';
  if (!row.type) row.type = 'passive';
  if (!row.source && parentEl?.name) row.source = parentEl.name;
  if (row.sourceType == null) {
    row.sourceType = collection === 'adversaries' ? 'adversary' : collection === 'environments' ? 'environment' : undefined;
  }
  return row;
}

/**
 * Adversary / environment feature list using `GuideFeatureCard` (matches Library generic detail).
 * Optional `onRollAttack` (adversaries): dice icon per rollable feature posts to the dice room.
 */
function DetailCardGuideFeatureList({
  parentEl,
  features,
  cardKey,
  hoveredFeature,
  collection,
  onRollAttack,
  damageBoost,
}) {
  if (!features?.length) return null;
  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-dh-muted uppercase border-b border-dh-border pb-1">Features</h5>
      <div className="space-y-1.5">
        {features.map((feat, featIdx) => {
          const fKey = `feat-${featIdx}`;
          const base = normalizeAdvEnvFeatureRow(feat, parentEl, collection);
          if (!base) return null;
          let description = base.description;
          if (damageBoost && collection === 'adversaries') {
            description = boostedAttackDesc(description, damageBoost);
          }
          const featRow = { ...base, description };
          const isHovered = hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === fKey;

          let rollBtn = null;
          if (collection === 'adversaries' && typeof onRollAttack === 'function') {
            const attackMatch = feat.type === 'action' && feat.description ? ATTACK_DESC_RE.exec(feat.description) : null;
            const forceAttack = !attackMatch && /\bmakes?\b.*?\battack\b/is.test(feat.description || '');
            const dicePatterns =
              !attackMatch && !forceAttack && feat.description
                ? [...feat.description.matchAll(DICE_PATTERN_RE)].map((m) => m[0])
                : [];
            const isRollable = !!(attackMatch || forceAttack || dicePatterns.length > 0);
            if (isRollable) {
              rollBtn = (
                <button
                  type="button"
                  className="shrink-0 mt-1 p-0.5 rounded text-dh-muted hover:text-red-400 hover:bg-dh-hover/80 transition-colors"
                  title="Roll to dice room"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (attackMatch) {
                      onRollAttack(
                        {
                          name: feat.name,
                          modifier: parseInt(attackMatch[1], 10),
                          range: attackMatch[2],
                          damage: boostedDamage(attackMatch[3], damageBoost),
                          trait: attackMatch[4],
                        },
                        e,
                      );
                    } else if (forceAttack) {
                      onRollAttack(
                        {
                          name: feat.name,
                          modifier: parentEl.attack?.modifier ?? 0,
                          range: parentEl.attack?.range || 'Melee',
                          damage: boostedDamage(parentEl.attack?.damage, damageBoost),
                          trait: parentEl.attack?.trait,
                        },
                        e,
                      );
                    } else {
                      onRollAttack({ name: feat.name, patterns: dicePatterns }, e);
                    }
                  }}
                >
                  <Dices size={14} />
                </button>
              );
            }
          }

          return (
            <div
              key={feat.id ?? featIdx}
              data-feature-key={fKey}
              className={`rounded-lg border transition-colors ${
                isHovered ? 'border-yellow-500 ring-1 ring-yellow-500/30' : 'border-transparent'
              }`}
            >
              <div className="flex items-start gap-0.5">
                {rollBtn}
                <div className="flex-1 min-w-0">
                  <GuideFeatureCard
                    featRow={featRow}
                    featureKey={String(feat.id ?? `${cardKey}-${fKey}`)}
                    el={ADV_ENV_FEATURE_EL_STUB}
                    open
                    onToggle={() => {}}
                    interactionMode="preview"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Apply damage boost to a damage string, returning original if no boost. */
function boostedDamage(dmg, damageBoost) {
  if (!damageBoost || !dmg) return dmg;
  return applyDamageBoost(dmg, damageBoost);
}

/** Apply damage boost inside an attack description like "+3 Melee | 2d6 Phy". */
function boostedAttackDesc(desc, damageBoost) {
  if (!damageBoost || !desc) return desc;
  return desc.replace(
    /^(([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*)([^\s]+)(\s+\w+)$/i,
    (_, prefix, _mod, _range, dmg, suffix) => `${prefix}${applyDamageBoost(dmg, damageBoost)}${suffix}`,
  );
}

export function EnvironmentCardContent({
  element,
  hoveredFeature,
  cardKey,
  featureCountdowns,
  updateCountdown,
  onAddAdversary,
  onPotentialAdversaryHover,
  onPotentialAdversaryLeave,
  suppressTierBadge = false,
}) {
  const subFull = libraryTierSubtitleText(element, 'environments');
  const subBody = libraryTierBodyLine(element, 'environments');
  const envFirstLine = suppressTierBadge
    ? (subBody ? `${subBody} Environment` : null)
    : (subFull ? `${subFull} Environment` : 'Environment');
  const showEnvTierRow = envFirstLine != null;
  return (
    <>
      {showEnvTierRow && (
      <div className="text-sm text-dh-muted mb-2 capitalize flex items-center gap-2 flex-wrap">
        {!suppressTierBadge && <TierShieldBadge tier={element.tier} />}
        <span>{envFirstLine}</span>
      </div>
      )}

      <div className="inline-flex mb-3 bg-dh-inset px-3 py-1.5 rounded border border-dh-border">
        <div className="flex flex-col">
          <span className="text-dh-muted text-xs uppercase leading-none mb-0.5">Difficulty</span>
          <span className="text-base font-semibold text-dh">{element.difficulty || '-'}</span>
        </div>
      </div>

      {element.description && (
        <MarkdownText text={stripHtml(element.description)} className="text-sm italic text-dh mb-3" />
      )}

      {element.impulses && (
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-dh-muted uppercase border-b border-dh-border pb-1 mb-1">Impulses</h5>
          <p className="text-sm text-dh">{stripHtml(element.impulses)}</p>
        </div>
      )}

      {(() => {
        const potAdv = normalizePotentialAdversaries(element.potential_adversaries);
        if (!potAdv.length) return null;
        const hasClickable = onAddAdversary && potAdv.some(e => e.adversaryId);
        return (
          <div className="space-y-1 mb-3">
            <h5 className="text-xs font-semibold text-dh-muted uppercase border-b border-dh-border pb-1">
              Potential Adversaries{hasClickable ? ' — click to add' : ''}
            </h5>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {potAdv.map((entry, idx) => {
                const isLinked = !!entry.adversaryId;
                const isClickable = isLinked && !!onAddAdversary;
                const baseClass = `flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  isLinked
                    ? 'bg-dh-raised border border-dh-border text-dh'
                    : 'bg-dh-inset border border-dashed border-dh-border text-dh-muted italic'
                }`;
                const hoverHandlers = isLinked && onPotentialAdversaryHover ? {
                  onMouseEnter: (e) => onPotentialAdversaryHover(entry.adversaryId, e.currentTarget.getBoundingClientRect()),
                  onMouseLeave: onPotentialAdversaryLeave,
                } : {};
                if (isClickable) {
                  return (
                    <button
                      key={idx}
                      onClick={() => onAddAdversary(entry.adversaryId)}
                      className={`${baseClass} hover:bg-green-900/60 hover:border-green-700 hover:text-green-200 transition-colors cursor-pointer`}
                      title={`Add ${entry.name} to encounter`}
                      {...hoverHandlers}
                    >
                      <Link2 size={10} className="text-blue-400 shrink-0" />
                      {entry.name}
                    </button>
                  );
                }
                return (
                  <span
                    key={idx}
                    className={baseClass}
                    {...hoverHandlers}
                  >
                    {isLinked && <Link2 size={10} className="text-blue-400 shrink-0" />}
                    {entry.name}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })()}

      <DetailCardGuideFeatureList
        parentEl={element}
        features={element.features}
        cardKey={cardKey}
        hoveredFeature={hoveredFeature}
        collection="environments"
      />
    </>
  );
}

/**
 * Shared adversary card body.
 *
 * Props:
 *   element          – the base adversary object
 *   hoveredFeature   – { cardKey, featureKey } | null
 *   cardKey          – string used for hover matching
 *   count            – number of instances (defaults to 1)
 *   instances        – array of live instance objects; when provided, renders
 *                      interactive HP/stress/conditions rows
 *   updateFn         – (instanceId, updates) => void, required when instances provided
 *   showInstanceRemove – boolean; show X button per row (used by Game Table)
 *   removeInstanceFn – (instanceId) => void, required when showInstanceRemove true
 */
export function AdversaryCardContent({
  element: el,
  hoveredFeature,
  cardKey,
  count = 1,
  instances,
  updateFn,
  showInstanceRemove = false,
  removeInstanceFn,
  featureCountdowns,
  updateCountdown,
  onRollAttack,
  damageBoost,
  scaledMeta,
  onScaledToggle,
  suppressTierBadge = false,
}) {
  // damageBoost: 'd4' | 'static' | null — when set, visually appends +1d4 or +2 to all damage.
  const dmgBoost = damageBoost || el._damageBoost || null;
  const advTierLine = suppressTierBadge
    ? libraryTierBodyLine(el, 'adversaries')
    : libraryTierSubtitleText(el, 'adversaries');
  const showAdvTierRow = !suppressTierBadge || advTierLine || scaledMeta;
  return (
    <>
      {showAdvTierRow && (
      <div className="text-sm text-dh-muted mb-2 capitalize flex items-center gap-2 flex-wrap">
        {!suppressTierBadge && <TierShieldBadge tier={el.tier} scaledFromTier={el._scaledFromTier} />}
        <span>{advTierLine}</span>
        {scaledMeta && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onScaledToggle?.(); }}
            className="inline-flex text-[10px] rounded border border-amber-700/50 overflow-hidden cursor-pointer"
          >
            <span className={`px-1.5 py-0.5 transition-colors ${scaledMeta.showScaled ? 'bg-amber-800/60 text-amber-200 border-r border-amber-700/50' : 'bg-amber-900/20 text-amber-500/80'}`}>
              Scaled from Tier {scaledMeta.fromTier}
            </span>
            <span className={`px-1.5 py-0.5 transition-colors ${!scaledMeta.showScaled ? 'bg-amber-800/60 text-amber-200 border-l border-amber-700/50' : 'bg-amber-900/20 text-amber-500/80'}`}>
              Original
            </span>
          </button>
        )}
      </div>
      )}

      {el.description && (
        <MarkdownText text={stripHtml(el.description)} className="text-sm italic text-dh mb-4" />
      )}

      {(el.motive || (el.experiences && el.experiences.length > 0)) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {el.motive && (
            <div>
              <h5 className="text-xs font-semibold text-dh-muted uppercase border-b border-dh-border pb-1 mb-2">
                Motives & Tactics
              </h5>
              <MarkdownText text={stripHtml(el.motive)} className="text-sm text-dh" />
            </div>
          )}
          {el.experiences && el.experiences.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-dh-muted uppercase border-b border-dh-border pb-1 mb-2">
                Experiences
              </h5>
              <div className="flex flex-wrap gap-2">
                {el.experiences.map(exp => (
                  <span key={exp.id} className="text-xs bg-dh-inset border border-dh-border text-dh px-2 py-1 rounded">
                    {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 bg-dh-inset p-3 rounded-lg border border-dh-border">
        {instances && instances.length > 0 ? (
          <div className="space-y-2">
            {instances.map((inst, idx) => {
              const hpDamage = (el.hp_max || 0) - (inst.currentHp ?? el.hp_max ?? 0);
              return (
                <div key={inst.instanceId} className="flex items-start gap-2">
                  {count > 1 && (
                    <span className="text-xs text-dh-muted w-4 flex-shrink-0 text-right mt-0.5">{idx + 1}</span>
                  )}

                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium">
                    <div className="flex flex-col">
                      <span className="text-dh-muted text-xs uppercase leading-none mb-0.5">Difficulty</span>
                      <span className="text-base text-dh">{el.difficulty || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-dh-muted text-xs uppercase leading-none mb-0.5">Thresholds</span>
                      <span className="text-base">{el.hp_thresholds?.major || '-'}/{el.hp_thresholds?.severe || '-'}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 border-l border-dh-border pl-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-dh flex-shrink-0">{el.hp_max || 0}</span>
                      <CheckboxTrack
                        total={el.hp_max || 0}
                        filled={hpDamage}
                        onSetFilled={(dmg) => updateFn(inst.instanceId, { currentHp: (el.hp_max || 0) - dmg })}
                        trackKind="hp"
                        label="HP"
                        verbs={['Mark', 'Clear']}
                      />
                    </div>
                    {(el.stress_max || 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-dh flex-shrink-0">{el.stress_max}</span>
                        <CheckboxTrack
                          total={el.stress_max || 0}
                          filled={inst.currentStress || 0}
                          onSetFilled={(s) => updateFn(inst.instanceId, { currentStress: s })}
                          trackKind="stressPurple"
                          label="Stress"
                          verbs={['Mark', 'Clear']}
                        />
                      </div>
                    )}
                    <ConditionsTextInput
                      instanceId={inst.instanceId}
                      placeholder="Conditions..."
                      value={inst.conditions || ''}
                      onCommit={(v) => updateFn(inst.instanceId, { conditions: v })}
                      className="w-full bg-dh-raised/80 border border-dh-border rounded px-2 py-1 text-sm text-dh outline-none focus:border-blue-500"
                    />
                  </div>

                  {showInstanceRemove && count > 1 && (
                    <button
                      onClick={() => removeInstanceFn(inst.instanceId)}
                      className="text-dh-muted hover:text-red-500 flex-shrink-0 mt-0.5"
                      title="Remove this copy"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium">
            <div className="flex flex-col">
              <span className="text-dh-muted text-xs uppercase">Difficulty</span>
              <span className="text-base text-dh">{el.difficulty || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-dh-muted text-xs uppercase">HP</span>
              <span className="text-base text-dh">{el.hp_max || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-dh-muted text-xs uppercase">Thresholds</span>
              <span className="text-base text-dh">{el.hp_thresholds?.major || '-'}/{el.hp_thresholds?.severe || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-dh-muted text-xs uppercase">Stress</span>
              <span className="text-base text-dh">{el.stress_max || '-'}</span>
            </div>
          </div>
        )}
      </div>

      {el.attack && el.attack.name && (
        <div className="space-y-1 mb-4">
          <h5 className="text-xs font-semibold text-dh-muted uppercase border-b border-dh-border pb-1 flex items-center gap-1">
            Attack
            {dmgBoost && <Zap size={10} className="text-amber-400" title="Damage boosted" />}
          </h5>
          <div
            data-feature-key="attack"
            className={`text-sm pl-2 border-l-2 transition-colors rounded-r ${
              hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === 'attack'
                ? 'border-yellow-500'
                : 'border-transparent'
            } ${onRollAttack ? 'cursor-pointer hover:bg-dh-hover/40 py-0.5 pr-1 group/atk' : ''}`}
            onClick={onRollAttack ? (e) => onRollAttack({ name: el.attack.name, modifier: el.attack.modifier, range: el.attack.range, damage: boostedDamage(el.attack.damage, dmgBoost), trait: el.attack.trait }, e) : undefined}
            title={onRollAttack ? 'Roll to dice room' : undefined}
          >
            <span className="font-bold text-dh">{el.attack.name}:</span>
            <span className="text-dh"> {el.attack.modifier >= 0 ? '+' : ''}{el.attack.modifier} {el.attack.range} | </span>
            <span className={dmgBoost ? 'text-dh-hope font-medium' : 'text-dh'}>{boostedDamage(el.attack.damage, dmgBoost)}</span>
            <span className="text-dh"> {el.attack.trait?.toLowerCase()}</span>
            {onRollAttack && <Dices size={11} className="inline ml-1.5 text-dh-muted group-hover/atk:text-red-400 transition-colors" />}
          </div>
        </div>
      )}

      <DetailCardGuideFeatureList
        parentEl={el}
        features={el.features}
        cardKey={cardKey}
        hoveredFeature={hoveredFeature}
        collection="adversaries"
        onRollAttack={onRollAttack}
        damageBoost={dmgBoost}
      />
    </>
  );
}
