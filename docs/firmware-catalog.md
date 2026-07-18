# GitHub Release firmware catalog

The app market supports a gradual migration from the handwritten catalog to
validated GitHub Releases. Existing entries remain in `catalog/apps.manual.json`.
A repository becomes automated only after its app ID is added to
`catalog/sources.json` and at least one eligible release passes validation.

## Catalog files

- `catalog/apps.manual.json`: legacy/manual entries.
- `catalog/sources.json`: repositories managed through GitHub Releases.
- `catalog/app-market-manifest.schema.json`: release manifest contract.
- `src/assets/apps.json`: generated application catalog; do not edit directly.
- `src/assets/generated/`: downloaded, checksum-verified release assets.

## Registering a repository

Add one entry to `catalog/sources.json`:

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "id": "tp-icon-256-test-app",
      "repository": "ThingPulse/icon256-testbed",
      "enabled": true,
      "manifestAsset": "app-market.json",
      "retainVersions": 3,
      "retainSnapshots": 3
    }
  ]
}
```

The `id` must match both the release manifest and the existing manual entry.
Once the release is accepted, the generated entry replaces the matching manual
entry. Other manual applications are unchanged.

## Firmware repository release assets

Every release must contain:

1. `app-market.json`.
2. The icon named by the manifest.
3. Every firmware binary named by the manifest.

Start from `docs/examples/app-market.json`. The release tag and manifest version
must match after removing an optional `v` prefix. For example, tag `v1.2.0`
matches manifest version `1.2.0`.

Replace the example's all-zero SHA-256 value with the digest of the actual
firmware binary.

Calculate each binary checksum with:

```bash
shasum -a 256 build/firmware.bin
```

Offsets may be decimal numbers or hexadecimal strings such as `"0x10000"`.
Downloaded partition assets are rejected when they overlap.

## Example firmware release workflow

Add `.github/workflows/release.yaml` to the firmware repository and adapt its
build command and output paths:

```yaml
name: Release firmware

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build firmware
        run: pio run

      - name: Prepare release files
        run: |
          cp .pio/build/esp32s3/firmware.bin dist/icon256-test-app.bin
          cp assets/icon.png dist/icon256-test-app.png
          cp app-market.json dist/app-market.json

      - name: Verify manifest checksum
        run: |
          test "$(shasum -a 256 dist/icon256-test-app.bin | cut -d' ' -f1)" = \
            "$(jq -r '.release.partitions[0].sha256' dist/app-market.json)"

      - name: Publish GitHub Release
        run: gh release create "${GITHUB_REF_NAME}" dist/* --generate-notes
        env:
          GH_TOKEN: ${{ github.token }}
```

For a production workflow, generate the checksum and manifest during the build
rather than manually copying the hash. The manifest attached to the release must
contain the final checksum before the app-market synchronizer runs.

## Snapshots

Snapshots are ordinary GitHub prereleases. Use a SemVer prerelease tag, for
example `v1.3.0-rc.1`, and mark the GitHub Release as a prerelease:

```bash
gh release create v1.3.0-rc.1 dist/* --prerelease --generate-notes
```

Stable catalog synchronization ignores prereleases. To test snapshots locally:

```bash
GITHUB_TOKEN=$(gh auth token) npm run catalog:sync:snapshots
npm start
```

The installer version selector labels these builds as **Snapshot** and displays
a warning before flashing.

The `Build firmware snapshot preview` workflow performs the same snapshot build
and uploads a seven-day static-site artifact. Host that directory on localhost
or deploy it to a separate HTTPS preview environment. Do not deploy snapshot
output over the production app market.

## Stable update pipeline

The hourly `Sync firmware catalog` workflow:

1. Fetches non-draft, non-prerelease GitHub Releases.
2. Validates every manifest against the JSON Schema.
3. Confirms release tag and manifest version match.
4. Downloads all referenced assets.
5. Verifies manifest SHA-256 and GitHub asset digests when available.
6. Rejects overlapping partitions and unknown device IDs.
7. Generates the combined manual/automated catalog.
8. Runs generator tests and an Angular production build.
9. Opens or updates a catalog pull request.

If the workflow fails, the deployed app market remains on its last known-good
catalog.

Normal `npm run build` is deliberately network-independent and uses the committed
generated catalog. Release discovery happens in `npm run catalog:sync` and in the
catalog workflow before the application build. This keeps Docker and production
builds reproducible and prevents GitHub API limits from affecting deployment.

## Infrastructure setup

For public repositories, the app-market workflow's built-in `GITHUB_TOKEN` can
read releases. No personal access token is needed for polling.

The repository must allow GitHub Actions to create pull requests:

1. Open **Settings → Actions → General**.
2. Set workflow permissions to **Read and write permissions**.
3. Enable **Allow GitHub Actions to create and approve pull requests**.

Optional near-real-time updates can later use `repository_dispatch`. The hourly
poll remains the recovery mechanism and is enough for the initial rollout.

For snapshot previews, configure a separate preview hostname or Docker tag if
the downloadable workflow artifact is not convenient. Web Serial requires a
secure context, except that browsers also allow localhost for local testing.
