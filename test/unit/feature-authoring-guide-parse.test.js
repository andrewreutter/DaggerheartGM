import { describe, it, expect } from 'vitest';
import { slugifyHeading, parseGuideMarkdown } from '../../src/client/lib/feature-authoring-guide-parse.js';

describe('slugifyHeading', () => {
  it('slugifies numbered sections', () => {
    expect(slugifyHeading('0. Core Concepts')).toBe('0-core-concepts');
  });

  it('strips backticks and parentheses', () => {
    expect(slugifyHeading('Conditional Wrappers (`when`)')).toContain('conditional-wrappers');
  });
});

describe('parseGuideMarkdown', () => {
  const sample = `# Title

Intro line.

## First Section

Body before h3.

### Sub A

Sub body.

## Second

Only body.
`;

  it('splits preamble and ## sections', () => {
    const { preamble, sections } = parseGuideMarkdown(sample);
    expect(preamble).toContain('# Title');
    expect(preamble).toContain('Intro line.');
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('First Section');
    expect(sections[1].title).toBe('Second');
  });

  it('extracts ### under each ##', () => {
    const { sections } = parseGuideMarkdown(sample);
    expect(sections[0].subs).toHaveLength(1);
    expect(sections[0].subs[0].title).toBe('Sub A');
    expect(sections[0].subs[0].intro.trim()).toBe('Sub body.');
    expect(sections[0].subs[0].subSubs).toHaveLength(0);
    expect(sections[0].intro).toContain('Body before h3.');
    expect(sections[1].subs).toHaveLength(0);
  });

  it('extracts #### under ### when present', () => {
    const sampleWithH4 = `## Section

### Subsection

Intro text.

#### Sub-subsection A

Content A.

#### Sub-subsection B

Content B.
`;
    const { sections } = parseGuideMarkdown(sampleWithH4);
    expect(sections[0].subs).toHaveLength(1);
    expect(sections[0].subs[0].title).toBe('Subsection');
    expect(sections[0].subs[0].intro.trim()).toBe('Intro text.');
    expect(sections[0].subs[0].subSubs).toHaveLength(2);
    expect(sections[0].subs[0].subSubs[0].title).toBe('Sub-subsection A');
    expect(sections[0].subs[0].subSubs[0].markdown.trim()).toBe('Content A.');
    expect(sections[0].subs[0].subSubs[1].title).toBe('Sub-subsection B');
    expect(sections[0].subs[0].subSubs[1].markdown.trim()).toBe('Content B.');
  });
});
