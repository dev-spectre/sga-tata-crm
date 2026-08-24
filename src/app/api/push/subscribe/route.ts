import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidatePushSubscriptionsCache } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, interval, deviceName } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const endpoint = subscription.endpoint;
    const keysJson = JSON.stringify(subscription.keys);
    const customInterval = parseInt(interval) || 5;

    const savedSub = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        keys: keysJson,
        interval: customInterval,
        deviceName: deviceName || 'Browser Device',
      },
      create: {
        endpoint,
        keys: keysJson,
        interval: customInterval,
        deviceName: deviceName || 'Browser Device',
      },
    });

    invalidatePushSubscriptionsCache();

    return NextResponse.json({ success: true, subscription: savedSub });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe to Web Push' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
      invalidatePushSubscriptionsCache();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}

