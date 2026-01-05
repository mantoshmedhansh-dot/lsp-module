import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";
import { getClientFromRequest } from "@/lib/client-auth";

export async function GET(request: NextRequest) {
  try {
    const client = await getClientFromRequest(request);
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");
    const category = searchParams.get("category"); // NDR, WEIGHT_DISPUTE, PAYMENT_DISPUTE, DAMAGE, etc.
    const status = searchParams.get("status");

    // Get exception counts by category
    const [
      ndrCount,
      weightDisputeCount,
      pendingAcknowledgmentCount,
    ] = await Promise.all([
      prisma.ndrCase.count({
        where: {
          order: { clientId: client.id },
          isResolved: false,
        },
      }),
      prisma.weightDispute.count({
        where: {
          clientId: client.id,
          status: { in: ["PENDING", "DISPUTED"] },
        },
      }),
      prisma.weightDispute.count({
        where: {
          clientId: client.id,
          status: "PENDING",
        },
      }),
    ]);

    // Get NDR cases
    let ndrCases: any[] = [];
    if (!category || category === "NDR") {
      const ndrWhere: any = {
        order: { clientId: client.id },
      };
      if (status) {
        ndrWhere.isResolved = status === "RESOLVED";
      }

      ndrCases = await prisma.ndrCase.findMany({
        where: ndrWhere,
        orderBy: { createdAt: "desc" },
        take: category === "NDR" ? pageSize : 10,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              awbNumber: true,
              customerName: true,
              customerPhone: true,
              deliveryAddress: true,
              deliveryPincode: true,
            },
          },
        },
      });
    }

    // Get weight disputes
    let weightDisputes: any[] = [];
    if (!category || category === "WEIGHT_DISPUTE") {
      const wdWhere: any = {
        clientId: client.id,
      };
      if (status) {
        wdWhere.status = status;
      }

      weightDisputes = await prisma.weightDispute.findMany({
        where: wdWhere,
        orderBy: { createdAt: "desc" },
        take: category === "WEIGHT_DISPUTE" ? pageSize : 10,
      });
    }

    // Get exception orders (status = EXCEPTION, NDR, RTO_INITIATED)
    let exceptionOrders: any[] = [];
    if (!category || category === "ORDER_EXCEPTION") {
      exceptionOrders = await prisma.order.findMany({
        where: {
          clientId: client.id,
          status: { in: ["EXCEPTION", "NDR", "RTO_INITIATED"] },
        },
        orderBy: { updatedAt: "desc" },
        take: category === "ORDER_EXCEPTION" ? pageSize : 10,
        select: {
          id: true,
          orderNumber: true,
          awbNumber: true,
          customerName: true,
          status: true,
          deliveryPincode: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          ndr: ndrCount,
          weightDispute: weightDisputeCount,
          pendingAcknowledgment: pendingAcknowledgmentCount,
          total: ndrCount + weightDisputeCount,
        },
        ndrCases: ndrCases.map((ndr) => ({
          id: ndr.id,
          orderId: ndr.order.id,
          orderNumber: ndr.order.orderNumber,
          awbNumber: ndr.order.awbNumber,
          customerName: ndr.order.customerName,
          customerPhone: ndr.order.customerPhone,
          deliveryAddress: ndr.order.deliveryAddress,
          reason: ndr.reason,
          reasonText: ndr.reasonText,
          attemptNumber: ndr.attemptNumber,
          maxAttempts: ndr.maxAttempts,
          action: ndr.action,
          isResolved: ndr.isResolved,
          rescheduledDate: ndr.rescheduledDate,
          createdAt: ndr.createdAt,
        })),
        weightDisputes: weightDisputes.map((wd) => ({
          id: wd.id,
          orderId: wd.orderId,
          declaredWeightKg: wd.declaredWeightKg,
          measuredWeightKg: wd.measuredWeightKg,
          chargeableDiff: wd.chargeableDiff,
          additionalCharge: wd.additionalCharge,
          status: wd.status,
          disputeReason: wd.disputeReason,
          createdAt: wd.createdAt,
        })),
        exceptionOrders,
      },
    });
  } catch (error) {
    console.error("Client exceptions error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
