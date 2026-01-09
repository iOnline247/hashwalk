import fs from 'node:fs';
import { type ChecksumRow } from './types.js';

/**
 * Conditionally quote a CSV field per RFC 4180.
 */
export function csvEscape(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function writeCsv(
  file: string,
  rows: AsyncIterable<ChecksumRow>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const stream = fs.createWriteStream(file, { encoding: 'utf8' });

    stream.write('RelativePath,FileName,Algorithm,Hash\n');

    try {
      for await (const row of rows) {
        const line = [
          csvEscape(row.RelativePath),
          csvEscape(row.FileName),
          csvEscape(row.Algorithm),
          csvEscape(row.Hash)
        ].join(',') + '\n';

        stream.write(line);
      }

      stream.end(resolve);
    } catch (err) {
      reject(err);
    }
  });
}
