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
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) {
      return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Fetch branch error:', error);
    return NextResponse.json({ error: 'Failed to fetch branch' }, { status: 500 });
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

    const { id } = await context.params;
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) {
      return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
    }

    const existingBranch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!existingBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    const isAdmin =
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'SUPERADMIN' ||
      Boolean(currentUser.isSuperAdmin);

    const isAssignedManager =
      currentUser.assignedBranch &&
      currentUser.assignedBranch.toLowerCase() === existingBranch.name.toLowerCase();

    if (!isAdmin && !isAssignedManager) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to modify this branch' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, code, address, city, latitude, longitude, radiusKm, isActive } = body;

    const updateData: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      latitude?: number | null;
      longitude?: number | null;
      radiusKm?: number;
      isActive?: boolean;
    } = {};

    // Validate and check name collision
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'Branch name cannot be empty' }, { status: 400 });
      }
      if (cleanName.toLowerCase() !== existingBranch.name.toLowerCase()) {
        const nameCollision = await prisma.branch.findFirst({
          where: {
            name: { equals: cleanName, mode: 'insensitive' },
            id: { not: branchId },
          },
        });
        if (nameCollision) {
          return NextResponse.json({ error: `Branch name "${cleanName}" already exists` }, { status: 409 });
        }
      }
      updateData.name = cleanName;
    }

    // Validate and check code collision
    if (code !== undefined) {
      const cleanCode = String(code).trim().toUpperCase();
      if (!cleanCode) {
        return NextResponse.json({ error: 'Branch code cannot be empty' }, { status: 400 });
      }
      if (cleanCode !== existingBranch.code) {
        const codeCollision = await prisma.branch.findFirst({
          where: {
            code: { equals: cleanCode, mode: 'insensitive' },
            id: { not: branchId },
          },
        });
        if (codeCollision) {
          return NextResponse.json({ error: `Branch code "${cleanCode}" already exists` }, { status: 409 });
        }
      }
      updateData.code = cleanCode;
    }

    if (address !== undefined) {
      updateData.address = String(address).trim();
    }

    if (city !== undefined) {
      updateData.city = String(city).trim();
    }

    if (latitude !== undefined) {
      updateData.latitude =
        latitude !== null && latitude !== '' && !isNaN(Number(latitude))
          ? Number(latitude)
          : null;
    }

    if (longitude !== undefined) {
      updateData.longitude =
        longitude !== null && longitude !== '' && !isNaN(Number(longitude))
          ? Number(longitude)
          : null;
    }

    if (radiusKm !== undefined) {
      updateData.radiusKm = !isNaN(Number(radiusKm)) ? Number(radiusKm) : 50.0;
    }

    // Only full admins can change active status
    if (isActive !== undefined && isAdmin) {
      updateData.isActive = Boolean(isActive);
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data: updateData,
    });

    return NextResponse.json({ success: true, branch: updated });
  } catch (error: any) {
    console.error('Update branch error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update branch' },
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
    const branchId = parseInt(id, 10);
    if (isNaN(branchId)) {
      return NextResponse.json({ error: 'Invalid branch ID' }, { status: 400 });
    }

    const existingBranch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!existingBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Soft-delete: update isActive to false to preserve historical leads and consultants (Decision D-03)
    const deactivated = await prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `Branch "${deactivated.name}" deactivated successfully`,
      branch: deactivated,
    });
  } catch (error: any) {
    console.error('Delete branch error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to deactivate branch' },
      { status: 500 }
    );
  }
}
