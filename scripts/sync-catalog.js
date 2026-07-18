#!/usr/bin/env node

const { createHash } = require('crypto');
const { mkdir, mkdtemp, readFile, rename, rm, writeFile } = require('fs/promises');
const { basename, join } = require('path');
const { tmpdir } = require('os');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ROOT = join(__dirname, '..');
const MANUAL_CATALOG = join(ROOT, 'catalog', 'apps.manual.json');
const SOURCES_FILE = join(ROOT, 'catalog', 'sources.json');
const MANIFEST_SCHEMA = join(ROOT, 'catalog', 'app-market-manifest.schema.json');
const DEVICE_CATALOG = join(ROOT, 'src', 'assets', 'devices.json');
const OUTPUT_CATALOG = join(ROOT, 'src', 'assets', 'apps.json');
const OUTPUT_ASSETS = join(ROOT, 'src', 'assets', 'generated');

function normalizeVersion(value) {
  return value.trim().replace(/^v(?=\d)/i, '');
}

function parseOffset(value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 16);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid flash offset: ${value}`);
  }
  return parsed;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function safeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function validatePartitions(partitions) {
  const sorted = [...partitions].sort((a, b) => a.offset - b.offset);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.offset + previous.size > current.offset) {
      throw new Error(
        `Flash partitions overlap: ${previous.name} ends after ${current.name} starts`
      );
    }
  }
}

function mergeCatalogs(manualApps, automatedApps) {
  const automatedById = new Map(automatedApps.map(app => [app.id, app]));
  const combined = manualApps.map(app => {
    const replacement = automatedById.get(app.id);
    automatedById.delete(app.id);
    return replacement || app;
  });
  combined.push(...automatedById.values());
  const ids = new Set();
  for (const app of combined) {
    if (ids.has(app.id)) {
      throw new Error(`Duplicate app id in combined catalog: ${app.id}`);
    }
    ids.add(app.id);
  }
  return combined;
}

function validateSourceConfig(config) {
  if (config.schemaVersion !== 1 || !Array.isArray(config.sources)) {
    throw new Error('catalog/sources.json must use schemaVersion 1 and contain a sources array');
  }
  const ids = new Set();
  for (const source of config.sources) {
    if (!source.id || !/^[a-z0-9][a-z0-9-]*$/.test(source.id)) {
      throw new Error(`Invalid catalog source id: ${source.id}`);
    }
    if (ids.has(source.id)) {
      throw new Error(`Duplicate catalog source id: ${source.id}`);
    }
    if (!/^[^/\s]+\/[^/\s]+$/.test(source.repository || '')) {
      throw new Error(`Invalid GitHub repository for ${source.id}: ${source.repository}`);
    }
    for (const property of ['retainVersions', 'retainSnapshots']) {
      if (source[property] !== undefined && (!Number.isInteger(source[property]) || source[property] < 1)) {
        throw new Error(`${property} for ${source.id} must be a positive integer`);
      }
    }
    ids.add(source.id);
  }
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ThingPulse-ESP-App-Market',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: githubHeaders(), redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function download(url) {
  const response = await fetch(url, { headers: githubHeaders(), redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Asset download failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function findAsset(release, assetName) {
  const asset = release.assets.find(candidate => candidate.name === assetName);
  if (!asset) {
    throw new Error(`${release.html_url} is missing release asset ${assetName}`);
  }
  return asset;
}

async function downloadVerifiedAsset(release, reference) {
  const asset = findAsset(release, reference.asset);
  const buffer = await download(asset.browser_download_url);
  const digest = sha256(buffer);
  if (reference.sha256 && digest.toLowerCase() !== reference.sha256.toLowerCase()) {
    throw new Error(`SHA-256 mismatch for ${release.tag_name}/${reference.asset}`);
  }
  if (asset.digest && asset.digest.toLowerCase() !== `sha256:${digest}`) {
    throw new Error(`GitHub asset digest mismatch for ${release.tag_name}/${reference.asset}`);
  }
  return { asset, buffer, digest };
}

async function loadManifest(release, source, validateManifest) {
  const manifestAsset = findAsset(release, source.manifestAsset || 'app-market.json');
  const manifest = JSON.parse((await download(manifestAsset.browser_download_url)).toString('utf8'));
  if (!validateManifest(manifest)) {
    const errors = validateManifest.errors.map(error => `${error.instancePath} ${error.message}`).join('; ');
    throw new Error(`Invalid manifest in ${release.html_url}: ${errors}`);
  }
  if (manifest.app.id !== source.id) {
    throw new Error(`Manifest app id ${manifest.app.id} does not match registered id ${source.id}`);
  }
  if (normalizeVersion(manifest.release.version) !== normalizeVersion(release.tag_name)) {
    throw new Error(
      `Manifest version ${manifest.release.version} does not match release tag ${release.tag_name}`
    );
  }
  return manifest;
}

async function syncSource(source, options) {
  const releases = await fetchJson(`https://api.github.com/repos/${source.repository}/releases?per_page=100`);
  const published = releases.filter(release => !release.draft);
  const stable = published.filter(release => !release.prerelease).slice(0, source.retainVersions || 3);
  const snapshots = options.includeSnapshots
    ? published.filter(release => release.prerelease).slice(0, source.retainSnapshots || 3)
    : [];
  const selected = [...stable, ...snapshots];
  if (selected.length === 0) {
    throw new Error(`No eligible releases found for ${source.repository}`);
  }

  const releaseRecords = [];
  for (const release of selected) {
    const manifest = await loadManifest(release, source, options.validateManifest);
    const version = normalizeVersion(manifest.release.version);
    const versionDirectory = join(options.assetDirectory, safeSegment(source.id), safeSegment(version));
    await mkdir(versionDirectory, { recursive: true });
    const partitions = [];
    const layout = [];

    for (const partition of manifest.release.partitions) {
      const downloaded = await downloadVerifiedAsset(release, partition);
      const filename = basename(downloaded.asset.name);
      await writeFile(join(versionDirectory, filename), downloaded.buffer);
      const offset = parseOffset(partition.offset);
      partitions.push({
        name: partition.name,
        data: '',
        offset,
        url: `/assets/generated/${safeSegment(source.id)}/${safeSegment(version)}/${filename}`,
        sha256: downloaded.digest,
        size: downloaded.buffer.length
      });
      layout.push({ name: partition.name, offset, size: downloaded.buffer.length });
    }
    validatePartitions(layout);
    releaseRecords.push({ release, manifest, version, partitions });
  }

  const metadataRecord = releaseRecords.find(record => !record.release.prerelease) || releaseRecords[0];
  const iconDownload = await downloadVerifiedAsset(metadataRecord.release, metadataRecord.manifest.app.icon);
  const iconDirectory = join(options.assetDirectory, safeSegment(source.id));
  await mkdir(iconDirectory, { recursive: true });
  const iconFilename = basename(iconDownload.asset.name);
  await writeFile(join(iconDirectory, iconFilename), iconDownload.buffer);
  const appMetadata = metadataRecord.manifest.app;
  const stableVersion = releaseRecords.find(record => !record.release.prerelease) || releaseRecords[0];

  return {
    id: source.id,
    name: appMetadata.name,
    description: appMetadata.description,
    instructions: appMetadata.instructions || '',
    version: stableVersion.version,
    repository: appMetadata.repository || `https://github.com/${source.repository}`,
    appIcon: `/assets/generated/${safeSegment(source.id)}/${iconFilename}`,
    supportedDevices: appMetadata.supportedDevices,
    tags: appMetadata.tags,
    source: { type: 'github-release', repository: source.repository },
    versions: releaseRecords.map(record => ({
      name: record.version,
      channel: record.release.prerelease ? 'snapshot' : 'stable',
      publishedAt: record.release.published_at,
      releaseUrl: record.release.html_url,
      notes: record.manifest.release.notes || '',
      partitions: record.partitions
    }))
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const includeSnapshots = process.argv.includes('--include-snapshots');
  const check = process.argv.includes('--check');
  const manualApps = await readJson(MANUAL_CATALOG);
  const sourceConfig = await readJson(SOURCES_FILE);
  validateSourceConfig(sourceConfig);
  const deviceIds = new Set((await readJson(DEVICE_CATALOG)).map(device => device.id));
  const schema = await readJson(MANIFEST_SCHEMA);
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateManifest = ajv.compile(schema);
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'esp-app-market-catalog-'));
  const temporaryAssets = join(temporaryRoot, 'generated');
  await mkdir(temporaryAssets, { recursive: true });

  try {
    const enabledSources = sourceConfig.sources.filter(source => source.enabled !== false);
    const automatedApps = [];
    for (const source of enabledSources) {
      process.stdout.write(`Syncing ${source.repository}${includeSnapshots ? ' with snapshots' : ''}...\n`);
      automatedApps.push(await syncSource(source, {
        includeSnapshots,
        validateManifest,
        assetDirectory: temporaryAssets
      }));
    }

    const catalog = mergeCatalogs(manualApps, automatedApps);
    const automatedIds = new Set(automatedApps.map(app => app.id));
    for (const app of catalog) {
      for (const deviceId of app.supportedDevices || []) {
        if (!deviceIds.has(deviceId)) {
          if (automatedIds.has(app.id)) {
            throw new Error(`App ${app.id} references unknown device ${deviceId}`);
          }
          process.stderr.write(`Warning: legacy app ${app.id} references unknown device ${deviceId}.\n`);
        }
      }
    }
    const output = `${JSON.stringify(catalog, null, 2)}\n`;

    if (check) {
      const current = await readFile(OUTPUT_CATALOG, 'utf8');
      if (current !== output) {
        throw new Error('Generated apps.json is out of date. Run npm run catalog:sync.');
      }
      process.stdout.write(`Catalog is current (${catalog.length} apps).\n`);
      return;
    }

    await writeFile(OUTPUT_CATALOG, output);
    await rm(OUTPUT_ASSETS, { recursive: true, force: true });
    if (enabledSources.length > 0) {
      await rename(temporaryAssets, OUTPUT_ASSETS);
    }
    process.stdout.write(
      `Generated ${catalog.length} apps (${automatedApps.length} automated, ${catalog.length - automatedApps.length} manual).\n`
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  mergeCatalogs,
  normalizeVersion,
  parseOffset,
  sha256,
  validatePartitions,
  validateSourceConfig
};
