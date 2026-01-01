import { NextRequest, NextResponse } from "next/server";
import { runAlertGenerators, cleanupExpiredAlerts } from "@/lib/prediction-engine/alert-generator";

// POST - Trigger alert generation
export async function POST(request: NextRequest) {
  try {
    // Run all alert generators
    const results = await runAlertGenerators();

    // Cleanup expired alerts
    const expiredCount = await cleanupExpiredAlerts();

    return NextResponse.json({
      success: true,
      data: {
        alertsGenerated: {
          slaBreaches: results.slaBreaches,
          hubCongestion: results.hubCongestion,
          stuckShipments: results.stuckShipments,
          total: results.slaBreaches + results.hubCongestion + results.stuckShipments,
        },
        expiredAlertsCleanedUp: expiredCount,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Alert Generation Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate alerts" },
      { status: 500 }
    );
  }
}
