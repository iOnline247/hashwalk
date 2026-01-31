# CI/CD Workflows

This repository uses GitHub Actions for continuous integration and publishing to
npm with provenance.

## Workflows

### CI Workflow (`ci.yml`)

Runs on every push and pull request to the `main` branch.

**Jobs:**

- **Build and Test**: Tests the package on Node.js 20.x and 22.x
  - Installs dependencies
  - Builds the project
  - Runs linter
  - Runs all tests

- **Coverage**: Generates test coverage report
  - Runs tests with coverage on Node.js 22.x
  - Uploads coverage artifacts for review

### Publish Workflow (`publish.yml`)

Publishes the package to npm with provenance when a new release is created, or
can be triggered manually.

**Key Features:**

#### 📦 npm Provenance

The workflow publishes with the `--provenance` flag, which:

- Generates a provenance attestation for the published package
- Links the package to its source code and build environment
- Uses **Sigstore** under the hood for keyless signing
- Creates a verifiable, tamper-evident record in a public transparency log

This means consumers can verify:

- The package was built from this specific repository
- The exact commit/tag it was built from
- The package hasn't been tampered with since publication

#### 🔐 Sigstore Integration

npm's provenance feature uses [Sigstore](https://www.sigstore.dev/) internally
for signing and verification:

- **Keyless Signing**: No long-term private keys to manage. Signing is tied to
  GitHub Actions' OIDC identity.
- **Transparency Log**: All signatures are recorded in a public, tamper-evident
  log (Rekor).
- **Verification**: Anyone can verify the provenance attestation using npm's
  built-in tooling.

The workflow requires the `id-token: write` permission to enable OIDC
authentication with Sigstore.

#### 📋 SBOM Generation

The workflow also generates Software Bill of Materials (SBOM) in both CycloneDX
and SPDX formats:

- `sbom/sbom-cyclonedx.json`
- `sbom/sbom-spdx.json`

These are uploaded as build artifacts and can be used for supply chain security
and compliance.

## Setup

### Prerequisites

#### 1. Configure npm Trusted Publisher (OIDC)

The workflow uses npm's Trusted Publishing with OIDC for secure, keyless
authentication. **No npm token or secret is required.**

**Steps to configure:**

1. Go to your package page on npmjs.com (or create the package first)
2. Navigate to **Settings** → **Publishing Access** → **Trusted Publishers**
3. Click **Add Trusted Publisher**
4. Select **GitHub Actions**
5. Fill in the details:
   - **Organization/User**: `iOnline247`
   - **Repository**: `hashwalk`
   - **Workflow filename**: `publish.yml` (just the filename, not the full path)
   - **Environment** (optional): Leave blank unless using GitHub Environments

This creates a trust relationship where npm will only accept publishes from this
specific workflow in this specific repository.

**Important Notes:**

- The workflow filename must match exactly (case-sensitive)
- The workflow file must be in `.github/workflows/` directory
- OIDC authentication requires npm CLI v11.5.1 or later (installed automatically
  in GitHub Actions)
- No `NPM_TOKEN` secret is needed - authentication is handled automatically via
  OIDC

For more details, see: https://docs.npmjs.com/trusted-publishers

### Publishing a New Version

#### Option 1: Create a GitHub Release (Recommended)

1. Update version in `package.json`
2. Commit and push to `main`
3. Create a new release on GitHub with a tag (e.g., `v1.2.0`)
4. The publish workflow will automatically run

#### Option 2: Manual Workflow Dispatch

1. Go to Actions → Publish to npm
2. Click "Run workflow"
3. Optionally specify a tag to publish
4. The workflow will run and publish the package

## Verifying Provenance

After publishing, you can verify the provenance of the package:

```bash
# View provenance information
npm view hashwalk --json | jq .dist

# The response will include attestations that prove the package
# was built from this repository by GitHub Actions
```

Users installing the package can also verify provenance automatically when using
npm with audit features enabled.

## Security Considerations

- **OIDC Trusted Publishing**: Uses keyless authentication - no long-lived
  secrets to manage or leak
- **Provenance**: Provides cryptographic proof of package origin via Sigstore
- **SBOM**: Enables supply chain transparency and vulnerability tracking
- **Test Before Publish**: The workflow ensures all tests pass before publishing
- **Minimal Permissions**: Workflows use least-privilege permission model

## Further Reading

- [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [Sigstore Documentation](https://docs.sigstore.dev/)
- [GitHub Actions for npm Publishing](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [npm Trusted Publishing with OIDC](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
