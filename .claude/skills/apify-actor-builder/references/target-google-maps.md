# Target: Google Maps / Google Places

Local-business listings. The most common lead-gen scraper.

## Interview questions specific to this target

- **Search shape:** search terms + a separate location field? free-form queries
  that already include location? both? (Terms + location is cleanest for running
  many verticals across one city.)
- **Filters they'll want** (offer these explicitly — this is the whole point):
  - Minimum / maximum **review count**
  - Minimum / maximum **star rating** (a `select` of presets 2.0–4.5+ reads well)
  - **Website** present: all / only-with / only-without (only-without = classic
    web-design lead gen)
  - **Phone** present: all / only-with / only-without
  - **Category** words (keep only matching categories; partial match)
  - **Name matching:** does the place name have to include/equal the term?
    (finds all branches of a brand)
  - **Skip closed** places (temporarily/permanently)
- **Output fields:** name, category, rating, reviewCount, phone, website,
  address, coordinates, placeId, Google Maps URL, plus hours/plus-code if wanted.
- **Scale:** per-search cap and a global cap.

## Field-name convention

If they want compatibility with the popular `compass/crawler-google-places`
actor, mirror its keys so existing inputs port over: `searchStringsArray`,
`locationQuery`, `maxCrawledPlacesPerSearch`, `maxCrawledPlaces`, `language`,
`categoryFilterWords`, `searchMatching` (`all` / `only_includes` /
`only_exact`), `placeMinimumStars` (`two`, `twoAndHalf`, `three`,
`threeAndHalf`, `four`, `fourAndHalf`), `website` (`allPlaces` / `withWebsite` /
`withoutWebsite`), `skipClosedPlaces`, `startUrls`. Note `maxReviews` there
means "how many reviews to scrape", so name a review-count *filter* differently
(e.g. `minReviewsCount` / `maxReviewsCount`) to avoid confusion.

## Scraping specifics

- Search URL: `https://www.google.com/maps/search/<query>?hl=<lang>`.
- Results feed selector: `div[role="feed"]`; place links: `a[href*="/maps/place/"]`.
- A search that matches one place exactly **redirects straight to the place
  page** — detect `/maps/place/` in the URL and route to the detail handler.
- On the place page, stable hooks: `h1` (name),
  `button[data-item-id="address"]`, `a[data-item-id="authority"]` (website),
  `button[data-item-id^="phone:tel:"]`, header `span[role="img"][aria-label*="star"]`.
- Coordinates: parse `!3d<lat>!4d<lng>` (the place) or `@lat,lng` (map center)
  from the URL.
- Seed the `SOCS` cookie to skip EU consent. Use residential proxies.
- Google caps a single search at ~120 results; split a city into
  neighborhoods/ZIPs for coverage.
