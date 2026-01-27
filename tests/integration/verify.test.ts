import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { runCli } from '../helpers/runCli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('hashwalk verification behavior - Integration Tests', () => {
  const dataDir = path.join(fixturesDir, 'data');

  it('should return isMatch false when checksum does not match', async () => {
    const args = [
      '--path',
      dataDir,
      '--compare',
      'deadbeef',
      '--algorithm',
      'sha256',
    ];

    const result = await runCli(args);

    assert.equal(result.code, 0);

    const jsonOutput = JSON.parse(result.stdout);
    assert.equal(jsonOutput.isMatch, false);
  });

  it('should return isMatch true when checksum matches', async () => {
    const generateArgs = [
      '--path',
      dataDir,
      '--algorithm',
      'sha256',
    ];

    const generateResult = await runCli(generateArgs);

    assert.equal(generateResult.code, 0);

    const generateOutput = JSON.parse(generateResult.stdout);
    const csvPath = generateOutput.csv;

    const csvContent = fs.readFileSync(csvPath);
    const hash = crypto
      .createHash('sha256')
      .update(csvContent)
      .digest('hex');

    const verifyArgs = [
      '--path',
      dataDir,
      '--compare',
      hash,
      '--algorithm',
      'sha256',
    ];

    const verifyResult = await runCli(verifyArgs);

    assert.equal(verifyResult.code, 0);

    const verifyOutput = JSON.parse(verifyResult.stdout);
    assert.equal(verifyOutput.isMatch, true);
  });
});
