/**
 * Parse docs/feature-authoring-guide.md for split-pane UI: ## sections, ### subsections, #### sub-subsections.
 * IDs are stable slugified titles with collision suffixes.
 */

export function slugifyHeading(title) {
  const s = String(title)
    .toLowerCase()
    .replace(/[`'"()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'section';
}

function takeUniqueId(base, used) {
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n++;
  }
  used.add(id);
  return id;
}

export function parseH4SubSubsections(subsectionMd, usedIds) {
  const lines = subsectionMd.split('\n');
  const intro = [];
  const subSubs = [];
  let currentTitle = null;
  let currentLines = [];

  const flush = () => {
    if (currentTitle !== null) {
      const base = slugifyHeading(currentTitle);
      const id = takeUniqueId(base, usedIds);
      subSubs.push({
        title: currentTitle,
        id,
        markdown: currentLines.join('\n'),
      });
      currentTitle = null;
      currentLines = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('#### ')) {
      flush();
      currentTitle = line.slice(5).trim();
      currentLines = [];
    } else if (currentTitle === null) {
      intro.push(line);
    } else {
      currentLines.push(line);
    }
  }
  flush();
  return { intro: intro.join('\n'), subSubs };
}

export function parseH3Subsections(sectionMd, usedIds) {
  const lines = sectionMd.split('\n');
  const intro = [];
  const subs = [];
  let currentTitle = null;
  let currentLines = [];

  const flush = () => {
    if (currentTitle !== null) {
      const base = slugifyHeading(currentTitle);
      const id = takeUniqueId(base, usedIds);
      const subsectionMd = currentLines.join('\n');
      const { intro: subIntro, subSubs } = parseH4SubSubsections(subsectionMd, usedIds);
      subs.push({
        title: currentTitle,
        id,
        intro: subIntro,
        subSubs,
      });
      currentTitle = null;
      currentLines = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('### ') && !line.startsWith('####')) {
      flush();
      currentTitle = line.slice(4).trim();
      currentLines = [];
    } else if (currentTitle === null) {
      intro.push(line);
    } else {
      currentLines.push(line);
    }
  }
  flush();
  return { intro: intro.join('\n'), subs };
}

export function parseGuideMarkdown(markdown) {
  const lines = markdown.split('\n');
  const usedIds = new Set();
  const preamble = [];
  const sections = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('## ') && !line.startsWith('###')) {
      const title = line.slice(3).trim();
      const base = slugifyHeading(title);
      const id = takeUniqueId(base, usedIds);
      i++;
      const bodyLines = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith('## ') && !l.startsWith('###')) break;
        bodyLines.push(l);
        i++;
      }
      const sectionMd = bodyLines.join('\n');
      const { intro, subs } = parseH3Subsections(sectionMd, usedIds);
      sections.push({ title, id, intro, subs });
    } else {
      preamble.push(line);
      i++;
    }
  }
  return { preamble: preamble.join('\n'), sections };
}
