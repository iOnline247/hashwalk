# hashwalk

![Hashwalk Logo](./docs/img/hashwalk.png)

This CLI utility creates a registry file (CSV) of all files within a directory and outputs the checksum of that registry file.  Effectively, we're checksumming the checksums - providing a single hash that represents the entire directory structure and its contents.

## Installation

```bash
npm install -g hashwalk
```

Or run directly with npx:

```bash
npx hashwalk --help
```

## Usage

### Basic Usage - Generate Checksum Registry

```bash
hashwalk --path ./data
```

This will:
1. Recursively scan the `./data` directory
2. Generate a checksum for each file using SHA-256 (default)
3. Create a CSV file with all checksums
4. Output JSON with the CSV path and overall hash

**Example output:**
```json
{
  "csv": "/tmp/hashwalk/20240115T120000_sha256_abc123.csv",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

### Verify Against a Known Checksum

```bash
hashwalk --path ./data --compare e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 --algorithm sha256
```

**Example output:**
```json
{
  "csv": "/tmp/hashwalk/20240115T120000_sha256_abc123.csv",
  "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "compare": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "isMatch": true
}
```

### Verify Against an Existing CSV File

```bash
hashwalk --path ./data --compare ./previous-checksums.csv --algorithm sha256
```

### Use Different Hash Algorithms

```bash
# MD5 (fastest, least secure)
hashwalk --path ./data --algorithm md5

# SHA-1
hashwalk --path ./data --algorithm sha1

# SHA-256 (default, recommended)
hashwalk --path ./data --algorithm sha256

# SHA-384
hashwalk --path ./data --algorithm sha384

# SHA-512 (most secure)
hashwalk --path ./data --algorithm sha512
```

### Specify Custom CSV Output Directory

```bash
hashwalk --path ./data --csvDirectory ./my-checksums
```

### Enable Debug Mode

```bash
hashwalk --path ./data --debug
```

Debug mode provides detailed error messages for troubleshooting.

## CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--path` | `-p` | Directory to scan (required) | - |
| `--compare` | `-c` | CSV file path or checksum string to verify against | - |
| `--algorithm` | `-a` | Hash algorithm: md5, sha1, sha256, sha384, sha512 | sha256 |
| `--csvDirectory` | - | Directory to write generated CSV | OS temp + /hashwalk |
| `--debug` | `-d` | Enable detailed error logging | false |
| `--help` | `-h` | Show help message | - |

## Generated CSV Format

The generated CSV follows RFC 4180 format with the following columns:

| Column | Description |
|--------|-------------|
| RelativePath | Path relative to the scanned directory |
| FileName | Name of the file |
| Algorithm | Hash algorithm used |
| Hash | Computed hash value |

**Example CSV content:**
```csv
"RelativePath","FileName","Algorithm","Hash"
"file1.txt","file1.txt","sha256","abc123..."
"subdir/file2.txt","file2.txt","sha256","def456..."
```

## Output Location

By default, CSV files are written to:
- **Linux/macOS:** `/tmp/hashwalk/`
- **Windows:** `%TEMP%\hashwalk\`

File naming format:  `YYYYMMDDTHHMMSS_<algorithm>_<uuid>.csv`

## Use Cases

- **Software Distribution:** Verify file integrity after transfer
- **Backup Verification:** Ensure backups match original files
- **Change Detection:** Detect modifications in a directory structure
- **Compliance:** Maintain audit trails of file states
- **CI/CD Pipelines:** Verify build artifacts

## Software Bill of Materials (SBOM)

Generate SBOM files in both CycloneDX and SPDX formats:

```bash
npm run sbom:generate
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run only tests marked with . only
npm run test:failures
```

### Building

```bash
npm run build
```

### Development Mode (watch)

```bash
npm run dev
```

## Publishing

This project uses automated publishing via GitHub Actions with npm Trusted Publishing (OIDC) and provenance.

**Automated Publishing** (Recommended):
1. Configure npm Trusted Publisher (one-time setup - see [CI/CD Documentation](./.github/CICD.md))
2. Update version in `package.json`
3. Create a GitHub release with a version tag (e.g., `v1.2.0`)
4. The publish workflow automatically runs with OIDC authentication and provenance signing

See [CI/CD Documentation](./.github/CICD.md) for setup details, workflow information, and OIDC configuration.

**Manual Publishing** (for testing):
```bash
# Quick preview of what would be published
npm pack --dry-run
npm publish --dry-run

# Create a local tarball you can inspect
npm pack

# Publish to npm manually (local only, no provenance)
npm publish
```

## CI/CD

This repository includes GitHub Actions workflows for:
- **Continuous Integration**: Automated testing on Node.js 20.x, 22.x, and 24.x (all active LTS versions)
- **Code Coverage**: Test coverage reporting
- **Automated Publishing**: npm publishing with OIDC and Sigstore provenance signing
- **Automated Publishing**: npm publishing with provenance and Sigstore signing

See [.github/CICD.md](./.github/CICD.md) for complete documentation.

## License

AGPL-3.0-only