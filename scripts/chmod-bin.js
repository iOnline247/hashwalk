#!/usr/bin/env node

/**
 * Makes dist/bin/hashwalk.js executable on Unix-like platforms.
 * Skips on Windows where executable permissions work differently.
 */

import { chmodSync } from 'fs';

const binPath = 'dist/bin/hashwalk.js';

if (process.platform !== 'win32') {
  try {
    chmodSync(binPath, 0o755);
    console.log(`✓ Made ${binPath} executable`);
  } catch (error) {
    console.error(`✗ Failed to chmod ${binPath}:`, error.message);
    process.exit(1);
  }
} else {
  console.log(`⊘ Skipping chmod on Windows`);
}
