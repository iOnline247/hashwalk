import fs from 'fs';
import crypto from 'crypto';

export function hashFile(
  file: string,
  algorithm: string
): Promise<string> {
  return new Promise((resolve) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(file);

    stream.on('error', (err: NodeJS.ErrnoException) => {
      resolve(`ERROR_${err.code ?? 'UNKNOWN'}_${Date.now()}`);
    });

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
