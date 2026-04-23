import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';

import { isAlgoAvailable } from '../helpers/utils.js';
import { runCli, runMain } from '../helpers/runCli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');
const dataDir = path.join(fixturesDir, 'data');

describe('hashwalk CLI - Smoke Tests (via child process)', () => {
  // These tests spawn the actual CLI binary to verify the entrypoint works.
  // Keep this minimal - just enough to catch bin wiring issues.

  it('should execute via bin and show help', async () => {
    const result = await runCli(['--help']);

    assert.equal(result.code, 0);
    assert.ok(
      result.stdout.includes(
        'hashwalk --path <directory> --algorithm <algo> [options]',
      ),
    );
  });

  it('should execute via bin and process directory', async () => {
    const result = await runCli(['--path', dataDir]);

    assert.equal(result.code, 0);

    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.csv);
    assert.ok(parsed.hash);
  });
});

describe('hashwalk CLI - Integration Tests', () => {
  // All functional tests use runMain() for speed and coverage tracking.

  describe('help and validation', () => {
    it('should show help with --help flag', async () => {
      const result = await runMain(['--help']);

      assert.equal(result.code, 0);
      assert.ok(result.stdout.includes('hashwalk --path'));
    });

    it('should fail if --path is missing', async () => {
      const result = await runMain([]);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      assert.ok(err.error.includes('Missing required argument: --path'));
    });

    it('should fail if --path is invalid', async () => {
      const result = await runMain(['--path', '/nonexistent']);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      assert.ok(err.error.includes('Invalid directory path'));
    });

    it('should fail with invalid algorithm', async () => {
      const result = await runMain([
        '--path',
        dataDir,
        '--algorithm',
        'invalid',
      ]);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      assert.ok(
        err.error.includes('Invalid algorithm: invalid. Must be one of'),
      );
    });

    it('should include algorithm names separated by ", " in the error message', async () => {
      // Mutant 9: validAlgorithms.join(', ') → join('')
      const result = await runMain([
        '--path',
        dataDir,
        '--algorithm',
        'invalid',
      ]);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      // The error must list algorithms with comma-space separator, not run together
      assert.ok(
        err.error.includes('md5, sha256'),
        'Algorithm names should be separated by ", " not ""',
      );
    });

    it('should reject positional arguments', async () => {
      // Mutant 8: allowPositionals: false → true
      // With allowPositionals: false, parseArgs throws a TypeError when positional
      // args are passed. With allowPositionals: true (mutation), it succeeds silently.
      let code: number;
      try {
        const result = await runMain(['--path', dataDir, 'extra-positional-arg']);
        code = result.code;
      } catch {
        // parseArgs with allowPositionals: false throws TypeError — expected
        code = 1;
      }
      assert.equal(code, 1, 'Should reject positional arguments');
    });
  });

  describe('generate mode', () => {
    it('should succeed with --path only', async () => {
      const result = await runMain(['--path', dataDir]);
      assert.equal(result.code, 0);
      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.csv);
      assert.ok(parsed.hash);
    });

    it('should use sha256 as default algorithm', async () => {
      const result = await runMain(['--path', dataDir]);
      assert.equal(result.code, 0);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.csv.includes('sha256'));
    });

    it('should fall back to sha256 when algorithm is empty string', async () => {
      // Passing '' as algorithm triggers the `|| 'sha256'` fallback in cli.ts
      const result = await runMain(['--path', dataDir, '--algorithm', '']);
      assert.equal(result.code, 0);

      const parsed = JSON.parse(result.stdout);
      assert.ok(parsed.csv.includes('sha256'));
    });

    it('should accept all valid algorithms', async () => {
      const algorithms = ['md5', 'sha256', 'sha384', 'sha512'];

      for (const algo of algorithms) {
        const result = await runMain(['--path', dataDir, '--algorithm', algo]);
        const isAlgoAvailableOnThisEnvironment = isAlgoAvailable(algo);

        if (!isAlgoAvailableOnThisEnvironment) {
          // NOTE:
          // Node's crypto uses the system OpenSSL provider. On some Linux builds OpenSSL
          // is configured (FIPS mode), built, or run with OpenSSL 3 providers that do not
          // expose insecure algorithms.
          continue;
        }

        assert.equal(result.code, 0, `Algorithm ${algo} should succeed`);

        const parsed = JSON.parse(result.stdout);
        assert.ok(parsed.csv.includes(algo));
      }
    });

    it('should accept uppercase algorithm names', async () => {
      const result = await runMain([
        '--path',
        dataDir,
        '--algorithm',
        'SHA256',
      ]);

      assert.equal(result.code, 0);
    });

    it('should accept mixed case algorithm names', async () => {
      const result = await runMain([
        '--path',
        dataDir,
        '--algorithm',
        'Sha256',
      ]);

      assert.equal(result.code, 0);
    });

    it('should write CSV to provided --csvDirectory', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashwalk-'));

      try {
        const result = await runMain([
          '--path',
          dataDir,
          '--csvDirectory',
          tmpDir,
        ]);
        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout);
        assert.equal(path.dirname(parsed.csv), tmpDir);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should write CSV to a path containing "hashwalk" when no --csvDirectory is given', async () => {
      // Mutant 11: path.join(os.tmpdir(), 'hashwalk') → path.join(os.tmpdir(), '')
      const result = await runMain(['--path', dataDir]);
      assert.equal(result.code, 0);

      const parsed = JSON.parse(result.stdout);
      assert.ok(
        parsed.csv.includes('hashwalk'),
        `Default CSV path should contain 'hashwalk', got: ${parsed.csv}`,
      );
    });

    it('should include a timestamp in the CSV filename matching YYYYMMDDTHHmmss format', async () => {
      // Mutant 12: timestamp format regex/replacement mutations
      // The timestamp is created by .toISOString().replace(/[-:]/g, '').slice(0, 15)
      // which produces e.g. "20240101T120000"
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashwalk-ts-'));

      try {
        const result = await runMain(['--path', dataDir, '--csvDirectory', tmpDir]);
        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout);
        const csvBasename = path.basename(parsed.csv);

        // Timestamp is 15 chars: 8 date digits + 'T' + 6 time digits
        assert.ok(
          /^\d{8}T\d{6}_/.test(csvBasename),
          `CSV filename should start with timestamp like '20240101T120000_', got: ${csvBasename}`,
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should output files in sorted order in the generated CSV', async () => {
      // Mutant 10: (await walk(basePath)).sort() → without .sort()
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashwalk-sort-'));
      const csvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashwalk-sort-csv-'));

      try {
        // Create files in reverse alphabetical order so filesystem order ≠ sorted order
        await fs.writeFile(path.join(tmpDir, 'z_last.txt'), 'z');
        await fs.writeFile(path.join(tmpDir, 'a_first.txt'), 'a');
        await fs.writeFile(path.join(tmpDir, 'm_middle.txt'), 'm');

        const result = await runMain(['--path', tmpDir, '--csvDirectory', csvDir]);
        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout);
        const csvContent = await fs.readFile(parsed.csv, 'utf-8');

        // Parse RelativePath from each data row (format: "path","file","algo","hash")
        const dataLines = csvContent.split('\n').slice(1).filter(Boolean);
        const relativePaths = dataLines.map((line) => {
          // First CSV field is quoted: "relativepath",...
          const match = line.match(/^"([^"]*)"/);
          return match ? match[1] : line;
        });

        const sortedPaths = [...relativePaths].sort();
        assert.deepEqual(relativePaths, sortedPaths, 'CSV rows must be in sorted order');
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
        await fs.rm(csvDir, { recursive: true, force: true });
      }
    });

    it('should use forward slashes in RelativePath regardless of platform', async () => {
      const tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'hashwalk-path-test-'),
      );

      try {
        // Create a nested directory structure
        const nestedDir = path.join(tmpDir, 'folder', 'subfolder', 'deep');
        await fs.mkdir(nestedDir, { recursive: true });

        // Create files at different levels
        await fs.writeFile(path.join(tmpDir, 'root.txt'), 'root file');
        await fs.writeFile(
          path.join(tmpDir, 'folder', 'level1.txt'),
          'level 1 file',
        );
        await fs.writeFile(
          path.join(tmpDir, 'folder', 'subfolder', 'level2.txt'),
          'level 2 file',
        );
        await fs.writeFile(
          path.join(tmpDir, 'folder', 'subfolder', 'deep', 'level3.txt'),
          'level 3 file',
        );

        const csvDir = await fs.mkdtemp(
          path.join(os.tmpdir(), 'hashwalk-csv-'),
        );

        const result = await runMain([
          '--path',
          tmpDir,
          '--csvDirectory',
          csvDir,
        ]);
        assert.equal(result.code, 0);

        const parsed = JSON.parse(result.stdout);
        const csvContent = await fs.readFile(parsed.csv, 'utf-8');

        // Verify all paths use forward slashes, not backslashes
        assert.ok(
          csvContent.includes('folder/level1.txt'),
          'Should contain forward slash path for level1',
        );
        assert.ok(
          csvContent.includes('folder/subfolder/level2.txt'),
          'Should contain forward slash path for level2',
        );
        assert.ok(
          csvContent.includes('folder/subfolder/deep/level3.txt'),
          'Should contain forward slash path for level3',
        );

        // Ensure no backslashes exist in the CSV (except possibly in headers/quoted strings)
        const lines = csvContent.split('\n').slice(1); // Skip header
        for (const line of lines) {
          if (line.trim()) {
            assert.ok(
              !line.includes('\\'),
              `Line should not contain backslashes: ${line}`,
            );
          }
        }

        await fs.rm(csvDir, { recursive: true, force: true });
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('compare mode', () => {
    it('should compare against checksum string (non-file)', async () => {
      const result = await runMain([
        '--path',
        dataDir,
        '--compare',
        'not-a-file-checksum',
      ]);
      assert.equal(result.code, 0);

      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.compare, 'not-a-file-checksum');
      assert.equal(parsed.isMatch, false);
    });

    it('should return isMatch=true when hashes match', async () => {
      // First, generate a hash
      const first = await runMain(['--path', dataDir]);
      assert.equal(first.code, 0);

      const firstResult = JSON.parse(first.stdout);
      const second = await runMain([
        '--path',
        dataDir,
        '--compare',
        firstResult.hash,
      ]);
      assert.equal(second.code, 0);

      const result = JSON.parse(second.stdout);
      assert.equal(result.isMatch, true);
    });

    it('should compare against existing CSV file', async () => {
      const result = await runMain([
        '--path',
        dataDir,
        '--compare',
        path.join(fixturesDir, 'existing-registry-file.csv'),
      ]);
      assert.equal(result.code, 0);

      const parsed = JSON.parse(result.stdout);
      assert.equal(
        parsed.hash,
        'b280ca23ad9b1203d7513342d25ab013c25f3d5e770fa9b71d7e7eec9ef50aa1',
      );
    });

    it('should compare against generated CSV file', async () => {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-csv-'));

      try {
        // Generate a CSV first
        const first = await runMain([
          '--path',
          dataDir,
          '--csvDirectory',
          tmpDir,
        ]);
        assert.equal(first.code, 0);

        const firstResult = JSON.parse(first.stdout);
        const second = await runMain([
          '--path',
          dataDir,
          '--compare',
          firstResult.csv,
        ]);
        assert.equal(second.code, 0);

        const result = JSON.parse(second.stdout);
        assert.ok('isMatch' in result);
        assert.equal(result.isMatch, true);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('should return isMatch=false when comparing against a CSV from a different directory', async () => {
      // Mutant 13: newHash === compareHash → true (always isMatch)
      // Need a file comparison that results in isMatch: false
      const tmpDir1 = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-cmp1-'));
      const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-cmp2-'));
      const csvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-cmp-csv-'));

      try {
        // Create two different source directories
        await fs.writeFile(path.join(tmpDir1, 'file_a.txt'), 'content A');
        await fs.writeFile(path.join(tmpDir2, 'file_b.txt'), 'content B');

        // Generate CSV for dir1
        const first = await runMain(['--path', tmpDir1, '--csvDirectory', csvDir]);
        assert.equal(first.code, 0);
        const firstResult = JSON.parse(first.stdout);

        // Now hash dir2 but compare against dir1's CSV — should not match
        const second = await runMain([
          '--path',
          tmpDir2,
          '--compare',
          firstResult.csv,
        ]);
        assert.equal(second.code, 0);

        const result = JSON.parse(second.stdout);
        assert.equal(
          result.isMatch,
          false,
          'Comparing against a different directory CSV should give isMatch: false',
        );
      } finally {
        await fs.rm(tmpDir1, { recursive: true, force: true });
        await fs.rm(tmpDir2, { recursive: true, force: true });
        await fs.rm(csvDir, { recursive: true, force: true });
      }
    });
  });

  describe('debug mode', () => {
    it('should show stack trace with --debug on error', async () => {
      const result = await runMain(['--path', '/nonexistent', '--debug']);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      assert.ok(err.error.includes('Invalid directory path'));
      assert.ok(err.error.includes('\n'), 'Should include stack trace');
      // Mutant 14: (err as Error).stack || '' → stack && '' / true / false
      // Verify the output contains actual stack frame text, not just a newline
      assert.ok(
        /\n\s+at\s/.test(err.error),
        'Debug output should contain actual stack frames (e.g. "    at main ...")',
      );
    });

    it('should show minimal error without --debug', async () => {
      const result = await runMain(['--path', '/nonexistent']);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      assert.ok(err.error.includes('Invalid directory path'));
      assert.ok(
        !err.error.includes('at main'),
        'Should not include detailed stack',
      );
    });

    it('should handle error without stack in debug mode', async () => {
      // Mock fs.promises.mkdir (via node:fs) to throw an error without a stack.
      // node:fs/promises default export and fs.promises share the same object,
      // so mocking through node:fs affects cli.ts's `import fs from 'node:fs/promises'`.
      const nodefs = await import('node:fs');

      mock.method(nodefs.promises, 'mkdir', async () => {
        const err = new Error('Error without stack');
        // @ts-expect-error: intentionally clearing stack to test the `|| ''` fallback
        err.stack = undefined;
        throw err;
      });

      try {
        const result = await runMain(['--path', __dirname, '--debug']);
        assert.equal(result.code, 1);

        const errOutput = JSON.parse(result.stderr);
        assert.ok(errOutput.error.includes('Error without stack'));
      } finally {
        mock.restoreAll();
      }
    });
  });
});
