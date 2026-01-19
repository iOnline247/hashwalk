import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { hashFile } from '../../lib/hasher.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('hashFile - Unit Tests', () => {
  const testFile = path.join(fixturesDir, 'test.txt');
  const emptyFile = path.join(fixturesDir, 'empty.txt');

  it('should compute sha256 hash of file', async () => {
    const expectedHash = crypto
      .createHash('sha256')
      .update('hello world\n')
      .digest('hex');

    const result = await hashFile(testFile, 'sha256');

    assert.equal(result, expectedHash);
  });

  it('should compute md5 hash of file', async () => {
    const expectedHash = crypto
      .createHash('md5')
      .update('hello world\n')
      .digest('hex');

    const result = await hashFile(testFile, 'md5');

    assert.equal(result, expectedHash);
  });

  it('should compute sha512 hash of file', async () => {
    const expectedHash = crypto
      .createHash('sha512')
      .update('hello world\n')
      .digest('hex');

    const result = await hashFile(testFile, 'sha512');

    assert.equal(result, expectedHash);
  });

  it('should return error marker for non-existent file', async () => {
    const nonExistentFile = path.join(fixturesDir, 'does-not-exist.txt');

    const result = await hashFile(nonExistentFile, 'sha256');

    assert.ok(result.startsWith('ERROR_ENOENT_'));
  });

  it('should handle empty files correctly', async () => {
    const expectedHash = crypto
      .createHash('sha256')
      .update('')
      .digest('hex');

    const result = await hashFile(emptyFile, 'sha256');

    assert.equal(result, expectedHash);
  });
});
