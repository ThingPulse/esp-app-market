# Firmware repository integration prompt

Use this prompt with Codex while the firmware repository you want to integrate
is open. Replace the values in the **ESP App Market values** section first.

```text
Prepare this public GitHub firmware repository for integration with the ESP App
Market GitHub Release catalog.

Inspect the repository's build system, generated binaries, flash offsets,
version source, existing tests, icon files, and GitHub Actions workflows before
editing. Reuse and extend the existing release workflow instead of creating a
competing release process.

ESP App Market values supplied by me:

- Application ID: <APP_MARKET_APPLICATION_ID>
- Supported device IDs: <APP_MARKET_DEVICE_IDS>
- Display name: <APPLICATION_DISPLAY_NAME>
- Release icon filename: <ICON_RELEASE_FILENAME, for example logo.png>
- Manifest release filename: app-market.json

The application ID and device IDs are identifiers from the ESP App Market. They
are not repository names or filenames. Use them exactly as supplied. If any of
these values are missing, ask me for them before implementing; do not invent
them.

## Required release assets

Each GitHub Release must contain:

1. `app-market.json`.
2. The icon file referenced by `app.icon.asset`.
3. Every firmware binary referenced by `release.partitions[].asset`.

All `asset` values in the manifest refer to assets attached to the SAME GitHub
Release as `app-market.json`. They do not refer to files in the Git repository,
raw GitHub URLs, web URLs, build-directory paths, or application runtime paths.

## Critical icon rules

There are three distinct icon concepts. Do not confuse them:

1. Source icon: an existing file somewhere in the checked-out repository, such
   as `docs/images/product-logo.png`. This path is used only by the build or
   release script.
2. Staged release icon: the source icon copied into the release staging
   directory with a stable filename, such as `dist/release/logo.png`.
3. Manifest icon asset: only the staged file's basename, such as `logo.png`.

`app.icon` MUST be an object with `asset` and `sha256`. It MUST NOT be a string.
`app.icon.asset` MUST be a plain filename with no `/` or `\\` characters. The
same filename must be uploaded as a GitHub Release asset.

Correct:

"icon": {
  "asset": "logo.png",
  "sha256": "<SHA-256 of the final staged logo.png>"
}

Incorrect examples:

"icon": "logo.png"
"icon": { "asset": "assets/logo.png" }
"icon": { "asset": "dist/release/logo.png" }
"icon": { "asset": "https://raw.githubusercontent.com/.../logo.png" }
"icon": { "asset": "/assets/apps/logo.png" }

Choose the source icon by inspecting the repository. Copy it to the release
staging directory using the supplied release icon filename. Calculate SHA-256
from that final staged copy, after copying or conversion. Upload that exact
staged file to the GitHub Release. Do not calculate the checksum from a
different source file and do not hard-code or placeholder the checksum.

## Manifest generation

Add a deterministic repository-native script that generates the final
`app-market.json` from the actual staged release files. Prefer the language and
tooling already used by the repository.

The generated manifest must follow this shape:

{
  "schemaVersion": 1,
  "app": {
    "id": "<exact supplied application ID>",
    "name": "<supplied display name>",
    "description": "<concise description derived from the repository>",
    "supportedDevices": ["<exact supplied device ID>"],
    "tags": ["<relevant tag>"],
    "icon": {
      "asset": "<release icon basename only>",
      "sha256": "<calculated SHA-256 of the staged release icon>"
    }
  },
  "release": {
    "version": "<version normalized from the Git tag>",
    "partitions": [
      {
        "name": "<partition name>",
        "asset": "<release binary basename only>",
        "offset": "<actual hexadecimal flash offset>",
        "sha256": "<calculated SHA-256 of the staged release binary>"
      }
    ]
  }
}

All firmware `asset` fields follow the same release-asset rule as the icon:
basename only, no repository path and no URL. For example, use `firmware.bin`,
not `.pio/build/board/firmware.bin`. The release script may copy the latter to
the staging directory as the former.

Get the version from the Git tag or authoritative project version. Remove only
an optional leading `v`; for example, `v1.2.0-rc.1` becomes `1.2.0-rc.1`.

Discover the binaries and flash offsets from the real build configuration and
output. Include every image needed to flash an erased device. Do not guess
offsets or change the existing firmware partition layout.

The generator and validation must fail if:

- A referenced staged asset is missing.
- An asset value contains a directory component or URL.
- `app.icon` is anything other than an object with `asset` and `sha256`.
- An application or device ID differs from the supplied value.
- A checksum is not exactly 64 hexadecimal characters.
- A checksum does not match the final staged asset.
- The manifest version does not match the release tag after normalization.
- Firmware partitions overlap based on offset and staged file size.

## GitHub release workflow

Add or update the GitHub Actions release workflow so it:

- Runs for tags matching `v*` and supports `workflow_dispatch` for validation.
- Installs pinned dependencies and performs a clean firmware build.
- Creates a clean release staging directory.
- Copies/renames the required binaries and source icon into that directory.
- Generates `app-market.json` only after all final assets have been staged.
- Validates all filenames, offsets, sizes, and checksums.
- Verifies every manifest reference resolves to a file in the staging directory.
- Uploads `app-market.json` and those exact staged files to one GitHub Release.
- Marks SemVer `-rc`, `-beta`, and `-alpha` versions as GitHub prereleases.
- Publishes ordinary versions such as `v1.2.0` as stable releases.
- Uses `GITHUB_TOKEN` with only the required permissions.
- Does not commit generated build or staging artifacts.

## Tests and documentation

Add focused automated tests for:

- Exact application and device IDs.
- Icon object shape.
- Rejection of repository paths, absolute paths, and URLs in asset fields.
- Icon and firmware checksums against final staged files.
- Artifact discovery and missing artifacts.
- Correct flash offsets and overlapping ranges.
- Stable and prerelease version normalization.
- Final manifest structure.

Document exact local commands for building, staging, generating, and validating
the release. Document how to create a snapshot tag such as `v1.2.0-rc.1` and a
stable tag such as `v1.2.0`.

## Scope and final report

Do not change firmware behavior, device behavior, partition layout, or unrelated
application code. Do not publish a release, create or delete tags, push commits,
or open a pull request unless I explicitly request it.

After implementing:

- Run the relevant tests and one real firmware build.
- Generate the manifest using locally staged release assets.
- Show the final generated manifest.
- List the staging directory and prove that every manifest asset is present
  there under exactly the declared basename.
- Independently recalculate and compare all SHA-256 checksums.
- Report changed files, commands and results, final release asset filenames,
  flash offsets, and required repository settings.
- Provide the exact `catalog/sources.json` entry for the ESP App Market.
- Tell me the next snapshot tag to create, but do not create it.
```
