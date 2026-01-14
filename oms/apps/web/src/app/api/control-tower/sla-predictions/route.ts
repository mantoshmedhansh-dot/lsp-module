/**
 * Control Tower - SLA Predictions Endpoint
 *
 * GET /api/control-tower/sla-predictions - Get SLA predictions for active orders
 *
 * Query params:
 * - limit: number of orders to analyze (default: 100)
 * - status: filter by predicted SLA status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createControlTowerService } from '@/lib/ai/control-tower';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = session.user.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const statusFilter = searchParams.get('status');

    const controlTower = createControlTowerService(companyId);
    let predictions = await controlTower.predictSLAForOrders(limit);

    // Apply status filter if provided
    if (statusFilter) {
      predictions = predictions.filter(p => p.predictedStatus === statusFilter);
    }

    // Calculate summary
    const summary = {
      total: predictions.length,
      onTrack: predictions.filter(p => p.predictedStatus === 'ON_TRACK').length,
      atRisk: predictions.filter(p => p.predictedStatus === 'AT_RISK').length,
      critical: predictions.filter(p => p.predictedStatus === 'CRITICAL').length,
      breached: predictions.filter(p => p.predictedStatus === 'BREACHED').length,
      avgBreachProbability: predictions.length > 0
        ? Math.round(predictions.reduce((sum, p) => sum + p.breachProbability, 0) / predictions.length * 100)
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        predictions,
        summary,
      },
    });
  } catch (error) {
    console.error('SLA Predictions error:', error);
    return NextResponse.json(
      { error: 'Failed to get SLA predictions' },
      { status: 500 }
    );
  }
}
