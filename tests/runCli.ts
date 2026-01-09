import { spawn } from 'node:child_process';
import path from 'node:path';

export function runCli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const proc = spawn(
        'node',
        [path.resolve('dist/cli.js'), ...args],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d: string) => stdout += d);
      proc.stderr.on('data', (d: string) => stderr += d);

    proc.on('close', (code: number) => {
      resolve({ code, stdout, stderr });
    });
    }
  );
}
