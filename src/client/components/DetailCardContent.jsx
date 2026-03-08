import { Heart, AlertCircle, X, Dices, Link2, Zap } from 'lucide-react';
import { FeatureDescription } from './FeatureDescription.jsx';
import { parseAllCountdownValues, stripHtml } from '../lib/helpers.js';
import { normalizePotentialAdversaries } from './forms/EnvironmentForm.jsx';
import { MarkdownText } from '../lib/markdown.js';
import { applyDamageBoost } from '../lib/battle-points.js';

const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

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

export function CheckboxTrack({ total, filled, onSetFilled, fillColor, label, valueOffset = 0, verbs, currentAbsoluteValue, targetToAbsolute }) {
  if (!total || total <= 0) return <span className="text-slate-500 text-xs">-</span>;

  const items = [];
  for (let i = 0; i < total; i++) {
    const isChecked = i < filled;
    const targetValue = isChecked ? i : i + 1;
    const delta = (currentAbsoluteValue != null && typeof targetToAbsolute === 'function')
      ? Math.abs(targetToAbsolute(targetValue) - currentAbsoluteValue)
      : Math.abs(targetValue - filled);
    let title = '';
    if (label && delta > 0) {
      if (verbs) {
        const verb = (currentAbsoluteValue != null && typeof targetToAbsolute === 'function'
          ? targetToAbsolute(targetValue) < currentAbsoluteValue
          : targetValue < filled) ? verbs[1] : verbs[0];
        title = `${verb} ${delta} ${label}`;
      } else {
        title = `${label} → ${targetValue + valueOffset}`;
      }
    }
    items.push(
      <button
        key={i}
        onClick={() => onSetFilled(targetValue)}
        title={title}
        className={`w-4 h-4 rounded-sm border-2 flex-shrink-0 transition-colors ${
          isChecked
            ? `${fillColor} border-transparent`
            : 'border-slate-600 hover:border-slate-400'
        }`}
      />
    );
  }

  return <div className="flex items-center gap-0.5 flex-wrap">{items}</div>;
}

export function EnvironmentCardContent({ element, hoveredFeature, cardKey, featureCountdowns, updateCountdown, onAddAdversary, onPotentialAdversaryHover, onPotentialAdversaryLeave }) {
  return (
    <>
      <div className="text-sm text-slate-400 mb-2 capitalize">
        Tier {element.tier || 0} {element.type} Environment
      </div>

      <div className="inline-flex mb-3 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
        <div className="flex flex-col">
          <span className="text-slate-500 text-xs uppercase leading-none mb-0.5">Difficulty</span>
          <span className="text-base font-semibold text-white">{element.difficulty || '-'}</span>
        </div>
      </div>

      {element.description && (
        <MarkdownText text={stripHtml(element.description)} className="text-sm italic text-slate-300 mb-3" />
      )}

      {element.impulses && (
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-1">Impulses</h5>
          <p className="text-sm text-slate-300">{stripHtml(element.impulses)}</p>
        </div>
      )}

      {(() => {
        const potAdv = normalizePotentialAdversaries(element.potential_adversaries);
        if (!potAdv.length) return null;
        const hasClickable = onAddAdversary && potAdv.some(e => e.adversaryId);
        return (
          <div className="space-y-1 mb-3">
            <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">
              Potential Adversaries{hasClickable ? ' — click to add' : ''}
            </h5>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {potAdv.map((entry, idx) => {
                const isLinked = !!entry.adversaryId;
                const isClickable = isLinked && !!onAddAdversary;
                const baseClass = `flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  isLinked
                    ? 'bg-slate-800 border border-slate-700 text-slate-300'
                    : 'bg-slate-900 border border-dashed border-slate-600 text-slate-400 italic'
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

      {element.features && element.features.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h5>
          {element.features.map((feat, idx) => {
            const allCds = parseAllCountdownValues(feat.description);
            const fKey = `feat-${idx}`;
            const cdVals = allCds.map((cd, cdIdx) =>
              featureCountdowns?.[(cardKey + '|' + fKey + '|' + cdIdx)] ?? cd.value
            );
            return (
              <div
                key={feat.id ?? idx}
                data-feature-key={fKey}
                className={`text-sm pl-2 border-l-2 transition-colors ${
                  hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === fKey
                    ? 'border-yellow-500'
                    : 'border-transparent'
                }`}
              >
                <span className="font-bold text-slate-200">
                  {feat.name}{feat.type ? ` - ${feat.type[0].toUpperCase()}${feat.type.slice(1)}` : ''}:{' '}
                </span>
                <span className="text-slate-400">
                  <FeatureDescription
                    description={feat.description}
                    countdownValues={updateCountdown && allCds.length > 0 ? cdVals : undefined}
                    onCountdownChange={updateCountdown && allCds.length > 0
                      ? (cdIdx, v) => updateCountdown(cardKey, fKey, cdIdx, v)
                      : undefined}
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
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
}) {
  // damageBoost: 'd4' | 'static' | null — when set, visually appends +1d4 or +2 to all damage.
  const dmgBoost = damageBoost || el._damageBoost || null;
  return (
    <>
      <div className="text-sm text-slate-400 mb-2 capitalize flex items-center gap-2 flex-wrap">
        <span>Tier {el.tier || 0} {el.role}</span>
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

      {el.description && (
        <MarkdownText text={stripHtml(el.description)} className="text-sm italic text-slate-300 mb-4" />
      )}

      {(el.motive || (el.experiences && el.experiences.length > 0)) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {el.motive && (
            <div>
              <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">
                Motives & Tactics
              </h5>
              <MarkdownText text={stripHtml(el.motive)} className="text-sm text-slate-300" />
            </div>
          )}
          {el.experiences && el.experiences.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">
                Experiences
              </h5>
              <div className="flex flex-wrap gap-2">
                {el.experiences.map(exp => (
                  <span key={exp.id} className="text-xs bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                    {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
        {instances && instances.length > 0 ? (
          <div className="space-y-2">
            {instances.map((inst, idx) => {
              const hpDamage = (el.hp_max || 0) - (inst.currentHp ?? el.hp_max ?? 0);
              return (
                <div key={inst.instanceId} className="flex items-start gap-2">
                  {count > 1 && (
                    <span className="text-xs text-slate-500 w-4 flex-shrink-0 text-right mt-0.5">{idx + 1}</span>
                  )}

                  <div className="flex gap-4 text-sm font-medium shrink-0">
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-xs uppercase leading-none mb-0.5">Difficulty</span>
                      <span className="text-base">{el.difficulty || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500 text-xs uppercase leading-none mb-0.5">Thresholds</span>
                      <span className="text-base">{el.hp_thresholds?.major || '-'}/{el.hp_thresholds?.severe || '-'}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 border-l border-slate-800 pl-3">
                    <div className="flex items-center gap-1.5">
                      <Heart size={12} className="text-red-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-slate-300 flex-shrink-0">{el.hp_max || 0}</span>
                      <CheckboxTrack
                        total={el.hp_max || 0}
                        filled={hpDamage}
                        onSetFilled={(dmg) => updateFn(inst.instanceId, { currentHp: (el.hp_max || 0) - dmg })}
                        fillColor="bg-red-500"
                        label="HP"
                        verbs={['Mark', 'Clear']}
                      />
                    </div>
                    {(el.stress_max || 0) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-purple-500 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-300 flex-shrink-0">{el.stress_max}</span>
                        <CheckboxTrack
                          total={el.stress_max || 0}
                          filled={inst.currentStress || 0}
                          onSetFilled={(s) => updateFn(inst.instanceId, { currentStress: s })}
                          fillColor="bg-purple-500"
                          label="Stress"
                          verbs={['Mark', 'Clear']}
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Conditions..."
                      value={inst.conditions || ''}
                      onChange={e => updateFn(inst.instanceId, { conditions: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  {showInstanceRemove && count > 1 && (
                    <button
                      onClick={() => removeInstanceFn(inst.instanceId)}
                      className="text-slate-500 hover:text-red-500 flex-shrink-0 mt-0.5"
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
          <div className="flex gap-4 text-sm font-medium">
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs uppercase">Difficulty</span>
              <span className="text-base">{el.difficulty || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs uppercase">HP</span>
              <span className="text-base">{el.hp_max || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs uppercase">Thresholds</span>
              <span className="text-base">{el.hp_thresholds?.major || '-'}/{el.hp_thresholds?.severe || '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs uppercase">Stress</span>
              <span className="text-base">{el.stress_max || '-'}</span>
            </div>
          </div>
        )}
      </div>

      {el.attack && el.attack.name && (
        <div className="space-y-1 mb-4">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 flex items-center gap-1">
            Attack
            {dmgBoost && <Zap size={10} className="text-amber-400" title="Damage boosted" />}
          </h5>
          <div
            data-feature-key="attack"
            className={`text-sm pl-2 border-l-2 transition-colors rounded-r ${
              hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === 'attack'
                ? 'border-yellow-500'
                : 'border-transparent'
            } ${onRollAttack ? 'cursor-pointer hover:bg-slate-800/40 py-0.5 pr-1 group/atk' : ''}`}
            onClick={onRollAttack ? () => onRollAttack({ name: el.attack.name, modifier: el.attack.modifier, range: el.attack.range, damage: boostedDamage(el.attack.damage, dmgBoost), trait: el.attack.trait }) : undefined}
            title={onRollAttack ? 'Roll to dice room' : undefined}
          >
            <span className="font-bold text-slate-200">{el.attack.name}:</span>
            <span className="text-slate-300"> {el.attack.modifier >= 0 ? '+' : ''}{el.attack.modifier} {el.attack.range} | </span>
            <span className={dmgBoost ? 'text-amber-300 font-medium' : 'text-slate-300'}>{boostedDamage(el.attack.damage, dmgBoost)}</span>
            <span className="text-slate-300"> {el.attack.trait?.toLowerCase()}</span>
            {onRollAttack && <Dices size={11} className="inline ml-1.5 text-slate-600 group-hover/atk:text-red-400 transition-colors" />}
          </div>
        </div>
      )}

      {el.features && el.features.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h5>
          {el.features.map((feat, featIdx) => {
            const allCds = parseAllCountdownValues(feat.description);
            const fKey = `feat-${featIdx}`;
            const cdVals = allCds.map((cd, cdIdx) =>
              featureCountdowns?.[(cardKey + '|' + fKey + '|' + cdIdx)] ?? cd.value
            );
            const attackMatch = onRollAttack && feat.type === 'action' && feat.description ? ATTACK_DESC_RE.exec(feat.description) : null;
            const forceAttack = !attackMatch && onRollAttack && /\bmakes?\b.*?\battack\b/is.test(feat.description || '');
            const dicePatterns = onRollAttack && !attackMatch && !forceAttack && feat.description
              ? [...feat.description.matchAll(DICE_PATTERN_RE)].map(m => m[0])
              : [];
            const isRollable = !!(attackMatch || forceAttack || dicePatterns.length > 0);
            const displayDesc = dmgBoost ? boostedAttackDesc(feat.description, dmgBoost) : feat.description;
            return (
              <div
                key={feat.id ?? featIdx}
                data-feature-key={fKey}
                className={`text-sm pl-2 border-l-2 transition-colors rounded-r ${
                  hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === fKey
                    ? 'border-yellow-500'
                    : 'border-transparent'
                } ${isRollable ? 'cursor-pointer hover:bg-slate-800/40 py-0.5 pr-1 group/feat' : ''}`}
                onClick={isRollable ? () => {
                  if (attackMatch) {
                    onRollAttack({ name: feat.name, modifier: parseInt(attackMatch[1]), range: attackMatch[2], damage: boostedDamage(attackMatch[3], dmgBoost), trait: attackMatch[4] });
                  } else if (forceAttack) {
                    onRollAttack({ name: feat.name, modifier: el.attack?.modifier ?? 0, range: el.attack?.range || 'Melee', damage: boostedDamage(el.attack?.damage, dmgBoost), trait: el.attack?.trait });
                  } else {
                    onRollAttack({ name: feat.name, patterns: dicePatterns });
                  }
                } : undefined}
                title={isRollable ? 'Roll to dice room' : undefined}
              >
                <span className="font-bold text-slate-200">
                  {feat.name}{feat.type ? ` - ${feat.type[0].toUpperCase()}${feat.type.slice(1)}` : ''}:{' '}
                </span>
                <span className={`${dmgBoost && attackMatch ? 'text-amber-300/90' : 'text-slate-400'}`}>
                  <FeatureDescription
                    description={displayDesc}
                    countdownValues={updateCountdown && allCds.length > 0 ? cdVals : undefined}
                    onCountdownChange={updateCountdown && allCds.length > 0
                      ? (cdIdx, v) => updateCountdown(cardKey, fKey, cdIdx, v)
                      : undefined}
                  />
                </span>
                {isRollable && <Dices size={11} className="inline ml-1.5 text-slate-600 group-hover/feat:text-red-400 transition-colors" />}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
