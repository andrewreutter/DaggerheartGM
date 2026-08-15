import { useState } from 'react';
import { sceneHasActiveBattleMods } from '../lib/scene-load-dialog.js';

/**
 * SceneAdoptDialog — shown after the GM picks a scene in Load Scene / Add to Table.
 * One decision UI: Add vs Replace, plus optional Apply Scene Factors when the
 * scene has active budget mods (avoids stacking two modals).
 */

const MOD_LABELS = {
  lessDifficult:         { label: 'Less difficult / shorter fight',                       value: -1 },
  damageBoostPlusOne:    { label: '+1 damage to all adversaries',                         value: -1 },
  damageBoostStatic:     { label: '+2 damage to all adversaries',                         value: -2 },
  damageBoostD4:         { label: '+1d4 damage to all adversaries',                       value: -2 },
  slightlyMoreDangerous: { label: 'Slightly more dangerous / slightly longer fight',      value: +1 },
  moreDangerous:         { label: 'More dangerous / longer fight',                        value: +2 },
};

function ActiveModList({ mods, emptyLabel }) {
  const active = Object.entries(MOD_LABELS).filter(([key]) => mods?.[key]);
  if (active.length === 0) return <p className="text-dh-muted text-xs italic">{emptyLabel}</p>;
  return (
    <ul className="space-y-0.5">
      {active.map(([key, { label, value }]) => (
        <li key={key} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-dh">{label}</span>
          <span className={`font-mono text-xs font-semibold ${value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {value > 0 ? `+${value}` : value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SceneAdoptDialog({ scene, tableHref, currentTableMods, onConfirm, onCancel }) {
  const hasSceneMods = sceneHasActiveBattleMods(scene);
  const tableHasActive = currentTableMods && Object.keys(MOD_LABELS).some(k => currentTableMods[k]);
  const [applyFactors, setApplyFactors] = useState(hasSceneMods);

  const confirm = (mode) => {
    onConfirm?.({ mode, applySceneBattleMods: hasSceneMods && applyFactors });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
      <div className="bg-dh-raised border border-dh-strong rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Load scene</h2>
          <p className="text-dh-muted text-sm">
            How should{' '}
            <span className="text-amber-300 font-medium">{scene?.name || 'this scene'}</span>
            {' '}join the table?
          </p>
        </div>

        {hasSceneMods && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-dh-muted uppercase tracking-wide mb-1.5">Scene factors</p>
              <ActiveModList mods={scene?.battleMods || scene?.tableBattleMods} emptyLabel="None" />
            </div>

            {tableHasActive && (
              <div>
                <p className="text-xs font-semibold text-dh-muted uppercase tracking-wide mb-1.5">Current table factors (replaced if applied)</p>
                <ActiveModList mods={currentTableMods} emptyLabel="None" />
              </div>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyFactors}
                onChange={(e) => setApplyFactors(e.target.checked)}
                className="mt-0.5 accent-amber-500"
              />
              <span className="text-sm text-dh">Apply scene factors to the table</span>
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            tabIndex={0}
            onClick={() => confirm('add')}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Add to table
          </button>
          <p className="text-xs text-dh-muted -mt-1 px-0.5">
            Append this scene onto existing maps, adversaries, environments, notes, and countdowns.
          </p>
          <button
            type="button"
            tabIndex={0}
            onClick={() => confirm('replace')}
            className="w-full bg-dh-hover hover:bg-dh-hover text-dh rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Replace table content
          </button>
          <p className="text-xs text-dh-muted -mt-1 px-0.5">
            Remove current maps, adversaries, environments, notes, and countdowns, then load this scene. Characters stay on the table.
          </p>
          <button
            type="button"
            tabIndex={0}
            onClick={onCancel}
            className="text-dh-muted hover:text-dh text-xs py-1 transition-colors"
          >
            Cancel
          </button>
          {tableHref && (
            <p className="text-center pt-1">
              <a
                href={tableHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-400/90 hover:text-sky-300 hover:underline"
              >
                Open table in new tab
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
