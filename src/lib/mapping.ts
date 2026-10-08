import { getSheetData, updateSheetRow } from './google';

export interface ColumnMapping {
  name: number;
  phone: number;
  city?: number;
  adname?: number;
  carModel?: number;
  branch?: number;
  followUpDate1?: number;
  followUpDate2?: number;
  createdAt?: number;
  remark?: number;
  status?: number;
  platform?: number;
  testDrive?: number;
  assignedConsultant?: number;
}

export async function computeIntelligentMapping(
  spreadsheetId: string,
  sheetName: string
): Promise<ColumnMapping> {
  const rows = await getSheetData(spreadsheetId, sheetName);
  
  if (!rows || rows.length === 0) {
    throw new Error('Sheet is empty');
  }

  const headers = (rows[0] || []).map((h: unknown) => String(h).toLowerCase().trim());
  let maxColIndex = headers.length - 1;

  // Find max col index from data rows as well in case headers are sparse
  for (let i = 1; i < Math.min(10, rows.length); i++) {
    if (rows[i].length - 1 > maxColIndex) {
      maxColIndex = rows[i].length - 1;
    }
  }

  const dataRows = rows.slice(1, 10);
  const mapping: Partial<Record<keyof ColumnMapping, number>> = {};

  const regexMap: Partial<Record<keyof ColumnMapping, RegExp[]>> = {
    name: [/^full\s?_?name$/i, /^first\s?_?name$/i, /^client\s?_?name/i, /^lead\s?_?name/i, /^customer\s?_?name/i, /^name$/i],
    phone: [/^phone\s?_?number$/i, /^mobile\s?_?number$/i, /^contact\s?_?number$/i, /^phone$/i, /^mobile$/i, /^contact\s?_?no/i],
    city: [/^city$/i, /^location$/i, /^town$/i, /city|location|town/i],
    adname: [/^ad\s?_?name$/i, /^campaign\s?_?name$/i, /^adset\s?_?name$/i, /ad\s?name|campaign\s?name/i],
    carModel: [/^car\s?_?model$/i, /^model$/i, /^vehicle$/i, /^car$/i, /car\s?model|model\s?name|variant/i],
    branch: [/^branch$/i, /^office$/i, /branch|office/i],
    platform: [/^platform$/i, /^source\s?_?platform$/i, /^lead\s?_?platform$/i, /^source$/i, /^publisher$/i, /^channel$/i],
    followUpDate1: [/^follow\s?up\s?date\s?1$/i, /^follow\s?up\s?1$/i, /follow up 1|date 1/i],
    followUpDate2: [/^follow\s?up\s?date\s?2$/i, /^follow\s?up\s?2$/i, /follow up 2|date 2/i],
    createdAt: [/^created\s?_?time$/i, /^created\s?_?at$/i, /^date$/i, /^timestamp$/i, /date|time|created/i],
    remark: [/^remark$/i, /^notes?$/i, /^comments?$/i, /remark|notes|comments/i],
    status: [/^lead\s?_?status$/i, /^status$/i, /^state$/i, /status|state/i],
    testDrive: [/^test\s?_?drive$/i, /^td$/i, /test\s?drive|td/i],
  };

  mapping.assignedConsultant = -1; // Consultant assignment is CRM-managed, never mapped from sheet

  // Phase 1: Header Matching with Priority
  for (const [field, regexes] of Object.entries(regexMap)) {
    const key = field as keyof ColumnMapping;
    for (const regex of regexes) {
      const matchIndex = headers.findIndex((h: string) => regex.test(h));
      if (matchIndex !== -1) {
        if (key === 'name' && /ad_name|campaign_name|adset_name|form_name|ad name|campaign name/i.test(headers[matchIndex])) {
          continue; // skip this match and keep trying
        }
        if (key === 'phone' && /status|id|name/i.test(headers[matchIndex]) && !/phone|mobile|contact/i.test(headers[matchIndex])) {
          continue;
        }
        if (key === 'status' && /phone|mobile/i.test(headers[matchIndex])) {
          continue;
        }
        if (key === 'platform') {
          // Check if data rows in this column look like dates
          const looksLikeDate = dataRows.some((row: unknown[]) => {
            const val = String((row as unknown[])[matchIndex] || '').trim();
            return val && !isNaN(Date.parse(val)) && (val.includes('-') || val.includes('/'));
          });
          if (looksLikeDate) {
            continue; // Skip this column for platform mapping
          }
        }
        mapping[key] = matchIndex;
        break;
      }
    }
  }

  // Phase 2: Data Sniffing for missing core fields
  if (mapping.phone === undefined) {
    for (let c = 0; c <= maxColIndex; c++) {
      if (Object.values(mapping).includes(c)) continue;
      const isPhone = dataRows.some((row: unknown[]) => {
        const val = String((row as unknown[])[c] || '').replace(/\D/g, '');
        return val.length >= 10 && val.length <= 15;
      });
      if (isPhone) { mapping.phone = c; break; }
    }
  }

  if (mapping.createdAt === undefined) {
    for (let c = 0; c <= maxColIndex; c++) {
      if (Object.values(mapping).includes(c)) continue;
      const isDate = dataRows.some((row: unknown[]) => {
        const val = String((row as unknown[])[c] || '').trim();
        return val && !isNaN(new Date(val).getTime()) && val.includes('-');
      });
      if (isDate) { mapping.createdAt = c; break; }
    }
  }

  if (mapping.platform === undefined) {
    for (let c = 0; c <= maxColIndex; c++) {
      if (Object.values(mapping).includes(c)) continue;
      // Skip columns that contain date-like strings
      const containsDates = dataRows.some((row: unknown[]) => {
        const val = String((row as unknown[])[c] || '').trim();
        return val && !isNaN(Date.parse(val)) && (val.includes('-') || val.includes('/'));
      });
      if (containsDates) continue;

      const isPlatform = dataRows.some((row: unknown[]) => {
        const val = String((row as unknown[])[c] || '').trim().toLowerCase();
        return (
          val.includes('meta') ||
          val.includes('facebook') ||
          val.includes('instagram') ||
          val.includes('google') ||
          val.includes('whatsapp') ||
          val.includes('website') ||
          val.includes('chatbot') ||
          val === 'fb' ||
          val === 'ig' ||
          val.includes('ads')
        );
      });
      if (isPlatform) { mapping.platform = c; break; }
    }
  }

  // Phase 3: Fallback defaults aligned with standard Google Sheet header:
  // id, created_time, ad_id, ad_name, adset_id, adset_name, campaign_id, campaign_name,
  // form_id, form_name, is_organic, platform, full_name, phone_number, city, email, lead_status
  if (mapping.name === undefined) mapping.name = 12;
  if (mapping.phone === undefined) mapping.phone = 13;
  if (mapping.city === undefined) mapping.city = 14;
  if (mapping.createdAt === undefined) mapping.createdAt = 1;
  if (mapping.adname === undefined) mapping.adname = 3;
  if (mapping.platform === undefined) mapping.platform = 11;
  if (mapping.status === undefined) mapping.status = 16;
  if (mapping.branch === undefined) mapping.branch = -1;
  if (mapping.carModel === undefined) mapping.carModel = -1;
  if (mapping.remark === undefined) mapping.remark = -1;
  if (mapping.followUpDate1 === undefined) mapping.followUpDate1 = -1;
  if (mapping.followUpDate2 === undefined) mapping.followUpDate2 = -1;
  if (mapping.testDrive === undefined) mapping.testDrive = -1;
  if (mapping.assignedConsultant === undefined) mapping.assignedConsultant = -1;

  return mapping as ColumnMapping;
}
