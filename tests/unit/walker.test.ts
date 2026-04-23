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

describe('walk - Symlink Tests', () => {
  const fixturesBase = fixturesDir;

  it('should follow a symlink to a file and include it exactly once', async () => {
    // Mutants 1, 2, 3: isSymbolicLink() conditional / stat() try-block
    // Mutants 5, 6: realpath deduplication
    const tmpDir = fs.mkdtempSync(path.join(fixturesBase, 'symlink-file-'));

    try {
      const realFile = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(realFile, 'real content');

      const linkFile = path.join(tmpDir, 'link.txt');
      try {
        fs.symlinkSync(realFile, linkFile);
      } catch {
        // Symlinks may not be supported on this platform
        return;
      }

      const result = await walk(tmpDir);
      // real.txt + link.txt → same inode, should deduplicate to 1 entry
      assert.equal(result.length, 1, 'Should find exactly one file (symlink deduplicated)');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should follow a symlink to a directory and walk its contents', async () => {
    // Mutants 1, 2, 3: isSymbolicLink() conditional / stat() resolves isDir=true
    // The real directory must be OUTSIDE the scanned tmpDir so files can only
    // be reached by following the symlink. If isSymbolicLink() → false the
    // symlink is skipped and result is empty, killing the mutant.
    const scanDir = fs.mkdtempSync(path.join(fixturesBase, 'symlink-dir-scan-'));
    const externalDir = fs.mkdtempSync(
      path.join(fixturesBase, 'symlink-dir-ext-'),
    );

    try {
      fs.writeFileSync(path.join(externalDir, 'file_in_dir.txt'), 'content');

      const linkDir = path.join(scanDir, 'link_dir');
      try {
        fs.symlinkSync(externalDir, linkDir, 'dir');
      } catch {
        // Symlinks may not be supported on this platform
        return;
      }

      const result = await walk(scanDir);
      // link_dir/file_in_dir.txt should appear exactly once
      assert.equal(
        result.length,
        1,
        'Should find exactly one file via symlinked directory',
      );
    } finally {
      fs.rmSync(scanDir, { recursive: true, force: true });
      fs.rmSync(externalDir, { recursive: true, force: true });
    }
  });

  it('should skip broken symlinks and not include them in results', async () => {
    // Mutant 4: else if (isFileEntry) → else if (true) — broken symlinks treated as files
    // Mutant 7: NoCoverage — catch block for broken symlinks never executed
    const tmpDir = fs.mkdtempSync(path.join(fixturesBase, 'symlink-broken-'));

    try {
      const realFile = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(realFile, 'real content');

      const brokenLink = path.join(tmpDir, 'broken.link');
      try {
        fs.symlinkSync(path.join(tmpDir, 'nonexistent.txt'), brokenLink);
      } catch {
        // Symlinks may not be supported on this platform
        return;
      }

      const result = await walk(tmpDir);
      assert.equal(result.length, 1, 'Should only find real.txt, not the broken symlink');
      assert.ok(result[0]?.includes('real.txt'), 'The single result should be real.txt');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should deduplicate files reached via multiple symlinks to the same target', async () => {
    // Mutant 5: realpath try-block emptied → realPath stays as fullPath → no dedup
    // Mutant 6: if (!visited.has(realPath)) → if (true) → always include
    const tmpDir = fs.mkdtempSync(path.join(fixturesBase, 'symlink-dedup-'));

    try {
      const realFile = path.join(tmpDir, 'real.txt');
      fs.writeFileSync(realFile, 'real content');

      const link1 = path.join(tmpDir, 'link1.txt');
      const link2 = path.join(tmpDir, 'link2.txt');
      try {
        fs.symlinkSync(realFile, link1);
        fs.symlinkSync(realFile, link2);
      } catch {
        // Symlinks may not be supported on this platform
        return;
      }

      const result = await walk(tmpDir);
      // real.txt, link1.txt, link2.txt all resolve to the same realpath.
      // The walker must deduplicate via realpath and count the file only once.
      assert.equal(
        result.length,
        1,
        'Should deduplicate: real file + 2 symlinks to it = 1 unique file',
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

