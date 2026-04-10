const assert = require('node:assert/strict');
const { readFile, mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  buildStoredFilename,
  validateUploadedFilename,
  writeUploadedFile,
} = require('./app');

async function testPreservesProvidedFilename() {
  const filename = 'Quarterly report (final) [v2].txt';

  assert.equal(validateUploadedFilename(filename), filename);
  assert.equal(buildStoredFilename(filename), filename);
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

async function main() {
  await testPreservesProvidedFilename();
  await testRejectsUnsafeFilenames();
  await testRejectsDuplicateFilenames();
  console.log('All tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
