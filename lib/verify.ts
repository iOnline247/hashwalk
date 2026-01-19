import fs from 'fs';
import crypto from 'crypto';

let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export async function hashFileStream(
  file: string,
  algorithm: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(file);

    stream.on('error', reject);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function isFile(filePath: string): Promise<boolean> {
  try {
    const fileStats = await fs.promises.stat(filePath)
    const isValidFilePath = fileStats.isFile();

    if (!isValidFilePath) {
      return false;
    }
  } catch (err) {
    if (debugEnabled) {
      console.debug(JSON.stringify({ debug: `Error checking file: ${err}` }));
    }
    
    return false;
  }

  return true;
}

export async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const dirStats = await fs.promises.stat(dirPath);
    const isValidDirPath = dirStats.isDirectory();

    if (!isValidDirPath) {
      return false;
    }
  } catch (err) {
    return false;
  }

  return true;
}