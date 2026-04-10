const { mkdirSync } = require('node:fs');
const { randomUUID, timingSafeEqual } = require('node:crypto');
const path = require('node:path');

const express = require('express');
const helmet = require('helmet');
const multer = require('multer');

const DEFAULT_PORT = 3000;
const DEFAULT_FILE_LIMIT = 10 * 1024 * 1024;
const DEFAULT_STORE_DIR = path.join('/tmp', 'simple-http-file-server');
const MAX_FILENAME_LENGTH = 128;

const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
const token = process.env.ACCESS_TOKEN ?? randomUUID();
const store = process.env.FILE_STORE_DIR ?? DEFAULT_STORE_DIR;
const fileLimit = Number.parseInt(
  process.env.FILE_SIZE_LIMIT ?? process.env.FILE_SIZE_LIMITE ?? `${DEFAULT_FILE_LIMIT}`,
  10,
);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

if (!Number.isInteger(fileLimit) || fileLimit <= 0) {
  throw new Error(
    `Invalid FILE_SIZE_LIMIT value: ${process.env.FILE_SIZE_LIMIT ?? process.env.FILE_SIZE_LIMITE}`,
  );
}

if (token.trim().length === 0) {
  throw new Error('ACCESS_TOKEN must not be empty.');
}

if (!process.env.ACCESS_TOKEN) {
  console.log(`Self-generated access token: ${token}`);
}

const normalizedStore = path.resolve(store);
mkdirSync(normalizedStore, { recursive: true, mode: 0o700 });

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeUploadedFilename(originalName) {
  const normalizedName = String(originalName ?? '').replace(/\\/g, '/');
  const baseName = path.posix.basename(normalizedName).trim();
  const sanitizedName = baseName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, MAX_FILENAME_LENGTH);

  if (
    sanitizedName.length === 0 ||
    sanitizedName === '.' ||
    sanitizedName === '..' ||
    sanitizedName.startsWith('.')
  ) {
    return null;
  }

  return sanitizedName;
}

function buildStoredFilename(originalName) {
  const safeFilename = sanitizeUploadedFilename(originalName);

  if (!safeFilename) {
    throw createHttpError(400, 'Invalid file name.');
  }

  return `${randomUUID()}-${safeFilename}`;
}

function isAuthorizedRequest(authorizationHeader) {
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

function getDownloadFilename(filePath) {
  return path.basename(filePath).replace(/["\\\r\n]/g, '_');
}

const app = express();
app.disable('x-powered-by');

app.use(helmet());
app.use((req, res, next) => {
  if (isAuthorizedRequest(req.headers.authorization)) {
    next();
    return;
  }

  res.sendStatus(403);
});

app.get('/', (req, res) => {
  res.send('Welcome to simple http file server!');
});

app.use(
  '/files',
  express.static(normalizedStore, {
    dotfiles: 'deny',
    fallthrough: false,
    index: false,
    redirect: false,
    setHeaders(res, filePath) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `attachment; filename="${getDownloadFilename(filePath)}"`);
    },
  }),
);

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, normalizedStore);
    },
    filename(req, file, cb) {
      try {
        cb(null, buildStoredFilename(file.originalname));
      } catch (error) {
        cb(error);
      }
    },
  }),
  limits: {
    fileSize: fileLimit,
    files: 1,
    fields: 0,
    headerPairs: 20,
  },
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({
      status: 'error',
      message: 'Error saving file.',
    });
    return;
  }

  res.status(201).json({
    status: 'ok',
    filename: req.file.filename,
    url: `/files/${encodeURIComponent(req.file.filename)}`,
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
