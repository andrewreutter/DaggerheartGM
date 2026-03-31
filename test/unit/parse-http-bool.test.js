import { describe, it, expect } from 'vitest';
import { parseHttpBooleanLoose } from '../../src/parse-http-bool.js';

describe('parseHttpBooleanLoose', () => {
  it('treats string "false" as false (unlike !!value)', () => {
    expect(parseHttpBooleanLoose('false', false)).toBe(false);
    expect(parseHttpBooleanLoose('false', true)).toBe(false);
    expect(Boolean('false')).toBe(true);
  });

  it('parses common true/false shapes', () => {
    expect(parseHttpBooleanLoose(true)).toBe(true);
    expect(parseHttpBooleanLoose(false)).toBe(false);
    expect(parseHttpBooleanLoose('true')).toBe(true);
    expect(parseHttpBooleanLoose('1')).toBe(true);
    expect(parseHttpBooleanLoose('0')).toBe(false);
    expect(parseHttpBooleanLoose(undefined, false)).toBe(false);
    expect(parseHttpBooleanLoose(null, false)).toBe(false);
  });
});
