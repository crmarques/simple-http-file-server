FROM node:25.9.0-bookworm-slim

ENV NODE_ENV=production
ENV FILE_STORE_DIR=/tmp/simple-http-file-server

WORKDIR /usr/src/app

RUN chown node:node /usr/src/app

COPY --chown=node:node package*.json ./

USER node

RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node app.js ./

EXPOSE 3000
CMD ["node", "app.js"]
