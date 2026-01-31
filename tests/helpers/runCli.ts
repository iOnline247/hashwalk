import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../../lib/cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '../../bin/hashwalk.js');

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/*
 * Why two test runners?
 *
 * - runMain(): Calls main() directly. Fast (~2-5ms) and provides code coverage.
 *              Used for all functional tests.
 *
 * - runCli():  Spawns the actual CLI binary as a child process. Slower (~100-200ms)
 *              and coverage is NOT tracked. Used only for smoke tests to verify
 *              the bin entrypoint (bin/hashwalk.js) is wired correctly.
 */

/**
 * Run CLI by spawning a child process (true E2E integration test).
 */
export function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [binPath, ...args]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Run CLI by calling main() directly (provides coverage tracking).
 * Returns same interface as runCli for consistent test patterns.
 */
export async function runMain(args: string[]): Promise<CliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...a: unknown[]) => stdout.push(a.map(String).join(' '));
  console.error = (...a: unknown[]) => stderr.push(a.map(String).join(' '));

  try {
    const code = await main(args);
    return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}
