import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { walk } from './walker.js';
import { hashFile } from './hasher.js';
import { writeCsv } from './csv.js';
import { hashFileStream } from './verify.js';
import { type HashWalkResult } from './types.js';

// TODO:
// Switch to using: https://nodejs.org/api/util.html#utilparseargsconfig

const argv = yargs(hideBin(process.argv))
  .scriptName('hashwalk')
  .usage('hashwalk --path <directory> --algorithm <algo> [options]')
  .example([
    [
      'hashwalk --path ./data',
      'Generate a checksum CSV'
    ],
    [
      'hashwalk --path ./data --compare checksums.csv --algorithm sha256',
      'Verify directory against an existing CSV'
    ],
    [
      'hashwalk --path ./data --compare <checksum_string> --algorithm sha256',
      'Verify directory against a known checksum'
    ]
  ])
  .options({
    path: {
      type: 'string',
      describe: 'Directory to scan',
      demandOption: true
    },
    compare: {
      type: 'string',
      describe: 'CSV file path or checksum string'
    },
    algorithm: {
      type: 'string',
      describe:
        'Hash algorithm (required when using --compare)',
      choices: ['md5', 'sha1', 'sha256', 'sha384', 'sha512'],
      default: "sha256",
    },
    csvDirectory: {
      type: 'string',
      describe:
        'Directory to write generated CSV (default: OS temp + /hashwalk)'
    },
    concurrency: {
      type: 'number',
      default: 8,
      describe: 'Maximum concurrent file hashes'
    }
  })
  .help()
  .strict()
  .parseSync();


try {
  const algorithm = argv.algorithm.toLowerCase();
  const basePath = path.resolve(argv.path);
  const files = (await walk(basePath)).sort();

  const csvDir =
    argv.csvDirectory ??
    path.join(os.tmpdir(), 'hashwalk');

  await fs.mkdir(csvDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 15);

  const outCsvPath = path.join(
    csvDir,
    `${timestamp}_${algorithm}_${crypto.randomUUID()}.csv`
  );

  async function* rows() {
    for (const file of files) {
      const hash = await hashFile(file, algorithm!);

      yield {
        RelativePath: path.relative(basePath, file),
        FileName: path.basename(file),
        Algorithm: algorithm!,
        Hash: hash
      };
    }
  }

  await writeCsv(outCsvPath, rows());

  const newHash = await hashFileStream(outCsvPath, algorithm);

  const results: HashWalkResult = {
    csv: outCsvPath,
    hash: newHash,
  }

  if (argv.compare) {
    // TODO:
    // Make a utility function to check if a path exists and is a file.
    const compareHash = await hashFileStream(argv.compare, algorithm);

    results.compare = newHash === compareHash;
  }

  console.log(JSON.stringify(results));
} catch {
  process.exit(1);
}
