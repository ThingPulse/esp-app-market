const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, mkdir, readFile, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');
const { describe, it } = require('node:test');
const { parsePartition, platformIoEnvironments, validateAsset, validateId, workflow, writeScaffold } = require('./prepare-repository');

const execFileAsync = promisify(execFile);

describe('firmware repository scaffolder', () => {
  it('validates catalog IDs and release asset basenames', () => {
    assert.equal(validateId('tp-example-device-app'), true);
    assert.equal(validateId('ThingPulse/App'), false);
    assert.equal(validateAsset('logo.png'), true);
    assert.equal(validateAsset('assets/logo.png'), false);
    assert.equal(validateAsset('https://example.com/logo.png'), false);
  });

  it('parses partition answers without treating build paths as release paths', () => {
    assert.deepEqual(parsePartition('Firmware|.pio/build/esp/firmware.bin|firmware.bin|0x10000'), {
      name: 'Firmware', source: '.pio/build/esp/firmware.bin', asset: 'firmware.bin', offset: '0x10000'
    });
    assert.throws(() => parsePartition('Firmware|build/fw.bin|release/fw.bin|0x0'), /Use name/);
  });

  it('discovers PlatformIO environments', async () => {
    const target = await mkdtemp(join(tmpdir(), 'app-market-platformio-'));
    await writeFile(join(target, 'platformio.ini'), '[platformio]\n\n[env:grande]\nplatform = espressif32\n\n[env:pro]\nplatform = espressif32\n');
    assert.deepEqual(await platformIoEnvironments(target), ['grande', 'pro']);
  });

  it('generates a tag and manual-validation workflow', () => {
    const yaml = workflow('pio run', 'python -m pip install platformio');
    assert.match(yaml, /tags:\n      - "v\*"/);
    assert.match(yaml, /python -m pip install platformio/);
    assert.match(yaml, /node scripts\/app-market-release\.mjs/);
    assert.match(yaml, /\.app-market\/release\/\*/);
  });

  it('stages exact assets and generates checksums from their final copies', async () => {
    const target = await mkdtemp(join(tmpdir(), 'app-market-scaffold-'));
    await mkdir(join(target, 'build'), { recursive: true });
    await mkdir(join(target, 'art'), { recursive: true });
    await writeFile(join(target, 'build/firmware.bin'), Buffer.from('firmware'));
    await writeFile(join(target, 'art/source-icon.png'), Buffer.from('icon'));
    const answers = {
      setupCommand: '',
      buildCommand: 'true',
      config: {
        schemaVersion: 1,
        app: {
          id: 'tp-test-app', name: 'Test App', description: 'Test firmware',
          repository: 'https://github.com/ThingPulse/test-app', supportedDevices: ['tp-test-device'], tags: ['test']
        },
        icon: { source: 'art/source-icon.png', asset: 'logo.png' },
        partitions: [{ name: 'Firmware', source: 'build/firmware.bin', asset: 'firmware.bin', offset: '0x10000' }]
      }
    };
    await writeScaffold(target, answers, false);
    await execFileAsync(process.execPath, ['scripts/app-market-release.mjs', '--tag', 'v1.2.0-rc.1'], { cwd: target });
    const manifest = JSON.parse(await readFile(join(target, '.app-market/release/app-market.json'), 'utf8'));
    assert.equal(manifest.release.version, '1.2.0-rc.1');
    assert.equal(manifest.app.icon.asset, 'logo.png');
    assert.match(manifest.app.icon.sha256, /^[0-9a-f]{64}$/);
    assert.equal(manifest.release.partitions[0].asset, 'firmware.bin');
    assert.match(manifest.release.partitions[0].sha256, /^[0-9a-f]{64}$/);
  });

  it('builds multiple hardware targets into separate manifests', async () => {
    const target = await mkdtemp(join(tmpdir(), 'app-market-multi-target-'));
    await mkdir(join(target, 'build/grande'), { recursive: true });
    await mkdir(join(target, 'build/pro'), { recursive: true });
    await mkdir(join(target, 'art'), { recursive: true });
    await writeFile(join(target, 'build/grande/firmware.bin'), Buffer.from('esp32'));
    await writeFile(join(target, 'build/pro/firmware.bin'), Buffer.from('esp32-s3'));
    await writeFile(join(target, 'art/icon.png'), Buffer.from('shared icon'));
    const shared = {
      name: 'Test App', description: 'Test firmware', repository: 'https://github.com/ThingPulse/test-app', tags: ['test']
    };
    const answers = {
      setupCommand: '',
      buildCommand: 'pio run -e grande -e pro',
      config: {
        schemaVersion: 1,
        targets: [
          {
            environment: 'grande', manifestAsset: 'app-market-grande.json',
            app: { ...shared, id: 'tp-grande-test-app', supportedDevices: ['tp-color-kit-grande'] },
            icon: { source: 'art/icon.png', asset: 'icon.png' },
            partitions: [{ name: 'Firmware', source: 'build/grande/firmware.bin', asset: 'firmware-grande.bin', offset: '0x10000' }]
          },
          {
            environment: 'pro', manifestAsset: 'app-market-pro.json',
            app: { ...shared, id: 'tp-pro-test-app', supportedDevices: ['tp-color-kit-pro'] },
            icon: { source: 'art/icon.png', asset: 'icon.png' },
            partitions: [{ name: 'Firmware', source: 'build/pro/firmware.bin', asset: 'firmware-pro.bin', offset: '0x10000' }]
          }
        ]
      }
    };
    await writeScaffold(target, answers, false);
    await execFileAsync(process.execPath, ['scripts/app-market-release.mjs', '--tag', 'v2.0.0'], { cwd: target });
    const grande = JSON.parse(await readFile(join(target, '.app-market/release/app-market-grande.json'), 'utf8'));
    const pro = JSON.parse(await readFile(join(target, '.app-market/release/app-market-pro.json'), 'utf8'));
    assert.deepEqual(grande.app.supportedDevices, ['tp-color-kit-grande']);
    assert.equal(grande.release.partitions[0].asset, 'firmware-grande.bin');
    assert.deepEqual(pro.app.supportedDevices, ['tp-color-kit-pro']);
    assert.equal(pro.release.partitions[0].asset, 'firmware-pro.bin');
  });
});
