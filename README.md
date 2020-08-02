# simple-http-file-server

A simple HTTP file server written in JavaScript.

Server behavior can be customized by the following environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| PORT | 3000 | Port that file server will be listening. |
| ACCESS_TOKEN | Randon generated UUID v4 token | Token used to authenticate to server. |
| FILE_STORE_DIR | /tmp | Directory where files will be stored. |
| FILE_SIZE_LIMITE | 10485760 (10Mb) | Max file size in bytes. |

## Usage

```bash
TOKEN=$(uuidgen)

# docker
docker run -d -p 3000:3000 --env ACCESS_TOKEN=${TOKEN} simple-http-file-server:0.0.1

# shell
ACCESS_TOKEN=${TOKEN} node app.js

cd /tmp

echo "test file content" > file.txt

curl -Ffile=@file.txt -H "Authorization: Bearer ${TOKEN}" http://localhost:3000/upload
# output: {"status":"ok"}
curl -H "Authorization: Bearer ${TOKEN}" http://localhost:3000/files/file.txt
# output: test file content
```
