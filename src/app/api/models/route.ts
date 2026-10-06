import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const DEFAULT_TATA_MODELS = [
  { name: 'Nexon', code: 'NXN' },
  { name: 'Punch', code: 'PCH' },
  { name: 'Harrier', code: 'HAR' },
  { name: 'Safari', code: 'SAF' },
  { name: 'Altroz', code: 'ALT' },
  { name: 'Tiago', code: 'TGO' },
  { name: 'Tigor', code: 'TGR' },
  { name: 'Curvv', code: 'CRV' },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Auto-seed default Tata models on first load if table is empty
    const totalModelsCount = await prisma.carModel.count();
    if (totalModelsCount === 0) {
      for (const m of DEFAULT_TATA_MODELS) {
        await prisma.carModel.upsert({
          where: { name: m.name },
          update: {},
          create: { name: m.name, code: m.code, isActive: true },
        });
      }
    }

    const [models, leadGroups] = await Promise.all([
      prisma.carModel.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.lead.groupBy({
        by: ['carModel'],
        _count: { id: true },
      }),
    ]);

    const leadCountMap = new Map<string, number>();
    leadGroups.forEach((g) => {
      if (g.carModel) {
        leadCountMap.set(g.carModel.toLowerCase().trim(), g._count.id);
      }
    });

    const enrichedModels = models.map((m) => ({
      ...m,
      leadsCount: leadCountMap.get(m.name.toLowerCase().trim()) || 0,
    }));

    return NextResponse.json({
      models: enrichedModels,
      modelNames: models.map((m) => m.name),
    });
  } catch (error) {
    console.error('Car models fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch car models' }, { status: 500 });
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
    const { name, code, isActive } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';

    // Check collision by name
    const existing = await prisma.carModel.findFirst({
      where: {
        name: { equals: cleanName, mode: 'insensitive' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Car model "${cleanName}" already exists` },
        { status: 409 }
      );
    }

    const newModel = await prisma.carModel.create({
      data: {
        name: cleanName,
        code: cleanCode,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ success: true, model: newModel }, { status: 201 });
  } catch (error: any) {
    console.error('Create car model error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create car model' },
      { status: 500 }
    );
  }
}
