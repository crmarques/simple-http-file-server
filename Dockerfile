FROM registry.access.redhat.com/ubi10/nodejs-24-minimal:10.1

ENV NODE_ENV=production
ENV FILE_STORE_DIR=/tmp/simple-http-file-server
ENV KEEP_FILENAME=false
ENV FILE_STORED_PERMISSIONS=600

WORKDIR /opt/app-root/src

COPY --chown=1001:0 package*.json ./

USER 1001

RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=1001:0 app.js ./

EXPOSE 3000
CMD ["node", "app.js"]
