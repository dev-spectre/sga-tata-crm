import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseBranches } from '@/lib/utils';

let cachedBranches: { data: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function GET() {
  try {
    const now = Date.now();
    if (cachedBranches && now - cachedBranches.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ branches: cachedBranches.data });
    }

    const [rawLeadBranches, rawConsultants, rawUsers] = await Promise.all([
      prisma.lead.groupBy({
        by: ['branch'],
        where: { branch: { not: '' } },
      }),
      prisma.consultant.groupBy({
        by: ['branch'],
        where: { branch: { not: '' } },
      }),
      prisma.user.groupBy({
        by: ['assignedBranch'],
        where: { assignedBranch: { not: null } },
      }),
    ]);

    const branchMap = new Map<string, string>();

    const addBranch = (raw: string | null | undefined) => {
      if (!raw) return;
      parseBranches(raw).forEach(clean => {
        if (!clean) return;
        const key = clean.toLowerCase();
        if (!branchMap.has(key)) {
          branchMap.set(key, clean);
        } else {
          // If clean has all-uppercase acronym (like MTP), prefer it
          if (clean === clean.toUpperCase()) {
            branchMap.set(key, clean);
          }
        }
      });
    };

    (rawLeadBranches as { branch: string | null }[]).forEach((b: { branch: string | null }) => addBranch(b.branch));
    (rawConsultants as { branch: string | null }[]).forEach((c: { branch: string | null }) => addBranch(c.branch));
    (rawUsers as { assignedBranch: string | null }[]).forEach((u: { assignedBranch: string | null }) => addBranch(u.assignedBranch));

    const sortedBranches = Array.from(branchMap.values()).sort((a, b) => a.localeCompare(b));
    cachedBranches = { data: sortedBranches, timestamp: now };

    return NextResponse.json({ branches: sortedBranches });

  } catch (error) {
    console.error('Branches fetch error:', error);
    if (cachedBranches) {
      return NextResponse.json({ branches: cachedBranches.data });
    }
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

