import { X } from 'lucide-react';

const STAT_ROWS = [
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'hp_max', label: 'HP' },
  { key: 'major', label: 'Major Threshold' },
  { key: 'severe', label: 'Severe Threshold' },
  { key: 'stress_max', label: 'Stress' },
  { key: 'atk', label: 'ATK Mod' },
  { key: 'damage', label: 'Damage' },
];

function getBefore(formData) {
  return {
    difficulty: formData.difficulty ?? '-',
    hp_max: formData.hp_max ?? '-',
    major: formData.hp_thresholds?.major ?? '-',
    severe: formData.hp_thresholds?.severe ?? '-',
    stress_max: formData.stress_max ?? '-',
    atk: formData.attack?.modifier ?? '-',
    damage: formData.attack?.damage || '-',
  };
}

function getAfter(merged) {
  return {
    difficulty: merged.difficulty ?? '-',
    hp_max: merged.hp_max ?? '-',
    major: merged.hp_thresholds?.major ?? '-',
    severe: merged.hp_thresholds?.severe ?? '-',
    stress_max: merged.stress_max ?? '-',
    atk: merged.attack?.modifier ?? '-',
    damage: merged.attack?.damage || '-',
  };
}

/**
 * Modal shown when the user changes Tier or Role and has customized stats.
 * Displays before/after comparison and lets them apply the changes or keep current stats.
 */
export function AdversaryStatChangeModal({
  mode, // 'scale' | 'baseline'
  newTier,
  newRole,
  formData,
  afterStats,
  onApply,
  onKeepCurrent,
  onClose,
}) {
  const capRole = r => r.charAt(0).toUpperCase() + r.slice(1);
  const before = getBefore(formData);
  const after = getAfter(afterStats);

  const title = mode === 'scale'
    ? `Scale stats to Tier ${newTier}?`
    : `Apply recommended stats for ${capRole(newRole)} Tier ${newTier}?`;

  const subtitle = mode === 'scale'
    ? 'Adjusts values by the guide\'s per-tier deltas while keeping your customizations. Attack damage uses the Tier baseline pool.'
    : 'Replaces stats with guide defaults for this role and tier.';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between p-5 pb-2">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white shrink-0 ml-2">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3">
          <div className="bg-slate-900/80 rounded-lg border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-500 font-semibold">Stat</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-semibold">Current</th>
                  <th className="text-right py-2 px-3 text-amber-400/90 font-semibold">New</th>
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map(({ key, label }) => {
                  const b = before[key];
                  const a = after[key];
                  const changed = String(b) !== String(a);
                  return (
                    <tr key={key} className={`border-b border-slate-700/70 last:border-0 ${changed ? 'bg-slate-800/50' : ''}`}>
                      <td className="py-1.5 px-3 text-slate-300">{label}</td>
                      <td className="py-1.5 px-3 text-right text-slate-400 font-mono">{b}</td>
                      <td className={`py-1.5 px-3 text-right font-mono ${changed ? 'text-amber-300' : 'text-slate-500'}`}>
                        {a}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-5 pt-2">
          <button
            onClick={onApply}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Apply These Changes
          </button>
          <button
            onClick={onKeepCurrent}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            Change {mode === 'scale' ? 'Tier' : 'Tier & Role'} Only (keep current stats)
          </button>
        </div>
      </div>
    </div>
  );
}
