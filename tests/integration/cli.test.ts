import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeDebuggerInfo } from '../helpers/utils.js';
import { runCli } from '../helpers/runCli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('hashwalk CLI validation - Integration Tests', () => {
  const dataDir = path.join(fixturesDir, 'data');

  it('should show help with --help flag', async () => {
    const args = ['--help'];

    const result = await runCli(args);

    assert.equal(result.code, 0);
    assert.ok(
      result.stdout.includes(
        'hashwalk --path <directory> --algorithm <algo> [options]',
      ),
    );
  });

  it('should fail if --path is missing', async () => {
    const args: string[] = [];

    const result = await runCli(args);

    assert.equal(result.code, 1);
  });

  it('should succeed with --path only (generate mode)', async () => {
    const args = ['--path', dataDir];

    const result = await runCli(args);

    assert.equal(result.code, 0);
  });

  it('should fail if --compare is used with unsupported algorithm', async () => {
    const args = [
      '--path',
      dataDir,
      '--compare',
      'abcdef',
      '--algorithm',
      'nope',
    ];

    const result = await runCli(args);

    assert.equal(result.code, 1);
  });

  it('should test existing registry file (CSV) with --compare', async () => {
    const args = [
      '--path',
      dataDir,
      '--compare',
      path.join(fixturesDir, 'test.txt'),
      '--algorithm',
      'sha256',
    ];

    const result = await runCli(args);

    assert.equal(result.code, 0);
  });

  it('should compare against checksum string (non-file)', async () => {
    const args = [
      '--path',
      dataDir,
      '--compare',
      'not-a-file-checksum',
      '--algorithm',
      'sha256',
    ];

    const result = await runCli(args);

    assert.equal(result.code, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.compare, 'not-a-file-checksum');
    assert.equal(parsed.isMatch, false);
  });

  it('should write CSV to provided --csvDirectory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashwalk-'));

    try {
      const args = [
        '--path',
        dataDir,
        '--csvDirectory',
        tmpDir,
        '--algorithm',
        'sha256',
      ];

      const result = await runCli(args);
      assert.equal(result.code, 0);

      const parsed = JSON.parse(result.stdout);
      assert.equal(path.dirname(parsed.csv), tmpDir);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should succeed with valid --path and --algorithm', async () => {
    const args = [
      '--path',
      dataDir,
      '--algorithm',
      'sha256',
    ];

    const result = await runCli(args);

    assert.equal(result.code, 0);
  });

  it('should show detailed error with --debug flag', async () => {
    const args = [
      '--path',
      '/nonexistent',
      '--algorithm',
      'sha256',
      '--debug',
    ];

    const result = await runCli(args);

    assert.equal(result.code, 1);
    const parsed = JSON.parse(removeDebuggerInfo(result.stderr));

    assert.ok(parsed.error);
    assert.ok(parsed.error.includes('Invalid directory path'));
  });

  it('should show minimal error without --debug flag', async () => {
    const args = [
      '--path',
      '/nonexistent',
      '--algorithm',
      'sha256',
    ];

    const result = await runCli(args);
    assert.equal(result.code, 1);

    const parsed = JSON.parse(removeDebuggerInfo(result.stderr));
    assert.ok(parsed.error);
    assert.ok(parsed.error.includes('Invalid directory path'));
  });

  it('should use forward slashes in RelativePath field regardless of platform', async () => {
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

      const csvDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashwalk-csv-'));

      const args = [
        '--path',
        tmpDir,
        '--csvDirectory',
        csvDir,
        '--algorithm',
        'sha256',
      ];

      const result = await runCli(args);
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
