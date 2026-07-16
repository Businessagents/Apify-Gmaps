# Playwright + Chrome base image maintained by Apify.
# The playwright version in package.json ("*") resolves to the one preinstalled here.
FROM apify/actor-node-playwright-chrome:20

# The base image runs as the non-root user "myuser" — files must be chowned
# to it or npm cannot write into the workdir.
COPY --chown=myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY --chown=myuser . ./

CMD npm start --silent
