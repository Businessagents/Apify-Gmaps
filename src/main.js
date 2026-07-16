import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';
import {
    PLACE_MINIMUM_STARS,
    buildFilters,
    matchesSearchTerm,
    parseCoordsFromUrl,
    parseRatingInput,
    parseRatingLabel,
} from './extractors.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};

// Field names mirror compass/crawler-google-places where possible.
// NOTE: Actor.getInput() merges input-schema defaults into the input, so
// fields with schema defaults always arrive with a value.
const searchTerms = input.searchStringsArray ?? [];
const location = input.locationQuery ?? '';
const startUrls = input.startUrls ?? [];
const maxPlacesPerSearch = input.maxCrawledPlacesPerSearch ?? 100;
const maxCrawledPlaces = input.maxCrawledPlaces ?? null;
const language = input.language ?? 'en';
const categoryFilterWords = input.categoryFilterWords ?? [];
const searchMatching = input.searchMatching ?? 'all';
const skipClosedPlaces = input.skipClosedPlaces ?? false;
const exportPlaceUrls = input.exportPlaceUrls ?? false;
const proxyInput = input.proxyConfiguration ?? { useApifyProxy: true };

const websiteFilter = input.website ?? 'allPlaces';
const phoneFilter = input.phone ?? 'allPlaces';

// Review-count bounds (this actor's own filters; not in compass).
const minReviews = input.minReviewsCount ?? 0;
const maxReviews = input.maxReviewsCount ?? null;

// Minimum rating: compass-style star enum; optional numeric maximum.
const placeMinimumStarsKey = input.placeMinimumStars ?? '';
if (!(placeMinimumStarsKey in PLACE_MINIMUM_STARS)) {
    throw new Error(`Input error: unknown "placeMinimumStars" value "${input.placeMinimumStars}".`);
}
const minRating = PLACE_MINIMUM_STARS[placeMinimumStarsKey];
const maxRating = parseRatingInput(input.maximumStars ?? null, 'maximumStars');

if (searchTerms.length === 0 && startUrls.length === 0) {
    throw new Error('Input error: provide at least one search term ("searchStringsArray") or one start URL ("startUrls").');
}

log.info('Effective configuration', {
    searchTerms, location, startUrls: startUrls.length, maxPlacesPerSearch, maxCrawledPlaces,
    minReviews, maxReviews, minRating, maxRating, websiteFilter, phoneFilter,
    searchMatching, categoryFilterWords, skipClosedPlaces, exportPlaceUrls,
});

const {
    passesRatingReviewFilters,
    passesWebsiteFilter,
    passesPhoneFilter,
    passesClosedFilter,
    passesCategoryFilter,
} = buildFilters({
    minReviews, maxReviews, minRating, maxRating, websiteFilter, phoneFilter, skipClosedPlaces, categoryFilterWords,
});

// Overridable so the pipeline can be tested against a local fixture server.
const BASE_URL = process.env.GMAPS_BASE_URL || 'https://www.google.com';

// Number of place pages enqueued per search term, capped at maxPlacesPerSearch.
const enqueuedPerTerm = new Map();
// Stats for the final summary.
const stats = { found: 0, scraped: 0, filteredOut: 0 };

const saveItem = async (item, crawlerRef) => {
    stats.scraped += 1;
    await Actor.pushData(item);
    if (maxCrawledPlaces !== null && stats.scraped >= maxCrawledPlaces) {
        log.info(`Reached maxCrawledPlaces (${maxCrawledPlaces}), stopping the crawler.`);
        crawlerRef.stop();
    }
};

const capReached = () => maxCrawledPlaces !== null && stats.scraped >= maxCrawledPlaces;

const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);

/** Clicks through the Google cookie-consent interstitial if it shows up. */
const handleConsent = async (page) => {
    if (!page.url().includes('consent.google.com')) return;
    log.info('Consent screen detected, accepting...');
    const button = page.locator('button[aria-label*="Accept"], form[action*="consent"] button').first();
    try {
        await button.click({ timeout: 10_000 });
        await page.waitForURL(/google\.[^/]+\/maps/, { timeout: 30_000 });
    } catch (err) {
        log.warning(`Could not click through consent screen: ${err.message}`);
    }
};

/** Extracts listing data from a place detail page. */
const extractPlaceDetails = async (page) => {
    return page.evaluate(() => {
        const getText = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;

        const name = getText('h1');
        const category = getText('button[jsaction*="category"]');

        const websiteEl = document.querySelector('a[data-item-id="authority"]');
        const website = websiteEl?.href ?? null;

        const phoneEl = document.querySelector('button[data-item-id^="phone:tel:"]');
        const phone = phoneEl
            ? phoneEl.getAttribute('data-item-id').replace('phone:tel:', '').trim()
            : null;

        const addressEl = document.querySelector('button[data-item-id="address"]');
        const address = addressEl
            ? (addressEl.getAttribute('aria-label') ?? addressEl.textContent).replace(/^Address:\s*/i, '').trim()
            : null;

        // Rating + review count from the header, e.g. aria-labels "4.6 stars" and "1,234 reviews".
        let rating = null;
        let reviewCount = null;
        const ratingEl = document.querySelector('div[role="main"] span[role="img"][aria-label*="star" i]');
        if (ratingEl) {
            const match = ratingEl.getAttribute('aria-label').match(/([\d.,]+)/);
            if (match) rating = Number.parseFloat(match[1].replace(',', '.'));
        }
        const reviewsEl = document.querySelector('div[role="main"] span[aria-label*="review" i]');
        if (reviewsEl) {
            const match = reviewsEl.getAttribute('aria-label').match(/([\d.,\s]+)/);
            if (match) reviewCount = Number.parseInt(match[1].replace(/[^\d]/g, ''), 10);
        }

        const mainText = document.querySelector('div[role="main"]')?.innerText ?? '';
        const permanentlyClosed = /permanently closed/i.test(mainText);
        const temporarilyClosed = /temporarily closed/i.test(mainText);

        // Best-effort Google place ID (ChIJ...) from the page source.
        const idMatch = document.documentElement.innerHTML.match(/"(ChIJ[0-9A-Za-z_-]{10,})"/);
        const placeId = idMatch ? idMatch[1] : null;

        return {
            name, category, website, phone, address, rating, reviewCount,
            permanentlyClosed, temporarilyClosed, placeId,
        };
    });
};

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxConcurrency: 5,
    requestHandlerTimeoutSecs: 300,
    navigationTimeoutSecs: 120,
    launchContext: {
        launchOptions: {
            args: ['--lang=en-US'],
            // Allows overriding the browser binary for local development;
            // unset on the Apify platform, where the base image's browser is used.
            executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
        },
    },
    browserPoolOptions: {
        useFingerprints: true,
    },
    preNavigationHooks: [
        async ({ page }) => {
            // SOCS cookie skips the EU cookie-consent interstitial in most cases.
            await page.context().addCookies([{
                name: 'SOCS',
                value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg',
                domain: '.google.com',
                path: '/',
            }]);
        },
    ],
    requestHandler: async ({ request, page, crawler: crawlerRef }) => {
        if (capReached()) return;
        const { label } = request.userData;
        await handleConsent(page);

        // A search with a single unambiguous result redirects straight to the place page.
        const isPlacePage = page.url().includes('/maps/place/');

        if (label !== 'PLACE' && !isPlacePage) {
            await handleSearchPage({ request, page, crawlerRef });
        } else {
            await handlePlacePage({ request, page, crawlerRef });
        }
    },
    failedRequestHandler: async ({ request }) => {
        log.error(`Request failed too many times: ${request.url}`);
    },
});

async function handleSearchPage({ request, page, crawlerRef }) {
    const { term, query } = request.userData;
    log.info(`Searching: "${query ?? request.url}"`);

    try {
        await page.waitForSelector('div[role="feed"]', { timeout: 60_000 });
    } catch {
        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
        if (/couldn't find|can't find|no results/i.test(bodyText)) {
            log.warning(`No results for "${query ?? request.url}".`);
            return;
        }
        throw new Error(`Results feed did not load for "${query ?? request.url}" (possible block/captcha).`);
    }

    // Scroll the results feed until we have enough listings or reach the end.
    const targetCount = maxPlacesPerSearch;
    let previousCount = 0;
    let stagnantRounds = 0;

    for (let i = 0; i < 100; i++) {
        const count = await page.locator('div[role="feed"] a[href*="/maps/place/"]').count();
        if (count >= targetCount) break;

        // Matches regardless of the apostrophe variant in "You've reached the end of the list."
        const reachedEnd = await page.getByText(/reached the end of the list/i).count();
        if (reachedEnd > 0) break;

        stagnantRounds = count === previousCount ? stagnantRounds + 1 : 0;
        if (stagnantRounds >= 5) {
            log.warning(`Feed stopped growing for "${query}" at ${count} results.`);
            break;
        }
        previousCount = count;

        await page.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollTo(0, feed.scrollHeight);
        });
        await page.waitForTimeout(1500 + Math.random() * 1000);
    }

    // Collect card data: place URL, name, and the "4.6 stars 1,234 Reviews" label.
    const cards = await page.$$eval('div[role="feed"] a[href*="/maps/place/"]', (links) => {
        return links.map((link) => {
            const card = link.closest('div[jsaction]') ?? link.parentElement;
            const ratingEl = card?.querySelector('span[role="img"]');
            return {
                href: link.href,
                name: link.getAttribute('aria-label'),
                ratingLabel: ratingEl?.getAttribute('aria-label') ?? null,
            };
        });
    });

    log.info(`Found ${cards.length} listings for "${query ?? request.url}".`);
    stats.found += cards.length;

    const termKey = term ?? request.url;
    let enqueued = enqueuedPerTerm.get(termKey) ?? 0;
    for (const card of cards.slice(0, targetCount)) {
        if (capReached()) break;
        const { rating, reviewCount } = parseRatingLabel(card.ratingLabel);

        // Pre-filter on card data so we don't waste page loads on listings
        // that already fail the rating/review or name-matching filters.
        if (!passesRatingReviewFilters({ rating, reviewCount })
            || !matchesSearchTerm(card.name, term, searchMatching)) {
            stats.filteredOut += 1;
            continue;
        }
        if (enqueued >= targetCount) break;
        enqueued += 1;

        if (exportPlaceUrls) {
            // Fast mode: save straight from the search results, skip place pages.
            await saveItem({
                name: card.name,
                rating,
                reviewCount,
                gmapsUrl: card.href,
                coordinates: parseCoordsFromUrl(card.href),
                searchTerm: term ?? null,
                location: location || null,
                scrapedAt: new Date().toISOString(),
            }, crawlerRef);
            continue;
        }

        await crawlerRef.addRequests([{
            url: card.href,
            userData: {
                label: 'PLACE',
                term,
                cardData: { name: card.name, rating, reviewCount },
            },
        }]);
    }
    enqueuedPerTerm.set(termKey, enqueued);
}

async function handlePlacePage({ request, page, crawlerRef }) {
    const { term, cardData = {} } = request.userData;

    await page.waitForSelector('h1', { timeout: 60_000 });
    const details = await extractPlaceDetails(page);

    const item = {
        name: details.name ?? cardData.name ?? null,
        placeId: details.placeId,
        category: details.category,
        rating: details.rating ?? cardData.rating ?? null,
        reviewCount: details.reviewCount ?? cardData.reviewCount ?? null,
        phone: details.phone,
        website: details.website,
        address: details.address,
        permanentlyClosed: details.permanentlyClosed,
        temporarilyClosed: details.temporarilyClosed,
        coordinates: parseCoordsFromUrl(page.url()),
        gmapsUrl: page.url(),
        searchTerm: term ?? null,
        location: location || null,
        scrapedAt: new Date().toISOString(),
    };

    if (!passesWebsiteFilter(item.website)
        || !passesPhoneFilter(item.phone)
        || !passesRatingReviewFilters(item, { strict: true })
        || !passesClosedFilter(item)
        || !passesCategoryFilter(item.category)
        || !matchesSearchTerm(item.name, term, searchMatching)) {
        stats.filteredOut += 1;
        log.debug(`Filtered out: ${item.name}`);
        return;
    }

    await saveItem(item, crawlerRef);
    log.info(`Saved: ${item.name} (${item.rating} stars, ${item.reviewCount} reviews)`);
}

const startRequests = [];

for (const term of searchTerms) {
    const query = location ? `${term} in ${location}` : term;
    startRequests.push({
        url: `${BASE_URL}/maps/search/${encodeURIComponent(query)}?hl=${encodeURIComponent(language)}`,
        userData: { label: 'SEARCH', term, query },
    });
}

// Start URLs: place URLs go straight to detail extraction, anything else is
// treated as a search/results page.
for (const entry of startUrls) {
    const url = typeof entry === 'string' ? entry : entry?.url;
    if (!url) continue;
    const label = url.includes('/maps/place/') ? 'PLACE' : 'SEARCH';
    startRequests.push({ url, userData: { label, term: null, query: null } });
}

await crawler.run(startRequests);

log.info('Done.', stats);
await Actor.setValue('SUMMARY', stats);
await Actor.exit();
