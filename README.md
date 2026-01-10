# hashwalk

![Hashwalk Logo](./docs/img/hashwalk.png)

This CLI utility will create a registry of all files within a directory and output the checksum of that registry. Effectively, we're checksumming the checksums.

## Software Bill of Materials (SBOM)

This project includes automated SBOM generation to improve supply chain security, vulnerability management, and license compliance. SBOMs provide a complete inventory of all dependencies used in the project.

### Why SBOM?

A Software Bill of Materials (SBOM) is a comprehensive list of all components, libraries, and dependencies in a software project. SBOMs are critical for:

- **Security**: Quickly identify vulnerable dependencies and assess security risks
- **Compliance**: Track licenses and ensure regulatory compliance
- **Supply Chain Transparency**: Understand the complete software supply chain
- **Vulnerability Management**: Enable rapid response to newly discovered vulnerabilities

### Generating SBOMs

The project supports two industry-standard SBOM formats:

1. **CycloneDX**: Optimized for security and vulnerability workflows
2. **SPDX**: Focused on license compliance and provenance

#### Generate All SBOMs

To generate both CycloneDX and SPDX format SBOMs:

```bash
npm run sbom:generate
```

This will create two files in the `sbom/` directory:
- `cyclonedx-sbom.json`: CycloneDX format SBOM
- `spdx-sbom.json`: SPDX format SBOM

#### Generate Individual Formats

Generate only CycloneDX format:

```bash
npm run sbom:cyclonedx
```

Generate only SPDX format:

```bash
npm run sbom:spdx
```

### SBOM Contents

The generated SBOMs include:

- Complete dependency tree (direct and transitive dependencies)
- Package versions and checksums
- License information
- Package metadata and URLs
- Timestamps and tool information
- Package relationships and dependency graphs

### Best Practices

- **Regenerate regularly**: Run SBOM generation whenever dependencies are updated
- **Version control**: Keep SBOMs with release artifacts for audit trails
- **Vulnerability scanning**: Use SBOMs with security tools to scan for vulnerabilities
- **Compliance checks**: Review license information in SBOMs before releases

### SBOM Formats Comparison

| Feature | CycloneDX | SPDX |
|---------|-----------|------|
| **Primary Focus** | Security & vulnerability management | License compliance & provenance |
| **Best For** | DevSecOps, security tooling | Legal compliance, open-source governance |
| **Metadata** | Deep relationships, VEX support, hashes | Rich license expressions, file checksums |
| **Tool Support** | Dependency-Track, Trivy, security scanners | License compliance tools, legal auditing |

## TODOs

- Create example usages
- Describe what is generated & where
- Publish to npm
