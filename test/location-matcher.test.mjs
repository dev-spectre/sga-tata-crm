import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd());
const {
  resolveLocation,
  normalizeString,
  extractPincode,
  damerauLevenshtein,
} = jiti('./src/lib/location/matcher.ts');

test('Category A: Exact District and City Queries', () => {
  const cases = [
    { query: 'Chennai', expectedCity: 'Chennai', expectedDist: 'Chennai' },
    { query: 'Coimbatore', expectedCity: 'Coimbatore', expectedDist: 'Coimbatore' },
    { query: 'Madurai', expectedCity: 'Madurai', expectedDist: 'Madurai' },
    { query: 'Tiruchirappalli', expectedCity: 'Tiruchirappalli', expectedDist: 'Tiruchirappalli' },
    { query: 'Salem', expectedCity: 'Salem', expectedDist: 'Salem' },
    { query: 'Tiruppur', expectedCity: 'Tiruppur', expectedDist: 'Tiruppur' },
    { query: 'Erode', expectedCity: 'Erode', expectedDist: 'Erode' },
    { query: 'Tirunelveli', expectedCity: 'Tirunelveli', expectedDist: 'Tirunelveli' },
    { query: 'Vellore', expectedCity: 'Vellore', expectedDist: 'Vellore' },
    { query: 'Thanjavur', expectedCity: 'Thanjavur', expectedDist: 'Thanjavur' },
    { query: 'Dindigul', expectedCity: 'Dindigul', expectedDist: 'Dindigul' },
    { query: 'Kanchipuram', expectedCity: 'Kanchipuram', expectedDist: 'Kanchipuram' },
    { query: 'Nagercoil', expectedCity: 'Nagercoil', expectedDist: 'Kanyakumari' },
    { query: 'Hosur', expectedCity: 'Hosur', expectedDist: 'Krishnagiri' },
    { query: 'Pollachi', expectedCity: 'Pollachi', expectedDist: 'Coimbatore' },
  ];

  for (const { query, expectedCity, expectedDist } of cases) {
    const result = resolveLocation(query);
    assert.equal(result.matched, true, `Query "${query}" should match`);
    assert.equal(result.canonicalName, expectedCity, `Query "${query}" should resolve to city ${expectedCity}`);
    assert.equal(result.district, expectedDist, `Query "${query}" should resolve to district ${expectedDist}`);
    assert.ok(result.latitude > 8 && result.latitude < 14, `Valid latitude for ${query}`);
    assert.ok(result.longitude > 76 && result.longitude < 81, `Valid longitude for ${query}`);
    assert.ok(result.confidence >= 0.95, `High confidence for exact match`);
  }
});

test('Category B: Colloquial Aliases & Acronyms', () => {
  const cases = [
    { alias: 'cbe', expected: 'Coimbatore' },
    { alias: 'kovai', expected: 'Coimbatore' },
    { alias: 'trichy', expected: 'Tiruchirappalli' },
    { alias: 'tiruchi', expected: 'Tiruchirappalli' },
    { alias: 'mdu', expected: 'Madurai' },
    { alias: 'ooty', expected: 'Udhagamandalam' },
    { alias: 'udhagai', expected: 'Udhagamandalam' },
    { alias: 'nellai', expected: 'Tirunelveli' },
    { alias: 'tvl', expected: 'Tirunelveli' },
    { alias: 'mtp', expected: 'Mettupalayam' },
    { alias: 'hsr', expected: 'Hosur' },
    { alias: 'slm', expected: 'Salem' },
    { alias: 'tpr', expected: 'Tiruppur' },
    { alias: 'erd', expected: 'Erode' },
    { alias: 'ngl', expected: 'Nagercoil' },
    { alias: 'plni', expected: 'Palani' },
    { alias: 'madras', expected: 'Chennai' },
    { alias: 'gobi', expected: 'Gobichettipalayam' },
    { alias: 'sathy', expected: 'Sathyamangalam' },
  ];

  for (const { alias, expected } of cases) {
    const result = resolveLocation(alias);
    assert.equal(result.matched, true, `Alias "${alias}" should match`);
    assert.equal(result.canonicalName, expected, `Alias "${alias}" should map to "${expected}"`);
    assert.ok(result.confidence >= 0.85, `Confidence for alias "${alias}" should be >= 0.85`);
  }
});

test('Category C: Spelling Typos & Phonetic Variations', () => {
  const cases = [
    { typo: 'Madurei', expected: 'Madurai' },
    { typo: 'Coimbator', expected: 'Coimbatore' },
    { typo: 'Tirupur', expected: 'Tiruppur' },
    { typo: 'Selam', expected: 'Salem' },
    { typo: 'Vellor', expected: 'Vellore' },
    { typo: 'Chenai', expected: 'Chennai' },
    { typo: 'Trichii', expected: 'Tiruchirappalli' },
    { typo: 'Polachi', expected: 'Pollachi' },
    { typo: 'Pazhani', expected: 'Palani' },
    { typo: 'Kumbakonum', expected: 'Kumbakonam' },
    { typo: 'Nagercoile', expected: 'Nagercoil' },
  ];

  for (const { typo, expected } of cases) {
    const result = resolveLocation(typo);
    assert.equal(result.matched, true, `Typo "${typo}" should match`);
    assert.equal(result.canonicalName, expected, `Typo "${typo}" should resolve to "${expected}"`);
    assert.ok(result.confidence >= 0.75, `Confidence for "${typo}" should be >= 0.75`);
  }
});

test('Category D: Tamil Nadu Postal Pincodes', () => {
  const cases = [
    { pin: '641004', expected: 'Coimbatore' }, // Peelamedu
    { pin: '600028', expected: 'Chennai' }, // RA Puram
    { pin: '625001', expected: 'Madurai' },
    { pin: '620001', expected: 'Tiruchirappalli' },
    { pin: '636001', expected: 'Salem' },
    { pin: '641601', expected: 'Tiruppur' },
    { pin: '638001', expected: 'Erode' },
    { pin: '635109', expected: 'Hosur' },
    { pin: '643001', expected: 'Udhagamandalam' },
    { pin: '642001', expected: 'Pollachi' },
    { pin: '641301', expected: 'Mettupalayam' },
  ];

  for (const { pin, expected } of cases) {
    const result = resolveLocation(pin);
    assert.equal(result.matched, true, `Pincode "${pin}" should match`);
    assert.equal(result.canonicalName, expected, `Pincode "${pin}" should resolve to "${expected}"`);
    assert.equal(result.matchType, 'pincode');
    assert.equal(result.confidence, 1.0);
  }
});

test('Category E: Compound & Messy Address Strings', () => {
  const cases = [
    {
      query: 'Near Gandhipuram Bus Stand, CBE',
      expectedCity: 'Gandhipuram',
      expectedDist: 'Coimbatore',
    },
    {
      query: 'Peelamedu, Coimbatore - 641004',
      expectedCity: 'Coimbatore',
      expectedDist: 'Coimbatore',
    },
    {
      query: 'Saravanampatti IT Corridor, Kovai',
      expectedCity: 'Saravanampatti',
      expectedDist: 'Coimbatore',
    },
    {
      query: 'Thillai Nagar, Trichy City',
      expectedCity: 'Tiruchirappalli',
      expectedDist: 'Tiruchirappalli',
    },
  ];

  for (const { query, expectedCity, expectedDist } of cases) {
    const result = resolveLocation(query);
    assert.equal(result.matched, true, `Composite query "${query}" should match`);
    assert.equal(result.canonicalName, expectedCity, `Should match expected city`);
    assert.equal(result.district, expectedDist, `Should match expected district`);
  }
});

test('Category F: Out-of-State / Non-Tamil Nadu Queries (Rejection Fence)', () => {
  const outOfStateQueries = [
    'Bangalore',
    'Bengaluru',
    'Kochi',
    'Cochin',
    'Hyderabad',
    'Delhi',
    'Mumbai',
    'Trivandrum',
    'Kolkata',
    'Unknown Place 123',
    '',
    '   ',
  ];

  for (const query of outOfStateQueries) {
    const result = resolveLocation(query);
    assert.equal(result.matched, false, `Out-of-state query "${query}" must return matched: false`);
    assert.equal(result.matchType, 'none');
    assert.equal(result.confidence, 0);
  }
});

test('Category G: Latency Benchmark (<5ms SLA requirement)', () => {
  const testQueries = [
    'cbe',
    'Madurei',
    '641004',
    'Near Gandhipuram Bus Stand, CBE',
    'Tirupur',
    'Selam',
    'Chennai',
    'Bangalore',
    'Hosur auto hub',
    'ooty',
  ];

  const ITERATIONS = 1000;
  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const q = testQueries[i % testQueries.length];
    resolveLocation(q);
  }

  const totalDurationMs = performance.now() - start;
  const avgLatencyMs = totalDurationMs / ITERATIONS;

  console.log(
    `\n  Benchmark Result: ${ITERATIONS} queries executed in ${totalDurationMs.toFixed(2)}ms ` +
      `(${avgLatencyMs.toFixed(3)}ms / lookup)\n`
  );

  assert.ok(
    avgLatencyMs < 5.0,
    `Average latency must be strictly under 5.0ms (actual: ${avgLatencyMs.toFixed(3)}ms)`
  );
  // In practice, pure V8 execution will be under 0.2ms
  assert.ok(
    avgLatencyMs < 1.0,
    `Average latency is ultra-fast under 1.0ms (actual: ${avgLatencyMs.toFixed(3)}ms)`
  );
});
