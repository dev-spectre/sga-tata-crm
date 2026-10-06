import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const modelId = parseInt(id, 10);
    if (isNaN(modelId)) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    const model = await prisma.carModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return NextResponse.json({ error: 'Car model not found' }, { status: 404 });
    }

    const leadsCount = await prisma.lead.count({
      where: { carModel: { equals: model.name, mode: 'insensitive' } },
    });

    return NextResponse.json({ model: { ...model, leadsCount } });
  } catch (error) {
    console.error('Fetch car model error:', error);
    return NextResponse.json({ error: 'Failed to fetch car model' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
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

    const { id } = await context.params;
    const modelId = parseInt(id, 10);
    if (isNaN(modelId)) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    const existingModel = await prisma.carModel.findUnique({
      where: { id: modelId },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Car model not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, code, isActive } = body;

    const updateData: {
      name?: string;
      code?: string;
      isActive?: boolean;
    } = {};

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'Model name cannot be empty' }, { status: 400 });
      }

      if (cleanName.toLowerCase() !== existingModel.name.toLowerCase()) {
        const collision = await prisma.carModel.findFirst({
          where: {
            name: { equals: cleanName, mode: 'insensitive' },
            id: { not: modelId },
          },
        });
        if (collision) {
          return NextResponse.json(
            { error: `Car model "${cleanName}" already exists` },
            { status: 409 }
          );
        }
      }
      updateData.name = cleanName;
    }

    if (code !== undefined) {
      updateData.code = String(code).trim().toUpperCase();
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updatedModel = await prisma.carModel.update({
      where: { id: modelId },
      data: updateData,
    });

    // If the model name changed, update existing leads that were tagged with old name
    if (updateData.name && updateData.name !== existingModel.name) {
      await prisma.lead.updateMany({
        where: { carModel: { equals: existingModel.name, mode: 'insensitive' } },
        data: { carModel: updateData.name },
      });
    }

    return NextResponse.json({ success: true, model: updatedModel });
  } catch (error: any) {
    console.error('Update car model error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update car model' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
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

    const { id } = await context.params;
    const modelId = parseInt(id, 10);
    if (isNaN(modelId)) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    const existingModel = await prisma.carModel.findUnique({
      where: { id: modelId },
    });

    if (!existingModel) {
      return NextResponse.json({ error: 'Car model not found' }, { status: 404 });
    }

    // Unassign this model from any leads before deleting
    await prisma.lead.updateMany({
      where: { carModel: { equals: existingModel.name, mode: 'insensitive' } },
      data: { carModel: '' },
    });

    await prisma.carModel.delete({
      where: { id: modelId },
    });

    return NextResponse.json({ success: true, deleted: existingModel.name });
  } catch (error: any) {
    console.error('Delete car model error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete car model' },
      { status: 500 }
    );
  }
}
