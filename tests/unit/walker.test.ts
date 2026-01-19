import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walk } from '../../lib/walker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('walk - Unit Tests', () => {
  const walkerTestDir = path.join(fixturesDir, 'walker-test');

  it('should recursively walk directory and return all file paths', async () => {
    const expectedFiles = [
      path.join(walkerTestDir, 'file1.txt'),
      path.join(walkerTestDir, 'file2.txt'),
      path.join(walkerTestDir, 'subdir1', 'file3.txt'),
      path.join(walkerTestDir, 'subdir1', 'nested', 'file4.txt'),
      path.join(walkerTestDir, 'subdir2', 'file5.txt')
    ].sort();

    const result = await walk(walkerTestDir);
    const sortedResult = result.sort();

    assert.equal(sortedResult.length, 5);
    assert.deepEqual(sortedResult, expectedFiles);
  });

  it('should return empty array for empty directory', async () => {
    let tmpDir;

    try {
      tmpDir = fs.mkdtempSync(path.join(fixturesDir, 'empty-dir-'));
      
      const result = await walk(tmpDir);

      assert.equal(result.length, 0);
      assert.deepEqual(result, []);
    } finally {
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });

  it('should only return files, not directories', async () => {
    const result = await walk(walkerTestDir);

    for (const filePath of result) {
      const stats = fs.statSync(filePath);
      assert.ok(stats.isFile(), `${filePath} should be a file`);
    }
  });
});
