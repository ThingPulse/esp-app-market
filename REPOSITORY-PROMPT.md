# SuperWiFiDuck manifest-generation prompt

Use the following prompt with Codex while the `ThingPulse/SuperWiFiDuck`
repository is open:

```text
Fix the ESP App Market manifest generation in this SuperWiFiDuck repository.

The generated manifests from releases `v1.2.0-rc.1` and `v1.2.0-rc.2` do not
satisfy the ESP App Market schema. Inspect the existing manifest template,
generation script, tests, and GitHub release workflow before editing.

Make these changes:

1. Correct the application identifiers

The generated manifest must contain exactly:

{
  "id": "tp-pendrive-s3-super-wifi-duck",
  "supportedDevices": [
    "tp-pendrive-s3"
  ]
}

Do not use `super-wifi-duck` as either the application ID or device ID.

2. Correct the icon representation

`app.icon` must be an asset-reference object, not a filename string:

{
  "asset": "logo.png",
  "sha256": "<SHA-256 of the exact logo.png release asset>"
}

Calculate the checksum during release preparation from the exact file that will
be uploaded. Do not hard-code the current checksum and do not use a placeholder.

3. Generate this manifest shape

The final release manifest must have this structure:

{
  "schemaVersion": 1,
  "app": {
    "id": "tp-pendrive-s3-super-wifi-duck",
    "name": "SuperWifiDuck",
    "description": "Wi-Fi controlled USB HID device for running Ducky Script payloads on the ThingPulse Pendrive S3.",
    "supportedDevices": [
      "tp-pendrive-s3"
    ],
    "tags": [
      "wifi",
      "security"
    ],
    "icon": {
      "asset": "logo.png",
      "sha256": "<calculated logo.png SHA-256>"
    }
  },
  "release": {
    "version": "<version normalized from the release tag>",
    "partitions": [
      {
        "name": "firmware",
        "asset": "app-firmware.bin",
        "offset": "0x0000",
        "sha256": "<calculated app-firmware.bin SHA-256>"
      }
    ]
  }
}

For example, tag `v1.2.0-rc.3` must produce manifest version `1.2.0-rc.3`.

4. Verify release assets

The release workflow must upload exactly the files referenced by the manifest:

- `app-market.json`
- `app-firmware.bin`
- `logo.png`

Before publishing, validation must fail if:

- A referenced file is missing.
- A checksum is not 64 hexadecimal characters.
- A generated checksum does not match its referenced file.
- The application ID is incorrect.
- The supported device ID is incorrect.
- `app.icon` is a string instead of an object.
- The manifest version does not match the Git tag after removing the optional
  `v` prefix.

Calculate SHA-256 checksums from the final staged release assets, after any
copying or renaming.

5. Add or update tests

Add tests that verify:

- The exact application ID.
- The exact supported device ID.
- `app.icon.asset` equals `logo.png`.
- `app.icon.sha256` matches the staged `logo.png`.
- The firmware checksum matches the staged firmware.
- A prerelease tag such as `v1.2.0-rc.3` becomes version `1.2.0-rc.3`.
- The final manifest satisfies the expected object structure.
- Missing assets and checksum mismatches fail release preparation.

Use the repository's existing test approach and tooling where possible.

6. Preserve scope

Do not change firmware functionality, flash layout, partition offsets, or
unrelated application code. Do not publish a release, create or delete tags,
push changes, or open a pull request.

After implementing:

- Run the manifest tests.
- Run the manifest generator against locally staged firmware and logo assets.
- Show the generated `app-market.json`.
- Independently recalculate both SHA-256 values and confirm they match.
- Report every changed file and command result.
- Tell me the exact command or tag to use for the next snapshot release.

Important release-history context:

The existing `v1.2.0-rc.1` and `v1.2.0-rc.2` manifests are invalid. The next test
release should normally be `v1.2.0-rc.3`. Do not modify or publish releases
automatically.
```
