/**
 * Demand Forecasting API
 *
 * GET /api/ai/forecast - Get demand forecasts
 * POST /api/ai/forecast - Generate forecast for specific SKUs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createDemandForecaster } from '@/lib/ai/forecasting';

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
    const skuId = searchParams.get('skuId');
    const locationId = searchParams.get('locationId') || undefined;
    const horizonDays = parseInt(searchParams.get('horizonDays') || '14');

    if (!skuId) {
      return NextResponse.json(
        { error: 'skuId is required' },
        { status: 400 }
      );
    }

    const forecaster = createDemandForecaster(companyId);
    const forecast = await forecaster.forecastSKU(skuId, horizonDays);

    return NextResponse.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    console.error('Forecast error:', error);
    return NextResponse.json(
      { error: 'Failed to generate forecast' },
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
    const { skuIds, locationId, horizonDays = 14, granularity = 'DAILY' } = body;

    if (!skuIds || !Array.isArray(skuIds) || skuIds.length === 0) {
      return NextResponse.json(
        { error: 'skuIds array is required' },
        { status: 400 }
      );
    }

    const forecaster = createDemandForecaster(companyId);

    // Generate forecasts for multiple SKUs
    const forecasts = await forecaster.forecastMultipleSKUs({
      skuIds,
      horizonDays,
      locationId,
      granularity,
    });

    // Get inventory recommendations
    const recommendations = await forecaster.getInventoryRecommendations(locationId);

    // Calculate summary
    const trendSummary = {
      increasing: forecasts.filter(f => f.trend === 'INCREASING').length,
      stable: forecasts.filter(f => f.trend === 'STABLE').length,
      decreasing: forecasts.filter(f => f.trend === 'DECREASING').length,
    };

    const actionSummary = {
      reorderNow: recommendations.filter(r => r.action === 'REORDER_NOW').length,
      reorderSoon: recommendations.filter(r => r.action === 'REORDER_SOON').length,
      adequate: recommendations.filter(r => r.action === 'ADEQUATE').length,
      overstock: recommendations.filter(r => r.action === 'OVERSTOCK').length,
      critical: recommendations.filter(r => r.action === 'CRITICAL').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        forecasts,
        recommendations,
        summary: {
          totalSKUs: skuIds.length,
          horizonDays,
          trendSummary,
          actionSummary,
        },
      },
    });
  } catch (error) {
    console.error('Batch forecast error:', error);
    return NextResponse.json(
      { error: 'Failed to generate forecasts' },
      { status: 500 }
    );
  }
}
