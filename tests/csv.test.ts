import { describe, it, expect } from 'vitest';
import { csvEscape } from '../lib/csv.js';

describe('csvEscape', () => {
  it('does not quote safe values', () => {
    expect(csvEscape('file.txt')).toBe('file.txt');
    expect(csvEscape('sha256')).toBe('sha256');
    expect(csvEscape('abcdef123456')).toBe('abcdef123456');
  });

  it('quotes values containing commas', () => {
    expect(csvEscape('data,final/file.txt'))
      .toBe('"data,final/file.txt"');
  });

  it('quotes and escapes double quotes', () => {
    expect(csvEscape('weird"name.txt'))
      .toBe('"weird""name.txt"');
  });

  it('quotes values containing newlines', () => {
    expect(csvEscape('line1\nline2'))
      .toBe('"line1\nline2"');
  });

  it('quotes error markers only if needed', () => {
    expect(csvEscape('ERROR_EACCES_1736209554123'))
      .toBe('ERROR_EACCES_1736209554123');
  });
});
