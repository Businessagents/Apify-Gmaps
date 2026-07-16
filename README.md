# Google Maps Listings Scraper

Extract business listings from Google Maps — with powerful filters applied **before** anything lands in your dataset. Search by keyword and location, then keep only the places that match your criteria: star rating, review count, category, website presence, name matching, and open/closed status.

Built for lead generation: for example, find every established business in a city (50+ reviews) that still has **no website**, complete with phone numbers you can call.

## Features

- 🔍 **Search terms + location** — run many searches in one go (`"dentist"`, `"plumber"` × `"Austin, TX"`), or feed direct Google Maps search/place URLs.
- 🎢 **Category filter** — keep only places matching category words (e.g. `restaurant` also matches *Sushi restaurant*).
- ⭐ **Star rating filter** — minimum stars (2.0–4.5+ presets) and an optional maximum (find poorly rated businesses).
- 💬 **Review count filter** — minimum and/or maximum number of reviews.
- 🌐 **Websites filter** — all places, only with a website, or only *without* a website (the classic lead-gen filter).
- 📞 **Phone numbers filter** — all places, only with a listed phone number, or only without one.
- 🏷️ **Name matching** — restrict results to places whose name includes or exactly matches the search term (find all locations of a brand).
- ⛔ **Skip closed places** — drop temporarily or permanently closed businesses.
- ⚡ **Fast URL export mode** — grab name, rating, review count, and place URL straight from search results without opening place pages.
- 💸 **Cost-efficient** — listings failing rating/review/name filters are dropped from the search results directly, so their place pages are never even opened.

The input follows the field conventions of the popular `compass/crawler-google-places` actor (`searchStringsArray`, `locationQuery`, `placeMinimumStars`, `website`, `skipClosedPlaces`, `categoryFilterWords`, `searchMatching`, `maxCrawledPlacesPerSearch`, `startUrls`), so existing inputs port over with no changes.

## Input

| Field | Type | Description |
|---|---|---|
| `searchStringsArray` | array | Search terms, e.g. `["dentist", "plumber"]`. Each runs as its own search. |
| `locationQuery` | string | Location appended to every term, e.g. `"Austin, TX"`. |
| `maxCrawledPlacesPerSearch` | integer | Max places collected per search term (default 100). Google Maps caps a single search at ~120 results. |
| `maxCrawledPlaces` | integer | Overall cap on saved places across all searches. Empty = no cap. |
| `language` | select | Interface language for results (default `en`). |
| `categoryFilterWords` | array | Only keep places whose category matches one of these words (case-insensitive, partial match). |
| `searchMatching` | select | `all`, `only_includes`, or `only_exact` — match search term against place names. |
| `placeMinimumStars` | select | Minimum rating: `two`, `twoAndHalf`, `three`, `threeAndHalf`, `four`, `fourAndHalf`. |
| `maximumStars` | string | Maximum rating (0–5), e.g. `"3.5"`. Empty = disabled. |
| `minReviewsCount` | integer | Only keep places with at least this many reviews. `0` = disabled. |
| `maxReviewsCount` | integer | Only keep places with at most this many reviews. Empty = disabled. |
| `website` | select | `allPlaces`, `withWebsite`, or `withoutWebsite`. |
| `phone` | select | `allPlaces`, `withPhone`, or `withoutPhone`. |
| `skipClosedPlaces` | boolean | Skip temporarily/permanently closed places. |
| `startUrls` | array | Google Maps search or place URLs to scrape directly. |
| `exportPlaceUrls` | boolean | Fast mode: save basic data straight from search results, skip place pages. |
| `proxyConfiguration` | object | **Residential Apify proxies strongly recommended** — Google blocks datacenter IPs quickly. |

### Example input

Find well-established dentists and chiropractors in Austin that don't have a website:

```json
{
    "searchStringsArray": ["dentist", "chiropractor"],
    "locationQuery": "Austin, TX",
    "minReviewsCount": 20,
    "placeMinimumStars": "four",
    "website": "withoutWebsite",
    "skipClosedPlaces": true,
    "maxCrawledPlacesPerSearch": 100,
    "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
}
```

## Output

One dataset item per place that passed all filters:

```json
{
    "name": "Smile Dental Studio",
    "placeId": "ChIJd8BlQ2BZwokRAFUEcm_qrcA",
    "category": "Dentist",
    "rating": 4.8,
    "reviewCount": 214,
    "phone": "+15125551234",
    "website": null,
    "address": "123 Congress Ave, Austin, TX 78701",
    "permanentlyClosed": false,
    "temporarilyClosed": false,
    "coordinates": { "lat": 30.2672, "lng": -97.7431 },
    "gmapsUrl": "https://www.google.com/maps/place/...",
    "searchTerm": "dentist",
    "location": "Austin, TX",
    "scrapedAt": "2026-07-16T12:34:56.789Z"
}
```

## How it works

1. Each search term is combined with the location and opened on Google Maps.
2. The results feed is scrolled until the requested number of places (or the end of the list) is reached.
3. Rating, review-count, and name-matching filters are applied to the result cards immediately — failing places are never opened, saving time and proxy traffic.
4. Each surviving place's detail page is visited to extract phone, website, category, address, and closed status.
5. The website, category, and closed-place filters are applied, and matching places are saved to the dataset.

## FAQ

**How many results can one search return?**
Google Maps caps a single search at roughly 120 places. To cover a whole city, split it into neighborhoods or ZIP codes (`"dentist downtown"`, `"dentist 78704"`) — deduplication across searches is automatic within a run.

**Why are residential proxies recommended?**
Google aggressively blocks datacenter IP ranges. With residential proxies the actor runs reliably at moderate concurrency.

**Does it scrape review texts, images, or contact enrichment?**
Not yet — this actor focuses on listing data and filtering. Review/image scraping can be added in a future version.

**Is scraping Google Maps legal?**
Scraping publicly available data is generally considered legal in most jurisdictions, but it may violate Google's Terms of Service, and regulations differ by country (especially for personal data). Use responsibly and consult a lawyer for your specific use case.

## Local development

```bash
npm install
# put your test input into ./storage/key_value_stores/default/INPUT.json
npm start
```

Deploy to Apify with `apify push`.

Optional environment variables for development:

- `CHROME_EXECUTABLE_PATH` — use a specific Chromium binary instead of the one Playwright resolves.
- `GMAPS_BASE_URL` — point the scraper at a mock server instead of `https://www.google.com` to test the pipeline offline.

## Project structure

```
.actor/actor.json         Actor metadata + dataset views
.actor/input_schema.json  Input form definition
src/main.js               Crawler: search feed scrolling, place page extraction, filtering
src/extractors.js         Pure helpers (rating parsing, filter predicates, URL parsing)
Dockerfile                Based on apify/actor-node-playwright-chrome
```
