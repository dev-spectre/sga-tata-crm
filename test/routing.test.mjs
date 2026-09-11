import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd());
const {
  calculateHaversineDistance,
  findNearestBranch,
  routeLeadToBranch,
  logRoutingActivity,
} = jiti('./src/lib/location/routing.ts');

const { prisma } = jiti('./src/lib/prisma.ts');

test('calculateHaversineDistance: accurately calculates geodesic distances', () => {
  // Distance from coordinate to itself must be 0
  const zeroDist = calculateHaversineDistance(11.0168, 76.9558, 11.0168, 76.9558);
  assert.equal(zeroDist, 0);

  // Coimbatore (11.0168, 76.9558) to Tiruppur (11.1085, 77.3411) ~ 43-45 km
  const cbeToTpr = calculateHaversineDistance(11.0168, 76.9558, 11.1085, 77.3411);
  assert.ok(
    cbeToTpr >= 42 && cbeToTpr <= 46,
    `Coimbatore to Tiruppur distance should be ~44 km (was ${cbeToTpr} km)`
  );

  // Chennai (13.0827, 80.2707) to Madurai (9.9252, 78.1198) ~ 415-425 km
  const cheToMdu = calculateHaversineDistance(13.0827, 80.2707, 9.9252, 78.1198);
  assert.ok(
    cheToMdu >= 415 && cheToMdu <= 430,
    `Chennai to Madurai distance should be ~420 km (was ${cheToMdu} km)`
  );
});

test('findNearestBranch: selects geographically closest active branch', async () => {
  const branches = [
    {
      id: 1,
      name: 'Tata Coimbatore Central',
      code: 'CBE-01',
      city: 'Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
    {
      id: 2,
      name: 'Tata Tiruppur Hub',
      code: 'TPR-01',
      city: 'Tiruppur',
      latitude: 11.1085,
      longitude: 77.3411,
      isActive: true,
    },
    {
      id: 3,
      name: 'Tata Chennai Anna Nagar',
      code: 'CHE-01',
      city: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2707,
      isActive: true,
    },
  ];

  // Lead in Peelamedu, Coimbatore (11.0267, 77.0097)
  const peelameduRes = await findNearestBranch(11.0267, 77.0097, branches);
  assert.ok(peelameduRes.nearestBranch);
  assert.equal(peelameduRes.nearestBranch.code, 'CBE-01');
  assert.ok(peelameduRes.distanceKm < 10, 'Peelamedu should be <10km from Coimbatore branch');

  // Lead in Avadi, Chennai (13.1147, 80.1018)
  const avadiRes = await findNearestBranch(13.1147, 80.1018, branches);
  assert.ok(avadiRes.nearestBranch);
  assert.equal(avadiRes.nearestBranch.code, 'CHE-01');
  assert.ok(avadiRes.distanceKm < 25, 'Avadi should be <25km from Chennai branch');
});

test('findNearestBranch: skips inactive branches', async () => {
  const branches = [
    {
      id: 1,
      name: 'Tata Coimbatore Paused',
      code: 'CBE-PAUSED',
      city: 'Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: false, // PAUSED / INACTIVE
    },
    {
      id: 2,
      name: 'Tata Tiruppur Active Hub',
      code: 'TPR-ACTIVE',
      city: 'Tiruppur',
      latitude: 11.1085,
      longitude: 77.3411,
      isActive: true,
    },
  ];

  // Lead in Coimbatore center (11.0168, 76.9558)
  // Since CBE branch is inactive, it MUST skip CBE and route to Tiruppur (~44 km)
  const res = await findNearestBranch(11.0168, 76.9558, branches);
  assert.ok(res.nearestBranch);
  assert.equal(res.nearestBranch.code, 'TPR-ACTIVE');
  assert.ok(res.distanceKm > 40 && res.distanceKm < 50);
});

test('routeLeadToBranch: full flow with dictionary resolution and nearest branch assignment', async () => {
  const branches = [
    {
      id: 1,
      name: 'Tata Coimbatore Main',
      code: 'CBE-01',
      city: 'Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
    {
      id: 2,
      name: 'Tata Madurai South',
      code: 'MDU-01',
      city: 'Madurai',
      latitude: 9.9252,
      longitude: 78.1198,
      isActive: true,
    },
  ];

  // Query resolving via dictionary to Madurai
  const mduRes = await routeLeadToBranch('Madurei', {
    candidateBranches: branches,
    skipExternalGeocode: true,
  });
  assert.equal(mduRes.status, 'assigned');
  assert.equal(mduRes.isOutOfState, false);
  assert.ok(mduRes.assignedBranch);
  assert.equal(mduRes.assignedBranch.code, 'MDU-01');
  assert.ok(mduRes.distanceKm < 10);

  // Query resolving via pincode to Coimbatore
  const pinRes = await routeLeadToBranch('641004', {
    candidateBranches: branches,
    skipExternalGeocode: true,
  });
  assert.equal(pinRes.status, 'assigned');
  assert.equal(pinRes.assignedBranch.code, 'CBE-01');
});

test('routeLeadToBranch: strict out-of-state fence rejects non-TN locations', async () => {
  const branches = [
    {
      id: 1,
      name: 'Tata Hosur Border Branch',
      code: 'HSR-01',
      city: 'Hosur',
      latitude: 12.7409,
      longitude: 77.8253,
      isActive: true,
    },
  ];

  // Bangalore is in Karnataka. It must NOT be assigned to Hosur even if Hosur is close!
  // Mock cache with Bangalore to test the out-of-state boundary in router
  await prisma.locationCache.deleteMany({
    where: { searchTerm: 'bengalurukarnataka' },
  });

  await prisma.locationCache.create({
    data: {
      searchTerm: 'bengalurukarnataka',
      canonicalName: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      latitude: 12.9716,
      longitude: 77.5946,
      source: 'test',
    },
  });

  const res = await routeLeadToBranch('Bengaluru Karnataka', {
    candidateBranches: branches,
    skipExternalGeocode: true,
  });

  assert.equal(res.status, 'out_of_state');
  assert.equal(res.isOutOfState, true);
  assert.equal(res.assignedBranch, null);
  assert.ok(res.reason.includes('outside Tamil Nadu'));

  await prisma.locationCache.deleteMany({
    where: { searchTerm: 'bengalurukarnataka' },
  });
});

test('routeLeadToBranch: unresolvable string returns unassigned status', async () => {
  const branches = [
    {
      id: 1,
      name: 'Tata Coimbatore Main',
      code: 'CBE-01',
      city: 'Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
  ];

  const res = await routeLeadToBranch('randomxyzunresolvable999', {
    candidateBranches: branches,
    skipExternalGeocode: true,
  });

  assert.equal(res.status, 'unresolved');
  assert.equal(res.isUnresolved, true);
  assert.equal(res.assignedBranch, null);
  assert.equal(res.distanceKm, null);
});

test('logRoutingActivity: creates audit record in prisma.leadActivity', async () => {
  // Create a temporary lead
  const testLead = await prisma.lead.create({
    data: {
      name: 'Test Routing Lead',
      phone: '9999900001',
      city: 'Coimbatore',
    },
  });

  const mockResult = {
    assignedBranch: {
      id: 999,
      name: 'Tata Test Branch',
      code: 'TST-01',
      city: 'Coimbatore',
      latitude: 11.0,
      longitude: 77.0,
      isActive: true,
    },
    distanceKm: 4.25,
    resolvedLocation: {
      query: 'Coimbatore',
      canonicalName: 'Coimbatore',
      district: 'Coimbatore',
      state: 'Tamil Nadu',
      latitude: 11.0168,
      longitude: 76.9558,
      source: 'dictionary',
    },
    isOutOfState: false,
    isUnresolved: false,
    status: 'assigned',
    reason: 'Assigned to Tata Test Branch (4.25 km away via dictionary)',
  };

  await logRoutingActivity(testLead.id, mockResult);

  // Verify activity record exists
  const activities = await prisma.leadActivity.findMany({
    where: { leadId: testLead.id },
  });

  assert.ok(activities.length >= 1, 'Activity record must be created');
  const lastActivity = activities[activities.length - 1];
  assert.equal(lastActivity.action, 'AUTO_ASSIGN_BRANCH');
  assert.ok(lastActivity.newValue.includes('Tata Test Branch'));
  assert.ok(lastActivity.newValue.includes('4.25 km'));

  // Clean up
  await prisma.leadActivity.deleteMany({ where: { leadId: testLead.id } });
  await prisma.lead.delete({ where: { id: testLead.id } });
});
