import { NextRequest, NextResponse } from "next/server";
import { prisma, RateCardType, RateCardStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/rate-cards - List rate cards
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";
    const transporterId = searchParams.get("transporterId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status as RateCardStatus;
    }

    if (type) {
      where.type = type as RateCardType;
    }

    if (transporterId) {
      where.transporterId = transporterId;
    }

    const [rateCards, total] = await Promise.all([
      prisma.rateCard.findMany({
        where,
        include: {
          RateCardSlab: {
            orderBy: { fromWeight: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.rateCard.count({ where }),
    ]);

    return NextResponse.json({
      data: rateCards,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching rate cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate cards" },
      { status: 500 }
    );
  }
}

// POST /api/rate-cards - Create rate card
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
      effectiveFrom,
      effectiveTo,
      baseCost,
      fuelSurcharge,
      codChargesPercent,
      codChargesMin,
      codChargesCap,
      awbCharges,
      rtoChargesPercent,
      slabs,
      remarks,
    } = body;

    if (!name || !type || !transporterId || !companyId || !effectiveFrom) {
      return NextResponse.json(
        { error: "Name, type, transporter, company, and effective date are required" },
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

    // Generate rate card number
    const sequence = await prisma.sequence.upsert({
      where: { name: "rate_card" },
      update: { currentValue: { increment: 1 } },
      create: { name: "rate_card", prefix: "RC", currentValue: 1 },
    });

    const rateCardNo = `RC${String(sequence.currentValue).padStart(6, "0")}`;

    const rateCard = await prisma.rateCard.create({
      data: {
        rateCardNo,
        name,
        type: type as RateCardType,
        transporterId,
        companyId,
        effectiveFrom: new Date(effectiveFrom),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
        baseCost: baseCost || 0,
        fuelSurcharge,
        codChargesPercent,
        codChargesMin,
        codChargesCap,
        awbCharges,
        rtoChargesPercent,
        remarks,
        RateCardSlab: slabs && slabs.length > 0 ? {
          create: slabs.map((s: {
            fromWeight: number;
            toWeight: number;
            rate: number;
            additionalWeightRate?: number;
          }) => ({
            fromWeight: s.fromWeight,
            toWeight: s.toWeight,
            rate: s.rate,
            additionalWeightRate: s.additionalWeightRate,
          })),
        } : undefined,
      },
      include: {
        RateCardSlab: {
          orderBy: { fromWeight: "asc" },
        },
      },
    });

    return NextResponse.json(rateCard, { status: 201 });
  } catch (error) {
    console.error("Error creating rate card:", error);
    return NextResponse.json(
      { error: "Failed to create rate card" },
      { status: 500 }
    );
  }
}
