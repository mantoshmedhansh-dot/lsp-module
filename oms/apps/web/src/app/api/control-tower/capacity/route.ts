/**
 * Control Tower - Capacity Predictions Endpoint
 *
 * GET /api/control-tower/capacity - Get capacity predictions for all locations
 *
 * Returns:
 * - Overall capacity status (GREEN/YELLOW/RED)
 * - Per-location capacity breakdown
 * - Bottleneck identification
 * - Utilization percentages
 * - Recommendations
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
    const capacityStatus = await controlTower.getCapacityStatus();

    // Calculate aggregate metrics
    const locations = capacityStatus.locations;
    const totalPredictedVolume = locations.reduce((sum, l) => sum + l.predictedOrderVolume, 0);
    const avgUtilization = locations.length > 0
      ? Math.round(locations.reduce((sum, l) => {
          const maxUtil = Math.max(
            l.predictedUtilization.picking,
            l.predictedUtilization.packing,
            l.predictedUtilization.shipping
          );
          return sum + maxUtil;
        }, 0) / locations.length)
      : 0;

    // Identify bottlenecks across locations
    const bottlenecks = {
      picking: locations.filter(l => l.bottleneck === 'PICKING').length,
      packing: locations.filter(l => l.bottleneck === 'PACKING').length,
      shipping: locations.filter(l => l.bottleneck === 'SHIPPING').length,
      none: locations.filter(l => l.bottleneck === 'NONE').length,
    };

    // Status distribution
    const statusDistribution = {
      optimal: locations.filter(l => l.capacityStatus === 'OPTIMAL').length,
      stretched: locations.filter(l => l.capacityStatus === 'STRETCHED').length,
      overloaded: locations.filter(l => l.capacityStatus === 'OVERLOADED').length,
      underUtilized: locations.filter(l => l.capacityStatus === 'UNDER_UTILIZED').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        overall: capacityStatus.overall,
        locations: capacityStatus.locations,
        summary: {
          totalLocations: locations.length,
          totalPredictedVolume,
          avgUtilization,
          bottlenecks,
          statusDistribution,
        },
      },
    });
  } catch (error) {
    console.error('Capacity error:', error);
    return NextResponse.json(
      { error: 'Failed to get capacity data' },
      { status: 500 }
    );
  }
}
