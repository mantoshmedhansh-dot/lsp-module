/**
 * Anomaly Detection API
 *
 * GET /api/ai/anomaly - Get recent anomalies
 * POST /api/ai/anomaly - Analyze order for anomalies
 * POST /api/ai/anomaly/scan - Scan recent orders for anomalies
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createAnomalyDetector } from '@/lib/ai/anomaly';

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
    const hours = parseInt(searchParams.get('hours') || '24');

    const detector = createAnomalyDetector(companyId);
    const anomalies = await detector.scanRecentOrders(hours);

    // Group by severity
    const bySeverity = {
      critical: anomalies.filter(a => a.severity === 'CRITICAL'),
      high: anomalies.filter(a => a.severity === 'HIGH'),
      medium: anomalies.filter(a => a.severity === 'MEDIUM'),
      low: anomalies.filter(a => a.severity === 'LOW'),
    };

    return NextResponse.json({
      success: true,
      data: {
        anomalies,
        summary: {
          total: anomalies.length,
          critical: bySeverity.critical.length,
          high: bySeverity.high.length,
          medium: bySeverity.medium.length,
          low: bySeverity.low.length,
        },
        bySeverity,
      },
    });
  } catch (error) {
    console.error('Anomaly scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan for anomalies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = session.user.companyId;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 });
    }

    const body = await request.json();
    const { orderId, orderIds } = body;

    const detector = createAnomalyDetector(companyId);

    if (orderId) {
      // Single order analysis
      const result = await detector.analyzeOrder(orderId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    if (orderIds && Array.isArray(orderIds)) {
      // Batch analysis
      const results = await detector.analyzeOrders(orderIds);
      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    return NextResponse.json(
      { error: 'orderId or orderIds required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Anomaly analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze order' },
      { status: 500 }
    );
  }
}
