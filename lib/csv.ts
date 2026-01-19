import fs from 'node:fs';
import { type ChecksumRow } from './types.js';

export function csvEscape(value: string): string {
  // Always quote fields per RFC 4180 Section 2.6:
  // Fields containing special characters should be enclosed in double-quotes.
  // Quoting all fields unconditionally is acceptable and simplifies implementation.
  return `"${value.replace(/"/g, '""')}"`;
}

export function writeCsv(
  file: string,
  rows: AsyncIterable<ChecksumRow>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const stream = fs.createWriteStream(file, { encoding: 'utf8' });

    stream.write('"RelativePath","FileName","Algorithm","Hash"\n');

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
