# Apify's Playwright + Chrome base image. Pin the Node major version.
FROM apify/actor-node-playwright-chrome:20

# IMPORTANT: the base image runs as the non-root user "myuser". Plain COPY
# lands files owned by root, and then `npm install` fails with EACCES when it
# tries to write package-lock.json. Always chown copied files to myuser.
COPY --chown=myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" && node --version \
    && echo "NPM version:" && npm --version

COPY --chown=myuser . ./

CMD npm start --silent
