import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd());
const {
  RateLimiter,
  isTamilNaduState,
  resolveLocationTiered,
} = jiti('./src/lib/location/geocoder.ts');

const { normalizeKey } = jiti('./src/lib/location/tn-locations.ts');
const { prisma } = jiti('./src/lib/prisma.ts');

test('RateLimiter enforces minimum delay interval between executions', async () => {
  const minInterval = 60; // 60ms for fast test execution
  const limiter = new RateLimiter(minInterval);
  const timestamps = [];

  const task = async (id) => {
    timestamps.push(Date.now());
    return id;
  };

  const start = Date.now();
  const results = await Promise.all([
    limiter.enqueue(() => task(1)),
    limiter.enqueue(() => task(2)),
    limiter.enqueue(() => task(3)),
  ]);

  const totalTime = Date.now() - start;

  assert.deepEqual(results, [1, 2, 3], 'All queued tasks must return in order');
  assert.equal(timestamps.length, 3, 'All 3 tasks must have executed');
  
  // 3 tasks with 60ms interval means at least ~120ms total duration
  assert.ok(
    totalTime >= 100,
    `Total execution time (${totalTime}ms) should reflect serialized 60ms spacing (>= 100ms)`
  );

  const diff1 = timestamps[1] - timestamps[0];
  const diff2 = timestamps[2] - timestamps[1];
  assert.ok(diff1 >= 50, `Task 2 should wait at least ~50ms after Task 1 (was ${diff1}ms)`);
  assert.ok(diff2 >= 50, `Task 3 should wait at least ~50ms after Task 2 (was ${diff2}ms)`);
});

test('isTamilNaduState correctly recognizes Tamil Nadu & Puducherry', () => {
  const tnStates = [
    'Tamil Nadu',
    'Tamilnadu',
    'TAMIL NADU',
    'Puducherry',
    'Pondicherry',
    'State of Tamil Nadu',
  ];

  for (const s of tnStates) {
    assert.equal(isTamilNaduState(s), true, `"${s}" should be recognized as TN/Pondy`);
  }

  const otherStates = [
    'Karnataka',
    'Kerala',
    'Maharashtra',
    'Delhi',
    'Andhra Pradesh',
    '',
    null,
    undefined,
  ];

  for (const s of otherStates) {
    assert.equal(isTamilNaduState(s), false, `"${s}" should not be recognized as TN`);
  }
});

test('resolveLocationTiered: Tier 1 resolves from local dictionary without DB or external calls', async () => {
  const cbeResult = await resolveLocationTiered('Coimbatore', { skipExternal: true });
  assert.equal(cbeResult.matched, true);
  assert.equal(cbeResult.canonicalName, 'Coimbatore');
  assert.equal(cbeResult.district, 'Coimbatore');
  assert.equal(cbeResult.state, 'Tamil Nadu');
  assert.equal(cbeResult.source, 'dictionary');
  assert.equal(cbeResult.isTamilNadu, true);
  assert.ok(cbeResult.confidence >= 0.95);

  const pinResult = await resolveLocationTiered('641004', { skipExternal: true });
  assert.equal(pinResult.matched, true);
  assert.equal(pinResult.canonicalName, 'Coimbatore');
  assert.equal(pinResult.pincode, '641004');
  assert.equal(pinResult.source, 'dictionary');
  assert.equal(pinResult.isTamilNadu, true);
});

test('resolveLocationTiered: Tier 2 LocationCache persistence and retrieval', async () => {
  const testKey = 'test-unknown-town-xy123';
  
  // Clean up if exists
  await prisma.locationCache.deleteMany({
    where: { searchTerm: normalizeKey(testKey) },
  });

  // 1. Initially uncached and with skipExternal=true, should return none
  const miss = await resolveLocationTiered(testKey, { skipExternal: true });
  assert.equal(miss.matched, false);
  assert.equal(miss.source, 'none');

  // 2. Insert mock entry directly into database LocationCache
  await prisma.locationCache.create({
    data: {
      searchTerm: normalizeKey(testKey),
      canonicalName: 'Test Town XY',
      district: 'Tiruppur',
      state: 'Tamil Nadu',
      latitude: 11.1085,
      longitude: 77.3411,
      source: 'test',
    },
  });

  // 3. Re-query resolveLocationTiered; should hit Tier 2 (cache)
  const cachedHit = await resolveLocationTiered(testKey, { skipExternal: true });
  assert.equal(cachedHit.matched, true);
  assert.equal(cachedHit.source, 'cache');
  assert.equal(cachedHit.canonicalName, 'Test Town XY');
  assert.equal(cachedHit.district, 'Tiruppur');
  assert.equal(cachedHit.isTamilNadu, true);

  // Clean up
  await prisma.locationCache.deleteMany({
    where: { searchTerm: normalizeKey(testKey) },
  });
});

test('resolveLocationTiered: Out-of-state location cached correctly identifies isTamilNadu: false', async () => {
  const testOutOfStateKey = 'test-mysore-palace-999';

  await prisma.locationCache.deleteMany({
    where: { searchTerm: normalizeKey(testOutOfStateKey) },
  });

  await prisma.locationCache.create({
    data: {
      searchTerm: normalizeKey(testOutOfStateKey),
      canonicalName: 'Mysore',
      district: 'Mysuru',
      state: 'Karnataka',
      latitude: 12.2958,
      longitude: 76.6394,
      source: 'test',
    },
  });

  const res = await resolveLocationTiered(testOutOfStateKey, { skipExternal: true });
  assert.equal(res.matched, true);
  assert.equal(res.source, 'cache');
  assert.equal(res.state, 'Karnataka');
  assert.equal(res.isTamilNadu, false, 'Non-TN cached state must have isTamilNadu: false');

  await prisma.locationCache.deleteMany({
    where: { searchTerm: normalizeKey(testOutOfStateKey) },
  });
});
