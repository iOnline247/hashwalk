import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCli } from './runCli.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashwalk-verify-'));
const dataDir = path.join(tmpDir, 'data');

fs.mkdirSync(dataDir);
fs.writeFileSync(path.join(dataDir, 'file.txt'), 'hello');

describe('hashwalk verification behavior', () => {
  it('returns 1 when checksum does not match', async () => {
    const res = await runCli([
      '--path', dataDir,
      '--compare', 'deadbeef',
      '--algorithm', 'sha256'
    ]);

    expect(res.code).toBe(1);
  });

  it('returns 0 when checksum matches', async () => {
    // First generate CSV
    const gen = await runCli([
      '--path', dataDir,
      '--algorithm', 'sha256'
    ]);

    expect(gen.code).toBe(0);

    const csvFile = fs
      .readdirSync(path.join(os.tmpdir(), 'hashwalk'))
      .find(f => f.endsWith('.csv'))!;

    const csvPath = path.join(os.tmpdir(), 'hashwalk', csvFile);

    // Hash CSV
    const crypto = await import('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(csvPath))
      .digest('hex');

    const verify = await runCli([
      '--path', dataDir,
      '--compare', hash,
      '--algorithm', 'sha256'
    ]);

    expect(verify.code).toBe(0);
  });
});
