const assert = require('node:assert/strict');
const { readFile, mkdtemp, rm, stat } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  buildStoredFilename,
  loadConfig,
  validateUploadedFilename,
  writeUploadedFile,
} = require('./app');

async function testGeneratesSecureStoredFilenameByDefault() {
  const filename = 'Quarterly report (final) [v2].txt';
  const storedFilename = buildStoredFilename(filename);

  assert.equal(validateUploadedFilename(filename), filename);
  assert.notEqual(storedFilename, filename);
  assert.equal(validateUploadedFilename(storedFilename), storedFilename);
  assert.equal(path.extname(storedFilename), '.txt');
}

async function testPreservesProvidedFilenameWhenConfigured() {
  const filename = 'Quarterly report (final) [v2].txt';

  assert.equal(buildStoredFilename(filename, { keepFilename: true }), filename);
}

async function testRejectsUnsafeFilenames() {
  const invalidFilenames = [
    '',
    '.',
    '..',
    '../secret.txt',
    'nested/file.txt',
    'nested\\file.txt',
    `bad${String.fromCharCode(10)}name.txt`,
    'x'.repeat(256),
  ];

  for (const filename of invalidFilenames) {
    assert.equal(validateUploadedFilename(filename), null);
    assert.throws(
      () => buildStoredFilename(filename),
      (error) => error?.statusCode === 400 && error.message === 'Invalid file name.',
    );
  }
}

async function testLoadsOptionalFilenameAndPermissionConfig() {
  const defaultConfig = loadConfig({
    ACCESS_TOKEN: 'test-token',
  });

  assert.equal(defaultConfig.keepFilename, false);
  assert.equal(defaultConfig.storedPermissions, 0o600);

  const configuredConfig = loadConfig({
    ACCESS_TOKEN: 'test-token',
    KEEP_FILENAME: 'true',
    FILE_STORED_PERMISSIONS: '640',
  });

  assert.equal(configuredConfig.keepFilename, true);
  assert.equal(configuredConfig.storedPermissions, 0o640);

  assert.throws(
    () =>
      loadConfig({
        ACCESS_TOKEN: 'test-token',
        KEEP_FILENAME: 'sometimes',
      }),
    /Invalid KEEP_FILENAME value/,
  );

  assert.throws(
    () =>
      loadConfig({
        ACCESS_TOKEN: 'test-token',
        FILE_STORED_PERMISSIONS: '999',
      }),
    /Invalid FILE_STORED_PERMISSIONS value/,
  );
}

async function testRejectsDuplicateFilenames() {
  const storeDir = await mkdtemp(path.join(os.tmpdir(), 'simple-http-file-server-'));
  const filename = 'duplicate.txt';

  try {
    await writeUploadedFile(storeDir, filename, Buffer.from('first'));

    await assert.rejects(
      () => writeUploadedFile(storeDir, filename, Buffer.from('second')),
      (error) =>
        error?.statusCode === 409 && error.message === 'A file with this name already exists.',
    );

    const storedContents = await readFile(path.join(storeDir, filename), 'utf8');
    assert.equal(storedContents, 'first');
  } finally {
    await rm(storeDir, { recursive: true, force: true });
  }
}

async function testStoresConfiguredPermissions() {
  const storeDir = await mkdtemp(path.join(os.tmpdir(), 'simple-http-file-server-'));
  const filename = 'permissions.txt';

  try {
    await writeUploadedFile(storeDir, filename, Buffer.from('contents'), 0o640);

    const storedStats = await stat(path.join(storeDir, filename));
    assert.equal(storedStats.mode & 0o777, 0o640);
  } finally {
    await rm(storeDir, { recursive: true, force: true });
  }
}

async function main() {
  await testGeneratesSecureStoredFilenameByDefault();
  await testPreservesProvidedFilenameWhenConfigured();
  await testRejectsUnsafeFilenames();
  await testLoadsOptionalFilenameAndPermissionConfig();
  await testRejectsDuplicateFilenames();
  await testStoresConfiguredPermissions();
  console.log('All tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
