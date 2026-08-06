#!/usr/bin/env node

const { access, copyFile, mkdir, readFile, writeFile } = require('node:fs/promises');
const { constants } = require('node:fs');
const { basename, dirname, join, relative, resolve } = require('node:path');
const { createInterface } = require('node:readline/promises');
const process = require('node:process');

const ROOT = resolve(__dirname, '..');
const RELEASE_TOOL = join(ROOT, 'scripts/app-market-release-tool.mjs');

function validateId(value) {
  return /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function validateAsset(value) {
  return Boolean(value) && basename(value) === value && !value.includes('/') && !value.includes('\\');
}

function parsePartition(value) {
  const [name, source, asset, offset, ...extra] = value.split('|').map(part => part.trim());
  if (extra.length || !name || !source || !validateAsset(asset) || !/^0x[0-9a-f]+$/i.test(offset || '')) {
    throw new Error('Use name|source path|release filename|hex offset, for example Firmware|build/firmware.bin|firmware.bin|0x10000');
  }
  return { name, source, asset, offset };
}

function yamlCommand(command) {
  return String(command).split('\n').map(line => `          ${line}`).join('\n');
}

function workflow(buildCommand, setupCommand = '') {
  const setupStep = setupCommand ? `
      - name: Install build dependencies
        run: |
${yamlCommand(setupCommand)}
` : '';
  return `name: Build and release firmware for ESP App Market

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      tag:
        description: Version used for validation (no release is published)
        required: true
        default: v0.0.0-local

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
${setupStep}
      - name: Build firmware
        run: |
${yamlCommand(buildCommand)}

      - name: Prepare and validate App Market assets
        env:
          RELEASE_TAG: \${{ github.ref_type == 'tag' && github.ref_name || inputs.tag }}
        run: node scripts/app-market-release.mjs

      - name: Upload GitHub Release
        if: github.ref_type == 'tag'
        uses: softprops/action-gh-release@v2
        with:
          prerelease: \${{ contains(github.ref_name, '-') }}
          files: .app-market/release/*
          fail_on_unmatched_files: true
`;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function askRequired(rl, question, defaultValue, validator = value => Boolean(value)) {
  while (true) {
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    const answer = (await rl.question(`${question}${suffix}: `)).trim() || defaultValue || '';
    if (validator(answer)) return answer;
    console.log('Invalid value; please try again.');
  }
}

async function platformIoEnvironments(target) {
  try {
    const contents = await readFile(join(target, 'platformio.ini'), 'utf8');
    return [...contents.matchAll(/^\s*\[env:([^\]]+)\]\s*$/gm)].map(match => match[1].trim());
  } catch {
    return [];
  }
}

async function collectAnswers(target) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const packagePath = join(target, 'package.json');
    const platformIo = await exists(join(target, 'platformio.ini'));
    let repositoryName = basename(target);
    if (await exists(packagePath)) {
      try { repositoryName = JSON.parse(await readFile(packagePath, 'utf8')).name || repositoryName; } catch {}
    }
    const repository = await askRequired(rl, 'Public repository URL', '', value => /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(value));
    const iconSource = await askRequired(rl, 'Repository-relative source icon path');
    const iconAsset = await askRequired(rl, 'Icon filename attached to each release', basename(iconSource), validateAsset);
    const setupCommand = await askRequired(
      rl,
      'CI dependency setup command (enter "none" if unnecessary)',
      platformIo ? 'python -m pip install platformio' : (await exists(packagePath) ? 'npm ci' : 'none')
    );
    const detectedEnvironments = platformIo ? await platformIoEnvironments(target) : [];
    const environments = platformIo
      ? (await askRequired(
        rl,
        'PlatformIO environments to publish (comma-separated)',
        detectedEnvironments.join(','),
        value => {
          const items = value.split(',').map(item => item.trim()).filter(Boolean);
          return items.length > 0 && items.every(item => /^[a-zA-Z0-9_.-]+$/.test(item));
        }
      )).split(',').map(value => value.trim()).filter(Boolean)
      : [''];
    const targets = [];
    for (const environment of environments) {
      const label = environment ? ` for PlatformIO environment ${environment}` : '';
      console.log(`\nConfigure App Market target${label}.`);
      const id = await askRequired(rl, `ESP App Market application ID${label}`, '', validateId);
      const name = await askRequired(rl, `Display name${label}`, environment ? `${repositoryName} (${environment})` : repositoryName);
      const description = await askRequired(rl, `Description${label}`);
      const devices = (await askRequired(rl, `Supported device IDs${label} (comma-separated)`))
        .split(',').map(value => value.trim()).filter(Boolean);
      const tags = (await rl.question(`Search tags${label} (comma-separated, optional): `)).split(',').map(value => value.trim()).filter(Boolean);
      const manifestAsset = await askRequired(
        rl,
        `Manifest release filename${label}`,
        environments.length === 1 ? 'app-market.json' : `app-market-${environment}.json`,
        validateAsset
      );
      console.log(`Enter each required flash image${label}. Asset must be a filename, not a path.`);
      console.log('Format: name|source path after build|release filename|hex offset');
      const partitions = [];
      while (true) {
        const value = (await rl.question(`Partition ${partitions.length + 1}${partitions.length ? ' (blank to finish)' : ''}: `)).trim();
        if (!value && partitions.length) break;
        try { partitions.push(parsePartition(value)); } catch (error) { console.log(error.message); }
      }
      targets.push({
        environment: environment || undefined,
        manifestAsset,
        app: { id, name, description, repository: repository.replace(/\/$/, ''), supportedDevices: devices, tags },
        icon: { source: iconSource, asset: iconAsset },
        partitions
      });
    }
    const defaultBuild = platformIo
      ? `pio run ${environments.map(environment => `-e ${environment}`).join(' ')}`.trim()
      : 'npm run build';
    const buildCommand = await askRequired(rl, 'Clean CI build command', defaultBuild);
    return {
      config: {
        schemaVersion: 1,
        targets
      },
      setupCommand: setupCommand === 'none' ? '' : setupCommand,
      buildCommand
    };
  } finally {
    rl.close();
  }
}

async function loadAnswers(path) {
  const answers = JSON.parse(await readFile(resolve(path), 'utf8'));
  if (!answers.config || !answers.buildCommand) throw new Error('Answers file requires config and buildCommand');
  return answers;
}

async function writeScaffold(target, answers, force) {
  const outputs = [
    join(target, '.app-market/config.json'),
    join(target, 'scripts/app-market-release.mjs'),
    join(target, '.github/workflows/app-market-release.yml'),
    join(target, '.app-market/.gitignore')
  ];
  const conflicts = [];
  for (const output of outputs) if (await exists(output)) conflicts.push(relative(target, output));
  if (conflicts.length && !force) {
    throw new Error(`Refusing to overwrite existing files: ${conflicts.join(', ')}. Review them or rerun with --force.`);
  }
  for (const output of outputs) await mkdir(dirname(output), { recursive: true });
  await writeFile(outputs[0], `${JSON.stringify(answers.config, null, 2)}\n`);
  await copyFile(RELEASE_TOOL, outputs[1]);
  await writeFile(outputs[2], workflow(answers.buildCommand, answers.setupCommand));
  await writeFile(outputs[3], 'release/\n');
  return outputs.map(path => relative(target, path));
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const target = resolve(option('--target') || process.cwd());
  if (target === ROOT) throw new Error('Choose a firmware repository with --target; do not scaffold the app-market repository itself.');
  const answersPath = option('--answers');
  const answers = answersPath ? await loadAnswers(answersPath) : await collectAnswers(target);
  const files = await writeScaffold(target, answers, process.argv.includes('--force'));
  console.log('\nCreated App Market integration:');
  for (const file of files) console.log(`- ${file}`);
  console.log('\nNext:');
  console.log(`1. Run the configured firmware build in ${target}`);
  console.log('2. Run: node scripts/app-market-release.mjs --tag v0.0.0-local');
  console.log('3. Inspect the generated manifests and staged assets in .app-market/release');
  console.log('4. Commit the config, tool, and workflow; then push a prerelease tag when ready');
  const targets = answers.config.targets || [{ ...answers.config, manifestAsset: 'app-market.json' }];
  console.log('\nAdd these sources to the app-market catalog after the first valid release:');
  console.log(JSON.stringify(targets.map(targetConfig => ({
    id: targetConfig.app.id,
    repository: targetConfig.app.repository.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, ''),
    enabled: true,
    manifestAsset: targetConfig.manifestAsset,
    retainVersions: 3,
    retainSnapshots: 3
  })), null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parsePartition, platformIoEnvironments, validateAsset, validateId, workflow, writeScaffold };
