/**
 * Pure, side-effect-free helpers: parsing scraped strings and applying the
 * input filters. Keeping these free of Crawlee/Playwright imports means they
 * can be unit-tested in plain Node (see test/unit.mjs) without a browser.
 *
 * The filter pattern that works well for scrapers:
 *   - Lenient pass on partial data collected from a list/search page, so you
 *     don't open detail pages you'll obviously discard.
 *   - Strict pass on the full detail record before saving, where a missing
 *     value counts as failing any filter that requires it.
 */

/** Example: turn a "with / without / all" tri-state into a predicate over a field. */
export const buildPresenceFilter = (mode) => (value) => {
    if (mode === 'withField') return Boolean(value);
    if (mode === 'withoutField') return !value;
    return true; // 'all'
};

/** Example numeric range filter. Unknown values pass unless `strict`. */
export const buildRangeFilter = ({ min = null, max = null }) => (value, { strict = false } = {}) => {
    if (value === null || value === undefined) return !strict || (min === null && max === null);
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
};
