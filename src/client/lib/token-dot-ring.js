/**
 * Layout for the token border pip ring (HP / Stress / Armor / conditions).
 * Groups with `total === 0` are ignored, so a conditions group only takes arc
 * space when the token actually has conditions.
 *
 * @param {number} sizeW
 * @param {number} sizeH
 * @param {{ total: number, filled?: number, color?: string, kind?: string, marks?: { name?: string, symbol?: string }[] }[]} groups
 * @returns {{ dr: number, dots: object[] } | null}
 */
export function layoutTokenDotRing(sizeW, sizeH, groups) {
  const list = (Array.isArray(groups) ? groups : []).filter((g) => g && g.total > 0);
  const numGroups = list.length;
  if (numGroups === 0) return null;
  const totalDots = list.reduce((s, g) => s + g.total, 0);
  if (totalDots === 0) return null;

  const cx = sizeW / 2;
  const cy = sizeH / 2;
  const rx = Math.max(1, sizeW / 2 - 1);
  const ry = Math.max(1, sizeH / 2 - 1);
  // Average radius drives dot size/spacing math (exact for circles — the default 1×1 token —
  // and a reasonable visual approximation for ellipses).
  const rr = (rx + ry) / 2;

  const minSize = Math.min(sizeW, sizeH);
  const preferredDr = Math.max(2, Math.round(minSize * 0.09));
  // Max dr where the gap between groups fits one empty dot slot (2×dotSpacing center-to-center):
  // totalArc = (totalDots−numGroups)·ds + numGroups·2·ds = (totalDots+numGroups)·ds = 2π
  // ds = (2dr+1)/rr → dr = (2π·rr/(totalDots+numGroups) − 1) / 2
  const maxDr = (2 * Math.PI * rr / (totalDots + numGroups) - 1) / 2;
  const dr = Math.max(1, Math.min(preferredDr, maxDr));

  const dotSpacing = (2 * dr + 1) / rr;
  const groupWidths = list.map((g) => Math.max(0, g.total - 1) * dotSpacing);
  const totalGroupArc = groupWidths.reduce((s, w) => s + w, 0);
  const gap = (2 * Math.PI - totalGroupArc) / numGroups;

  const dots = [];
  let cursor = -Math.PI / 2 - groupWidths[0] / 2;
  list.forEach((group, gi) => {
    const isCondition = group.kind === 'condition';
    for (let i = 0; i < group.total; i++) {
      const angle = cursor + i * dotSpacing;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      const mark = isCondition ? group.marks?.[i] : null;
      dots.push({
        x,
        y,
        color: group.color,
        filled: i < (group.filled ?? 0),
        key: `${gi}-${i}`,
        kind: isCondition ? 'condition' : 'resource',
        name: isCondition ? mark?.name : (group.name || null),
        symbol: mark?.symbol,
      });
    }
    cursor += groupWidths[gi] + gap;
  });

  return { dr, dots };
}
