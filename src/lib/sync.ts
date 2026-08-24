import { prisma } from '@/lib/prisma';
import { getSheetData, batchUpdateSheetRows } from '@/lib/google';
import { parsePhoneNumber, sanitizeField, parseSheetStatus } from '@/lib/utils';
import { getCachedSettings } from '@/lib/settings';

interface ColumnMapping {
  name: number;
  phone: number;
  city: number;
  adname?: number;
  branch?: number;
  followUpDate1?: number;
  followUpDate2?: number;
  createdAt: number;
  remark: number;
  status: number;
  platform?: number;
}

const DEFAULT_MAPPING: ColumnMapping = {
  name: 0,
  phone: 1,
  city: 2,
  createdAt: 3,
  remark: 4,
  status: 5,
  adname: 6,
  branch: 7,
  followUpDate1: 8,
  followUpDate2: 9,
  platform: 10,
};

function isLowQualityLead(name: string, phone: string, city: string): boolean {
  if (!name && !phone) return true;
  if (!phone || phone.length < 5) return true;
  const isJunkText = (val: string) => /^(n\/?a|null|nil|none|test|\.|\-)$/i.test(val.trim());
  if ((!name || isJunkText(name)) && (!city || isJunkText(city))) return true;
  return false;
}

export async function deduplicateDatabaseLeads() {
  try {
    const { executeDeleteDuplicateLeads } = await import('@/lib/deduplicate');
    const result = await executeDeleteDuplicateLeads();
    return result;
  } catch (err) {
    console.error('Failed to deduplicate database leads:', err);
    return { duplicateCount: 0 };
  }
}

export async function performSheetSync() {
  try {
    const settings = await getCachedSettings();

    if (!settings?.selectedSpreadsheetId || !settings?.selectedSheetName || !settings?.googleAccessToken) {
      return { synced: 0, duplicates: 0, skippedLowQuality: 0, skippedDuplicates: 0, total: 0, error: 'Settings not configured' };
    }

  const mapping: ColumnMapping = settings.columnMapping
    ? { ...DEFAULT_MAPPING, ...JSON.parse(settings.columnMapping) }
    : DEFAULT_MAPPING;

  const rows = await getSheetData(settings.selectedSpreadsheetId, settings.selectedSheetName);

  if (!rows || rows.length <= 1) {
    return { synced: 0, duplicates: 0, skippedLowQuality: 0, skippedDuplicates: 0, total: 0 };
  }

  const dataRows = rows.slice(1);
  let synced = 0;
  let duplicates = 0;
  let skippedLowQuality = 0;
  let skippedDuplicates = 0;

  // 1. Scan sheet rows in memory to collect search keys (phones, fingerprints, row numbers)
  const candidatePhones = new Set<string>();
  const candidateFingerprints = new Set<string>();
  const candidateRows = new Set<number>();
  const preScanCounts = new Map<string, number>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;
    candidateRows.add(rowNum);

    const rawPhone = (row[mapping.phone] || '').toString();
    const phone = parsePhoneNumber(rawPhone);
    if (phone) candidatePhones.add(phone);

    const createdAtRaw = (row[mapping.createdAt] || '').toString().trim();
    const baseFp = `${phone}|${createdAtRaw}`;
    const cnt = preScanCounts.get(baseFp) || 0;
    preScanCounts.set(baseFp, cnt + 1);
    candidateFingerprints.add(`${baseFp}|${cnt}`);
  }

  // 2. Fetch only matching DB leads (slashing egress from 2,700+ rows down to matching subset)
  const orConditions: any[] = [];
  if (candidatePhones.size > 0) {
    orConditions.push({ phone: { in: Array.from(candidatePhones) } });
  }
  if (candidateFingerprints.size > 0) {
    orConditions.push({ fingerprint: { in: Array.from(candidateFingerprints) } });
  }
  if (candidateRows.size > 0) {
    orConditions.push({ sheetRow: { in: Array.from(candidateRows) } });
  }

  const existingLeads = orConditions.length > 0
    ? await prisma.lead.findMany({
        where: {
          source: { not: 'External Upload' },
          uploadedById: null,
          OR: orConditions,
        },
        select: {
          id: true,
          fingerprint: true,
          remark: true,
          status: true,
          name: true,
          phone: true,
          city: true,
          adname: true,
          branch: true,
          followUpDate1: true,
          followUpDate2: true,
          sheetRow: true,
          assignedConsultant: true,
          testDrive: true,
          platform: true,
          source: true,
          uploadedById: true,
          sheetId: true,
        },
      })
    : [];

  const existingByFingerprint = new Map<string, typeof existingLeads[0]>();
  const existingByPhone = new Map<string, typeof existingLeads[0]>();
  const existingByRow = new Map<number, typeof existingLeads[0]>();
  const activeDbIds = new Set<number>();

  for (const lead of existingLeads) {
    if (lead.fingerprint && !existingByFingerprint.has(lead.fingerprint)) {
      existingByFingerprint.set(lead.fingerprint, lead);
    }
    const cleanPhone = parsePhoneNumber(lead.phone);
    if (cleanPhone && !existingByPhone.has(cleanPhone)) {
      existingByPhone.set(cleanPhone, lead);
    }
    if (lead.sheetRow && !existingByRow.has(lead.sheetRow)) {
      existingByRow.set(lead.sheetRow, lead);
    }
  }

  const fingerprintCounts = new Map<string, number>();
  const seenFullData = new Set<string>();
  const currentSheetPhones = new Set<string>();

  const toCreate: any[] = [];
  const toUpdate: { id: number; data: any }[] = [];
  const sheetUpdatesToCorrect: { rowNumber: number; updates: { col: number; value: string }[] }[] = [];

  // 2. In-Memory Reconciliation
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2;

    const rawName = (row[mapping.name] || '').toString();
    const rawPhone = (row[mapping.phone] || '').toString();
    const rawCity = (row[mapping.city] || '').toString();

    const name = sanitizeField(rawName);
    const phone = parsePhoneNumber(rawPhone);
    const city = sanitizeField(rawCity);

    const rawPlatform = mapping.platform !== undefined ? (row[mapping.platform] || '').toString() : '';
    let platform = sanitizeField(rawPlatform);
    if (platform) {
      platform = platform.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
      const isDateStr = /^\d{4}-\d{2}-\d{2}$/.test(platform) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(platform) || (!isNaN(Date.parse(platform)) && (platform.includes('-') || platform.includes('/')));
      if (isDateStr) {
        platform = 'Unknown';
      }
    } else {
      platform = 'Unknown';
    }
    
    const rawAdname = mapping.adname !== undefined ? (row[mapping.adname] || '').toString() : '';
    const rawBranch = mapping.branch !== undefined ? (row[mapping.branch] || '').toString() : '';
    const rawFollowUpDate1 = mapping.followUpDate1 !== undefined ? (row[mapping.followUpDate1] || '').toString() : '';
    const rawFollowUpDate2 = mapping.followUpDate2 !== undefined ? (row[mapping.followUpDate2] || '').toString() : '';
    const adname = sanitizeField(rawAdname);
    const branch = sanitizeField(rawBranch);

    let followUpDate1: Date | null = null;
    if (rawFollowUpDate1) {
      const parsed = new Date(rawFollowUpDate1);
      if (!isNaN(parsed.getTime())) followUpDate1 = parsed;
    }

    let followUpDate2: Date | null = null;
    if (rawFollowUpDate2) {
      const parsed = new Date(rawFollowUpDate2);
      if (!isNaN(parsed.getTime())) followUpDate2 = parsed;
    }

    if (phone) {
      currentSheetPhones.add(phone);
    }

    if (isLowQualityLead(name, phone, city)) {
      skippedLowQuality++;
      continue;
    }

    const createdAtRaw = (row[mapping.createdAt] || '').toString().trim();
    const remark = sanitizeField((row[mapping.remark] || '').toString()) || null;
    const statusRaw = (row[mapping.status] || '').toString().trim().toLowerCase();

    // Deduplicate exact identical rows from the sheet
    const fullDataHash = `${name}|${phone}|${city}|${adname}|${branch}|${createdAtRaw}|${remark || ''}|${statusRaw}|${followUpDate1 ? followUpDate1.getTime() : ''}|${followUpDate2 ? followUpDate2.getTime() : ''}|${platform}`;
    if (seenFullData.has(fullDataHash)) {
      skippedDuplicates++;
      continue;
    }
    seenFullData.add(fullDataHash);

    let createdAt = new Date();
    if (createdAtRaw) {
      const parsed = new Date(createdAtRaw);
      if (!isNaN(parsed.getTime())) {
        createdAt = parsed;
      }
    }

    const status = parseSheetStatus(statusRaw);

    const baseFingerprint = `${phone}|${createdAtRaw}`;
    const count = fingerprintCounts.get(baseFingerprint) || 0;
    fingerprintCounts.set(baseFingerprint, count + 1);

    const fingerprint = `${baseFingerprint}|${count}`;

    // Multi-stage fallback lead matching
    let existing = existingByFingerprint.get(fingerprint);
    if (!existing && phone) {
      existing = existingByPhone.get(phone);
    }
    if (!existing && rowNumber) {
      existing = existingByRow.get(rowNumber);
    }

    if (existing) {
      activeDbIds.add(existing.id);

      // RULE: DB takes absolute priority over Google Sheets for status, remark, follow-up dates, test drive, and assigned consultant.
      const finalStatus = existing.status || (statusRaw ? status : 'not_contacted');
      const finalRemark = existing.remark !== null && existing.remark !== undefined ? existing.remark : (remark || null);
      const finalFollowUpDate1 = existing.followUpDate1 !== null && existing.followUpDate1 !== undefined ? existing.followUpDate1 : followUpDate1;
      const finalFollowUpDate2 = existing.followUpDate2 !== null && existing.followUpDate2 !== undefined ? existing.followUpDate2 : followUpDate2;

      // Check if Sheet row has mismatched values and queue corrections to write back to Google Sheet
      const corrections: { col: number; value: string }[] = [];

      // 1. Status Mismatch Correction
      if (mapping.status !== undefined && mapping.status >= 0) {
        const normExistingStatus = (existing.status === 'created' ? 'not_contacted' : existing.status === 'closed_successful' ? 'live' : existing.status === 'closed_unsuccessful' ? 'lost' : existing.status) || 'not_contacted';
        let formattedDbStatus = 'Not Contacted';
        if (normExistingStatus === 'pending') formattedDbStatus = 'Contacted';
        else if (normExistingStatus === 'live') formattedDbStatus = 'Completed';
        else if (normExistingStatus === 'lost') formattedDbStatus = 'Lost';

        const rawSheetStatusStr = (row[mapping.status] || '').toString().trim();
        const normSheetStatus = parseSheetStatus(rawSheetStatusStr.toLowerCase());

        if (rawSheetStatusStr && normSheetStatus !== normExistingStatus) {
          corrections.push({ col: mapping.status, value: formattedDbStatus });
        }
      }

      // 2. Remark Mismatch Correction
      if (mapping.remark !== undefined && mapping.remark >= 0) {
        const rawSheetRemark = (row[mapping.remark] || '').toString();
        const cleanSheetRemark = sanitizeField(rawSheetRemark) || '';
        const dbRemark = existing.remark || '';
        if (existing.remark !== null && existing.remark !== undefined && cleanSheetRemark !== dbRemark) {
          corrections.push({ col: mapping.remark, value: dbRemark });
        }
      }

      // 3. Follow Up Date 1 Mismatch Correction
      if (mapping.followUpDate1 !== undefined && mapping.followUpDate1 >= 0) {
        const dbF1 = existing.followUpDate1 ? existing.followUpDate1.toISOString().split('T')[0] : '';
        const sheetF1 = followUpDate1 ? followUpDate1.toISOString().split('T')[0] : '';
        if (existing.followUpDate1 && dbF1 !== sheetF1) {
          corrections.push({ col: mapping.followUpDate1, value: dbF1 });
        }
      }

      // 4. Follow Up Date 2 Mismatch Correction
      if (mapping.followUpDate2 !== undefined && mapping.followUpDate2 >= 0) {
        const dbF2 = existing.followUpDate2 ? existing.followUpDate2.toISOString().split('T')[0] : '';
        const sheetF2 = followUpDate2 ? followUpDate2.toISOString().split('T')[0] : '';
        if (existing.followUpDate2 && dbF2 !== sheetF2) {
          corrections.push({ col: mapping.followUpDate2, value: dbF2 });
        }
      }

      if (corrections.length > 0 && rowNumber) {
        sheetUpdatesToCorrect.push({ rowNumber, updates: corrections });
      }

      // Only queue DB update if metadata (like name, phone, city, branch, adname, platform, sheetRow) changed from sheet
      if (
        existing.name !== name ||
        existing.phone !== phone ||
        existing.city !== city ||
        existing.adname !== adname ||
        existing.branch !== branch ||
        existing.platform !== platform ||
        existing.sheetRow !== rowNumber
      ) {
        toUpdate.push({
          id: existing.id,
          data: {
            name,
            phone,
            city,
            adname,
            branch,
            followUpDate1: finalFollowUpDate1,
            followUpDate2: finalFollowUpDate2,
            remark: finalRemark,
            status: finalStatus,
            platform,
            sheetRow: rowNumber,
            sheetId: settings.selectedSpreadsheetId,
            fingerprint,
          }
        });
      }
      duplicates++;
    } else {
      toCreate.push({
        name,
        phone,
        city,
        adname,
        branch,
        followUpDate1,
        followUpDate2,
        createdAt,
        remark,
        status,
        platform,
        sheetRow: rowNumber,
        sheetId: settings.selectedSpreadsheetId,
        source: 'System',
        uploadedById: null,
        fingerprint,
      });
      synced++;
    }
  }

  // 3. Execute Bulk DB Operations
  // Create New Leads with DB-level duplicate skipping using upsert
  const chunkSize = 50;
  for (let i = 0; i < toCreate.length; i += chunkSize) {
    const chunk = toCreate.slice(i, i + chunkSize);
    const createPromises = chunk.map(data => 
      prisma.lead.upsert({
        where: { fingerprint: data.fingerprint },
        update: data,
        create: data
      }).catch(e => {
        console.error(`Create/Upsert failed for fingerprint ${data.fingerprint}:`, e);
      })
    );
    await Promise.all(createPromises);
  }

  // Update Existing Leads in chunks of 50 concurrent updates
  for (let i = 0; i < toUpdate.length; i += 50) {
    const updatePromises = toUpdate.slice(i, i + 50).map(u =>
      prisma.lead.update({
        where: { id: u.id },
        data: u.data
      }).catch(e => {
        console.error(`Update failed for id ${u.id}:`, e);
      })
    );
    await Promise.all(updatePromises);
  }

  // 4. Correct Mismatched Google Sheet Rows to Match Authoritative DB Data (Single Bulk API Request)
  if (sheetUpdatesToCorrect.length > 0 && settings.selectedSpreadsheetId && settings.selectedSheetName) {
    try {
      await batchUpdateSheetRows(
        settings.selectedSpreadsheetId,
        settings.selectedSheetName,
        sheetUpdatesToCorrect.map(c => ({ row: c.rowNumber, colValues: c.updates }))
      );
    } catch (sheetErr) {
      console.error('Failed to batch-correct mismatched Google Sheet rows:', sheetErr);
    }
  }

  // 4. Preserve All Database Leads
  // Leads removed or missing from the Google Sheet are preserved in the database and visible in dashboard.

  await prisma.settings.update({
    where: { id: 1 },
    data: { lastSyncAt: new Date() },
  });

    return {
      synced,
      duplicates,
      skippedLowQuality,
      skippedDuplicates,
      total: dataRows.length,
    };
  } catch (err: any) {
    console.error('Auto background sheet sync error:', err?.message || err);
    return { synced: 0, duplicates: 0, skippedLowQuality: 0, skippedDuplicates: 0, total: 0, error: err?.message || String(err) };
  }
}

export async function clearAndResyncDatabase() {
  await prisma.lead.deleteMany({
    where: {
      source: { not: 'External Upload' },
      uploadedById: null,
    },
  });
  console.log('🧹 Purged sheet leads database data (preserved external uploads).');
  return await performSheetSync();
}
