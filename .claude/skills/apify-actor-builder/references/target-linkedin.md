# Target: LinkedIn

LinkedIn is aggressively anti-scraping and auth-walled. Handle the ethics/ToS
and feasibility conversation up front — don't scaffold silently.

## Feasibility & compliance — raise this first

- Most useful LinkedIn data sits **behind login**. Scraping authenticated pages
  violates LinkedIn's User Agreement and can expose personal data (GDPR/CCPA).
  The *hiQ v. LinkedIn* line of cases touched only **public** profile data and
  did not bless authenticated scraping.
- Steer toward defensible inputs: **public** company pages, **public** job
  postings, content the user is authorized to access, or LinkedIn's official
  APIs / Marketing & Talent Solutions partners.
- Never build anything that logs in with someone else's credentials, harvests
  personal profiles at scale, or evades access controls. If that's the ask,
  say so plainly and offer the public/API alternative instead.

## Interview questions specific to this target

- **What entity:** job postings, company pages, or public profiles? (Steer to
  jobs/companies.)
- **Input shape:** search keywords + location + filters, or a list of specific
  page URLs?
- **Job filters** (if jobs): keyword, location, remote/hybrid/on-site,
  date-posted window, experience level, job type, salary if present, company.
- **Company filters:** industry, company size, headquarters location.
- **Output fields:** for jobs — title, company, location, posted date, work
  mode, description, apply URL; for companies — name, industry, size, HQ,
  website, follower count, about.

## Scraping specifics

- Expect auth walls, rate limits, and frequent DOM changes. **Residential
  proxies are mandatory**, low concurrency, generous delays.
- Public job search: `https://www.linkedin.com/jobs/search/?keywords=...&location=...`.
  There's also a lighter guest jobs endpoint under
  `/jobs-guest/jobs/api/seeMoreJobPostings/search` that returns HTML cards
  without login — prefer it for public job listings.
- Selectors change often; keep extraction resilient and fail loudly on a
  missing container (probable block) rather than silently saving empty rows.
- Consider whether an existing maintained Store actor is the pragmatic choice
  before hand-rolling a fragile authenticated scraper.
