/**
 * Pure helpers for parsing Google Maps data and applying listing filters.
 * Kept free of Crawlee/Playwright imports so they can be unit-tested directly.
 */

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
 * Builds the filter predicates from the actor input.
 *
 * `passesRatingReviewFilters` returns false only when the listing is KNOWN to
 * fail a filter — unknown values pass so the place page can decide. With
 * `strict: true` (final check on the place page), missing values are treated
 * as failing when the corresponding filter is set.
 */
export const buildFilters = ({ minReviews, maxReviews, minRating, maxRating, websiteFilter }) => {
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
        return true;
    };

    return { passesRatingReviewFilters, passesWebsiteFilter };
};
