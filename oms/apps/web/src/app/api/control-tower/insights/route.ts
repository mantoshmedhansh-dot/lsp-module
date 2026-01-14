/**
 * Control Tower - Predictive Insights Endpoint
 *
 * GET /api/control-tower/insights - Get predictive insights and recommendations
 *
 * Returns actionable insights about:
 * - SLA risks
 * - Capacity constraints
 * - Carrier issues
 * - Inventory risks
 * - Demand spikes
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
    const insights = await controlTower.generateInsights();

    // Group by severity
    const critical = insights.filter(i => i.severity === 'CRITICAL');
    const warnings = insights.filter(i => i.severity === 'WARNING');
    const info = insights.filter(i => i.severity === 'INFO');

    // Calculate total impact
    const totalAffectedOrders = insights.reduce(
      (sum, i) => sum + (i.predictedImpact.affectedOrders || 0),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        insights,
        summary: {
          total: insights.length,
          critical: critical.length,
          warnings: warnings.length,
          info: info.length,
          totalAffectedOrders,
        },
        byType: {
          SLA_RISK: insights.filter(i => i.type === 'SLA_RISK'),
          CAPACITY_CONSTRAINT: insights.filter(i => i.type === 'CAPACITY_CONSTRAINT'),
          CARRIER_ISSUE: insights.filter(i => i.type === 'CARRIER_ISSUE'),
          INVENTORY_RISK: insights.filter(i => i.type === 'INVENTORY_RISK'),
          DEMAND_SPIKE: insights.filter(i => i.type === 'DEMAND_SPIKE'),
        },
      },
    });
  } catch (error) {
    console.error('Insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
