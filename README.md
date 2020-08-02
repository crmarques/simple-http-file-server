# simple-http-file-server

A simple HTTP file server written in JavaScript.

Server behavior can be customized by the following environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| PORT | 3000 | Port that file server will be listening. |
| ACCESS_TOKEN | Randon generated UUID v4 token | Token used to authenticate to server. |
| FILE_STORE_DIR | /tmp | Directory where files will be stored. |
| FILE_SIZE_LIMITE | 10485760 (10Mb) | Max file size in bytes. |
