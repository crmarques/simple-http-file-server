# simple-http-file-server

A simple HTTP file server written in JavaScript.

## Published Image

The repository includes a GitHub Actions workflow that builds the Docker image from the project's `Dockerfile` and publishes it to GitHub Container Registry:

```bash
docker pull ghcr.io/crmarques/simple-http-file-server:latest
```

The workflow behavior is:

- Pull requests: build only, no publish.
- Pushes to `master`: publish `ghcr.io/crmarques/simple-http-file-server:latest` and `:master`.
- Git tags like `v1.2.3`: publish the image with the exact version tag `:1.2.3`.

For release tags, `package.json.version` must match the Git tag without the leading `v`.

If the repository or package is private, users must authenticate first with `docker login ghcr.io`, or the package visibility must be changed to public in GitHub package settings.

Server behavior can be customized by the following environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| PORT | 3000 | Port that file server will be listening. |
| ACCESS_TOKEN | Randomly generated UUID token | Token used to authenticate to server. |
| FILE_STORE_DIR | /tmp/simple-http-file-server | Directory where files will be stored. |
| FILE_SIZE_LIMIT | 10485760 (10 MB) | Max file size in bytes. |
| KEEP_FILENAME | false | When `true`, stores uploads using the original client filename. When `false`, stores uploads as `<uuid><original extension>`. |
| FILE_STORED_PERMISSIONS | 600 | Octal permission mode applied to stored files. |

`FILE_SIZE_LIMITE` is still accepted for backward compatibility.

By default, uploaded files are stored as a randomized UUID filename while keeping the original extension when it fits safely. Set `KEEP_FILENAME=true` to preserve the exact filename provided by the client. The server rejects unsafe names such as paths (`../file.txt`, `dir/file.txt`, `dir\\file.txt`), control characters, and filenames longer than 255 UTF-8 bytes. When original filenames are preserved, uploading a filename that already exists returns `409 Conflict` instead of overwriting the existing file. Stored files are created with `0600` permissions by default, and `FILE_STORED_PERMISSIONS` accepts octal values such as `640` or `644`.

## Usage

```bash
TOKEN=$(uuidgen)

# release tag from package.json version
npm run release:tag

# docker from published image
docker run -d -p 3000:3000 --env ACCESS_TOKEN="${TOKEN}" ghcr.io/crmarques/simple-http-file-server:latest

# docker local build
docker build -t simple-http-file-server .
docker run -d -p 3000:3000 --env ACCESS_TOKEN="${TOKEN}" simple-http-file-server

# shell
ACCESS_TOKEN="${TOKEN}" node app.js

cd /tmp

echo "test file content" > file.txt

curl -Ffile=@file.txt -H "Authorization: Bearer ${TOKEN}" http://localhost:3000/upload
# output: {"status":"ok","filename":"<uuid>.txt","url":"/files/<uuid>.txt"}
curl -H "Authorization: Bearer ${TOKEN}" http://localhost:3000/files/<uuid>.txt
# output: test file content
```
