import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { walk } from './walker.js';
import { rows, writeCsv } from './csv.js';
import {
  hashFileStream,
  isAlgoAvailable,
  isDirectory,
  isFile,
  setDebug,
} from './verify.js';
import { type HashWalkResult } from './types.js';

const cliOptions = {
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
  'verify-supported': {
    type: 'boolean',
    default: false,
    short: 'v',
  },
} as const;

// Algorithms supported for file hashing operations
const supportedHashAlgorithms = ['md5', 'sha256', 'sha384', 'sha512'];

// All algorithms from crypto.getHashes() to check with --verify-supported
const validAlgorithms = [
  'RSA-MD5',
  'RSA-RIPEMD160',
  'RSA-SHA1',
  'RSA-SHA1-2',
  'RSA-SHA224',
  'RSA-SHA256',
  'RSA-SHA3-224',
  'RSA-SHA3-256',
  'RSA-SHA3-384',
  'RSA-SHA3-512',
  'RSA-SHA384',
  'RSA-SHA512',
  'RSA-SHA512/224',
  'RSA-SHA512/256',
  'RSA-SM3',
  'blake2b512',
  'blake2s256',
  'id-rsassa-pkcs1-v1_5-with-sha3-224',
  'id-rsassa-pkcs1-v1_5-with-sha3-256',
  'id-rsassa-pkcs1-v1_5-with-sha3-384',
  'id-rsassa-pkcs1-v1_5-with-sha3-512',
  'md5',
  'md5-sha1',
  'md5WithRSAEncryption',
  'ripemd',
  'ripemd160',
  'ripemd160WithRSA',
  'rmd160',
  'sha1',
  'sha1WithRSAEncryption',
  'sha224',
  'sha224WithRSAEncryption',
  'sha256',
  'sha256WithRSAEncryption',
  'sha3-224',
  'sha3-256',
  'sha3-384',
  'sha3-512',
  'sha384',
  'sha384WithRSAEncryption',
  'sha512',
  'sha512-224',
  'sha512-224WithRSAEncryption',
  'sha512-256',
  'sha512-256WithRSAEncryption',
  'sha512WithRSAEncryption',
  'shake128',
  'shake256',
  'sm3',
  'sm3WithRSAEncryption',
  'ssl3-md5',
  'ssl3-sha1',
];

const helpText = `
hashwalk --path <directory> --algorithm <algo> [options]

Options:
  --path               Directory to scan (required unless using --verify-supported)
  --compare            CSV file path or checksum string
  --algorithm          Hash algorithm (md5, sha256, sha384, sha512) [default: sha256]
  --csvDirectory       Directory to write generated CSV (default: OS temp + /hashwalk)
  --debug              Enable detailed error logging [default: false]
  --verify-supported, -v  Test which algorithms are supported in the environment
  --help               Show this help message

Examples:
  hashwalk --path ./data
  hashwalk --path ./data --compare checksums.csv --algorithm sha256
  hashwalk --path ./data --compare <checksum_string> --algorithm sha256
  hashwalk --verify-supported
`;

export async function main(
  args: string[] = process.argv.slice(2),
): Promise<number> {
  const { values: argv } = parseArgs({
    args,
    options: cliOptions,
    allowPositionals: false,
  });

  if (argv.help) {
    console.log(helpText);

    return 0;
  }

  // Handle --verify-supported flag
  if (argv['verify-supported']) {
    const supportedAlgorithms: string[] = [];
    for (const algo of validAlgorithms) {
      if (isAlgoAvailable(algo)) {
        supportedAlgorithms.push(algo);
      }
    }

    console.log(JSON.stringify(supportedAlgorithms));

    return 0;
  }

  if (!argv.path) {
    console.error(
      JSON.stringify({ error: 'Missing required argument: --path' }),
    );

    return 1;
  }

  const algorithm = (argv.algorithm || 'sha256').toLowerCase();
  if (!supportedHashAlgorithms.includes(algorithm)) {
    console.error(
      JSON.stringify({
        error: `Invalid algorithm: ${algorithm}. Must be one of: ${
          supportedHashAlgorithms.join(', ')
        }`,
      }),
    );

    return 1;
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

    const csvDir = argv.csvDirectory ?? path.join(os.tmpdir(), 'hashwalk');

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

    return 0;
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

    return 1;
  }
}
