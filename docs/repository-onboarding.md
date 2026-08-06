# Adding a firmware repository

Use the repository scaffolder instead of asking an agent to reproduce the
manifest contract. It records repository-specific facts in JSON and installs a
deterministic release tool and GitHub Actions workflow.

## Interactive setup

From this app-market repository, run:

```bash
npm run repository:init -- --target ../your-firmware-repository
```

The command asks for:

- the exact app-market application and device IDs;
- display metadata and public repository URL;
- the repository-relative source icon path and its release filename;
- the CI dependency-setup command and clean build command;
- each required binary's build-output path, release filename, and flash offset.

For PlatformIO repositories, the scaffolder reads all `[env:<name>]` sections
from `platformio.ini` and asks which environments should be published. Each
selected environment becomes an independent App Market target with its own app
ID, supported device IDs, manifest filename, firmware assets, and flash layout.
The generated workflow builds all selected environments and attaches every
target manifest and binary to the same GitHub Release.

For each partition, enter one line in this form:

```text
Application|.pio/build/esp32s3/firmware.bin|firmware.bin|0x10000
```

The source path may contain directories. The release filename must be a basename
only. The generated manifest will refer to `firmware.bin`, never to its build
directory.

Use different firmware asset names for different targets, for example
`firmware-grande.bin` and `firmware-pro.bin`. Targets may share an icon asset
when its source path and release filename are identical.

The scaffolder refuses to overwrite existing integration files unless you pass
`--force`. Review existing files before doing that.

## Repeatable, non-interactive setup

Copy `docs/examples/repository-answers.json`, fill in its values, and run:

```bash
npm run repository:init -- \
  --target ../your-firmware-repository \
  --answers ./my-repository-answers.json
```

This makes onboarding reproducible across multiple repositories. Keep answer
files outside the firmware repository if they are only migration inputs.
For a repository with multiple PlatformIO environments, start from
`docs/examples/repository-answers-multi-target.json` instead.

## Files installed in the firmware repository

- `.app-market/config.json`: one or more targets with app metadata, PlatformIO
  environment, source paths, release filenames, and flash offsets.
- `.app-market/.gitignore`: excludes locally staged release assets.
- `scripts/app-market-release.mjs`: dependency-free staging, manifest generation,
  checksum validation, and overlap validation.
- `.github/workflows/app-market-release.yml`: clean build, validation, snapshot
  prereleases, and stable GitHub Releases.

The source icon path exists only in `.app-market/config.json`. The manifest icon
is always an object containing the final GitHub Release asset basename and the
SHA-256 of that exact staged file.

## Local validation

In the firmware repository, run the configured build command and then:

```bash
node scripts/app-market-release.mjs --tag v0.0.0-local
```

Inspect:

```text
.app-market/release/<manifest filename(s)>
.app-market/release/<icon filename>
.app-market/release/<firmware binaries>
```

The tool starts from a clean staging directory and fails for missing files,
paths used as release asset names, invalid IDs or offsets, duplicate filenames,
checksum mismatches, and overlapping flash ranges.

Run the generated workflow manually to validate on GitHub without publishing a
release. Pushing a `v*` tag publishes the staged files. Tags containing a SemVer
prerelease suffix, such as `v1.2.0-rc.1`, create a GitHub prerelease that the app
market can import as a snapshot.

## Registering the repository

After its first valid release, add every target to `catalog/sources.json` in the
app-market repository. Multiple source entries may point to the same repository;
each uses its target's distinct `id` and `manifestAsset`. A source ID must exactly
match the corresponding `app.id` in `.app-market/config.json`.

The remaining manual review is intentionally small: confirm that the declared
device IDs are real and that the build-output offsets describe the device's
actual flash layout. Everything else is generated or validated by code.
