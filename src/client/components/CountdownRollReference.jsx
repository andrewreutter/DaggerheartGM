import { getSessionCountdownDynamicChartRows } from '../lib/session-countdowns.js';

const DYNAMIC_CHART_ROWS = getSessionCountdownDynamicChartRows();

export const COUNTDOWN_KIND_LABELS = {
  standard: 'Standard',
  progress: 'Progress',
  consequence: 'Consequence',
};

/**
 * @param {object} props
 * @param {'standard' | 'progress' | 'consequence'} props.kind
 * @param {boolean} props.autoStandard
 * @param {boolean} props.autoDynamic
 */
export function CountdownRollReferencePanel({ kind, autoStandard, autoDynamic }) {
  const isStandard = kind === 'standard';
  const isDynamicKind = kind === 'progress' || kind === 'consequence';

  return (
    <div className="space-y-4 text-dh">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-dh-muted">When automation runs</h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-dh-muted">
          Only <span className="font-semibold text-dh">PC action rolls</span> count: the roller is a character on the table,
          not an action notification or rest roll, and the result includes Hope and Fear dice.
        </p>
      </div>

      <section
        className={`rounded-lg border px-2.5 py-2 ${
          isStandard && autoStandard
            ? 'border-sky-500/40 bg-sky-950/20'
            : 'border-dh-border bg-dh-raised/30'
        }`}
      >
        <h4 className="text-[11px] font-semibold text-dh">Standard countdown</h4>
        <p className="mt-1 text-[10px] leading-snug text-dh-muted">
          With <span className="text-dh">Auto (−1)</span> on, each qualifying roll reduces the counter by{' '}
          <span className="font-bold text-sky-300">1</span>. Difficulty is not used.
        </p>
      </section>

      <section
        className={`rounded-lg border px-2.5 py-2 ${
          isDynamicKind && autoDynamic ? 'border-violet-500/40 bg-violet-950/20' : 'border-dh-border bg-dh-raised/30'
        }`}
      >
        <h4 className="text-[11px] font-semibold text-dh">Dynamic DC chart</h4>
        <p className="mt-1 text-[10px] leading-snug text-dh-muted">
          For <span className="text-dh">Progress</span> or <span className="text-dh">Consequence</span> with{' '}
          <span className="text-dh">Auto (dynamic DC)</span>, the app reads Hope/Fear vs the roll&apos;s{' '}
          <span className="font-semibold text-dh">DC</span> (difficulty on the banner).{' '}
          <span className="italic">Critical</span> uses matching Hope/Fear dice only; all other rows need a set DC.
        </p>
        <p className="mt-1.5 text-[10px] text-dh-muted">
          Values are how many ticks <span className="font-semibold text-sky-300">Progress</span> or{' '}
          <span className="font-semibold text-violet-300">Consequence</span> lose for that outcome (0 = no change).
        </p>

        <div className="mt-2 overflow-x-auto rounded-md border border-dh-border bg-dh-canvas/30">
          <table className="w-full min-w-[260px] border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-dh-border bg-dh-raised/50">
                <th className="px-2 py-1.5 font-semibold text-dh-muted">Outcome</th>
                <th className="px-2 py-1.5 text-center font-semibold text-sky-300">Prog −</th>
                <th className="px-2 py-1.5 text-center font-semibold text-violet-300">Cons −</th>
              </tr>
            </thead>
            <tbody>
              {DYNAMIC_CHART_ROWS.map((r) => (
                <tr key={r.outcome} className="border-b border-dh-border/80 last:border-0">
                  <td className="px-2 py-1.5 align-top">
                    <div className="font-medium text-dh leading-tight">{r.title}</div>
                    <div className="mt-0.5 text-[9px] leading-snug text-dh-muted">{r.detail}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center align-middle">
                    <TickVisual value={r.progress} barClass="bg-sky-500/75" strongClass="text-sky-300" />
                  </td>
                  <td className="px-2 py-1.5 text-center align-middle">
                    <TickVisual value={r.consequence} barClass="bg-violet-500/75" strongClass="text-violet-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** @param {{ value: number, barClass: string, strongClass: string }} props */
function TickVisual({ value, barClass, strongClass }) {
  const w = value <= 0 ? 0 : Math.min(100, (value / 3) * 100);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-xs font-bold tabular-nums ${value > 0 ? strongClass : 'text-dh-muted'}`}>{value}</span>
      <div className="h-1.5 w-12 rounded-full bg-dh-border/70">
        {w > 0 ? <div className={`h-full rounded-full ${barClass}`} style={{ width: `${w}%` }} /> : null}
      </div>
    </div>
  );
}
