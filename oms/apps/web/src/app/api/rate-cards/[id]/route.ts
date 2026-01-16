import { NextRequest, NextResponse } from "next/server";
import { prisma, RateCardType, RateCardStatus } from "@oms/database";
import { auth } from "@/lib/auth";

// GET /api/rate-cards/[id] - Get rate card details
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

    const rateCard = await prisma.rateCard.findUnique({
      where: { id },
      include: {
        RateCardSlab: {
          orderBy: { fromWeight: "asc" },
        },
      },
    });

    if (!rateCard) {
      return NextResponse.json({ error: "Rate card not found" }, { status: 404 });
    }

    return NextResponse.json(rateCard);
  } catch (error) {
    console.error("Error fetching rate card:", error);
    return NextResponse.json(
      { error: "Failed to fetch rate card" },
      { status: 500 }
    );
  }
}

// PATCH /api/rate-cards/[id] - Update rate card
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
    const {
      name,
      type,
      status,
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

    const existingCard = await prisma.rateCard.findUnique({
      where: { id },
    });

    if (!existingCard) {
      return NextResponse.json({ error: "Rate card not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type as RateCardType;
    if (status !== undefined) updateData.status = status as RateCardStatus;
    if (effectiveFrom !== undefined) updateData.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : null;
    if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    if (baseCost !== undefined) updateData.baseCost = baseCost;
    if (fuelSurcharge !== undefined) updateData.fuelSurcharge = fuelSurcharge;
    if (codChargesPercent !== undefined) updateData.codChargesPercent = codChargesPercent;
    if (codChargesMin !== undefined) updateData.codChargesMin = codChargesMin;
    if (codChargesCap !== undefined) updateData.codChargesCap = codChargesCap;
    if (awbCharges !== undefined) updateData.awbCharges = awbCharges;
    if (rtoChargesPercent !== undefined) updateData.rtoChargesPercent = rtoChargesPercent;
    if (remarks !== undefined) updateData.remarks = remarks;

    // Handle slabs update
    if (slabs !== undefined) {
      // Delete existing slabs
      await prisma.rateCardSlab.deleteMany({
        where: { rateCardId: id },
      });

      // Create new slabs
      if (slabs.length > 0) {
        await prisma.rateCardSlab.createMany({
          data: slabs.map((s: {
            fromWeight: number;
            toWeight: number;
            rate: number;
            additionalWeightRate?: number;
          }) => ({
            rateCardId: id,
            fromWeight: s.fromWeight,
            toWeight: s.toWeight,
            rate: s.rate,
            additionalWeightRate: s.additionalWeightRate,
          })),
        });
      }
    }

    const rateCard = await prisma.rateCard.update({
      where: { id },
      data: updateData,
      include: {
        RateCardSlab: {
          orderBy: { fromWeight: "asc" },
        },
      },
    });

    return NextResponse.json(rateCard);
  } catch (error) {
    console.error("Error updating rate card:", error);
    return NextResponse.json(
      { error: "Failed to update rate card" },
      { status: 500 }
    );
  }
}

// DELETE /api/rate-cards/[id] - Delete rate card
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

    const existingCard = await prisma.rateCard.findUnique({
      where: { id },
    });

    if (!existingCard) {
      return NextResponse.json({ error: "Rate card not found" }, { status: 404 });
    }

    // Delete slabs first
    await prisma.rateCardSlab.deleteMany({
      where: { rateCardId: id },
    });

    // Delete rate card
    await prisma.rateCard.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Rate card deleted" });
  } catch (error) {
    console.error("Error deleting rate card:", error);
    return NextResponse.json(
      { error: "Failed to delete rate card" },
      { status: 500 }
    );
  }
}
