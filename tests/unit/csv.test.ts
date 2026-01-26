import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape } from '../../lib/csv.js';

describe('csvEscape - Unit Tests', () => {
  it('should quote all values unconditionally', () => {
    const input1 = 'file.txt';
    const input2 = 'sha256';
    const input3 = 'abcdef123456';

    const result1 = csvEscape(input1);
    const result2 = csvEscape(input2);
    const result3 = csvEscape(input3);

    assert.equal(result1, '"file.txt"');
    assert.equal(result2, '"sha256"');
    assert.equal(result3, '"abcdef123456"');
  });

  it('should quote values containing commas', () => {
    const input = 'data,final/file.txt';

    const result = csvEscape(input);

    assert.equal(result, '"data,final/file.txt"');
  });

  it('should quote and escape double quotes', () => {
    const input = 'weird"name.txt';

    const result = csvEscape(input);

    assert.equal(result, '"weird""name.txt"');
  });

  it('should quote values containing newlines', () => {
    const input = 'line1\nline2';

    const result = csvEscape(input);

    assert.equal(result, '"line1\nline2"');
  });

  it('should quote error markers', () => {
    const input = 'ERROR_EACCES_1736209554123';

    const result = csvEscape(input);

    assert.equal(result, '"ERROR_EACCES_1736209554123"');
  });

  it('should escape multiple double quotes correctly', () => {
    const input = 'file""with""multiple""quotes.txt';

    const result = csvEscape(input);

    assert.equal(result, '"file""""with""""multiple""""quotes.txt"');
  });

  it('should handle carriage returns', () => {
    const input = 'file\rwith\rcarriage\rreturns.txt';

    const result = csvEscape(input);

    assert.equal(result, '"file\rwith\rcarriage\rreturns.txt"');
  });

  it('should handle combination of special characters', () => {
    const input = 'complex,file"name\nwith\rall.txt';

    const result = csvEscape(input);

    assert.equal(result, '"complex,file""name\nwith\rall.txt"');
  });

  it('should handle empty strings', () => {
    const input = '';

    const result = csvEscape(input);

    assert.equal(result, '""');
  });

  it('should handle strings with only special characters', () => {
    const input = ',",\n\r';

    const result = csvEscape(input);

    assert.equal(result, '","",\n\r"');
  });

  it('should handle backslashes in paths (Windows-style paths)', () => {
    const input = 'folder\\subfolder\\file.txt';

    const result = csvEscape(input);

    // csvEscape should quote the value but preserve the backslashes
    // The conversion to forward slashes happens at the source (cli.ts)
    assert.equal(result, '"folder\\subfolder\\file.txt"');
  });
});
