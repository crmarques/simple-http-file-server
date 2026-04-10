const { mkdirSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const { randomUUID, timingSafeEqual } = require('node:crypto');
const path = require('node:path');

const express = require('express');
const helmet = require('helmet');
const multer = require('multer');

const DEFAULT_PORT = 3000;
const DEFAULT_FILE_LIMIT = 10 * 1024 * 1024;
const DEFAULT_STORE_DIR = path.join('/tmp', 'simple-http-file-server');
const MAX_FILENAME_BYTES = 255;

function loadConfig(env = process.env) {
  const port = Number.parseInt(env.PORT ?? `${DEFAULT_PORT}`, 10);
  const token = env.ACCESS_TOKEN ?? randomUUID();
  const store = env.FILE_STORE_DIR ?? DEFAULT_STORE_DIR;
  const fileLimit = Number.parseInt(
    env.FILE_SIZE_LIMIT ?? env.FILE_SIZE_LIMITE ?? `${DEFAULT_FILE_LIMIT}`,
    10,
  );

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${env.PORT}`);
  }

  if (!Number.isInteger(fileLimit) || fileLimit <= 0) {
    throw new Error(`Invalid FILE_SIZE_LIMIT value: ${env.FILE_SIZE_LIMIT ?? env.FILE_SIZE_LIMITE}`);
  }

  if (token.trim().length === 0) {
    throw new Error('ACCESS_TOKEN must not be empty.');
  }

  if (!env.ACCESS_TOKEN) {
    console.log(`Self-generated access token: ${token}`);
  }

  return {
    fileLimit,
    port,
    store: path.resolve(store),
    token,
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateUploadedFilename(originalName) {
  if (typeof originalName !== 'string' || originalName.length === 0) {
    return null;
  }

  if (path.posix.basename(originalName.replace(/\\/g, '/')) !== originalName) {
    return null;
  }

  if (
    originalName === '.' ||
    originalName === '..' ||
    /[\u0000-\u001f\u007f]/.test(originalName) ||
    Buffer.byteLength(originalName, 'utf8') > MAX_FILENAME_BYTES
  ) {
    return null;
  }

  return originalName;
}

function buildStoredFilename(originalName) {
  const safeFilename = validateUploadedFilename(originalName);

  if (!safeFilename) {
    throw createHttpError(400, 'Invalid file name.');
  }

  return safeFilename;
}

function isAuthorizedRequest(authorizationHeader, token) {
  if (typeof authorizationHeader !== 'string' || !authorizationHeader.startsWith('Bearer ')) {
    return false;
  }

  const providedToken = Buffer.from(authorizationHeader.slice('Bearer '.length));
  const expectedToken = Buffer.from(token);

  return (
    providedToken.length === expectedToken.length &&
    timingSafeEqual(providedToken, expectedToken)
  );
}

async function writeUploadedFile(store, filename, buffer) {
  try {
    await writeFile(path.join(store, filename), buffer, {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw createHttpError(409, 'A file with this name already exists.');
    }

    throw error;
  }
}

function createApp({ fileLimit, store, token }) {
  mkdirSync(store, { recursive: true, mode: 0o700 });

  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use((req, res, next) => {
    if (isAuthorizedRequest(req.headers.authorization, token)) {
      next();
      return;
    }

    res.sendStatus(403);
  });

  app.get('/', (req, res) => {
    res.send('Welcome to simple http file server!');
  });

  app.get('/files/:filename', (req, res, next) => {
    let filename;

    try {
      filename = buildStoredFilename(req.params.filename);
    } catch (error) {
      next(error);
      return;
    }

    res.download(
      filename,
      filename,
      {
        root: store,
        dotfiles: 'allow',
        headers: {
          'Cache-Control': 'no-store',
        },
      },
      (error) => {
        if (error) {
          if (error.code === 'ENOENT') {
            next(createHttpError(404, 'File not found.'));
            return;
          }

          next(error);
        }
      },
    );
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: fileLimit,
      files: 1,
      fields: 0,
      headerPairs: 20,
    },
  });

  app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        status: 'error',
        message: 'Error saving file.',
      });
      return;
    }

    const filename = buildStoredFilename(req.file.originalname);
    await writeUploadedFile(store, filename, req.file.buffer);

    res.status(201).json({
      status: 'ok',
      filename,
      url: `/files/${encodeURIComponent(filename)}`,
    });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    if (error?.statusCode) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    console.error(error);

    res.status(500).json({
      status: 'error',
      message: 'Internal server error.',
    });
  });

  return app;
}

function startServer(config = loadConfig()) {
  const app = createApp(config);
  return app.listen(config.port, () => {
    console.log(`Server listening at http://localhost:${config.port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  buildStoredFilename,
  createApp,
  loadConfig,
  startServer,
  validateUploadedFilename,
  writeUploadedFile,
};
