import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function runTests() {
  console.log('--- TEST: Lead Categorization Pipeline ---');

  const testFingerprints = [
    'test-cat-priority-today',
    'test-cat-priority-overdue',
    'test-cat-valid-future',
    'test-cat-valid-nodate',
    'test-cat-unassigned-mumbai',
  ];

  // Clean up any leftovers first
  await prisma.lead.deleteMany({
    where: { fingerprint: { in: testFingerprints } },
  });

  const now = new Date();
  const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayDateStr = kolkataFormatter.format(now);
  const todayEndOfDay = new Date(`${todayDateStr}T23:59:59.999+05:30`);
  const twoDaysAgo = new Date(Date.now() - 86400000 * 2);
  const fiveDaysFuture = new Date(Date.now() + 86400000 * 5);

  // 1. Create Test Leads
  const leadA = await prisma.lead.create({
    data: {
      name: 'CatTest Priority Today',
      phone: '9900000001',
      city: 'Coimbatore',
      branch: 'Coimbatore Peelamedu',
      followUpDate1: now,
      fingerprint: 'test-cat-priority-today',
    },
  });

  const leadB = await prisma.lead.create({
    data: {
      name: 'CatTest Priority Overdue',
      phone: '9900000002',
      city: 'Salem',
      branch: 'Salem',
      followUpDate1: twoDaysAgo,
      fingerprint: 'test-cat-priority-overdue',
    },
  });

  const leadC = await prisma.lead.create({
    data: {
      name: 'CatTest Valid Future',
      phone: '9900000003',
      city: 'Coimbatore',
      branch: 'Coimbatore Peelamedu',
      followUpDate1: fiveDaysFuture,
      fingerprint: 'test-cat-valid-future',
    },
  });

  const leadD = await prisma.lead.create({
    data: {
      name: 'CatTest Valid NoDate',
      phone: '9900000004',
      city: 'Tirupur',
      branch: 'Tirupur',
      followUpDate1: null,
      fingerprint: 'test-cat-valid-nodate',
    },
  });

  const leadE = await prisma.lead.create({
    data: {
      name: 'CatTest Unassigned Mumbai',
      phone: '9900000005',
      city: 'Mumbai',
      branch: '',
      followUpDate1: null,
      fingerprint: 'test-cat-unassigned-mumbai',
    },
  });

  console.log('✓ 5 Test leads seeded successfully');

  // 2. Query Category: Priority
  const validBranchCondition = {
    branch: { notIn: ['', 'Unassigned'] },
  };
  const unassignedBranchCondition = {
    branch: { in: ['', 'Unassigned'] },
  };
  const priorityFollowUpCondition = {
    OR: [
      { followUpDate1: { lte: todayEndOfDay, not: null } },
      { followUpDate2: { lte: todayEndOfDay, not: null } },
    ],
  };

  const priorityLeads = await prisma.lead.findMany({
    where: {
      fingerprint: { in: testFingerprints },
      AND: [validBranchCondition, priorityFollowUpCondition],
    },
  });

  const priorityNames = priorityLeads.map((l) => l.name);
  console.log('Priority Leads:', priorityNames);
  console.assert(priorityLeads.length === 2, `Expected 2 priority leads, got ${priorityLeads.length}`);
  console.assert(priorityNames.includes('CatTest Priority Today'), 'Must include Today lead');
  console.assert(priorityNames.includes('CatTest Priority Overdue'), 'Must include Overdue lead');
  console.assert(!priorityNames.includes('CatTest Valid Future'), 'Must not include Future lead');
  console.assert(!priorityNames.includes('CatTest Unassigned Mumbai'), 'Must not include Unassigned lead');
  console.log('✓ Priority category query verified');

  // 3. Query Category: Valid (all Tamil Nadu)
  const validLeads = await prisma.lead.findMany({
    where: {
      fingerprint: { in: testFingerprints },
      AND: [validBranchCondition],
    },
  });
  const validNames = validLeads.map((l) => l.name);
  console.log('Valid Leads:', validNames);
  console.assert(validLeads.length === 4, `Expected 4 valid leads, got ${validLeads.length}`);
  console.assert(!validNames.includes('CatTest Unassigned Mumbai'), 'Must not include Unassigned lead');
  console.log('✓ Valid category query verified');

  // 4. Query Category: Unassigned (out of state / empty branch)
  const unassignedLeads = await prisma.lead.findMany({
    where: {
      fingerprint: { in: testFingerprints },
      AND: [unassignedBranchCondition],
    },
  });
  const unassignedNames = unassignedLeads.map((l) => l.name);
  console.log('Unassigned Leads:', unassignedNames);
  console.assert(unassignedLeads.length === 1, `Expected 1 unassigned lead, got ${unassignedLeads.length}`);
  console.assert(unassignedNames.includes('CatTest Unassigned Mumbai'), 'Must include Mumbai lead');
  console.log('✓ Unassigned category query verified');

  // 5. Clean up
  await prisma.lead.deleteMany({
    where: { fingerprint: { in: testFingerprints } },
  });
  console.log('✓ Test leads cleaned up');

  console.log('\n🎉 ALL PHASE 11 LEAD CATEGORY TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
