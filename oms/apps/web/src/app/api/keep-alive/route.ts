/**
 * Keep-Alive Cron Job
 *
 * This endpoint is called every 10 minutes by Vercel Cron
 * to keep the Render backend server warm and prevent cold starts.
 *
 * Cold starts on Render free tier can take 30-50 seconds.
 * By pinging the server regularly, we keep it responsive.
 */

import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://lsp-oms-api.onrender.com";

export async function GET() {
  const startTime = Date.now();

  try {
    // Ping the backend health endpoint
    const healthResponse = await fetch(`${BACKEND_URL}/health`, {
      method: "GET",
      headers: {
        "User-Agent": "VercelCron/1.0",
      },
    });

    // Also ping the dashboard ping endpoint to warm up that route
    const pingResponse = await fetch(`${BACKEND_URL}/api/v1/dashboard/ping`, {
      method: "GET",
      headers: {
        "User-Agent": "VercelCron/1.0",
      },
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: "Backend server is warm",
      healthStatus: healthResponse.status,
      pingStatus: pingResponse.status,
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: false,
      message: "Failed to ping backend",
      error: error instanceof Error ? error.message : "Unknown error",
      responseTime: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Allow this endpoint to be called without authentication
export const dynamic = "force-dynamic";
export const runtime = "edge";
