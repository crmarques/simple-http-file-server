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

`FILE_SIZE_LIMITE` is still accepted for backward compatibility.

Uploaded files keep the exact filename provided by the client. The server rejects unsafe names such as paths (`../file.txt`, `dir/file.txt`, `dir\\file.txt`), control characters, and filenames longer than 255 UTF-8 bytes. Uploading a filename that already exists returns `409 Conflict` instead of overwriting the existing file.

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
# output: {"status":"ok","filename":"file.txt","url":"/files/file.txt"}
curl -H "Authorization: Bearer ${TOKEN}" http://localhost:3000/files/file.txt
# output: test file content
```
