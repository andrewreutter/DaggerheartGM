import { Heart, AlertCircle, X } from 'lucide-react';
import { FeatureDescription } from './FeatureDescription.jsx';

export function EnvironmentCardContent({ element, hoveredFeature, cardKey }) {
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
        <p className="text-sm italic text-slate-300 mb-3 whitespace-pre-wrap">{element.description}</p>
      )}

      {element.features && element.features.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h5>
          {element.features.map((feat, idx) => (
            <div
              key={feat.id ?? idx}
              className={`text-sm pl-2 border-l-2 transition-colors ${
                hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === `feat-${idx}`
                  ? 'border-yellow-500'
                  : 'border-transparent'
              }`}
            >
              <span className="font-bold text-slate-200 mr-2">
                {feat.name}{feat.type ? ` - ${feat.type[0].toUpperCase()}${feat.type.slice(1)}` : ''}:
              </span>
              <span className="text-slate-400"><FeatureDescription description={feat.description} /></span>
            </div>
          ))}
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
 *   showInstanceRemove – boolean; show X button per row (used by GM Table)
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
}) {
  return (
    <>
      <div className="text-sm text-slate-400 mb-2 capitalize">
        Tier {el.tier || 0} {el.role}
      </div>

      {el.description && (
        <div className="text-sm italic text-slate-300 mb-4 whitespace-pre-wrap">{el.description}</div>
      )}

      {(el.motive || (el.experiences && el.experiences.length > 0)) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {el.motive && (
            <div>
              <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">
                Motives & Tactics
              </h5>
              <p className="text-sm text-slate-300">{el.motive}</p>
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
        <div className="flex gap-4 text-sm font-medium border-b border-slate-800 pb-2 mb-2">
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

        {instances && instances.length > 0 && (
          <div className="space-y-2">
            {instances.map((inst, idx) => (
              <div key={inst.instanceId} className="flex items-center gap-2">
                {count > 1 && (
                  <span className="text-xs text-slate-500 w-4 flex-shrink-0 text-right">{idx + 1}</span>
                )}

                <div className="flex items-center gap-1">
                  <Heart size={12} className="text-red-500 flex-shrink-0" />
                  <input
                    type="number"
                    value={inst.currentHp}
                    onChange={e => updateFn(inst.instanceId, { currentHp: parseInt(e.target.value) || 0 })}
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-red-500 text-sm"
                  />
                  <span className="text-slate-500 text-xs">/{el.hp_max}</span>
                </div>

                <div className="flex items-center gap-1">
                  <AlertCircle size={12} className="text-purple-500 flex-shrink-0" />
                  <input
                    type="number"
                    value={inst.currentStress}
                    onChange={e => updateFn(inst.instanceId, { currentStress: parseInt(e.target.value) || 0 })}
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center font-bold text-white outline-none focus:border-purple-500 text-sm"
                  />
                  <span className="text-slate-500 text-xs">/{el.stress_max}</span>
                </div>

                <input
                  type="text"
                  placeholder="Conditions..."
                  value={inst.conditions || ''}
                  onChange={e => updateFn(inst.instanceId, { conditions: e.target.value })}
                  className="flex-1 min-w-0 bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                />

                {showInstanceRemove && count > 1 && (
                  <button
                    onClick={() => removeInstanceFn(inst.instanceId)}
                    className="text-slate-600 hover:text-red-500 flex-shrink-0"
                    title="Remove this copy"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {el.attack && el.attack.name && (
        <div className="space-y-1 mb-4">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Attack</h5>
          <div
            className={`text-sm pl-2 border-l-2 transition-colors ${
              hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === 'attack'
                ? 'border-yellow-500'
                : 'border-transparent'
            }`}
          >
            <span className="font-bold text-slate-200">{el.attack.name}:</span>
            <span className="text-slate-300"> {el.attack.modifier >= 0 ? '+' : ''}{el.attack.modifier} {el.attack.range} | {el.attack.damage} {el.attack.trait?.toLowerCase()}</span>
          </div>
        </div>
      )}

      {el.features && el.features.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1">Features</h5>
          {el.features.map((feat, featIdx) => (
            <div
              key={feat.id ?? featIdx}
              className={`text-sm pl-2 border-l-2 transition-colors ${
                hoveredFeature?.cardKey === cardKey && hoveredFeature?.featureKey === `feat-${featIdx}`
                  ? 'border-yellow-500'
                  : 'border-transparent'
              }`}
            >
              <span className="font-bold text-slate-200 mr-2">
                {feat.name}{feat.type ? ` - ${feat.type[0].toUpperCase()}${feat.type.slice(1)}` : ''}:
              </span>
              <span className="text-slate-400"><FeatureDescription description={feat.description} /></span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
