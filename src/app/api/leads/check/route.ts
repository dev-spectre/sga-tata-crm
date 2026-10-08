import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const isAdmin = currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.isSuperAdmin);

    const searchParams = request.nextUrl.searchParams;
    const since = searchParams.get('since');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const consultant = searchParams.get('consultant') || '';
    const requestedBranch = searchParams.get('branch') || '';
    const branch = !isAdmin && currentUser?.assignedBranch
      ? currentUser.assignedBranch
      : requestedBranch;

    const requestedPlatform = searchParams.get('platform') || '';
    const platform = !isAdmin && currentUser?.assignedPlatform
      ? currentUser.assignedPlatform
      : requestedPlatform;

    const city = searchParams.get('city') || '';
    const testDrive = searchParams.get('testDrive') || '';
    const carModel = searchParams.get('carModel') || searchParams.get('model') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const followUpDate = searchParams.get('followUpDate') || '';
    const followUpStartDate = searchParams.get('followUpStartDate') || followUpDate;
    const followUpEndDate = searchParams.get('followUpEndDate') || followUpDate;
    const hasFollowUp = searchParams.get('hasFollowUp') === 'true' || searchParams.get('hasFollowUp') === '1' || searchParams.get('onlyFollowUps') === 'true' || Boolean(followUpStartDate || followUpEndDate);
    const uploader = searchParams.get('uploader');
    const uploadedById = searchParams.get('uploadedById');
    const source = searchParams.get('source');
    const category = searchParams.get('category')?.trim().toLowerCase() || 'all';

    // Build base filter matching active user view (without category and status scoping)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statsWhere: any = {};

    // Soft delete filter: Exclude leads hidden by this user
    if (currentUser?.userId) {
      const hiddenRecords = await prisma.hiddenLead.findMany({
        where: { userId: currentUser.userId },
        select: { leadId: true },
      });
      if (hiddenRecords.length > 0) {
        statsWhere.id = { notIn: hiddenRecords.map(r => r.leadId) };
      }
    }

    if (startDate || endDate) {
      statsWhere.createdAt = {};
      if (startDate) {
        statsWhere.createdAt.gte = new Date(`${startDate}T00:00:00+05:30`);
      }
      if (endDate) {
        statsWhere.createdAt.lte = new Date(`${endDate}T23:59:59.999+05:30`);
      }
    }

    if (search.trim()) {
      const tokens = search.trim().split(/\s+/).filter(Boolean);
      const searchConditions = tokens.map(token => {
        const tokenDigits = token.replace(/\D/g, '');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fields: any[] = [
          { name: { contains: token, mode: 'insensitive' } },
          { phone: { contains: token, mode: 'insensitive' } },
          { city: { contains: token, mode: 'insensitive' } },
          { adname: { contains: token, mode: 'insensitive' } },
          { carModel: { contains: token, mode: 'insensitive' } },
          { branch: { contains: token, mode: 'insensitive' } },
          { remark: { contains: token, mode: 'insensitive' } },
        ];
        if (tokenDigits && tokenDigits.length >= 3) {
          fields.push({ phone: { contains: tokenDigits, mode: 'insensitive' } });
        }
        return { OR: fields };
      });

      statsWhere.AND = [
        ...(statsWhere.AND || []),
        ...searchConditions
      ];
    }

    if (city) {
      statsWhere.city = { contains: city, mode: 'insensitive' };
    }

    if (branch) {
      const branchTokens = branch.split(',').map(b => b.trim()).filter(Boolean);
      if (branchTokens.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const branchConditions: any[] = branchTokens.map(b => {
          const words = b.split(/\s+/).filter(Boolean);
          if (words.length > 1) {
            return { AND: words.map(w => ({ branch: { contains: w, mode: 'insensitive' } })) };
          }
          return { branch: { contains: b, mode: 'insensitive' } };
        });
        statsWhere.AND = [
          ...(statsWhere.AND || []),
          { OR: branchConditions }
        ];
      }
    }

    if (platform) {
      const platformTokens = platform.split(',').map((p: string) => p.trim()).filter(Boolean);
      if (platformTokens.length > 0) {
        const mapPlatformValue = (val: string): string[] => {
          const lower = val.toLowerCase();
          if (lower === 'facebook' || lower === 'fb') return ['Fb'];
          if (lower === 'instagram' || lower === 'ig') return ['Ig'];
          if (lower === 'meta ads') return ['Fb', 'Ig'];
          return [val];
        };
        const dbPlatforms = Array.from(new Set(platformTokens.flatMap(mapPlatformValue)));
        if (dbPlatforms.length === 1) {
          statsWhere.platform = dbPlatforms[0];
        } else {
          statsWhere.AND = [
            ...(statsWhere.AND || []),
            { platform: { in: dbPlatforms } }
          ];
        }
      }
    }

    if (consultant) {
      const consultantTokens = consultant.split(',').map(c => c.trim()).filter(Boolean);
      if (consultantTokens.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const consultantConditions: any[] = [];
        consultantTokens.forEach(c => {
          if (c === 'Unassigned') {
            consultantConditions.push({ assignedConsultant: null }, { assignedConsultant: '' });
          } else {
            consultantConditions.push({ assignedConsultant: c });
          }
        });
        statsWhere.AND = [
          ...(statsWhere.AND || []),
          { OR: consultantConditions }
        ];
      }
    }

    if (testDrive) {
      const tdTokens = testDrive.split(',').map(s => s.trim()).filter(Boolean);
      if (tdTokens.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const testDriveConditions: any[] = [];
        tdTokens.forEach(td => {
          if (td === 'Not Scheduled') {
            testDriveConditions.push(
              { testDrive: null },
              { testDrive: '' },
              { testDrive: 'Not Scheduled' },
              { testDrive: 'No' }
            );
          } else if (td === 'Scheduled') {
            testDriveConditions.push(
              { testDrive: 'Scheduled' },
              { testDrive: 'Yes' }
            );
          } else {
            testDriveConditions.push({ testDrive: td });
          }
        });
        statsWhere.AND = [
          ...(statsWhere.AND || []),
          { OR: testDriveConditions }
        ];
      }
    }

    if (carModel) {
      const modelTokens = carModel.split(',').map(m => m.trim()).filter(Boolean);
      if (modelTokens.length > 0) {
        statsWhere.AND = [
          ...(statsWhere.AND || []),
          { OR: modelTokens.map(m => ({ carModel: { contains: m, mode: 'insensitive' } })) }
        ];
      }
    }

    if (followUpStartDate || followUpEndDate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f1Cond: any = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f2Cond: any = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fFollowUpCond: any = {};
      if (followUpStartDate) {
        const start = new Date(`${followUpStartDate}T00:00:00+05:30`);
        f1Cond.gte = start;
        f2Cond.gte = start;
        fFollowUpCond.gte = start;
      }
      if (followUpEndDate) {
        const end = new Date(`${followUpEndDate}T23:59:59.999+05:30`);
        f1Cond.lte = end;
        f2Cond.lte = end;
        fFollowUpCond.lte = end;
      }
      statsWhere.AND = [
        ...(statsWhere.AND || []),
        {
          OR: [
            { followUpDate1: f1Cond },
            { followUpDate2: f2Cond },
            { followUps: { some: { date: fFollowUpCond } } },
          ]
        }
      ];
    } else if (hasFollowUp) {
      statsWhere.AND = [
        ...(statsWhere.AND || []),
        {
          OR: [
            { followUpDate1: { not: null } },
            { followUpDate2: { not: null } },
            { followUpCount: { gt: 0 } },
            { followUps: { some: {} } },
          ]
        }
      ];
    }

    if (uploadedById) {
      const parsedId = parseInt(uploadedById);
      if (!isNaN(parsedId)) {
        statsWhere.uploadedById = parsedId;
      }
    }

    if (uploader) {
      const uploaderTokens = uploader.split(',').map(u => u.trim()).filter(Boolean);
      if (uploaderTokens.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploaderConditions: any[] = [];
        uploaderTokens.forEach(u => {
          if (u === 'system' || u === 'sheet') {
            uploaderConditions.push({ source: { not: 'External Upload' } });
          } else if (u === 'external') {
            uploaderConditions.push({ source: 'External Upload' });
          } else if (u.startsWith('user:')) {
            const uName = u.replace('user:', '').trim();
            uploaderConditions.push({ uploadedBy: { username: { equals: uName, mode: 'insensitive' } } });
          } else {
            uploaderConditions.push({ uploadedBy: { username: { equals: u, mode: 'insensitive' } } });
          }
        });
        statsWhere.AND = [
          ...(statsWhere.AND || []),
          { OR: uploaderConditions }
        ];
      }
    }

    if (source) {
      if (source === 'External Upload' || source === 'external') {
        statsWhere.source = 'External Upload';
      } else if (source === 'System' || source === 'system' || source === 'sheet') {
        statsWhere.source = { not: 'External Upload' };
      }
    }

    // Active branches and categories matching /api/leads exactly
    const now = new Date();
    const kolkataFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayDateStr = kolkataFormatter.format(now);
    const todayEndOfDay = new Date(`${todayDateStr}T23:59:59.999+05:30`);

    const activeBranches = await prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        latitude: true,
        longitude: true,
        radiusKm: true,
        isActive: true,
      },
    });
    const activeBranchNames: string[] = [];
    const activeBranchSet = new Set<string>();
    const activeBranchLookup = new Map<string, string>();

    activeBranches.forEach((b: { name: string; code?: string | null }) => {
      const cleanName = b.name.trim();
      const lowerName = cleanName.toLowerCase();
      activeBranchNames.push(cleanName);
      activeBranchSet.add(lowerName);
      activeBranchLookup.set(lowerName, cleanName);

      if (b.code) {
        const cleanCode = b.code.trim();
        const lowerCode = cleanCode.toLowerCase();
        activeBranchNames.push(cleanCode);
        activeBranchSet.add(lowerCode);
        activeBranchLookup.set(lowerCode, cleanName);
      }

      if (!lowerName.startsWith('sga')) {
        const sgaMotorsVariant = `SGA Motors ${cleanName}`;
        const sgaVariant = `SGA ${cleanName}`;
        activeBranchNames.push(sgaMotorsVariant);
        activeBranchNames.push(sgaVariant);
        activeBranchSet.add(sgaMotorsVariant.toLowerCase());
        activeBranchSet.add(sgaVariant.toLowerCase());
        activeBranchLookup.set(sgaMotorsVariant.toLowerCase(), cleanName);
        activeBranchLookup.set(sgaVariant.toLowerCase(), cleanName);
      }
    });

    const validPhoneCondition: any = {
      isInvalidPhone: false,
    };

    const invalidPhoneCondition: any = {
      isInvalidPhone: true,
    };

    const inStateCondition: any = {
      isOutOfState: false,
    };

    const outOfStateCondition: any = {
      isOutOfState: true,
    };

    const priorityFollowUpCondition: any = {
      OR: [
        { followUpDate1: { lte: todayEndOfDay, not: null } },
        { followUpDate2: { lte: todayEndOfDay, not: null } },
        { followUps: { some: { date: { lte: todayEndOfDay } } } },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...statsWhere };

    if (status) {
      const statusTokens = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statusTokens.length > 0) {
        const dbStatuses = new Set<string>();
        statusTokens.forEach(st => {
          if (st === 'not_contacted' || st === 'created') {
            dbStatuses.add('not_contacted');
            dbStatuses.add('created');
          } else if (st === 'pending') {
            dbStatuses.add('pending');
          } else if (st === 'callback') {
            dbStatuses.add('callback');
          } else if (st === 'live' || st === 'closed_successful') {
            dbStatuses.add('live');
            dbStatuses.add('closed_successful');
          } else if (st === 'lost' || st === 'closed_unsuccessful') {
            dbStatuses.add('lost');
            dbStatuses.add('closed_unsuccessful');
          } else {
            dbStatuses.add(st);
          }
        });
        where.status = { in: Array.from(dbStatuses) };
      }
    }

    if (category === 'valid') {
      where.AND = [
        ...(where.AND || []),
        validPhoneCondition,
        inStateCondition,
      ];
    } else if (category === 'invalid') {
      where.AND = [
        ...(where.AND || []),
        invalidPhoneCondition,
      ];
    } else if (category === 'outside' || category === 'unassigned') {
      where.AND = [
        ...(where.AND || []),
        validPhoneCondition,
        outOfStateCondition,
      ];
    } else if (category === 'priority') {
      where.AND = [
        ...(where.AND || []),
        validPhoneCondition,
        inStateCondition,
        priorityFollowUpCondition,
      ];
    }

    // Step 1: Lightweight aggregate check on the scoped where
    const aggregate = await prisma.lead.aggregate({
      where,
      _count: true,
      _max: {
        updatedAt: true,
      },
    });

    const count = aggregate._count || 0;
    const lastUpdated = aggregate._max.updatedAt || null;

    // If client provided a 'since' timestamp, check if anything changed
    if (since && lastUpdated) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        // If DB max updatedAt is <= client's timestamp, nothing has changed!
        if (lastUpdated.getTime() <= sinceDate.getTime()) {
          return NextResponse.json({
            hasChanges: false,
            changedLeads: [],
            count,
            lastUpdated: lastUpdated.toISOString(),
          });
        }

        // Fetch changed leads and fresh stats (including full categoryStats) in parallel
        const [
          changedLeads,
          statusCounts,
          validCount,
          invalidCount,
          outsideCount,
          allCount,
          priorityCount,
        ] = await Promise.all([
          prisma.lead.findMany({
            where: {
              ...where,
              updatedAt: { gt: sinceDate },
            },
            select: {
              id: true,
              name: true,
              phone: true,
              city: true,
              adname: true,
              carModel: true,
              branch: true,
              followUpDate1: true,
              followUpDate2: true,
              followUpCount: true,
              followUps: {
                select: { id: true, step: true, date: true, createdAt: true },
                orderBy: { step: 'asc' as const },
              },
              remark: true,
              status: true,
              testDrive: true,
              assignedConsultant: true,
              platform: true,
              source: true,
              uploadedById: true,
              uploadedBy: {
                select: { id: true, username: true }
              },
              uploadedAt: true,
              isBranchManual: true,
              isOutOfState: true,
              isInvalidPhone: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
          }),
          prisma.lead.groupBy({
            where: status || (category && category !== 'all') ? where : statsWhere,
            by: ['status'],
            _count: {
              status: true,
            },
          }),
          // 1. Valid: Tamil Nadu leads with valid phone number
          prisma.lead.count({
            where: {
              ...statsWhere,
              AND: [
                ...(statsWhere.AND || []),
                validPhoneCondition,
                inStateCondition,
              ],
            },
          }),
          // 2. Invalid: Leads with invalid phone number
          prisma.lead.count({
            where: {
              ...statsWhere,
              AND: [
                ...(statsWhere.AND || []),
                invalidPhoneCondition,
              ],
            },
          }),
          // 3. Outside: Leads outside Tamil Nadu with valid phone number
          prisma.lead.count({
            where: {
              ...statsWhere,
              AND: [
                ...(statsWhere.AND || []),
                validPhoneCondition,
                outOfStateCondition,
              ],
            },
          }),
          // 4. All leads matching active statsWhere filters
          prisma.lead.count({
            where: statsWhere,
          }),
          // 5. Priority follow-up leads
          prisma.lead.count({
            where: {
              ...statsWhere,
              AND: [
                ...(statsWhere.AND || []),
                validPhoneCondition,
                inStateCondition,
                priorityFollowUpCondition,
              ],
            },
          }),
        ]);

        if (changedLeads.length === 0) {
          return NextResponse.json({
            hasChanges: false,
            changedLeads: [],
            count,
            lastUpdated: lastUpdated.toISOString(),
          });
        }

        let totalLeads = 0;
        let notContactedLeads = 0;
        let pendingLeads = 0;
        let callbackLeads = 0;
        let liveLeads = 0;
        let lostLeads = 0;

        statusCounts.forEach((group) => {
          const c = group._count.status;
          totalLeads += c;
          if (group.status === 'not_contacted' || group.status === 'created') {
            notContactedLeads += c;
          } else if (group.status === 'pending') {
            pendingLeads += c;
          } else if (group.status === 'callback') {
            callbackLeads += c;
          } else if (['live', 'closed_successful'].includes(group.status)) {
            liveLeads += c;
          } else if (['lost', 'closed_unsuccessful'].includes(group.status)) {
            lostLeads += c;
          }
        });

        const categoryStats = {
          valid: validCount,
          invalid: invalidCount,
          outside: outsideCount,
          all: allCount,
          priority: priorityCount,
          unassigned: outsideCount,
        };

        const stats = {
          total: totalLeads,
          notContacted: notContactedLeads,
          pending: pendingLeads,
          callback: callbackLeads,
          live: liveLeads,
          lost: lostLeads,
          open: pendingLeads,
          closedSuccessful: liveLeads,
          closedUnsuccessful: lostLeads,
          categories: categoryStats,
        };

        // In-memory branch normalization for changed leads
        for (const lead of changedLeads) {
          const currentBranchTrimmed = (lead.branch || '').toLowerCase().trim();
          const normBranch = currentBranchTrimmed.replace(/^sga\s+(motors\s+)?/i, '').trim();
          if (currentBranchTrimmed) {
            if (activeBranchSet.has(currentBranchTrimmed)) {
              const canonical = activeBranchLookup.get(currentBranchTrimmed) || activeBranchLookup.get(normBranch);
              if (canonical) lead.branch = canonical;
            } else if (activeBranchSet.has(normBranch)) {
              const canonical = activeBranchLookup.get(normBranch);
              if (canonical) lead.branch = canonical;
            } else {
              lead.branch = '';
            }
          }
        }

        return NextResponse.json({
          hasChanges: true,
          changedLeads,
          count,
          stats,
          lastUpdated: lastUpdated.toISOString(),
        });
      }
    }

    // Default response if no 'since' provided
    return NextResponse.json({
      hasChanges: false,
      changedLeads: [],
      count,
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
    });
  } catch (error: any) {
    console.error('Leads check warning (transient network/DB error):', error?.message || error);
    return NextResponse.json({
      hasChanges: false,
      changedLeads: [],
      count: 0,
      lastUpdated: null,
      warning: 'Database temporarily unavailable',
    });
  }
}
