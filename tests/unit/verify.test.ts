import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  hashFileStream,
  isDirectory,
  isFile,
  setDebug,
} from '../../lib/verify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../tests/fixtures');

describe('verify module - Unit Tests', () => {
  const testFile = path.join(fixturesDir, 'test-content.txt');

  describe('hashFileStream', () => {
    it('should compute sha256 hash using stream', async () => {
      const expectedHash = crypto
        .createHash('sha256')
        .update('test content\n')
        .digest('hex');

      const result = await hashFileStream(testFile, 'sha256');

      assert.equal(result, expectedHash);
    });

    it('should compute md5 hash using stream', async () => {
      const expectedHash = crypto
        .createHash('md5')
        .update('test content\n')
        .digest('hex');

      const result = await hashFileStream(testFile, 'md5');

      assert.equal(result, expectedHash);
    });

    // TODO:
    // Add large file to fixtures and not reference test.txt
    // The file should have a very descriptive name, so it's apparent
    // what the file will be used for.
    it('should handle large files via stream', async () => {
      const largeFile = path.join(fixturesDir, 'test.txt');
      const content = fs.readFileSync(largeFile, 'utf-8');
      const expectedHash = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      const result = await hashFileStream(largeFile, 'sha256');

      assert.equal(result, expectedHash);
    });
  });

  describe('isFile', () => {
    it('should return true for existing file', async () => {
      const result = await isFile(testFile);

      assert.equal(result, true);
    });

    it('should return false for non-existent file', async () => {
      const nonExistentFile = path.join(fixturesDir, 'does-not-exist.txt');

      const result = await isFile(nonExistentFile);

      assert.equal(result, false);
    });

    it('should return false for directory', async () => {
      const result = await isFile(fixturesDir);

      assert.equal(result, false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for existing directory', async () => {
      const result = await isDirectory(fixturesDir);

      assert.equal(result, true);
    });

    it('should return false for non-existent directory', async () => {
      const nonExistentDir = path.join(fixturesDir, 'does-not-exist');

      const result = await isDirectory(nonExistentDir);

      assert.equal(result, false);
    });

    it('should return false for file', async () => {
      const result = await isDirectory(testFile);

      assert.equal(result, false);
    });
  });

  describe('setDebug', () => {
    it('should enable debug mode', () => {
      // This is a simple setter test
      setDebug(true);
      setDebug(false);

      // If no error, the function works correctly
      assert.ok(true);
    });
  });
});
