# Playwright + Chrome base image maintained by Apify.
# The playwright version in package.json ("*") resolves to the one preinstalled here.
FROM apify/actor-node-playwright-chrome:20

COPY package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version

COPY . ./

CMD npm start --silent
