/**
 * Follow-up utilities for managing unlimited follow-ups, timeline tracking,
 * and DD-MM-YYYY date formatting.
 */

export interface FollowUpItem {
  id?: number;
  leadId?: number;
  step: number;
  date: string; // ISO or YYYY-MM-DD
  createdAt?: string;
}

/**
 * Formats any Date or date string to DD-MM-YYYY strictly in Asia/Kolkata timezone.
 * Handles: "2026-10-07", ISO timestamps, or Date instances.
 */
export function formatToDDMMYYYY(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      if (!clean) return '';
      // If already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-');
        return `${d}-${m}-${y}`;
      }
      // If already DD-MM-YYYY
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        return clean;
      }
      const parsed = new Date(clean);
      if (isNaN(parsed.getTime())) return clean;
      return formatDateParts(parsed);
    }
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return formatDateParts(dateVal);
    }
    return '';
  } catch {
    return '';
  }
}

function formatDateParts(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const year = parts.find((p) => p.type === 'year')?.value || `${d.getFullYear()}`;
  return `${day}-${month}-${year}`;
}

/**
 * Converts ISO/Date to YYYY-MM-DD for standard HTML input[type="date"] binding.
 */
export function toISTDateString(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
      const d = new Date(clean);
      if (isNaN(d.getTime())) return '';
      return extractISTDate(d);
    }
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return extractISTDate(dateVal);
    }
    return '';
  } catch {
    return '';
  }
}

function extractISTDate(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

/**
 * Normalizes all follow-ups for a lead into a clean ordered list.
 * Fallbacks to followUpDate1 and followUpDate2 if no relation rows are attached.
 */
export function getLeadFollowUps(lead: {
  followUps?: any[];
  followUpDate1?: string | Date | null;
  followUpDate2?: string | Date | null;
  followUpCount?: number;
}): FollowUpItem[] {
  if (Array.isArray(lead?.followUps) && lead.followUps.length > 0) {
    return lead.followUps
      .filter((f: any) => f && f.date && String(f.date).trim() !== '')
      .map((f: any, idx: number) => ({
        id: f.id,
        leadId: f.leadId,
        step: f.step || idx + 1,
        date: typeof f.date === 'string' ? f.date : (f.date instanceof Date ? f.date.toISOString() : String(f.date)),
        createdAt: f.createdAt ? String(f.createdAt) : undefined,
      }))
      .sort((a, b) => a.step - b.step);
  }

  // Synthesize from legacy followUpDate1 & followUpDate2
  const synthetic: FollowUpItem[] = [];
  if (lead?.followUpDate1 && String(lead.followUpDate1).trim() !== '') {
    synthetic.push({
      step: 1,
      date: typeof lead.followUpDate1 === 'string' ? lead.followUpDate1 : lead.followUpDate1.toISOString(),
    });
  }
  if (lead?.followUpDate2 && String(lead.followUpDate2).trim() !== '') {
    synthetic.push({
      step: 2,
      date: typeof lead.followUpDate2 === 'string' ? lead.followUpDate2 : lead.followUpDate2.toISOString(),
    });
  }
  return synthetic;
}

/**
 * Returns total count of follow-ups for a lead.
 */
export function getLeadFollowUpCount(lead: any): number {
  const list = getLeadFollowUps(lead);
  if (list.length > 0) return list.length;
  if (typeof lead?.followUpCount === 'number' && lead.followUpCount > 0) {
    return lead.followUpCount;
  }
  return 0;
}

/**
 * Generates newline-separated follow-up dates in DD-MM-YYYY format for Excel export.
 */
export function formatAllFollowUpsForExcel(lead: any): string {
  const followUps = getLeadFollowUps(lead);
  if (!followUps || followUps.length === 0) {
    return '-';
  }
  return followUps
    .map((f, idx) => {
      const formatted = formatToDDMMYYYY(f.date);
      return followUps.length > 1 ? `${idx + 1}. ${formatted}` : formatted;
    })
    .filter(Boolean)
    .join('\r\n');
}
