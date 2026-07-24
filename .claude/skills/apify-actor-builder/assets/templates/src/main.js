import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';
import { buildPresenceFilter, buildRangeFilter } from './filters.js';

await Actor.init();

// NOTE: Actor.getInput() merges input-schema defaults into the returned object,
// so any field with a `default` in input_schema.json always arrives populated.
// Don't rely on "legacy field name" fallbacks being reachable once a default exists.
const input = (await Actor.getInput()) ?? {};
const {
    startUrlsOrTerms = [],
    maxItems = null,
    proxyConfiguration: proxyInput = { useApifyProxy: true },
} = input;

// Build filter predicates from input here, e.g.:
// const passesWebsite = buildPresenceFilter(input.website ?? 'all');

// Overridable base URL lets the pipeline be tested against a local fixture
// server offline (see test/fixture-server.mjs). Point it at the real site here.
const BASE_URL = process.env.TARGET_BASE_URL || 'https://example.com';

const stats = { found: 0, saved: 0, filteredOut: 0 };

const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);

const saveItem = async (item, crawler) => {
    stats.saved += 1;
    await Actor.pushData(item);
    if (maxItems !== null && stats.saved >= maxItems) {
        log.info(`Reached maxItems (${maxItems}); stopping.`);
        crawler.stop();
    }
};

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxConcurrency: 5,
    requestHandlerTimeoutSecs: 300,
    navigationTimeoutSecs: 120,
    launchContext: {
        launchOptions: {
            // Lets local dev point at a specific Chromium build; unset on the
            // Apify platform, where the base image's browser is used.
            executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
        },
    },
    browserPoolOptions: { useFingerprints: true },
    requestHandler: async ({ request, page, crawler: crawlerRef }) => {
        const { label } = request.userData;
        if (label === 'DETAIL') {
            await handleDetail({ request, page, crawlerRef });
        } else {
            await handleList({ request, page, crawlerRef });
        }
    },
    failedRequestHandler: async ({ request }) => {
        log.error(`Request failed too many times: ${request.url}`);
    },
});

async function handleList({ request, page, crawlerRef }) {
    // 1. Wait for the results container.
    // 2. Scroll / paginate to load enough items.
    // 3. Collect list-level fields (name, url, cheap filterable attributes).
    // 4. Apply lenient filters; enqueue surviving DETAIL requests (or save
    //    directly if a "fast mode" was requested and detail pages aren't needed).
    log.warning('handleList is a stub — implement the target-specific extraction.');
}

async function handleDetail({ request, page, crawlerRef }) {
    // 1. Wait for the detail content.
    // 2. Extract the full record.
    // 3. Apply strict filters.
    // 4. await saveItem(item, crawlerRef).
    log.warning('handleDetail is a stub — implement the target-specific extraction.');
}

const startRequests = startUrlsOrTerms.map((entry) => {
    const term = typeof entry === 'string' ? entry : entry?.url;
    return { url: `${BASE_URL}/search?q=${encodeURIComponent(term)}`, userData: { label: 'LIST', term } };
});

await crawler.run(startRequests);

log.info('Done.', stats);
await Actor.setValue('SUMMARY', stats);
await Actor.exit();
