# Target: Instagram

Public profiles, posts, and hashtags. Also heavily rate-limited and partly
auth-walled; set expectations early.

## Feasibility & compliance — raise this first

- Scrape **public** data only. Scraping private accounts, or logging in with
  another person's credentials, violates Instagram's Terms and privacy law.
- Instagram serves personal data — profiles, comments, likes. Collecting and
  storing it triggers GDPR/CCPA obligations. Keep the user's use case to
  aggregate/public-interest analysis (brand monitoring, public hashtag trends,
  a creator analyzing their own account) rather than harvesting individuals.
- For business use, the official **Instagram Graph API** (via a linked
  Facebook/Meta app) is the compliant path for a creator's or brand's own data.

## Interview questions specific to this target

- **What entity:** profiles, individual posts, or hashtag feeds?
- **Input shape:** list of usernames/handles, list of hashtags, or post URLs?
- **Filters:** for profiles — min followers, verified only, business/creator
  accounts; for posts — date window, min likes/comments, media type
  (image/video/carousel/reel).
- **Depth:** how many posts per profile/hashtag? scrape comments too? (comments
  are personal data — confirm intent).
- **Output fields:** profile — username, full name, bio, followers, following,
  post count, external URL, verified, category; post — shortcode/URL, caption,
  likes, comments count, timestamp, media type, media URLs.

## Scraping specifics

- Public profile page: `https://www.instagram.com/<username>/`; public hashtag:
  `https://www.instagram.com/explore/tags/<tag>/`.
- Much of the data loads via internal JSON/GraphQL endpoints and embedded
  `window._sharedData` / JSON script tags rather than server-rendered HTML —
  extracting from those payloads is more robust than DOM scraping.
- Expect login walls after a few requests. Residential proxies, low concurrency,
  human-like delays. Rotate sessions on block.
- A fragile hand-rolled Instagram scraper breaks often; weigh a maintained Store
  actor or the Graph API against maintenance cost.
