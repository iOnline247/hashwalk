import fs from 'node:fs';
import path from 'node:path';

import { hashFile } from './hasher.js';

import { type ChecksumRow } from './types.js';

export function csvEscape(value: string): string {
  // Always quote fields per RFC 4180 Section 2.6:
  // Fields containing special characters should be enclosed in double-quotes.
  // Quoting all fields unconditionally is acceptable and simplifies implementation.
  return `"${value.replace(/"/g, '""')}"`;
}

export async function* rows(files: string[], basePath: string, algorithm: string): AsyncGenerator<ChecksumRow> {
    for (const file of files) {
        const hash = await hashFile(file, algorithm);

        yield {
            RelativePath: path.relative(basePath, file).replace(/\\/g, '/'),
            FileName: path.basename(file),
            Algorithm: algorithm,
            Hash: hash
        };
    }
}

export async function writeCsv(
  file: string,
  rows: AsyncIterable<ChecksumRow>
): Promise<void> {
  const stream = fs.createWriteStream(file, { encoding: 'utf8' });

  stream.write('"RelativePath","FileName","Algorithm","Hash"\n');

  for await (const row of rows) {
    const line = [
      csvEscape(row.RelativePath),
      csvEscape(row.FileName),
      csvEscape(row.Algorithm),
      csvEscape(row.Hash)
    ].join(',') + '\n';

    stream.write(line);
  }

  stream.end();
}
