import assert from 'node:assert/strict';
import { buildPresenceFilter, buildRangeFilter } from '../src/filters.js';

// Presence filter
const withField = buildPresenceFilter('withField');
assert.equal(withField('x'), true);
assert.equal(withField(null), false);
const withoutField = buildPresenceFilter('withoutField');
assert.equal(withoutField(null), true);
assert.equal(buildPresenceFilter('all')(null), true);

// Range filter — lenient vs strict on missing values
const range = buildRangeFilter({ min: 10, max: 100 });
assert.equal(range(50), true);
assert.equal(range(5), false);
assert.equal(range(500), false);
assert.equal(range(null), true);                 // lenient: unknown passes
assert.equal(range(null, { strict: true }), false); // strict: unknown fails when bounds set

console.log('All unit tests passed.');
