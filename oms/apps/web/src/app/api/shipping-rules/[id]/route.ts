import { NextRequest, NextResponse } from "next/server";
import { prisma, ShippingRuleType, RuleStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/shipping-rules/[id] - Get shipping rule details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const rule = await prisma.shippingRule.findUnique({
      where: { id },
      include: {
        ShippingRuleCondition: true,
      },
    });

    if (!rule) {
      return NextResponse.json({ error: "Shipping rule not found" }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error fetching shipping rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping rule" },
      { status: 500 }
    );
  }
}

// PATCH /api/shipping-rules/[id] - Update shipping rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, type, transporterId, priority, status, conditions } = body;

    const existingRule = await prisma.shippingRule.findUnique({
      where: { id },
      include: { ShippingRuleCondition: true },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Shipping rule not found" }, { status: 404 });
    }

    // Update rule
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as ShippingRuleType;
    if (transporterId !== undefined) updateData.transporterId = transporterId;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status as RuleStatus;

    // Handle conditions update
    if (conditions !== undefined) {
      // Delete existing conditions
      await prisma.shippingRuleCondition.deleteMany({
        where: { ruleId: id },
      });

      // Create new conditions
      if (conditions.length > 0) {
        await prisma.shippingRuleCondition.createMany({
          data: conditions.map((c: {
            conditionType: string;
            operator: string;
            value: unknown;
          }) => ({
            ruleId: id,
            conditionType: c.conditionType,
            operator: c.operator,
            value: c.value,
          })),
        });
      }
    }

    const rule = await prisma.shippingRule.update({
      where: { id },
      data: updateData,
      include: {
        ShippingRuleCondition: true,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error updating shipping rule:", error);
    return NextResponse.json(
      { error: "Failed to update shipping rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/shipping-rules/[id] - Delete shipping rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existingRule = await prisma.shippingRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Shipping rule not found" }, { status: 404 });
    }

    // Delete conditions first
    await prisma.shippingRuleCondition.deleteMany({
      where: { ruleId: id },
    });

    // Delete rule
    await prisma.shippingRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Shipping rule deleted" });
  } catch (error) {
    console.error("Error deleting shipping rule:", error);
    return NextResponse.json(
      { error: "Failed to delete shipping rule" },
      { status: 500 }
    );
  }
}
