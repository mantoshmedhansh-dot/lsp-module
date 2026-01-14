/**
 * Control Tower API - Main Snapshot Endpoint
 *
 * GET /api/control-tower - Get complete control tower snapshot
 *
 * Returns:
 * - Real-time order metrics
 * - SLA predictions
 * - D0/D1/D2 performance predictions
 * - Capacity status
 * - Active alerts
 * - Carrier health
 * - Inventory health
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createControlTowerService } from '@/lib/ai/control-tower';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = session.user.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 });
    }

    const controlTower = createControlTowerService(companyId);
    const snapshot = await controlTower.getSnapshot();

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('Control Tower error:', error);
    return NextResponse.json(
      { error: 'Failed to get control tower data' },
      { status: 500 }
    );
  }
}
