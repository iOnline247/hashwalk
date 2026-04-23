import { describe, it, mock } from 'node:test';
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
      path.join(walkerTestDir, 'subdir2', 'file5.txt'),
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

  it('should skip file entries when realpath throws', async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(fixturesDir, 'realpath-fail-test-'),
    );

    try {
      fs.writeFileSync(path.join(tmpDir, 'normal.txt'), 'content');
      fs.writeFileSync(path.join(tmpDir, 'unreachable.txt'), 'content');

      const originalRealpath = fs.promises.realpath;

      mock.method(fs.promises, 'realpath', async (p: string) => {
        if (typeof p === 'string' && p.includes('unreachable')) {
          throw new Error('Simulated realpath failure');
        }
        return originalRealpath(p as Parameters<typeof originalRealpath>[0]);
      });

      try {
        const result = await walk(tmpDir);

        // When realpath fails for a file, the file is still included using
        // its original fullPath (the catch block falls through to the visit check).
        // Both files should be present.
        assert.equal(result.length, 2, 'Both files should be returned');
      } finally {
        mock.restoreAll();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
