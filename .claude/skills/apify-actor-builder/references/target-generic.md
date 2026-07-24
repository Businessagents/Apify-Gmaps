# Target: generic website / other

When the target isn't one of the pre-written references, derive the plan from
the site itself. Ask enough to fill the same slots the specific references fill.

## Interview questions to drive out the shape

- **Site & entities:** what site, and what records are you collecting (products,
  listings, articles, companies, events)?
- **Entry points:** search results, category pages, a sitemap, or a list of
  specific URLs you'll provide?
- **List vs detail:** does each result need a detail-page visit for the full
  record, or is everything on the list page?
- **Filters:** which attributes decide keep-vs-drop? For each, is it a range
  (price, date, rating), a presence flag (has email / has stock), a category
  membership, or a text match?
- **Output fields:** exactly which fields per record, and their types.
- **Auth:** is any of it behind login or a paywall? (If so, confirm the user is
  authorized and handle it explicitly — don't evade access controls.)
- **Volume & politeness:** how many records, and does the site publish a
  robots.txt / rate limit to respect?
- **Rendering:** is content server-rendered (Cheerio/HTTP is enough and much
  cheaper) or JS-rendered (needs Playwright)?

## Choosing the base image / crawler

- Static HTML, no JS needed → `apify/actor-node:20` + `CheerioCrawler`. Faster,
  lighter, cheaper.
- JS-rendered or needs a real browser → `apify/actor-node-playwright-chrome:20`
  + `PlaywrightCrawler` (the template default).

## Compliance

Check robots.txt and the site's ToS. Prefer public data. If the site offers an
API, that's usually the better and more stable path — mention it. For personal
data, note the GDPR/CCPA implications of collecting and storing it.
