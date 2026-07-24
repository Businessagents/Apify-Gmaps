# Apify actor anatomy & environment gotchas

The files an actor needs, what goes in each, and the environment traps that
cost real debugging time. Read this before scaffolding.

## File layout

```
my-actor/
├── .actor/
│   ├── actor.json          Metadata: name, title, version, dataset views
│   └── input_schema.json   The input form users fill in
├── src/
│   ├── main.js             Entry point (crawler setup + handlers)
│   └── filters.js          Pure helpers (unit-testable, no browser imports)
├── test/
│   ├── unit.mjs            Node assertions over the pure helpers
│   └── fixture-server.mjs  Local DOM mock for offline end-to-end runs
├── Dockerfile
├── package.json
├── .gitignore
└── README.md               Store-quality docs (see the README section below)
```

The bundled `scripts/init_actor.sh` writes all of these from templates.

## input_schema.json — the part users touch most

Each property needs a `title`, `type`, `description`, and usually an `editor`.
Editors worth knowing:

| Editor | For | Notes |
|---|---|---|
| `stringList` | list of terms/URLs/handles | array type |
| `textfield` | single short string | |
| `textarea` | long text | |
| `number` | integer/float | supports `minimum`, `maximum` |
| `select` | fixed choices | needs `enum` + `enumTitles` (parallel arrays) |
| `requestListSources` | Start URLs | array type; yields `{url}` objects |
| `proxy` | proxy picker | object type |
| `hidden` / checkbox | booleans | boolean type renders as a checkbox |

Guidance that makes a schema feel professional:
- Group related fields with `sectionCaption` (and optional `sectionDescription`)
  on the **first** field of each section. Good sections: the main input, then
  "Filters", then "Advanced".
- Use `prefill` for a suggested starting value the user sees in the form; use
  `default` for a value the code should assume when the field is omitted.
- Emoji in a `title` (e.g. `"🌐 Website filter"`) read well in the Apify console
  and help users scan the form. Use them sparingly on the important filters.
- `nullable: true` lets a numeric/text filter be genuinely empty ("disabled").

### The `Actor.getInput()` + defaults trap

`Actor.getInput()` **merges input-schema `default` values into the returned
object**. So a field with a `default` always arrives populated — you cannot
detect "user left it blank" for such a field, and any `input.oldName ??
input.newName` fallback chain silently resolves to the default before it ever
reaches `newName`. If you rename input fields, drop the old names rather than
relying on `??` fallbacks, or the defaults will shadow them.

## actor.json — dataset views

The `views` block controls how results render as a table in the console. List
the fields in `transformation.fields`, then label/format each in
`display.properties` (formats: `text`, `number`, `link`, `boolean`, `date`).
A good overview view is one of the cheapest ways to make an actor look polished.

## Dockerfile — the chown trap

Base images: `apify/actor-node-playwright-chrome:20` (browser scraping) or
`apify/actor-node:20` (HTTP/Cheerio only, much lighter).

The Playwright image runs as the **non-root user `myuser`**. A plain `COPY`
lands files owned by root, and then `npm install` dies with
`EACCES: permission denied, open '/home/myuser/package-lock.json'`. Always:

```dockerfile
COPY --chown=myuser package*.json ./
# ...npm install...
COPY --chown=myuser . ./
```

The bundled Dockerfile template already does this.

## README — publishing standard

If the actor may be published to Apify Store, the README is the store listing.
Structure that works: one-line value proposition → Features (bulleted, benefit-
first) → Input table → example input JSON → example output JSON → How it works →
FAQ (result limits, why proxies, legality) → local dev notes. Lead with the
user's outcome ("find businesses without a website"), not the mechanics.

## Local verification without the Apify platform

You don't need `apify run` to test. Put input JSON at
`storage/key_value_stores/default/INPUT.json` and run `npm start`. The SDK reads
it and writes results under `storage/datasets/default/`. Combine with the
`TARGET_BASE_URL` override and the fixture server for fully offline runs.
