/**
 * Renders a feature description with:
 *  1. Trailing questions moved to a new line and italicized.
 *  2. Text matching GM trigger patterns (spend…fear, mark…fear, mark…stress) bolded.
 *  3. Optional inline countdown widgets placed right after each "Countdown (N)" occurrence.
 */
import { parseAllCountdownValues } from '../lib/helpers.js';

const FEAR_TRIGGER_RE = /(\bspend\b[^.!?]*?\bfear\b|\bmark\b[^.!?]*?\bfear\b|\bmark\b[^.!?]*?\bstress\b)/gi;

function applyFearBolding(text) {
  if (!text) return text;
  const parts = [];
  let lastIdx = 0;
  const re = new RegExp(FEAR_TRIGGER_RE.source, 'gi');
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    parts.push(<strong key={match.index} className="text-slate-200">{match[0]}</strong>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 0 ? parts : text;
}

function splitDescription(text) {
  if (!text || !text.includes('?')) return { body: text, questions: null };

  const tokens = [];
  const re = /[^.!?]+[.!?]+\s*/g;
  let lastEnd = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[0]);
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) tokens.push(text.slice(lastEnd));
  if (tokens.length === 0) return { body: text, questions: null };

  let firstQIdx = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].trimEnd().endsWith('?')) firstQIdx = i;
    else break;
  }

  if (firstQIdx === tokens.length) return { body: text, questions: null };

  return {
    body: tokens.slice(0, firstQIdx).join('').trimEnd() || null,
    questions: tokens.slice(firstQIdx).join('').trim(),
  };
}

export function CountdownCounter({ value, onChange }) {
  return (
    <span className="inline-flex items-center gap-1 mx-1 align-middle" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-5 h-5 rounded bg-slate-700 hover:bg-red-800 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
      >−</button>
      <span className="min-w-[1.5rem] text-center font-bold text-yellow-400 text-sm tabular-nums">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-5 h-5 rounded bg-slate-700 hover:bg-green-800 text-slate-200 flex items-center justify-center text-xs font-bold transition-colors leading-none"
      >+</button>
    </span>
  );
}

/**
 * Renders a feature description string.
 *
 * Props:
 *   description       – the raw description text
 *   countdownValues   – optional number[]; when provided, a CountdownCounter is rendered
 *                       inline immediately after each "Countdown (N)" match in the text.
 *                       Index i corresponds to the i-th Countdown occurrence in order.
 *   onCountdownChange – optional (cdIdx, newValue) => void; required when countdownValues
 *                       is provided. If null, no countdown widgets are rendered.
 */
export function FeatureDescription({ description, countdownValues, onCountdownChange }) {
  if (!description) return null;

  const allCds = (countdownValues && onCountdownChange) ? parseAllCountdownValues(description) : [];

  if (allCds.length === 0) {
    const { body, questions } = splitDescription(description);
    return (
      <>
        {body && applyFearBolding(body)}
        {questions && (
          <>
            {body && <br />}
            <em>{applyFearBolding(questions)}</em>
          </>
        )}
      </>
    );
  }

  // Build segments: text (up to + including each countdown match) alternating with widgets.
  const segments = [];
  let lastIdx = 0;
  allCds.forEach((cd, cdIdx) => {
    segments.push({ type: 'text', text: description.slice(lastIdx, cd.index + cd.length), key: `t${cdIdx}` });
    segments.push({ type: 'countdown', cdIdx, key: `cd${cdIdx}` });
    lastIdx = cd.index + cd.length;
  });
  const tailText = description.slice(lastIdx);
  segments.push({ type: 'text', text: tailText, key: 'tail', isTail: true });

  // Apply body/questions split only to the trailing text segment.
  const { body: tailBody, questions } = splitDescription(tailText);

  return (
    <>
      {segments.map(seg => {
        if (seg.type === 'countdown') {
          return (
            <CountdownCounter
              key={seg.key}
              value={countdownValues[seg.cdIdx]}
              onChange={v => onCountdownChange(seg.cdIdx, v)}
            />
          );
        }
        const text = seg.isTail ? tailBody : seg.text;
        return <span key={seg.key}>{applyFearBolding(text || '')}</span>;
      })}
      {questions && (
        <><br /><em>{applyFearBolding(questions)}</em></>
      )}
    </>
  );
}
