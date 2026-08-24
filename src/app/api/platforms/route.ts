import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

let cachedPlatforms: { data: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function GET() {
  try {
    const now = Date.now();
    if (cachedPlatforms && now - cachedPlatforms.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ platforms: cachedPlatforms.data });
    }

    const rawPlatforms = await prisma.lead.groupBy({
      by: ['platform'],
      where: { platform: { not: null } },
    });

    const uniquePlatforms = Array.from(
      new Set(rawPlatforms.map((p) => p.platform?.trim()).filter(Boolean))
    ).sort() as string[];

    cachedPlatforms = { data: uniquePlatforms, timestamp: now };

    return NextResponse.json({ platforms: uniquePlatforms });
  } catch (error) {
    console.error('Platforms fetch error:', error);
    if (cachedPlatforms) {
      return NextResponse.json({ platforms: cachedPlatforms.data });
    }
    return NextResponse.json({ error: 'Failed to fetch platforms' }, { status: 500 });
  }
}

