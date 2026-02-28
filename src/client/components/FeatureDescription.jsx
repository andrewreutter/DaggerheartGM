/**
 * Renders a feature description with two enhancements:
 *  1. Trailing questions are moved to a new line and italicized.
 *  2. Text matching GM trigger patterns (spend…fear, mark…fear, mark…stress) is bolded.
 */

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

  // Tokenise into sentences: each token ends with . ! or ?
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

  // Collect trailing consecutive question tokens from the end
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

export function FeatureDescription({ description }) {
  if (!description) return null;
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
