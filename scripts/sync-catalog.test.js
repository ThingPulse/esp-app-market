const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const {
  mergeCatalogs,
  normalizeVersion,
  parseOffset,
  sha256,
  validatePartitions,
  validateSourceConfig
} = require('./sync-catalog');

describe('catalog synchronizer', () => {
  it('normalizes conventional GitHub release tags', () => {
    assert.equal(normalizeVersion('v1.2.3'), '1.2.3');
    assert.equal(normalizeVersion('1.2.3-rc.1'), '1.2.3-rc.1');
  });

  it('parses decimal and hexadecimal flash offsets', () => {
    assert.equal(parseOffset(4096), 4096);
    assert.equal(parseOffset('0x1000'), 4096);
  });

  it('calculates SHA-256 digests', () => {
    assert.equal(
      sha256(Buffer.from('firmware')),
      'c3bf47ea1f4a4a605470313cacb3a44f4a461f68c6faeab07e737610cb5ac835'
    );
  });

  it('replaces a matching manual app only after automation produced it', () => {
    const manual = [{ id: 'automated' }, { id: 'manual' }];
    const automated = [{ id: 'automated', source: { type: 'github-release' } }];
    assert.deepEqual(mergeCatalogs(manual, automated), [automated[0], manual[1]]);
    assert.deepEqual(mergeCatalogs(manual, []), manual);
  });

  it('rejects overlapping partition assets', () => {
    assert.throws(() => validatePartitions([
      { name: 'Bootloader', offset: 0, size: 8192 },
      { name: 'Application', offset: 4096, size: 8192 }
    ]), /overlap/);
  });

  it('keeps the example release manifest valid', () => {
    const root = join(__dirname, '..');
    const schema = JSON.parse(readFileSync(join(root, 'catalog', 'app-market-manifest.schema.json')));
    const example = JSON.parse(readFileSync(join(root, 'docs', 'examples', 'app-market.json')));
    const ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    assert.equal(validate(example), true, JSON.stringify(validate.errors));
  });

  it('validates registered GitHub sources', () => {
    assert.doesNotThrow(() => validateSourceConfig({
      schemaVersion: 1,
      sources: [{ id: 'test-app', repository: 'ThingPulse/test-app', retainVersions: 3 }]
    }));
    assert.throws(() => validateSourceConfig({
      schemaVersion: 1,
      sources: [{ id: 'test-app', repository: 'invalid' }]
    }), /Invalid GitHub repository/);
  });
});
