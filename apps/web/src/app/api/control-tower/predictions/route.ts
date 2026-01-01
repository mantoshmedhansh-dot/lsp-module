import { NextRequest, NextResponse } from "next/server";
import { generateBatchPredictions } from "@/lib/prediction-engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const riskLevel = searchParams.get("riskLevel");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Parse risk levels
    const riskLevels = riskLevel
      ? (riskLevel.split(",") as ("LOW" | "MEDIUM" | "HIGH")[])
      : undefined;

    // Parse statuses
    const statuses = status ? status.split(",") : undefined;

    // Generate predictions
    const result = await generateBatchPredictions(undefined, {
      riskLevel: riskLevels,
      status: statuses,
      limit,
      offset,
    });

    // Format response
    const items = result.predictions.map((p) => ({
      shipmentId: p.shipmentId,
      awbNumber: p.awbNumber,
      prediction: {
        predictedDeliveryTime: p.predictedDeliveryTime.toISOString(),
        originalExpectedTime: p.originalExpectedTime?.toISOString() || null,
        delayMinutes: p.delayMinutes,
        riskScore: p.riskScore,
        delayRisk: p.delayRisk,
        confidenceLow: p.confidenceLow.toISOString(),
        confidenceHigh: p.confidenceHigh.toISOString(),
        confidencePercent: p.confidencePercent,
        topFactors: p.factors.slice(0, 3).map((f) => ({
          factor: f.factor,
          description: f.description,
        })),
      },
      calculatedAt: p.calculatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          total: items.length,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
        },
        summary: result.summary,
      },
    });
  } catch (error) {
    console.error("Control Tower Predictions Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate predictions" },
      { status: 500 }
    );
  }
}
