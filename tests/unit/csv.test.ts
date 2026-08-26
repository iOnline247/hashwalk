import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { csvEscape, rows, writeCsv } from '../../lib/csv.js';
import { setImmediate } from 'node:timers';

async function* emptyRows() {
  // No rows — writeCsv writes only the header then calls stream.end()
}

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

describe('rows - Unit Tests', () => {
  it('should replace backslashes with forward slashes in RelativePath', async () => {
    // Mutant 15: replace(/\\/g, '/') → replace(/\\/g, '')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-backslash-'));
    const csvFile = path.join(tmpDir, 'out.csv');

    try {
      const testFile = path.join(tmpDir, 'file.txt');
      fs.writeFileSync(testFile, 'content');

      // Mock path.relative to return a Windows-style backslash path
      mock.method(
        path,
        'relative',
        (_from: string, _to: string) => 'sub\\dir\\file.txt',
      );

      try {
        await writeCsv(csvFile, rows([testFile], tmpDir, 'sha256'));
        const content = fs.readFileSync(csvFile, 'utf-8');

        assert.ok(
          content.includes('sub/dir/file.txt'),
          'Should convert backslashes to forward slashes in RelativePath',
        );
        assert.ok(
          !content.includes('sub\\dir\\file.txt'),
          'Should not contain raw backslashes in RelativePath',
        );
        // With mutation (replace to ''), backslashes are deleted: 'subdirfile.txt'
        assert.ok(
          !content.includes('subdirfile.txt'),
          'Should not strip backslashes (mutation guard)',
        );
      } finally {
        mock.restoreAll();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('writeCsv - Unit Tests', () => {
  it('should end each data row with a newline character', async () => {
    // Mutant 16: + '\n' → + ''  (rows without newlines)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-newline-'));
    const testFile = path.join(tmpDir, 'test.txt');
    const csvFile = path.join(tmpDir, 'output.csv');

    try {
      fs.writeFileSync(testFile, 'test content');
      await writeCsv(csvFile, rows([testFile], tmpDir, 'sha256'));
      const content = fs.readFileSync(csvFile, 'utf-8');

      // Every row (header and data) should end with \n, so splitting on \n
      // should produce an empty trailing element.
      assert.ok(
        content.endsWith('\n'),
        'CSV content should end with a newline',
      );

      // Splitting on \n: [header, datarow, ''] - at least 3 elements
      const parts = content.split('\n');
      assert.ok(
        parts.length >= 3,
        'Should have header + data rows + trailing empty',
      );
      assert.equal(
        parts[parts.length - 1],
        '',
        'Trailing newline should produce empty last element',
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should reject when the write stream emits an error', async () => {
    // Mutant csv.ts L53:15: stream.on('error', reject) → stream.on('', reject)
    // Without the error handler, stream errors are silently ignored.
    const { EventEmitter } = await import('node:events');

    const fakeStream = new EventEmitter() as ReturnType<
      typeof fs.createWriteStream
    >;
    // Satisfy duck-typing: writeCsv calls .write(), .on(), and .end()
    (fakeStream as unknown as Record<string, unknown>).write = () => true;
    (fakeStream as unknown as Record<string, unknown>).end = () => {
      // Emit error asynchronously so the promise handlers are set up first
      setImmediate(() =>
        fakeStream.emit('error', new Error('Write stream error'))
      );
    };

    mock.method(fs, 'createWriteStream', () => fakeStream);

    try {
      await assert.rejects(
        () => writeCsv('/fake/path.csv', emptyRows()),
        /Write stream error/,
        'writeCsv should reject when the write stream emits an error',
      );
    } finally {
      mock.restoreAll();
    }
  });

  it('should await drain when stream.write() returns false (backpressure)', async () => {
    // Mutant csv.ts L49: if (!ok) → if (ok) — the drain branch is never taken.
    const { EventEmitter } = await import('node:events');

    let writeCallCount = 0;
    let drainEmitted = false;
    const fakeStream = new EventEmitter() as ReturnType<
      typeof fs.createWriteStream
    >;
    (fakeStream as unknown as Record<string, unknown>).write = (_chunk: string) => {
      writeCallCount++;
      // Return false on first data-row write to trigger backpressure path
      if (writeCallCount === 2 && !drainEmitted) {
        setImmediate(() => {
          drainEmitted = true;
          fakeStream.emit('drain');
        });
        return false;
      }
      return true;
    };
    (fakeStream as unknown as Record<string, unknown>).end = () => {
      setImmediate(() => fakeStream.emit('finish'));
    };

    mock.method(fs, 'createWriteStream', () => fakeStream);

    try {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-drain-'));
      const testFile1 = path.join(tmpDir, 'file1.txt');
      const testFile2 = path.join(tmpDir, 'file2.txt');
      const csvFile = path.join(tmpDir, 'output.csv');

      try {
        fs.writeFileSync(testFile1, 'content1');
        fs.writeFileSync(testFile2, 'content2');

        await writeCsv(csvFile, rows([testFile1, testFile2], tmpDir, 'sha256'));
        assert.ok(drainEmitted, 'Drain event should have been emitted during backpressure');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } finally {
      mock.restoreAll();
    }
  });
});
