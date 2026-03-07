/**
 * SceneAdoptDialog — shown when a scene with active budget factors is added to
 * the Game Table.  Asks whether to apply the scene's factors to the table.
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
  if (active.length === 0) return <p className="text-slate-500 text-xs italic">{emptyLabel}</p>;
  return (
    <ul className="space-y-0.5">
      {active.map(([key, { label, value }]) => (
        <li key={key} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-300">{label}</span>
          <span className={`font-mono text-xs font-semibold ${value < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {value > 0 ? `+${value}` : value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SceneAdoptDialog({ scene, currentTableMods, onApply, onKeep, onCancel }) {
  const tableHasActive = currentTableMods && Object.keys(MOD_LABELS).some(k => currentTableMods[k]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white mb-1">Apply Budget Factors?</h2>
          <p className="text-slate-400 text-sm">
            <span className="text-amber-300 font-medium">{scene?.name || 'This scene'}</span> has battle budget factors set.
            Apply them to the table?
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Scene factors</p>
            <ActiveModList mods={scene?.battleMods} emptyLabel="None" />
          </div>

          {tableHasActive && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Current table factors (will be replaced)</p>
              <ActiveModList mods={currentTableMods} emptyLabel="None" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onApply}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Apply Scene Factors to Table
          </button>
          <button
            onClick={onKeep}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Keep Current Table Factors
          </button>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-300 text-xs py-1 transition-colors"
          >
            Cancel (don't add scene)
          </button>
        </div>
      </div>
    </div>
  );
}
