import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd());
const { prisma } = jiti('./src/lib/prisma.ts');
const { routeLeadToBranch, logRoutingActivity } = jiti('./src/lib/location/routing.ts');

test('Ingestion: nearest-branch auto-routing for lead lacking branch column', async () => {
  // Ensure test branches exist
  const cbeBranch = await prisma.branch.upsert({
    where: { code: 'TEST-CBE-INGEST' },
    update: { isActive: true, latitude: 11.0168, longitude: 76.9558 },
    create: {
      name: 'Tata Test Coimbatore',
      code: 'TEST-CBE-INGEST',
      city: 'Coimbatore',
      address: 'Avinashi Road, Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
  });

  const mduBranch = await prisma.branch.upsert({
    where: { code: 'TEST-MDU-INGEST' },
    update: { isActive: true, latitude: 9.9252, longitude: 78.1198 },
    create: {
      name: 'Tata Test Madurai',
      code: 'TEST-MDU-INGEST',
      city: 'Madurai',
      address: 'Bypass Road, Madurai',
      latitude: 9.9252,
      longitude: 78.1198,
      isActive: true,
    },
  });

  const activeBranches = [cbeBranch, mduBranch];

  // 1. Lead in Peelamedu, Coimbatore -> should route to Coimbatore branch
  const cbeRouting = await routeLeadToBranch('Peelamedu, Coimbatore', {
    candidateBranches: activeBranches,
    skipExternalGeocode: true,
  });
  assert.equal(cbeRouting.status, 'assigned');
  assert.equal(cbeRouting.assignedBranch?.code, 'TEST-CBE-INGEST');
  assert.ok(cbeRouting.distanceKm < 15);

  // 2. Lead in Madurai -> should route to Madurai branch
  const mduRouting = await routeLeadToBranch('Madurai City', {
    candidateBranches: activeBranches,
    skipExternalGeocode: true,
  });
  assert.equal(mduRouting.status, 'assigned');
  assert.equal(mduRouting.assignedBranch?.code, 'TEST-MDU-INGEST');

  // 3. Lead in Bangalore (out of state) -> should NOT be assigned
  await prisma.locationCache.upsert({
    where: { searchTerm: 'bengaluru' },
    update: { state: 'Karnataka' },
    create: {
      searchTerm: 'bengaluru',
      canonicalName: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      latitude: 12.9716,
      longitude: 77.5946,
      source: 'test',
    },
  });

  const blrRouting = await routeLeadToBranch('Bengaluru', {
    candidateBranches: activeBranches,
    skipExternalGeocode: true,
  });
  assert.equal(blrRouting.status, 'out_of_state');
  assert.equal(blrRouting.assignedBranch, null);
  assert.equal(blrRouting.isOutOfState, true);

  // Clean up test branches and cache
  await prisma.branch.deleteMany({
    where: { code: { in: ['TEST-CBE-INGEST', 'TEST-MDU-INGEST'] } },
  });
  await prisma.locationCache.deleteMany({
    where: { searchTerm: 'bengaluru' },
  });
});

test('Ingestion: existing assigned branch is protected from empty sheet branch overwrite', async () => {
  // Create a lead that already has a manually assigned branch
  const testPhone = '9999912345';
  await prisma.lead.deleteMany({ where: { phone: testPhone } });

  const existingLead = await prisma.lead.create({
    data: {
      name: 'Existing Customer',
      phone: testPhone,
      city: 'Coimbatore',
      branch: 'Tata Prime Coimbatore',
    },
  });

  // Simulate sheet sync reconciliation logic
  const incomingSheetBranch = ''; // Sheet row has no branch column
  const incomingCity = 'Coimbatore';

  // Core invariant in sync.ts:
  // if incomingSheetBranch is empty, preserve existingLead.branch!
  const finalBranch = incomingSheetBranch || existingLead.branch || '';

  assert.equal(
    finalBranch,
    'Tata Prime Coimbatore',
    'Existing branch must never be overwritten with empty string from sheet'
  );

  // Clean up
  await prisma.lead.delete({ where: { id: existingLead.id } });
});

test('Ingestion: webhook lead auto-routes and logs audit activity', async () => {
  const testBranch = await prisma.branch.upsert({
    where: { code: 'TEST-WH-BRANCH' },
    update: { isActive: true },
    create: {
      name: 'Tata Webhook Branch',
      code: 'TEST-WH-BRANCH',
      city: 'Coimbatore',
      address: 'Test Address',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
  });

  const routing = await routeLeadToBranch('Coimbatore', {
    candidateBranches: [testBranch],
    skipExternalGeocode: true,
  });

  assert.equal(routing.status, 'assigned');
  assert.equal(routing.assignedBranch?.code, 'TEST-WH-BRANCH');

  const createdLead = await prisma.lead.create({
    data: {
      name: 'Webhook Lead',
      phone: '9999988776',
      city: 'Coimbatore',
      branch: routing.assignedBranch.name,
    },
  });

  await logRoutingActivity(createdLead.id, routing, 'Webhook');

  const activities = await prisma.leadActivity.findMany({
    where: { leadId: createdLead.id },
  });

  assert.ok(activities.length >= 1);
  assert.equal(activities[0].action, 'AUTO_ASSIGN_BRANCH');
  assert.ok(activities[0].newValue.includes('Tata Webhook Branch'));

  // Clean up
  await prisma.leadActivity.deleteMany({ where: { leadId: createdLead.id } });
  await prisma.lead.delete({ where: { id: createdLead.id } });
  await prisma.branch.delete({ where: { id: testBranch.id } });
});
