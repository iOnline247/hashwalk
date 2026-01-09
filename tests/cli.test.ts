import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runCli } from './runCli.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hashwalk-test-'));
const dataDir = path.join(tmpDir, 'data');

fs.mkdirSync(dataDir);
fs.writeFileSync(path.join(dataDir, 'file.txt'), 'hello');

describe('hashwalk CLI validation', () => {
  it('fails if --path is missing', async () => {
    const res = await runCli([]);
    expect(res.code).toBe(2);
  });

  it('succeeds with --path only (generate mode)', async () => {
    const res = await runCli([
      '--path', dataDir,
      // '--algorithm', 'sha256'
    ]);
    expect(res.code).toBe(0);
  });

  it('fails if --compare is used without --algorithm', async () => {
    const res = await runCli([
      '--path', dataDir,
      '--compare', 'abcdef'
    ]);
    expect(res.code).toBe(2);
  });

  it('fails if --compare is used with unsupported algorithm', async () => {
    const res = await runCli([
      '--path', dataDir,
      '--compare', 'abcdef',
      '--algorithm', 'nope'
    ]);
    expect(res.code).toBe(2);
  });
});
