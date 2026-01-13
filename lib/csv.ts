import fs from 'node:fs';
import { type ChecksumRow } from './types.js';

export function csvEscape(value: string): string {
  // TODO: Re-enable reserved character check if needed
  // Research CSV specifications to see if adding quotes unconditionally is acceptable.

  // const hasReservedCharacters = /[",\r\n]/.test(value);

  // if (hasReservedCharacters) {
  //   return `"${value.replace(/"/g, '""')}"`;
  // }

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
