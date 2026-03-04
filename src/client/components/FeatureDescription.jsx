/**
 * Renders a feature description with:
 *  1. Markdown rendering (bold, italic, lists, etc.)
 *  2. Text matching GM trigger patterns (spend…fear, mark…fear, mark…stress) bolded.
 *  3. Trailing questions moved to a new line and italicized.
 *  4. Optional inline countdown widgets placed right after each "Countdown (N)" occurrence.
 *
 * For the common (no-countdown) case, description is rendered as markdown HTML with
 * fear-trigger bolding and question italicizing applied as post-processing steps.
 *
 * For the countdown path (GM Table interactive mode), the plain-text React approach is
 * retained because countdown widgets require inline React components between text segments.
 */
import { parseAllCountdownValues, stripHtml } from '../lib/helpers.js';
import { renderMarkdown } from '../lib/markdown.js';

// ---------------------------------------------------------------------------
// Shared: trailing question detection
// ---------------------------------------------------------------------------

/**
 * Tokenize `text` into sentence-ending chunks and find the index of the first
 * token in the contiguous trailing run of `?`-ending sentences.
 *
 * Returns `{ body, questions }` where `body` is the non-question prefix (may be
 * null/empty) and `questions` is the trailing question text (null if none found).
 *
 * Strips HTML tags before checking sentence endings so it works correctly even
 * when the text has already had <strong> or similar wrapping applied.
 */
function splitAtTrailingQuestions(text) {
  if (!text || !text.includes('?')) return { body: text || null, questions: null };

  const tokenRe = /[^.!?]*[.!?]+\s*/g;
  const tokens = [];
  let lastEnd = 0;
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    tokens.push(m[0]);
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) tokens.push(text.slice(lastEnd));
  if (tokens.length === 0) return { body: text, questions: null };

  const stripTags = s => s.replace(/<[^>]+>/g, '');
  let firstQIdx = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (stripTags(tokens[i]).trimEnd().endsWith('?')) firstQIdx = i;
    else break;
  }

  if (firstQIdx === tokens.length) return { body: text, questions: null };

  return {
    body: tokens.slice(0, firstQIdx).join('').trimEnd() || null,
    questions: tokens.slice(firstQIdx).join('').trim(),
  };
}

// ---------------------------------------------------------------------------
// Fear trigger bolding
// ---------------------------------------------------------------------------

const FEAR_TRIGGER_RE = /(\bspend\b[^.!?<]*?\bfear\b|\bmark\b[^.!?<]*?\bfear\b|\bmark\b[^.!?<]*?\bstress\b)/gi;

/**
 * Apply fear-bolding to an HTML string without disturbing existing tags.
 * Iterates through text nodes (portions between HTML tags) and wraps matches.
 */
function applyFearBoldingToHtml(html) {
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag;
    return text.replace(FEAR_TRIGGER_RE, '<strong class="text-slate-200">$1</strong>');
  });
}

// ---------------------------------------------------------------------------
// Trailing question italicizing (HTML path)
// ---------------------------------------------------------------------------

/**
 * In the last <p> block of the rendered HTML, find trailing sentences ending in
 * '?' and wrap them in <em>, separated from the body by a <br>.
 * Uses splitAtTrailingQuestions on the last paragraph's content.
 */
function applyQuestionItalicsToHtml(html) {
  const lastPRe = /(<p>)([\s\S]*?)(<\/p>)(?![\s\S]*<p>)/i;
  const match = lastPRe.exec(html);
  if (!match) return html;

  const [fullMatch, openTag, content, closeTag] = match;
  const { body, questions } = splitAtTrailingQuestions(content);
  if (!questions) return html;

  const newContent = body
    ? `${body}<br><em>${questions}</em>`
    : `<em>${questions}</em>`;

  return html.slice(0, match.index) + openTag + newContent + closeTag + html.slice(match.index + fullMatch.length);
}

// ---------------------------------------------------------------------------
// React-side fear bolding (used by countdown path)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Countdown counter widget
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders a feature description string.
 *
 * Props:
 *   description       – the raw description text (plain text or markdown)
 *   countdownValues   – optional number[]; when provided, a CountdownCounter is rendered
 *                       inline immediately after each "Countdown (N)" match in the text.
 *                       Index i corresponds to the i-th Countdown occurrence in order.
 *   onCountdownChange – optional (cdIdx, newValue) => void; required when countdownValues
 *                       is provided. If null, no countdown widgets are rendered.
 */
export function FeatureDescription({ description: rawDescription, countdownValues, onCountdownChange }) {
  const description = stripHtml(rawDescription);
  if (!description) return null;

  const allCds = (countdownValues && onCountdownChange) ? parseAllCountdownValues(description) : [];

  // Common path: no countdown widgets — render markdown with HTML post-processing
  if (allCds.length === 0) {
    let html = applyQuestionItalicsToHtml(applyFearBoldingToHtml(renderMarkdown(description)));
    // Strip single wrapping <p> so description flows inline after feature title (no unwanted newline)
    const singleP = html.trim().match(/^<p>([\s\S]*?)<\/p>$/);
    if (singleP && !singleP[1].includes('<p')) html = singleP[1];
    return (
      <span
        className="dh-md"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Countdown path: keep React component approach (widgets must be inline React nodes).
  // Question splitting uses the shared splitAtTrailingQuestions on the plain-text tail.
  const segments = [];
  let lastIdx = 0;
  allCds.forEach((cd, cdIdx) => {
    segments.push({ type: 'text', text: description.slice(lastIdx, cd.index + cd.length), key: `t${cdIdx}` });
    segments.push({ type: 'countdown', cdIdx, key: `cd${cdIdx}` });
    lastIdx = cd.index + cd.length;
  });
  const tailText = description.slice(lastIdx);
  segments.push({ type: 'text', text: tailText, key: 'tail', isTail: true });

  const { body: tailBody, questions } = splitAtTrailingQuestions(tailText);

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
