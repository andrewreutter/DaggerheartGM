import { Sparkles, Zap, Shield, ShieldCheck } from 'lucide-react';

/**
 * Renders repeated stat icons for Hope, Stress, and armor slot costs (mark / clear),
 * placed immediately after a feature or chip name.
 */
export function FeatureResourceCostIcons({ action, iconSize = 10, className = '' }) {
  if (!action) return null;
  const hc = Math.max(0, Number(action.hopeCost) || 0);
  const sc = Math.max(0, Number(action.stressCost) || 0);
  const am = Math.max(0, Number(action.armorMark) || 0);
  const ac = Math.max(0, Number(action.armorClear) || 0);
  if (!hc && !sc && !am && !ac) return null;
  const parts = [];
  if (hc) parts.push(`${hc} Hope`);
  if (sc) parts.push(`${sc} Stress`);
  if (am) parts.push(`Mark ${am} Armor`);
  if (ac) parts.push(`Clear ${ac} Armor`);
  const label = parts.join(', ');
  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 ${className}`}
      title={label}
      aria-label={label}
    >
      {Array.from({ length: hc }, (_, i) => (
        <Sparkles key={`h-${i}`} size={iconSize} className="text-amber-400" />
      ))}
      {Array.from({ length: sc }, (_, i) => (
        <Zap key={`s-${i}`} size={iconSize} className="text-orange-400" />
      ))}
      {Array.from({ length: am }, (_, i) => (
        <Shield key={`am-${i}`} size={iconSize} className="text-cyan-400" />
      ))}
      {Array.from({ length: ac }, (_, i) => (
        <ShieldCheck key={`ac-${i}`} size={iconSize} className="text-emerald-400" />
      ))}
    </span>
  );
}
