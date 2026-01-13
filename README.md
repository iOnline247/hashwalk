# hashwalk

![Hashwalk Logo](./docs/img/hashwalk.png)

This CLI utility will create a registry of all files within a directory and output the checksum of that registry. Effectively, we're checksumming the checksums.

## Software Bill of Materials (SBOM)

Generate SBOM files in both CycloneDX and SPDX formats:

```bash
npm run sbom:generate
```

## Publishing

- Quick preview of what would be published  
`npm pack --dry-run`  
`npm publish --dry-run`  

- Fix problems with CLI configuration within package.json  
`npm pkg fix`  

- Create a local tarball you can inspect  
`npm pack`

## TODOs

- Create example usages
- Describe what is generated & where
- Publish to npm
