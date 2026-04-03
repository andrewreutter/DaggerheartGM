#!/usr/bin/env node
/**
 * Splits daggerheart-srd/README.md (full SRD as one markdown file) into
 * per-section files under data/srd-text-chunks/ for RAG indexing or manual review.
 *
 * Usage: node scripts/chunk-srd-readme.mjs
 *
 * Breadcrumbs: Each chunk file includes a YAML frontmatter `breadcrumb` string and
 * `breadcrumb_titles` array so retrievers and readers see where the excerpt lives in
 * the SRD hierarchy (major section → heading → subheading → …).
 *
 * Rationale (see HTML comment at top of each output file): embedding breadcrumbs in
 * the chunk text (and/or metadata) helps retrieval and generation — a short passage
 * may match a vague query only when the parent section is known, and rerankers/
 * readers get explicit context. Tradeoff: more tokens per chunk; for very small leaf
 * sections the breadcrumb can dominate — tune MAX_CHUNK_CHARS or merge tiny sections
 * downstream if needed.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const README_PATH = join(REPO_ROOT, 'daggerheart-srd', 'README.md');
const OUT_DIR = join(REPO_ROOT, 'data', 'srd-text-chunks');

/** Target max characters per written chunk body (before frontmatter). Oversized sections are split into part N. */
const MAX_CHUNK_CHARS = 10_000;

const HEADING_LINE_RE = /^(#{1,6})\s+(.+?)\s*$/;

function slugifySegment(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function buildFilenameSlug(stack) {
  const parts = stack.map((s) => slugifySegment(s.title)).filter(Boolean);
  let slug = parts.join('--') || 'chunk';
  if (slug.length > 140) {
    const h = createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 10);
    slug = `${slug.slice(0, 100)}--${h}`;
  }
  return slug;
}

/**
 * Split a large markdown body on paragraph boundaries; hard-split only if a single block exceeds max.
 */
function splitBodyIntoParts(body, maxChars) {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const blocks = trimmed.split(/\n\n+/);
  const parts = [];
  let cur = '';

  const pushCur = () => {
    if (cur.trim()) parts.push(cur.trim());
    cur = '';
  };

  for (const block of blocks) {
    const next = cur ? `${cur}\n\n${block}` : block;
    if (next.length > maxChars && cur.length > 0) {
      pushCur();
      if (block.length > maxChars) {
        for (let i = 0; i < block.length; i += maxChars) {
          parts.push(block.slice(i, i + maxChars));
        }
      } else {
        cur = block;
      }
    } else if (block.length > maxChars) {
      pushCur();
      for (let i = 0; i < block.length; i += maxChars) {
        parts.push(block.slice(i, i + maxChars));
      }
    } else {
      cur = next;
    }
  }
  pushCur();

  return parts.length ? parts : [trimmed.slice(0, maxChars)];
}

function parseHeadingLine(line) {
  const m = line.match(HEADING_LINE_RE);
  if (!m) return null;
  return { level: m[1].length, title: m[2].trim() };
}

/** First `##` title in the stack (major “chapter”); falls back to document `#` title. */
function inferChapter(stack) {
  const h2 = stack.find((s) => s.level === 2);
  if (h2) return h2.title;
  const h1 = stack.find((s) => s.level === 1);
  return h1 ? h1.title : null;
}

function escapeYamlString(s) {
  if (/[\n":]/.test(s)) return JSON.stringify(s);
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildFileContent({
  breadcrumbTitles,
  chapter,
  headingLevel,
  body,
  partIndex,
  partTotal,
}) {
  const breadcrumb = breadcrumbTitles.join(' › ');
  const titlesYaml = breadcrumbTitles.map((t) => `    - ${escapeYamlString(t)}`).join('\n');

  const meta = [
    '---',
    `breadcrumb: ${escapeYamlString(breadcrumb)}`,
    'breadcrumb_titles:',
    titlesYaml,
    chapter ? `chapter: ${escapeYamlString(chapter)}` : null,
    `heading_level: ${headingLevel}`,
    `source_file: daggerheart-srd/README.md`,
    partTotal > 1 ? `chunk_part: ${partIndex}` : null,
    partTotal > 1 ? `chunk_part_total: ${partTotal}` : null,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  const comment = `<!--
  Breadcrumb context: Storing the section path (chapter › heading › …) helps RAG and
  humans disambiguate short or generic excerpts — retrieval may surface a paragraph
  because it matches a keyword, while the real signal is "this is under Stress" or
  "Leveling Up". Downsides: extra tokens per chunk; redundant if your embedder already
  sees parent sections. Hybrid approach: keep breadcrumbs in metadata only and prepend
  a one-line summary to the embedded text at index time.
-->`;

  const titleLine = `# ${breadcrumbTitles[breadcrumbTitles.length - 1] || 'Section'}\n\n`;

  return `${meta}\n\n${comment}\n${titleLine}${body.trim()}\n`;
}

async function main() {
  const raw = await readFile(README_PATH, 'utf8');
  const lines = raw.split(/\n/);

  /** @type {{ level: number, title: string }[]} */
  const stack = [];
  /** @type {string[]} */
  let buffer = [];

  /** @type {{ stack: { level: number, title: string }[], lines: string[] }[]} */
  const sections = [];

  const flush = () => {
    if (!stack.length) return;
    const body = buffer.join('\n');
    sections.push({ stack: stack.map((s) => ({ ...s })), lines: body.split('\n') });
    buffer = [];
  };

  for (const line of lines) {
    const heading = parseHeadingLine(line);
    if (heading) {
      flush();
      while (stack.length && stack[stack.length - 1].level >= heading.level) {
        stack.pop();
      }
      stack.push({ level: heading.level, title: heading.title });
      continue;
    }
    buffer.push(line);
  }
  flush();

  await mkdir(OUT_DIR, { recursive: true });

  // Remove previous *.md outputs so stale chunks disappear if the SRD structure changes.
  const existing = await readdir(OUT_DIR);
  await Promise.all(
    existing
      .filter((f) => f.endsWith('.md') && /^\d{5}-/.test(f))
      .map((f) => rm(join(OUT_DIR, f), { force: true })),
  );

  let fileIndex = 0;

  for (const { stack: secStack, lines: bodyLines } of sections) {
    const body = bodyLines.join('\n');
    const breadcrumbTitles = secStack.map((s) => s.title);
    const chapter = inferChapter(secStack);
    const headingLevel = secStack.length ? secStack[secStack.length - 1].level : 0;
    const parts = splitBodyIntoParts(body, MAX_CHUNK_CHARS);
    const partTotal = parts.length;

    for (let pi = 0; pi < parts.length; pi++) {
      fileIndex += 1;
      const partSuffix = partTotal > 1 ? `--part-${String(pi + 1).padStart(2, '0')}-of-${String(partTotal).padStart(2, '0')}` : '';
      const baseSlug = buildFilenameSlug(secStack);
      const name = `${String(fileIndex).padStart(5, '0')}-${baseSlug}${partSuffix}.md`;
      const path = join(OUT_DIR, name);

      const content = buildFileContent({
        breadcrumbTitles,
        chapter,
        headingLevel,
        body: parts[pi],
        partIndex: pi + 1,
        partTotal,
      });

      await writeFile(path, content, 'utf8');
    }
  }

  console.error(`Wrote ${fileIndex} chunk file(s) to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
