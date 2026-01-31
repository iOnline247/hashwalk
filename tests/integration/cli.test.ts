import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
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

    it('should accept all valid algorithms', async () => {
      const algorithms = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];

      for (const algo of algorithms) {
        const result = await runMain(['--path', dataDir, '--algorithm', algo]);
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

      await sleep(100);
      // Compare against the generated hash
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

        await sleep(100);
        // Compare against the generated CSV
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
  });

  describe('debug mode', () => {
    it('should show stack trace with --debug on error', async () => {
      const result = await runMain(['--path', '/nonexistent', '--debug']);
      assert.equal(result.code, 1);

      const err = JSON.parse(result.stderr);
      assert.ok(err.error.includes('Invalid directory path'));
      assert.ok(err.error.includes('\n'), 'Should include stack trace');
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
  });
});
