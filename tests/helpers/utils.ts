import crypto from 'node:crypto';
import process from 'node:process';

export function removeDebuggerInfo(input: string): string {
  let val = input.slice(input.indexOf('\n{') + 1);
  val = val.slice(0, val.lastIndexOf('}\n') + 2);

  return val;
}

export function isAlgoAvailable(algo: string): boolean {
  try {
    crypto.createHash(algo);
    return true;
  } catch {
    return false;
  }
}

export const isWindows = process.platform === 'win32';
