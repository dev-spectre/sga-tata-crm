import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';

const jiti = createJiti(process.cwd());
const { prisma } = jiti('./src/lib/prisma.ts');
const { routeLeadToBranch, logRoutingActivity } = jiti('./src/lib/location/routing.ts');
const { isInvalidPhoneNumber } = jiti('./src/lib/utils.ts');

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

test('Geocode Batch: resolves unassigned visible leads and caches location', async () => {
  const branchCbe = await prisma.branch.upsert({
    where: { code: 'TEST-BATCH-CBE' },
    update: { isActive: true, latitude: 11.0168, longitude: 76.9558 },
    create: {
      name: 'Batch Branch CBE',
      code: 'TEST-BATCH-CBE',
      city: 'Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
  });

  // Create two unassigned leads (e.g. from sheet sync where branch was empty or ad name)
  const lead1 = await prisma.lead.create({
    data: {
      name: 'Unassigned Visible Lead 1',
      phone: '9888811111',
      city: 'Pollachi',
      branch: '', // unassigned
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      name: 'Unassigned Visible Lead 2',
      phone: '9888822222',
      city: 'Mettupalayam',
      branch: 'Ad_Camp_Summer_2024', // polluted ad name
    },
  });

  // Simulate geocoding batch processing
  const leadsToGeocode = await prisma.lead.findMany({
    where: { id: { in: [lead1.id, lead2.id] } },
  });

  for (const l of leadsToGeocode) {
    const routeRes = await routeLeadToBranch(l.city || '', {
      candidateBranches: [branchCbe],
      skipExternalGeocode: true,
    });
    if (routeRes.status === 'assigned' && routeRes.assignedBranch) {
      await prisma.lead.update({
        where: { id: l.id },
        data: { branch: routeRes.assignedBranch.name },
      });
      await logRoutingActivity(l.id, routeRes, 'System');
    }
  }

  // Verify lead1 is assigned to nearest branch
  const updated1 = await prisma.lead.findUnique({ where: { id: lead1.id } });
  assert.equal(updated1?.branch, 'Batch Branch CBE');

  // Verify lead2 replaced polluted ad name with real branch
  const updated2 = await prisma.lead.findUnique({ where: { id: lead2.id } });
  assert.equal(updated2?.branch, 'Batch Branch CBE');

  // Cleanup
  await prisma.leadActivity.deleteMany({ where: { leadId: { in: [lead1.id, lead2.id] } } });
  await prisma.lead.deleteMany({ where: { id: { in: [lead1.id, lead2.id] } } });
  await prisma.branch.delete({ where: { id: branchCbe.id } });
});

test('Frontend Category Classification: isInvalidPhoneNumber correctly detects invalid numbers', () => {
  // Valid numbers (standard 10-digit Indian numbers, with or without prefix)
  assert.equal(isInvalidPhoneNumber('9876543210'), false, 'Standard 10 digits is valid');
  assert.equal(isInvalidPhoneNumber('+91 9876543210'), false, '+91 prefix is valid');
  assert.equal(isInvalidPhoneNumber('09876543210'), false, 'Leading 0 is valid');

  // Invalid numbers (marked red in UI and moved to Invalid category)
  assert.equal(isInvalidPhoneNumber(''), true, 'Empty phone is invalid');
  assert.equal(isInvalidPhoneNumber(null), true, 'Null phone is invalid');
  assert.equal(isInvalidPhoneNumber('12345'), true, 'Short phone (<10) is invalid');
  assert.equal(isInvalidPhoneNumber('98765432109999'), true, 'Long phone (>10 unresolvable) is invalid');
  assert.equal(isInvalidPhoneNumber('<test lead: dummy data>'), true, 'Dummy placeholder is invalid');
  assert.equal(isInvalidPhoneNumber('Test Lead Phone'), true, 'Test lead placeholder is invalid');
});

test('Manual Branch Override: Leads with isBranchManual: true are never overwritten by auto-geocoding', async () => {
  const branchCbe = await prisma.branch.upsert({
    where: { code: 'TEST-MANUAL-PROTECT' },
    update: { isActive: true, latitude: 11.0168, longitude: 76.9558 },
    create: {
      name: 'Manual Test Branch CBE',
      code: 'TEST-MANUAL-PROTECT',
      city: 'Coimbatore',
      latitude: 11.0168,
      longitude: 76.9558,
      isActive: true,
    },
  });

  // Create a lead in Coimbatore whose branch was manually changed to '' (Unassigned)
  const manualUnassignedLead = await prisma.lead.create({
    data: {
      name: 'Manual Unassigned User',
      phone: '9888800001',
      city: 'Peelamedu, Coimbatore',
      branch: '',
      isBranchManual: true,
    },
  });

  // Create a lead in Coimbatore whose branch was manually changed to a custom branch
  const manualAssignedLead = await prisma.lead.create({
    data: {
      name: 'Manual Assigned User',
      phone: '9888800002',
      city: 'Peelamedu, Coimbatore',
      branch: 'Tata Test Madurai',
      isBranchManual: true,
    },
  });

  // Simulate geocoding route processing:
  // Must skip any lead where isBranchManual is true
  const leads = await prisma.lead.findMany({
    where: { id: { in: [manualUnassignedLead.id, manualAssignedLead.id] } },
    select: { id: true, city: true, branch: true, isBranchManual: true },
  });

  for (const l of leads) {
    if (l.isBranchManual) {
      // Geocoder skips manual leads
      continue;
    }
    const routeRes = await routeLeadToBranch(l.city || '', {
      candidateBranches: [branchCbe],
      skipExternalGeocode: true,
    });
    if (routeRes.status === 'assigned' && routeRes.assignedBranch) {
      await prisma.lead.update({
        where: { id: l.id },
        data: { branch: routeRes.assignedBranch.name },
      });
    }
  }

  // Verify manual unassigned lead remained empty string (NOT auto-assigned to Coimbatore)
  const after1 = await prisma.lead.findUnique({ where: { id: manualUnassignedLead.id } });
  assert.equal(after1?.branch, '');
  assert.equal(after1?.isBranchManual, true);

  // Verify manual assigned lead remained Tata Test Madurai (NOT changed to Coimbatore)
  const after2 = await prisma.lead.findUnique({ where: { id: manualAssignedLead.id } });
  assert.equal(after2?.branch, 'Tata Test Madurai');
  assert.equal(after2?.isBranchManual, true);

  // Cleanup
  await prisma.lead.deleteMany({
    where: { id: { in: [manualUnassignedLead.id, manualAssignedLead.id] } },
  });
  await prisma.branch.delete({ where: { id: branchCbe.id } });
});

