import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { walk } from './walker.js';
import { rows, writeCsv } from './csv.js';
import { hashFileStream, isDirectory, isFile, setDebug } from './verify.js';
import { type HashWalkResult } from './types.js';

const { values: argv } = parseArgs({
  options: {
    path: {
      type: 'string',
    },
    compare: {
      type: 'string',
    },
    algorithm: {
      type: 'string',
      default: 'sha256',
    },
    csvDirectory: {
      type: 'string',
    },
    debug: {
      type: 'boolean',
      default: false,
    },
    help: {
      type: 'boolean',
      default: false,
    },
  },
  allowPositionals: false,
});

if (argv.help) {
  console.log(`
hashwalk --path <directory> --algorithm <algo> [options]

Options:
  --path          Directory to scan (required)
  --compare       CSV file path or checksum string
  --algorithm     Hash algorithm (md5, sha1, sha256, sha384, sha512) [default: sha256]
  --csvDirectory  Directory to write generated CSV (default: OS temp + /hashwalk)
  --debug         Enable detailed error logging [default: false]
  --help          Show this help message

Examples:
  hashwalk --path ./data
  hashwalk --path ./data --compare checksums.csv --algorithm sha256
  hashwalk --path ./data --compare <checksum_string> --algorithm sha256
`);
  process.exit(0);
}

if (!argv.path) {
  console.error(JSON.stringify({ error: 'Missing required argument: --path' }));
  process.exit(1);
}

const algorithm = (argv.algorithm || 'sha256').toLowerCase();
const validAlgorithms = ['md5', 'sha1', 'sha256', 'sha384', 'sha512'];
if (!validAlgorithms.includes(algorithm)) {
  console.error(
    JSON.stringify({
      error: `Invalid algorithm: ${algorithm}. Must be one of: ${
        validAlgorithms.join(', ')
      }`,
    }),
  );
  process.exit(1);
}

// Enable debug mode if requested
setDebug(argv.debug);

try {
  const basePath = path.resolve(argv.path);

  // Validate the directory path
  if (!(await isDirectory(basePath))) {
    throw new Error(`Invalid directory path: ${argv.path}`);
  }

  const files = (await walk(basePath)).sort();

  const csvDir = argv.csvDirectory ??
    path.join(os.tmpdir(), 'hashwalk');

  await fs.mkdir(csvDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 15);

  const outCsvPath = path.join(
    csvDir,
    `${timestamp}_${algorithm}_${crypto.randomUUID()}.csv`,
  );

  await writeCsv(outCsvPath, rows(files, basePath, algorithm));

  const newHash = await hashFileStream(outCsvPath, algorithm);

  const results: HashWalkResult = {
    csv: outCsvPath,
    hash: newHash,
  };

  if (argv.compare) {
    const compareFilePath = path.resolve(argv.compare);
    const shouldProcessAsFile = await isFile(compareFilePath);

    results.compare = argv.compare;

    if (shouldProcessAsFile) {
      const compareHash = await hashFileStream(compareFilePath, algorithm);

      results.isMatch = newHash === compareHash;
    } else {
      // NOTE:
      // This is treated as a direct checksum string comparison.
      results.isMatch = newHash === argv.compare;
    }
  }

  console.log(JSON.stringify(results));
} catch (err) {
  if (argv.debug) {
    // NOTE:
    // This needs to be console.error to avoid mixing with stdout.error JSON result.
    console.error(
      JSON.stringify({
        error: `${(err as Error).message}\n${(err as Error).stack || ''}`,
      }),
    );
  } else {
    console.error(JSON.stringify({ error: (err as Error).message }));
  }
  process.exit(1);
}
