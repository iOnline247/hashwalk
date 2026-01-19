import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/runCli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('hashwalk CLI validation - Integration Tests', () => {
  const dataDir = path.join(fixturesDir, 'data');

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
      '--path', dataDir,
      '--compare', 'abcdef',
      '--algorithm', 'nope'
    ];

    const result = await runCli(args);

    assert.equal(result.code, 1);
  });

  it('should succeed with valid --path and --algorithm', async () => {
    const args = [
      '--path', dataDir,
      '--algorithm', 'sha256'
    ];

    const result = await runCli(args);

    assert.equal(result.code, 0);
  });

  it('should show detailed error with --debug flag', async () => {
    const args = [
      '--path', '/nonexistent',
      '--algorithm', 'sha256',
      '--debug'
    ];

    const result = await runCli(args);

    assert.equal(result.code, 1);
    const parsed = JSON.parse(result.stderr);
    assert.ok(parsed.error);
    assert.ok(parsed.error.includes('Invalid directory path'));
  });

  it('should show minimal error without --debug flag', async () => {
    const args = [
      '--path', '/nonexistent',
      '--algorithm', 'sha256'
    ];

    const result = await runCli(args);

    assert.equal(result.code, 1);
    const parsed = JSON.parse(result.stderr);
    assert.ok(parsed.error);
    assert.ok(parsed.error.includes('Invalid directory path'));
  });
});
