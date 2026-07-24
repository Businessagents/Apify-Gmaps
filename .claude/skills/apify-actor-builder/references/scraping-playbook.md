# Scraping playbook (Crawlee + Playwright)

Reusable patterns for the crawler itself, and how to verify it offline. These
are target-agnostic; the per-target reference files add site specifics.

## Two-phase crawl: list → detail

Most scrapers have a **list/search page** (many results, cheap fields) and
**detail pages** (one entity, full fields). Enqueue detail requests from the
list handler with `userData.label = 'DETAIL'` and branch in the request
handler. This keeps concurrency high and lets you filter cheaply before paying
for detail-page loads.

## Filter early, filter late

Apply filters in two passes:

1. **Lenient pass on list data.** With only partial fields, reject a result
   only when it *provably* fails a filter. Unknown values pass through so the
   detail page can decide. This avoids opening detail pages you'll discard.
2. **Strict pass on the full record**, before `pushData`. Here a missing value
   counts as failing any filter that requires it.

`src/filters.js` in the template shows this with a `strict` flag. Keeping
filters as pure functions there (no Playwright imports) is what makes
`test/unit.mjs` able to run them in plain Node.

## Infinite-scroll feeds

Many sites lazy-load results into a scrollable container. Loop: count loaded
items → if enough, stop → if an "end of list" marker appears, stop → if the
count hasn't grown for several rounds, stop → else scroll the container to its
bottom and wait a randomized 1.5–2.5s. Cap total rounds so a broken selector
can't spin forever.

## Cookie-consent / interstitials

EU consent screens block the first navigation. Two mitigations, use both:
- Pre-seed a consent cookie in a `preNavigationHook` (for Google, the `SOCS`
  cookie on `.google.com` skips it in most regions).
- Detect the consent URL/host in the handler and click the accept button as a
  fallback, then wait for the real page.

## Blocking, proxies, fingerprints

- Default to **residential** proxies for consumer sites (Google, LinkedIn,
  Instagram) — datacenter IPs get 403'd or captcha'd fast. Expose a `proxy`
  editor and prefill `RESIDENTIAL`.
- Enable `browserPoolOptions.useFingerprints = true` (Crawlee rotates realistic
  fingerprints).
- Keep `maxConcurrency` modest (≈5) on aggressive sites; raise it only if the
  target tolerates it.
- Treat a 403 or a missing results container as a probable block, not a code
  bug — surface it clearly in logs and let Crawlee retry on a fresh session.

## A global result cap that actually stops

Track saved count; when it reaches `maxItems`, call `crawler.stop()`. Check the
cap before enqueueing more detail requests too, so in-flight work winds down.

## Offline verification (no network, no real site)

This is how to *know* the pipeline works without hitting the target:

1. **Unit-test the pure helpers** — `node test/unit.mjs`. Fast, deterministic.
2. **End-to-end against a fixture** — `test/fixture-server.mjs` serves HTML that
   mirrors the target's DOM structure (same selectors your extractor queries).
   Run the actor with `TARGET_BASE_URL=http://127.0.0.1:38471` so it crawls the
   fixture instead of the real site. Assert on the rows written to
   `storage/datasets/default/`.

Build the fixture to include edge cases your filters care about (an item with no
rating, one that's closed, one without a website, etc.) and assert the right
subset survives.

## Running the browser in a sandboxed dev environment

- Playwright's bundled Chromium may be at `/opt/pw-browsers/chromium`. If the
  installed browser build doesn't match the Playwright npm version, pass its
  path via `CHROME_EXECUTABLE_PATH` (the template's `launchOptions.executablePath`
  reads it) instead of running `playwright install`.
- Run headless: `APIFY_HEADLESS=1 CRAWLEE_HEADLESS=1`.
- **TLS through a corporate/agent proxy:** if the browser gets
  `ERR_CERT_AUTHORITY_INVALID` while `curl` works, the proxy's CA is trusted at
  the OS level but not in the browser's own NSS store. Import the proxy CA
  bundle into the NSS DB:
  `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n proxy-ca -i <ca-bundle.crt>`
  (install `libnss3-tools` for `certutil`). A blanket outbound-block that 403s
  even `curl https://example.com`, by contrast, means the environment has no
  egress — verify on the Apify platform instead.
