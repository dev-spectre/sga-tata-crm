import { prisma } from '../src/lib/prisma';

export interface NewBranch {
  name: string;
  code: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  isActive: boolean;
}

export const NEW_BRANCHES: NewBranch[] = [
  {
    name: 'SGA Motors Singanallur',
    code: 'SGA-SINGANALLUR',
    address: 'SF No 413/2, Trichy Road, Thiyagi Shanmuga Nagar, Singanallur, Coimbatore, Tamil Nadu – 641005',
    city: 'Coimbatore',
    latitude: 10.998939,
    longitude: 77.021521,
    radiusKm: 50.0,
    isActive: true,
  },
  {
    name: 'SGA Motors Saravanampatti',
    code: 'SGA-SARAVANAMPATTI',
    address: 'SF No 149, Sathy Road, Saravanampatti Sub Post Office, Saravanampatti, Coimbatore, Tamil Nadu – 641035',
    city: 'Coimbatore',
    latitude: 11.070927,
    longitude: 77.002781,
    radiusKm: 50.0,
    isActive: true,
  },
  {
    name: 'SGA Motors Ooty',
    code: 'SGA-OOTY',
    address: 'No 258/B, Main, Ettines Rd, Near Main Ooty Bus Stand, Next St.Thomas Church, Ooty, Tamil Nadu – 643001',
    city: 'Ooty',
    latitude: 11.402056,
    longitude: 76.695972,
    radiusKm: 50.0,
    isActive: true,
  },
  {
    name: 'SGA Motors Udumalpet',
    code: 'SGA-UDUMALPET',
    address: 'No 5/B5B, Kannamanikanur Village, Lakshmi Nagar, Palani Road, Udumalaipettai, Tamil Nadu – 642126',
    city: 'Udumalaipettai',
    latitude: 10.577851,
    longitude: 77.276326,
    radiusKm: 50.0,
    isActive: true,
  },
  {
    name: 'SGA Motors Salem',
    code: 'SGA-SALEM',
    address: '96/1C, Junction Road, SDLOA Petrol Bunk, Kanthampatti, Salem, Tamil Nadu – 636005',
    city: 'Salem',
    latitude: 11.645180,
    longitude: 78.120601,
    radiusKm: 50.0,
    isActive: true,
  },
  {
    name: 'SGA Motors Mettur',
    code: 'SGA-METTUR',
    address: 'No 1/178, SVT Bharathi Petrol Bunk, Nattamangalam, Madayankuttai, Mettur, Salem, Tamil Nadu – 636452',
    city: 'Mettur',
    latitude: 11.759207,
    longitude: 77.790747,
    radiusKm: 50.0,
    isActive: true,
  },
  {
    name: 'SGA Motors Tiruchengode',
    code: 'SGA-TIRUCHENGODE',
    address: 'No 106, Pallipalayam Main Road, Rajagoundampalayam, Suriyampalayam (PO), Tiruchengode, Namakkal, Tamil Nadu – 637209',
    city: 'Tiruchengode',
    latitude: 11.374646,
    longitude: 77.879369,
    radiusKm: 50.0,
    isActive: true,
  },
];

async function updateBranches() {
  console.log('--- Starting Branch Replacement ---');

  // 1. Fetch and log existing branches before deletion
  const existingBranches = await prisma.branch.findMany();
  console.log(`Found ${existingBranches.length} existing branches to remove:`);
  for (const b of existingBranches) {
    console.log(`  - [ID: ${b.id}] ${b.name} (${b.code})`);
  }

  // 2. Delete all existing branches
  const deleteResult = await prisma.branch.deleteMany({});
  console.log(`Deleted ${deleteResult.count} branches from the database.`);

  // 3. Insert the 7 new verified SGA Motors branches
  console.log(`Inserting ${NEW_BRANCHES.length} new branches...`);
  for (const b of NEW_BRANCHES) {
    const created = await prisma.branch.create({
      data: {
        name: b.name,
        code: b.code,
        address: b.address,
        city: b.city,
        latitude: b.latitude,
        longitude: b.longitude,
        radiusKm: b.radiusKm,
        isActive: b.isActive,
      },
    });
    console.log(`  + Created branch: "${created.name}" (${created.code}) @ [${created.latitude}, ${created.longitude}]`);
  }

  // 4. Update leads previously referencing 'Coimbatore Singanallur' to 'SGA Motors Singanallur'
  const updatedSinganallurLeads = await prisma.lead.updateMany({
    where: { branch: 'Coimbatore Singanallur' },
    data: { branch: 'SGA Motors Singanallur' },
  });
  console.log(`Updated ${updatedSinganallurLeads.count} leads from 'Coimbatore Singanallur' to 'SGA Motors Singanallur'.`);

  // 5. Query and display current state
  const allBranches = await prisma.branch.findMany({ orderBy: { id: 'asc' } });
  console.log('\n--- Current Active Branches in DB ---');
  console.table(
    allBranches.map((b: any) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      city: b.city,
      lat: b.latitude,
      lon: b.longitude,
      radiusKm: b.radiusKm,
      isActive: b.isActive,
    }))
  );

  console.log('--- Branch Replacement Completed Successfully ---');
}

updateBranches()
  .catch((err) => {
    console.error('Failed to update branches:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
