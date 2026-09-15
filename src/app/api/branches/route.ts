import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseBranches } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const dbBranches = await prisma.branch.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });

    const branchNames = dbBranches.map((b: { name: string }) => b.name);
    if (format === 'names') {
      return NextResponse.json({ branches: branchNames });
    }
    return NextResponse.json({
      branches: dbBranches,
      branchNames,
    });
  } catch (error) {
    console.error('Branches fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin =
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'SUPERADMIN' ||
      Boolean(currentUser.isSuperAdmin);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, address, city, latitude, longitude, radiusKm, isActive } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Branch code is required' }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    // Check for collisions with existing branches
    const existing = await prisma.branch.findFirst({
      where: {
        OR: [
          { name: { equals: cleanName, mode: 'insensitive' } },
          { code: { equals: cleanCode, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      const isCodeConflict = existing.code.toUpperCase() === cleanCode;
      return NextResponse.json(
        { error: isCodeConflict ? `Branch code "${cleanCode}" already exists` : `Branch name "${cleanName}" already exists` },
        { status: 409 }
      );
    }

    const lat =
      latitude !== undefined && latitude !== null && latitude !== '' && !isNaN(Number(latitude))
        ? Number(latitude)
        : null;

    const lng =
      longitude !== undefined && longitude !== null && longitude !== '' && !isNaN(Number(longitude))
        ? Number(longitude)
        : null;

    const rad =
      radiusKm !== undefined && radiusKm !== null && !isNaN(Number(radiusKm))
        ? Number(radiusKm)
        : 50.0;

    const newBranch = await prisma.branch.create({
      data: {
        name: cleanName,
        code: cleanCode,
        address: typeof address === 'string' ? address.trim() : '',
        city: typeof city === 'string' ? city.trim() : '',
        latitude: lat,
        longitude: lng,
        radiusKm: rad,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ success: true, branch: newBranch }, { status: 201 });
  } catch (error: any) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create branch' },
      { status: 500 }
    );
  }
}
