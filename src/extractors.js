/**
 * Pure helpers for parsing Google Maps data and applying listing filters.
 * Kept free of Crawlee/Playwright imports so they can be unit-tested directly.
 */

/** Maps compass/crawler-google-places style star enums to numbers. */
export const PLACE_MINIMUM_STARS = {
    '': null,
    two: 2,
    twoAndHalf: 2.5,
    three: 3,
    threeAndHalf: 3.5,
    four: 4,
    fourAndHalf: 4.5,
};

/** Parses a user-supplied rating bound like "4" or "3,5" into a number 0–5 (or null). */
export const parseRatingInput = (value, name) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number.parseFloat(String(value).replace(',', '.'));
    if (Number.isNaN(num) || num < 0 || num > 5) {
        throw new Error(`Input error: "${name}" must be a number between 0 and 5, got "${value}".`);
    }
    return num;
};

/** Parses "4.6 stars 1,234 Reviews"-style aria-labels from search result cards. */
export const parseRatingLabel = (label) => {
    const result = { rating: null, reviewCount: null };
    if (!label) return result;
    const ratingMatch = label.match(/([\d.,]+)\s+star/i);
    if (ratingMatch) result.rating = Number.parseFloat(ratingMatch[1].replace(',', '.'));
    const reviewsMatch = label.match(/star[s]?\s+([\d.,\s]+)\s+review/i);
    if (reviewsMatch) result.reviewCount = Number.parseInt(reviewsMatch[1].replace(/[^\d]/g, ''), 10);
    else if (result.rating !== null) result.reviewCount = 0;
    return result;
};

/**
 * Extracts the place coordinates from a Google Maps place URL.
 * Prefers the `!3d<lat>!4d<lng>` pair (the place itself) over `@lat,lng` (map center).
 */
export const parseCoordsFromUrl = (url) => {
    if (!url) return null;
    let match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (!match) match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!match) return null;
    return { lat: Number.parseFloat(match[1]), lng: Number.parseFloat(match[2]) };
};

/**
 * compass-style search term matching against the place name.
 * - "all": no restriction
 * - "only_includes": place name must contain the search term
 * - "only_exact": place name must equal the search term
 * Unknown names pass (the place page recheck decides); no term = no restriction.
 */
export const matchesSearchTerm = (name, term, searchMatching = 'all') => {
    if (searchMatching === 'all' || !term) return true;
    if (name === null || name === undefined) return true;
    const normalizedName = name.trim().toLowerCase();
    const normalizedTerm = term.trim().toLowerCase();
    if (searchMatching === 'only_includes') return normalizedName.includes(normalizedTerm);
    if (searchMatching === 'only_exact') return normalizedName === normalizedTerm;
    return true;
};

/**
 * Builds the filter predicates from the actor input.
 *
 * `passesRatingReviewFilters` returns false only when the listing is KNOWN to
 * fail a filter — unknown values pass so the place page can decide. With
 * `strict: true` (final check on the place page), missing values are treated
 * as failing when the corresponding filter is set.
 */
export const buildFilters = ({
    minReviews,
    maxReviews,
    minRating,
    maxRating,
    websiteFilter,
    phoneFilter = 'allPlaces',
    skipClosedPlaces = false,
    categoryFilterWords = [],
}) => {
    const passesRatingReviewFilters = ({ rating, reviewCount }, { strict = false } = {}) => {
        if (reviewCount !== null && reviewCount !== undefined) {
            if (minReviews && reviewCount < minReviews) return false;
            if (maxReviews !== null && maxReviews !== undefined && reviewCount > maxReviews) return false;
        } else if (strict && minReviews) {
            return false;
        }
        if (rating !== null && rating !== undefined) {
            if (minRating !== null && rating < minRating) return false;
            if (maxRating !== null && rating > maxRating) return false;
        } else if (strict && minRating !== null) {
            return false;
        }
        return true;
    };

    const passesWebsiteFilter = (website) => {
        if (websiteFilter === 'withWebsite') return Boolean(website);
        if (websiteFilter === 'withoutWebsite') return !website;
        return true; // 'all' / 'allPlaces'
    };

    const passesPhoneFilter = (phone) => {
        if (phoneFilter === 'withPhone') return Boolean(phone);
        if (phoneFilter === 'withoutPhone') return !phone;
        return true; // 'allPlaces'
    };

    const passesClosedFilter = ({ permanentlyClosed, temporarilyClosed }) => {
        if (!skipClosedPlaces) return true;
        return !permanentlyClosed && !temporarilyClosed;
    };

    const normalizedCategoryWords = (categoryFilterWords ?? [])
        .map((word) => String(word).trim().toLowerCase())
        .filter(Boolean);

    const passesCategoryFilter = (category) => {
        if (normalizedCategoryWords.length === 0) return true;
        if (!category) return false;
        const normalized = category.trim().toLowerCase();
        return normalizedCategoryWords.some((word) => normalized.includes(word));
    };

    return {
        passesRatingReviewFilters,
        passesWebsiteFilter,
        passesPhoneFilter,
        passesClosedFilter,
        passesCategoryFilter,
    };
};
