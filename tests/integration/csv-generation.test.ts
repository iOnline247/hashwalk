import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { writeCsv, csvEscape } from '../../lib/csv.js';
import { walk } from '../../lib/walker.js';
import { hashFile } from '../../lib/hasher.js';
import { type ChecksumRow } from '../../lib/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('CSV Generation - Integration Tests', () => {
  const csvSpecialCharsDir = path.join(fixturesDir, 'csv-special-chars');

  it('should correctly escape commas in filenames', () => {
    const filename = 'file,with,commas.txt';
    
    const result = csvEscape(filename);
    
    assert.equal(result, '"file,with,commas.txt"');
  });

  it('should correctly escape double quotes in filenames', () => {
    const filename = 'file"with"quotes.txt';
    
    const result = csvEscape(filename);
    
    assert.equal(result, '"file""with""quotes.txt"');
  });

  it('should correctly escape newlines in filenames', () => {
    const filename = 'file\nwith\nnewline.txt';
    
    const result = csvEscape(filename);
    
    assert.equal(result, '"file\nwith\nnewline.txt"');
  });

  it('should correctly escape filenames with both commas and quotes', () => {
    const filename = 'file,and"both.txt';
    
    const result = csvEscape(filename);
    
    assert.equal(result, '"file,and""both.txt"');
  });

  it('should handle filenames with spaces', () => {
    const filename = 'file with spaces.txt';
    
    const result = csvEscape(filename);
    
    assert.equal(result, '"file with spaces.txt"');
  });

  it('should generate valid CSV with special character filenames', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashwalk-csv-test-'));
    const csvPath = path.join(tmpDir, 'test.csv');

    async function* generateRows(): AsyncGenerator<ChecksumRow> {
      yield {
        RelativePath: 'file,with,commas.txt',
        FileName: 'file,with,commas.txt',
        Algorithm: 'sha256',
        Hash: 'abc123'
      };
      yield {
        RelativePath: 'file"with"quotes.txt',
        FileName: 'file"with"quotes.txt',
        Algorithm: 'sha256',
        Hash: 'def456'
      };
    }

    await writeCsv(csvPath, generateRows());

    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    assert.ok(csvContent.includes('"file,with,commas.txt","file,with,commas.txt","sha256","abc123"'));
    assert.ok(csvContent.includes('"file""with""quotes.txt","file""with""quotes.txt","sha256","def456"'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate accurate CSV from fixture files with special characters', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashwalk-csv-fixture-'));
    const csvPath = path.join(tmpDir, 'fixtures.csv');

    const files = await walk(csvSpecialCharsDir);
    const sortedFiles = files.sort();
    const specialFilenames = [
      'file"with"quotes.txt',
      'file\nwith\nnewline.txt',
      'file,and"both.txt',
    ];

    try {
      if (process.platform !== 'win32') {
        for (const filename of specialFilenames) {
          const filePath = path.join(csvSpecialCharsDir, filename);
          fs.writeFileSync(filePath, `Content of ${filename}`);
          sortedFiles.push(filePath);
        }
      }

      async function* rows(): AsyncGenerator<ChecksumRow> {
        for (const file of sortedFiles) {
          const hash = await hashFile(file, 'sha256');
          yield {
            RelativePath: path.relative(csvSpecialCharsDir, file),
            FileName: path.basename(file),
            Algorithm: 'sha256',
            Hash: hash
          };
        }
      }

      await writeCsv(csvPath, rows());

      const csvContent = fs.readFileSync(csvPath, 'utf-8');

      assert.ok(csvContent.includes('"RelativePath","FileName","Algorithm","Hash"'), 'Should have CSV header');
      assert.ok(csvContent.includes('file,with,commas.txt'), 'CSV should contain file with commas');
      assert.ok(csvContent.includes('file""with""quotes.txt'), 'CSV should contain file with escaped quotes');
      assert.ok(csvContent.includes('file\nwith\nnewline.txt'), 'CSV should contain file with newlines');
      assert.ok(csvContent.includes('file,and""both.txt'), 'CSV should contain file with both special chars');
      assert.ok(csvContent.includes('file with spaces.txt'), 'CSV should contain file with spaces');
      assert.ok(csvContent.includes('normal.txt'), 'CSV should contain normal file');

      const csvLines = csvContent.split('\n');
      const firstLine = csvLines[0];
      if (firstLine !== undefined) {
        assert.equal(firstLine, '"RelativePath","FileName","Algorithm","Hash"', 'First line should be header');
      }

      fs.rmSync(tmpDir, { recursive: true, force: true });
    } finally {
      for (const filename of specialFilenames) {
        const filePath = path.join(csvSpecialCharsDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  });

  it('should parse generated CSV correctly when fields contain special characters', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashwalk-csv-parse-'));
    const csvPath = path.join(tmpDir, 'parse-test.csv');

    async function* generateRows(): AsyncGenerator<ChecksumRow> {
      yield {
        RelativePath: 'path/to/file,with,commas.txt',
        FileName: 'file,with,commas.txt',
        Algorithm: 'sha256',
        Hash: 'hash1'
      };
      yield {
        RelativePath: 'path/to/file"with"quotes.txt',
        FileName: 'file"with"quotes.txt',
        Algorithm: 'md5',
        Hash: 'hash2'
      };
    }

    await writeCsv(csvPath, generateRows());

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const lines = csvContent.trim().split('\n');
    assert.equal(lines.length, 3, 'Should have header + 2 data rows');

    const line1 = lines[1];
    const line2 = lines[2];

    if (line1 === undefined || line2 === undefined) {
      throw new Error('Lines should be defined');
    }

    const line1Fields = line1.match(/"([^"]*(?:""[^"]*)*)"/g);
    const line2Fields = line2.match(/"([^"]*(?:""[^"]*)*)"/g);

    assert.ok(line1Fields, 'Line 1 should have quoted fields');
    assert.ok(line2Fields, 'Line 2 should have quoted fields');
    assert.equal(line1Fields.length, 4, 'Line 1 should have 4 fields');
    assert.equal(line2Fields.length, 4, 'Line 2 should have 4 fields');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
