---
name: apify-actor-builder
description: >-
  Interview-driven builder for Apify actors (web scrapers/automation). Use this
  whenever the user wants to create, build, scaffold, or design an Apify actor
  or a scraper to deploy on Apify — for Google Maps / Google Places listings,
  LinkedIn jobs or companies, Instagram profiles or hashtags, e-commerce
  products, or any website. Trigger it even when the user only says "I want to
  scrape X" or "build me an actor for Y" without naming Apify, and when they
  want help figuring out the filters, inputs, and output fields they need. The
  skill asks focused questions with AskUserQuestion to pull the requirements out
  of the user's head, then scaffolds a complete, deployable, locally-tested
  actor. Do not use it for one-off ad-hoc scraping scripts the user does not
  intend to run on Apify.
---

# Apify actor builder

Turn a vague "I want to scrape X" into a complete, deployable, tested Apify
actor. The skill's job is to **interview the user to surface requirements they
haven't fully articulated**, then build the actor to that spec.

## The shape of the work

1. **Interview** with `AskUserQuestion` — figure out the target, input, filters,
   and output. This is the core; do it well.
2. **Scaffold** the actor from templates (`scripts/init_actor.sh`).
3. **Tailor** the input schema and implement the scraping logic for the target.
4. **Verify locally** — unit tests plus an offline fixture run.
5. **Document and hand off** — a store-quality README, then commit if the user
   wants it version-controlled.

Reference material (read as needed, don't preload everything):
- `references/actor-anatomy.md` — required files, input-schema editors,
  actor.json views, Dockerfile, and the environment traps. **Read before
  scaffolding.**
- `references/scraping-playbook.md` — crawler patterns (list→detail, filter
  early/late, scrolling, consent, proxies, blocking) and how to verify offline.
  **Read before implementing `main.js`.**
- `references/target-<name>.md` — target-specific questions, field conventions,
  selectors, and compliance notes. One each for `google-maps`, `linkedin`,
  `instagram`, and `generic`. **Read the matching one before the interview's
  filter round**, since it tells you which filters to offer.

## Step 1 — Interview

Run the interview as a short sequence of `AskUserQuestion` rounds. **Adapt to
what you already know**: if the user already told you the target and their
goal (e.g. "an actor to find local businesses without a website"), skip straight
past those questions — re-asking what's already answered is the fastest way to
feel robotic. Offer a clear recommendation as the first option where one exists.

Prefer a few focused rounds over one giant form. A round holds up to 4
questions; use `multiSelect: true` when choices aren't exclusive (e.g. output
fields, which filters to include).

**Round 1 — Target & goal** (skip anything already known)
- What are you scraping? Offer common targets as options — Google Maps /
  Google Places, LinkedIn, Instagram, an e-commerce/other website — plus "Other"
  for free-form. Their answer selects which `references/target-*.md` to read.
- What's the goal? (lead generation, market/competitor research, monitoring,
  building a dataset) — this shapes which fields and filters matter.

Now **read the matching `references/target-*.md`** so the next rounds offer the
right filters and you know the site's quirks. For unlisted targets use
`target-generic.md` and derive the plan from the site.

**Round 2 — Input shape & stack**
- How does the user specify what to scrape? (search terms + location / list of
  URLs / usernames or handles / category + region) — per the target reference.
- Tech stack: default to **Node.js + Crawlee/Playwright** (best-supported on
  Apify); offer Python only if the user prefers it. Static-HTML sites can use
  the lighter Cheerio path — see `target-generic.md`.

**Round 3 — Filters** (the part users most want, and most under-specify)
Pull the candidate filters from the target reference and present them, ideally
as a `multiSelect` "which of these do you want?" plus follow-ups for specifics
(ranges, tri-state presence like has-website/has-phone, category words, name
matching). Suggest filters they didn't think of — surfacing the has-no-website
lead-gen angle, or a min-reviews threshold, is exactly the "identify what's in
my brain" help they asked for.

**Round 4 — Output & delivery**
- Which fields per record? Offer a recommended set from the target reference as
  `multiSelect`, plus "everything available".
- Proxy: default residential for consumer sites; expose the picker regardless.
- Scale caps: per-search and/or global maximum.

When the picture is complete, briefly play back the spec in prose (target,
input, filters, output, stack) so the user can correct it before you build. One
short confirmation beats building the wrong thing.

### Compliance is part of the interview, not an afterthought

For auth-walled or personal-data targets (LinkedIn, Instagram, anything behind
login), raise ToS and privacy **during** the interview as the target reference
describes. Steer toward public data and official APIs. Don't build tools whose
purpose is to log in as someone else, evade access controls, or harvest personal
profiles at scale — say so plainly and offer the compliant alternative.

## Step 2 — Scaffold

Run the init script to lay down the file structure (it substitutes the name/
title/description and never overwrites existing files):

```bash
scripts/init_actor.sh <target-dir> <actor-name> "<Actor Title>" "<one-line description>"
```

`<actor-name>` should be kebab-case (e.g. `linkedin-jobs-scraper`). Then read
`references/actor-anatomy.md` if you haven't, and note the two traps it covers:
the Dockerfile `--chown=myuser` requirement and the `Actor.getInput()`-merges-
defaults behavior.

## Step 3 — Tailor & implement

- **Input schema:** replace the placeholder properties in
  `.actor/input_schema.json` with the fields from the interview. Group them into
  sections, give selects `enum` + `enumTitles`, add tooltips, and use the target
  reference's field-name conventions where compatibility matters.
- **Filters:** implement each as a pure function in `src/filters.js` so it's
  unit-testable. Apply them in two passes (lenient on list data, strict before
  saving) per the playbook.
- **Crawler:** fill in `handleList` and `handleDetail` in `src/main.js` using the
  target reference's selectors and the playbook's patterns. Keep the
  `TARGET_BASE_URL` override intact so the fixture test works.
- **Dataset view:** list the real output fields in `.actor/actor.json`.

## Step 4 — Verify locally

Do not hand over an unverified actor. At minimum:

1. `node --check src/main.js` and validate the JSON files parse.
2. `npm test` (the pure-helper unit tests) — extend `test/unit.mjs` to cover the
   filters you implemented, including edge cases (missing rating, closed place,
   no website).
3. **Offline end-to-end:** build `test/fixture-server.mjs` to serve HTML mirroring
   the target's DOM (same selectors), including records that should be filtered
   out, then run the actor against it:
   ```bash
   node test/fixture-server.mjs &
   TARGET_BASE_URL=http://127.0.0.1:38471 CHROME_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
     APIFY_HEADLESS=1 CRAWLEE_HEADLESS=1 npm start
   ```
   Confirm exactly the expected subset lands in `storage/datasets/default/`.

See the playbook's offline-verification and sandbox-browser notes (browser path,
headless flags, the NSS-CA fix for `ERR_CERT_AUTHORITY_INVALID`). If the sandbox
blocks all egress (even `curl` 403s), you can't do a live run there — verify with
the fixture and note that a live smoke run on the Apify platform is the remaining
step.

## Step 5 — Document & hand off

Write a store-quality `README.md` (structure in `actor-anatomy.md`). Summarize
for the user what was built, how it was verified, and what's left (usually: a
live run on Apify, since selectors can drift and the sandbox can't reach the real
site). If they want it version-controlled, commit on the working branch; only
open a PR or push elsewhere if they ask.

## Adding a new target

To support another site later, drop a `references/target-<name>.md` alongside the
others following the same shape (specific questions → field conventions →
selectors → compliance). The interview picks it up when the user names that
target. No code changes needed.
