import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { calculateSLA, trackSLACompliance } from "@/lib/intelligent-orchestration";

/**
 * SLA Management API - OMS Backend
 *
 * Provides SLA calculation and tracking:
 * - Calculate SLA for new orders
 * - Track SLA compliance
 * - SLA dashboard overview
 */

// GET /api/sla - Get SLA status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const action = searchParams.get("action");

    // Track specific order SLA
    if (orderId && action === "track") {
      const result = await trackSLACompliance(orderId);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // SLA dashboard overview
    if (action === "dashboard") {
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));

      const [
        totalOrders,
        atRiskOrders,
        breachedOrders,
        todayDeliveries,
      ] = await Promise.all([
        prisma.order.count({
          where: {
            status: { notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"] },
          },
        }),
        prisma.order.count({
          where: {
            status: { notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"] },
            promisedDate: {
              lte: new Date(Date.now() + 4 * 60 * 60 * 1000), // Within 4 hours
              gt: now,
            },
          },
        }),
        prisma.order.count({
          where: {
            status: { notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"] },
            promisedDate: { lt: now },
          },
        }),
        prisma.order.count({
          where: {
            status: "DELIVERED",
            updatedAt: { gte: startOfDay },
          },
        }),
      ]);

      const onTrack = totalOrders - atRiskOrders - breachedOrders;
      const complianceRate = totalOrders > 0
        ? ((onTrack / totalOrders) * 100).toFixed(1)
        : "100";

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            total: totalOrders,
            onTrack,
            atRisk: atRiskOrders,
            breached: breachedOrders,
            complianceRate: parseFloat(complianceRate),
          },
          todayDeliveries,
        },
      });
    }

    // Get orders by SLA status
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const slaStatus = searchParams.get("slaStatus"); // ON_TRACK, AT_RISK, BREACHED

    const now = new Date();
    let dateFilter: any = {};

    if (slaStatus === "BREACHED") {
      dateFilter = { lt: now };
    } else if (slaStatus === "AT_RISK") {
      dateFilter = {
        lte: new Date(Date.now() + 4 * 60 * 60 * 1000),
        gt: now,
      };
    } else if (slaStatus === "ON_TRACK") {
      dateFilter = { gt: new Date(Date.now() + 4 * 60 * 60 * 1000) };
    }

    const where: any = {
      status: { notIn: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"] },
    };

    if (Object.keys(dateFilter).length > 0) {
      where.promisedDate = dateFilter;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          Location: { select: { code: true, name: true } },
          Delivery: {
            select: {
              awbNo: true,
              Transporter: { select: { code: true, name: true } },
            },
            take: 1,
          },
        },
        orderBy: { promisedDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        orders: orders.map(o => ({
          id: o.id,
          orderNo: o.orderNo,
          customer: o.customerName,
          status: o.status,
          promisedDate: o.promisedDate,
          slaStatus: !o.promisedDate ? "UNKNOWN"
            : o.promisedDate < now ? "BREACHED"
            : o.promisedDate < new Date(Date.now() + 4 * 60 * 60 * 1000) ? "AT_RISK"
            : "ON_TRACK",
          location: o.Location,
          transporter: o.Delivery[0]?.Transporter,
          awbNo: o.Delivery[0]?.awbNo,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("SLA API error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch SLA data",
    }, { status: 500 });
  }
}

// POST /api/sla - Calculate or update SLA
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Calculate SLA for new order
    if (action === "calculate") {
      const {
        orderType = "STANDARD",
        originPincode,
        destinationPincode,
        orderPlacedAt,
      } = body;

      if (!originPincode || !destinationPincode) {
        return NextResponse.json({
          success: false,
          error: "Origin and destination pincodes required",
        }, { status: 400 });
      }

      const sla = calculateSLA({
        orderType,
        originPincode,
        destinationPincode,
        orderPlacedAt: orderPlacedAt ? new Date(orderPlacedAt) : new Date(),
      });

      return NextResponse.json({
        success: true,
        data: {
          promisedDeliveryDate: sla.promisedDeliveryDate.toISOString(),
          tatDays: sla.tatDays,
          slaType: sla.slaType,
          riskLevel: sla.riskLevel,
          milestones: sla.milestones.map(m => ({
            ...m,
            expectedBy: m.expectedBy.toISOString(),
          })),
        },
      });
    }

    // Update order SLA
    if (action === "update") {
      const { orderId, promisedDate, reason } = body;

      if (!orderId || !promisedDate) {
        return NextResponse.json({
          success: false,
          error: "orderId and promisedDate required",
        }, { status: 400 });
      }

      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          promisedDate: new Date(promisedDate),
          remarks: reason ? `SLA updated: ${reason}` : undefined,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          promisedDate: order.promisedDate,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action",
    }, { status: 400 });
  } catch (error) {
    console.error("SLA POST error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to process SLA request",
    }, { status: 500 });
  }
}
