import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getSheetData } from '@/lib/google';
import { parsePhoneNumber, sanitizeField, parseSheetStatus } from '@/lib/utils';
import { isSuperAdminUser } from '@/lib/activity';
import { getCachedSettings } from '@/lib/settings';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.isSuperAdmin);
    if (!currentUser || (!currentUser.allowExternalUpload && !isAdmin)) {
      return NextResponse.json({ error: 'Unauthorized. You do not have permission to upload external data.' }, { status: 403 });
    }

    const body = await request.json();
    const { spreadsheetId, sheetName, rows: directRows, mapping: userMapping, defaultPlatform } = body;

    let rows: (string | number)[][] = [];

    if (Array.isArray(directRows) && directRows.length > 0) {
      // Direct rows uploaded via Excel/CSV
      rows = directRows;
    } else if (spreadsheetId && sheetName) {
      // Google Sheet mode
      let cleanId = String(spreadsheetId).trim();
      const urlMatch = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        cleanId = urlMatch[1];
      }

      const settings = await getCachedSettings();
      if (!settings?.googleAccessToken) {
        return NextResponse.json({ error: 'Google account not linked. Please connect Google in Settings or upload an Excel/CSV file instead.' }, { status: 400 });
      }

      rows = await getSheetData(cleanId, sheetName);
    } else {
      return NextResponse.json({ error: 'Please provide either a Google Sheet or upload an Excel/CSV file.' }, { status: 400 });
    }

    if (!rows || rows.length <= 1) {
      return NextResponse.json({ error: 'No data rows found to process.' }, { status: 400 });
    }

    const mapping = {
      name: userMapping?.name ?? 0,
      phone: userMapping?.phone ?? 1,
      city: userMapping?.city ?? 2,
      createdAt: userMapping?.createdAt ?? 3,
      remark: userMapping?.remark ?? 4,
      status: userMapping?.status ?? 5,
      adname: userMapping?.adname ?? 6,
      branch: userMapping?.branch ?? -1,
      followUpDate1: userMapping?.followUpDate1 ?? 8,
      followUpDate2: userMapping?.followUpDate2 ?? 9,
      platform: userMapping?.platform ?? 10,
      assignedConsultant: userMapping?.assignedConsultant ?? -1,
      testDrive: userMapping?.testDrive ?? -1,
    };

    const dataRows = rows.slice(1);
    let synced = 0;
    let skipped = 0;

    const getVal = (row: (string | number)[], colIndex: number | undefined): string => {
      if (colIndex === undefined || colIndex === null || colIndex < 0 || colIndex >= row.length) {
        return '';
      }
      return String(row[colIndex] ?? '').trim();
    };

    // Pre-extract candidate phones and fingerprints to query only matching subset from DB
    const candidatePhones = new Set<string>();
    const candidateFingerprints = new Set<string>();
    const fpCounts = new Map<string, number>();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rawPhone = getVal(row, mapping.phone);
      const cleanPhone = parsePhoneNumber(rawPhone);
      if (cleanPhone) candidatePhones.add(cleanPhone);

      const rawCreatedAt = getVal(row, mapping.createdAt);
      const baseFp = `${cleanPhone}|${rawCreatedAt}`;
      const cnt = fpCounts.get(baseFp) || 0;
      fpCounts.set(baseFp, cnt + 1);
      candidateFingerprints.add(`${baseFp}|${cnt}`);
    }

    const orConditions: any[] = [];
    if (candidatePhones.size > 0) {
      orConditions.push({ phone: { in: Array.from(candidatePhones) } });
    }
    if (candidateFingerprints.size > 0) {
      orConditions.push({ fingerprint: { in: Array.from(candidateFingerprints) } });
    }

    const existingLeads = orConditions.length > 0
      ? await prisma.lead.findMany({
          where: { OR: orConditions },
          select: { id: true, fingerprint: true, phone: true },
        })
      : [];

    const existingByFingerprint = new Map<string, number>();
    const existingByPhone = new Map<string, number>();

    for (const lead of existingLeads) {
      if (lead.fingerprint) existingByFingerprint.set(lead.fingerprint, lead.id);
      const cleanPhone = parsePhoneNumber(lead.phone);
      if (cleanPhone) existingByPhone.set(cleanPhone, lead.id);
    }

    const toCreate: any[] = [];
    const seenPhonesInSheet = new Set<string>();

    let uploaderDbId: number | null = currentUser.userId > 0 ? currentUser.userId : null;
    if (!uploaderDbId) {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: currentUser.username, mode: 'insensitive' } },
            { role: 'ADMIN' }
          ]
        },
        select: { id: true }
      });
      if (dbUser) {
        uploaderDbId = dbUser.id;
      }
    }

    // Pre-fetch active branches once to validate incoming branch
    let activeBranches: { name: string; code?: string | null }[] = [];
    try {
      activeBranches = await prisma.branch.findMany({
        where: { isActive: true },
        select: {
          name: true,
          code: true,
        },
      });
    } catch (err) {
      console.error('Failed to pre-fetch active branches in external upload:', err);
    }

    const activeBranchLookup = new Map<string, string>();
    activeBranches.forEach((b) => {
      if (b.name) activeBranchLookup.set(b.name.toLowerCase().trim(), b.name);
      if (b.code) activeBranchLookup.set(b.code.toLowerCase().trim(), b.name);
    });

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];

      const rawName = getVal(row, mapping.name);
      const rawPhone = getVal(row, mapping.phone);

      const name = sanitizeField(rawName);
      const phone = parsePhoneNumber(rawPhone);

      if (!phone) {
        skipped++;
        continue;
      }

      if (seenPhonesInSheet.has(phone)) {
        skipped++;
        continue;
      }
      seenPhonesInSheet.add(phone);

      const cleanCity = sanitizeField(getVal(row, mapping.city));
      const fingerprint = `${name.toLowerCase()}|${phone}|${cleanCity.toLowerCase()}`;

      if (existingByFingerprint.has(fingerprint) || existingByPhone.has(phone)) {
        skipped++;
        continue;
      }

      // Platform assignment
      const rawPlatform = getVal(row, mapping.platform);
      let mappedPlatform = sanitizeField(rawPlatform);
      if (mappedPlatform) {
        mappedPlatform = mappedPlatform.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
        const isDateStr = /^\d{4}-\d{2}-\d{2}$/.test(mappedPlatform) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(mappedPlatform) || (!isNaN(Date.parse(mappedPlatform)) && (mappedPlatform.includes('-') || mappedPlatform.includes('/')));
        if (isDateStr) {
          mappedPlatform = '';
        }
      }
      const cleanDefaultPlatform = defaultPlatform ? sanitizeField(defaultPlatform) : '';
      const assignedPlatform = mappedPlatform || cleanDefaultPlatform || currentUser.assignedPlatform || 'Unknown';
      const uploadedById = uploaderDbId;

      // Status mapping
      const rawStatus = getVal(row, mapping.status);
      const status = parseSheetStatus(rawStatus);

      // Test drive mapping
      const rawTd = getVal(row, mapping.testDrive).toLowerCase();
      let testDrive: string | null = null;
      if (rawTd === 'scheduled') testDrive = 'Scheduled';
      else if (rawTd === 'completed' || rawTd === 'taken' || rawTd === 'done') testDrive = 'Completed';
      else if (rawTd === 'cancelled' || rawTd === 'canceled') testDrive = 'Cancelled';
      else if (rawTd === 'yes' || rawTd === 'y' || rawTd === 'true') testDrive = 'Scheduled';
      else if (rawTd === 'no' || rawTd === 'n' || rawTd === 'false' || rawTd === 'not scheduled') testDrive = 'Not Scheduled';
      else if (rawTd) testDrive = getVal(row, mapping.testDrive);

      // Created At parsing
      const createdAtRaw = getVal(row, mapping.createdAt);
      let createdAt = new Date();
      if (createdAtRaw) {
        const parsed = new Date(createdAtRaw);
        if (!isNaN(parsed.getTime())) createdAt = parsed;
      }

      const assignedConsultant = sanitizeField(getVal(row, mapping.assignedConsultant)) || null;
      const rawRowBranch = sanitizeField(getVal(row, mapping.branch));
      const branch = (rawRowBranch ? activeBranchLookup.get(rawRowBranch.toLowerCase().trim()) : '') ||
                     (currentUser.assignedBranch && activeBranchLookup.get(currentUser.assignedBranch.toLowerCase().trim())) ||
                     '';

      toCreate.push({
        name: name || 'Unknown',
        phone,
        city: cleanCity,
        adname: sanitizeField(getVal(row, mapping.adname)),
        branch,
        remark: sanitizeField(getVal(row, mapping.remark)) || null,
        assignedConsultant,
        testDrive,
        status,
        platform: assignedPlatform,
        fingerprint,
        source: 'External Upload',
        uploadedById,
        uploadedAt: new Date(),
        createdAt,
        updatedAt: new Date(),
      });

      synced++;
    }

    if (toCreate.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < toCreate.length; i += chunkSize) {
        const chunk = toCreate.slice(i, i + chunkSize);
        await prisma.lead.createMany({
          data: chunk,
        });
      }

      // Log upload activity for created leads (skips superadmin)
      if (currentUser && !isSuperAdminUser(currentUser)) {
        try {
          const createdFingerprints = toCreate.map(c => c.fingerprint).filter(Boolean);
          const insertedLeads = await prisma.lead.findMany({
            where: { fingerprint: { in: createdFingerprints } },
            select: { id: true, name: true, phone: true }
          });

          if (insertedLeads.length > 0) {
            const activityData = insertedLeads.map(lead => ({
              leadId: lead.id,
              userId: uploaderDbId,
              username: currentUser.username,
              action: 'EXTERNAL_UPLOAD',
              oldValue: null,
              newValue: 'External Upload',
            }));

            for (let i = 0; i < activityData.length; i += chunkSize) {
              await prisma.leadActivity.createMany({
                data: activityData.slice(i, i + chunkSize),
              });
            }
          }
        } catch (actErr) {
          console.error('Failed to log batch upload activities:', actErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      total: dataRows.length,
      message: `Successfully imported ${synced} leads! (Skipped ${skipped} duplicates/invalid rows)`,
    });
  } catch (error: any) {
    console.error('External Sync Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to upload and import leads' }, { status: 500 });
  }
}
