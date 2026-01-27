import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { walk } from '../../lib/walker.js';
import { hashFile } from '../../lib/hasher.js';
import { rows, writeCsv } from '../../lib/csv.js';

describe('Symlink Handling - Integration Tests', () => {
  it('should handle large directory structure with symlinks without infinite loops', async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'hashwalk-symlink-test-'),
    );

    try {
      // Generate 200 directories with at least 10 levels of nesting
      const directories: string[] = [tmpDir];
      const filesCreated: string[] = [];

      // Create nested directory structure (at least 10 levels deep)
      // We'll create a tree structure with branching
      let currentLevel = [tmpDir];
      const levels = 12; // More than 10 to ensure we meet the requirement

      for (let level = 0; level < levels; level++) {
        const nextLevel: string[] = [];

        for (const parentDir of currentLevel) {
          if (!parentDir) continue;

          // Create 2-3 subdirectories per parent to reach 200 total directories
          const numSubdirs = directories.length < 200 ? 2 : 0;

          for (let i = 0; i < numSubdirs; i++) {
            // Use Windows-compatible names (no special characters)
            const dirName = `level${level}_dir${i}_${Date.now() % 10000}`;
            const newDir = path.join(parentDir, dirName);

            if (directories.length < 200) {
              fs.mkdirSync(newDir, { recursive: true });
              directories.push(newDir);
              nextLevel.push(newDir);
            }
          }
        }

        currentLevel = nextLevel;
        if (directories.length >= 200) break;
      }

      // Ensure we have at least 200 directories
      while (directories.length < 200) {
        const parentDir = directories[
          Math.floor(Math.random() * Math.min(directories.length, 50))
        ];
        if (!parentDir) break;
        const dirName = `extra_dir_${directories.length}`;
        const newDir = path.join(parentDir, dirName);
        fs.mkdirSync(newDir, { recursive: true });
        directories.push(newDir);
      }

      // Distribute 20000 files across the directories
      const filesPerDir = Math.ceil(20000 / directories.length);
      let fileCount = 0;

      for (const dir of directories) {
        const numFiles = Math.min(filesPerDir, 20000 - fileCount);

        for (let i = 0; i < numFiles; i++) {
          // Windows-compatible filename (no special characters like :, *, ?, <, >, |)
          const fileName = `file_${fileCount}_data.txt`;
          const filePath = path.join(dir, fileName);

          // Write filename as content
          fs.writeFileSync(filePath, fileName);
          filesCreated.push(filePath);
          fileCount++;

          if (fileCount >= 20000) break;
        }

        if (fileCount >= 20000) break;
      }

      assert.equal(fileCount, 20000, 'Should have created exactly 20000 files');
      assert.ok(
        directories.length >= 200,
        'Should have created at least 200 directories',
      );

      // Create a symlink at a deterministic directory (5th directory in the list)
      // to create a recursive structure
      const symlinkTargetIndex = 4; // Deterministic position
      const symlinkDirIndex = 10; // Also deterministic
      const symlinkDir = directories[symlinkDirIndex];
      const symlinkTarget = directories[symlinkTargetIndex];

      // Create symlink (skip on Windows if not supported)
      let symlinkCreated = false;
      if (symlinkDir && symlinkTarget) {
        const symlinkPath = path.join(symlinkDir, 'recursive_link');
        try {
          fs.symlinkSync(symlinkTarget, symlinkPath, 'dir');
          symlinkCreated = true;
        } catch {
          // Symlink creation might fail on Windows without admin privileges
          console.log('Skipping symlink test on this platform');
        }
      }

      // Walk the directory
      const walkedFiles = await walk(tmpDir);

      // Verify no file is processed more than once
      const uniqueFiles = new Set(walkedFiles);
      assert.equal(
        walkedFiles.length,
        uniqueFiles.size,
        'Should not process any file more than once (no duplicates)',
      );

      // Verify we found all original files and not infinite loop files
      assert.equal(
        walkedFiles.length,
        20000,
        'Should find exactly 20000 files (no infinite loop from symlink)',
      );

      // Generate CSV and verify it's deterministic
      const csvPath1 = path.join(tmpDir, 'test1.csv');
      const csvPath2 = path.join(tmpDir, 'test2.csv');

      await writeCsv(csvPath1, rows(walkedFiles, tmpDir, 'sha256'));
      await writeCsv(csvPath2, rows(walkedFiles, tmpDir, 'sha256'));
      const csv1Hash = await hashFile(csvPath1, 'sha256');
      const csv2Hash = await hashFile(csvPath2, 'sha256');

      assert.equal(
        csv1Hash,
        csv2Hash,
        'CSV hashes should be identical on multiple runs',
      );

      const csv1Content = fs.readFileSync(csvPath1, 'utf-8');
      // Verify CSV has correct number of lines (header + 20000 data rows)
      const csvLines = csv1Content.trim().split('\n');
      assert.equal(
        csvLines.length,
        20001,
        'CSV should have header + 20000 data rows',
      );

      if (symlinkCreated) {
        console.log('✓ Symlink test completed successfully');
      }
    } finally {
      // Clean up
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
