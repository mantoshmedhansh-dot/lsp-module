import { NextRequest, NextResponse } from "next/server";
import { prisma, ShippingRuleType, RuleStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/shipping-rules - List shipping rules
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const locationId = searchParams.get("locationId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status as RuleStatus;
    }

    if (type) {
      where.type = type as ShippingRuleType;
    }

    // ShippingRule doesn't have locationId - filter by transporterId if needed
    const [rules, total] = await Promise.all([
      prisma.shippingRule.findMany({
        where,
        include: {
          ShippingRuleCondition: true,
        },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.shippingRule.count({ where }),
    ]);

    return NextResponse.json({
      data: rules,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching shipping rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipping rules" },
      { status: 500 }
    );
  }
}

// POST /api/shipping-rules - Create shipping rule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      type,
      transporterId,
      companyId,
      priority,
      description,
      conditions,
    } = body;

    if (!name || !type || !transporterId || !companyId) {
      return NextResponse.json(
        { error: "Name, type, transporter, and company are required" },
        { status: 400 }
      );
    }

    // Validate transporter exists
    const transporter = await prisma.transporter.findUnique({
      where: { id: transporterId },
    });

    if (!transporter) {
      return NextResponse.json(
        { error: "Transporter not found" },
        { status: 400 }
      );
    }

    // Generate rule number
    const sequence = await prisma.sequence.upsert({
      where: { name: "shipping_rule" },
      update: { currentValue: { increment: 1 } },
      create: { name: "shipping_rule", prefix: "SR", currentValue: 1 },
    });

    const ruleNo = `SR${String(sequence.currentValue).padStart(6, "0")}`;

    const rule = await prisma.shippingRule.create({
      data: {
        ruleNo,
        name,
        type: type as ShippingRuleType,
        transporterId,
        companyId,
        priority: priority || 0,
        description,
        ShippingRuleCondition: conditions && conditions.length > 0 ? {
          create: conditions.map((c: {
            conditionType: string;
            operator: string;
            value: unknown;
          }) => ({
            conditionType: c.conditionType,
            operator: c.operator,
            value: c.value,
          })),
        } : undefined,
      },
      include: {
        ShippingRuleCondition: true,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating shipping rule:", error);
    return NextResponse.json(
      { error: "Failed to create shipping rule" },
      { status: 500 }
    );
  }
}
