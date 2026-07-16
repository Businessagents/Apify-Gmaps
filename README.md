# Google Maps Listings Scraper

An [Apify](https://apify.com) actor that scrapes Google Maps listings for your search terms and filters them by review count, star rating, and website presence. Built for lead generation — e.g. find businesses in a city that have plenty of reviews but no website.

## How it works

1. For each search term (optionally combined with a location) the actor opens Google Maps search and scrolls the results feed to collect listings.
2. Listings that already fail the rating/review filters are dropped early to save time.
3. Each remaining listing's place page is visited to extract the phone number, category, website, and address.
4. The website filter and final rating/review checks are applied, and matching listings are saved to the dataset.

## Input

| Field | Type | Description |
|---|---|---|
| `searchTerms` | array | **Required.** Search terms, e.g. `["dentist", "plumber"]`. Each runs as its own search. |
| `location` | string | Optional location appended to every term, e.g. `"Austin, TX"`. |
| `minReviews` | integer | Only keep listings with at least this many reviews. `0` disables. |
| `maxReviews` | integer | Only keep listings with at most this many reviews. Empty disables. |
| `minRating` | string | Minimum star rating (0–5), e.g. `"4"` or `"3.5"`. Empty disables. |
| `maxRating` | string | Maximum star rating (0–5). Empty disables. |
| `websiteFilter` | select | `all`, `withWebsite`, or `withoutWebsite`. |
| `maxResultsPerSearch` | integer | Max listings collected per search term before filtering (default 100). Google Maps itself caps a search at roughly 120 results. |
| `language` | string | Google Maps interface language (`hl` parameter), default `en`. |
| `proxyConfiguration` | object | Proxy settings. **Residential Apify proxies are strongly recommended** — Google blocks datacenter IPs quickly. |

### Example input

```json
{
    "searchTerms": ["dentist", "chiropractor"],
    "location": "Austin, TX",
    "minReviews": 20,
    "minRating": "4",
    "websiteFilter": "withoutWebsite",
    "maxResultsPerSearch": 100,
    "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
}
```

## Output

One dataset item per listing that passed all filters:

```json
{
    "name": "Smile Dental Studio",
    "category": "Dentist",
    "rating": 4.8,
    "reviewCount": 214,
    "phone": "+15125551234",
    "website": null,
    "address": "123 Congress Ave, Austin, TX 78701",
    "gmapsUrl": "https://www.google.com/maps/place/...",
    "searchTerm": "dentist",
    "location": "Austin, TX",
    "scrapedAt": "2026-07-16T12:34:56.789Z"
}
```

## Tips

- Google Maps returns at most ~120 results per search. To cover a whole city, split it into neighborhoods or zip codes and use multiple search terms (e.g. `"dentist downtown"`, `"dentist 78704"`).
- If a search matches a single place exactly, Google redirects straight to that place — the actor handles this and scrapes it directly.
- Tip for lead-gen: `websiteFilter: "withoutWebsite"` + `minReviews: 10` finds established businesses without a web presence.

## Local development

```bash
npm install
# put your test input into ./storage/key_value_stores/default/INPUT.json
npm start
```

Deploy to Apify with `apify push`.

Optional environment variables for development:

- `CHROME_EXECUTABLE_PATH` — use a specific Chromium binary instead of the one Playwright resolves (handy when the installed browser build doesn't match the Playwright version).
- `GMAPS_BASE_URL` — point the scraper at a mock server instead of `https://www.google.com` to test the pipeline offline (see `src/extractors.js` unit-testable helpers).

## Project structure

```
.actor/actor.json         Actor metadata + dataset views
.actor/input_schema.json  Input form definition
src/main.js               Crawler: search feed scrolling, place page extraction, filtering
src/extractors.js         Pure helpers (rating label parsing, filter predicates)
Dockerfile                Based on apify/actor-node-playwright-chrome
```

## Disclaimer

Scraping Google Maps may violate Google's Terms of Service. Use responsibly, respect rate limits, and check the legal situation in your jurisdiction before large-scale use.
