import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";

interface AvailableInventory {
  skuId: string;
  skuCode: string;
  skuName: string;
  locationId: string;
  locationName: string;
  physicalQty: number;
  reservedQty: number;
  virtualReserves: {
    channelReserve: number;
    preorder: number;
    promotional: number;
    safetyStock: number;
  };
  availableQty: number;
  availableToPromise: number;
}

// GET /api/inventory/available - Calculate available inventory
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get("skuId");
    const locationId = searchParams.get("locationId");
    const channel = searchParams.get("channel");

    const inventoryWhere: Record<string, unknown> = {};
    if (skuId) inventoryWhere.skuId = skuId;
    if (locationId) inventoryWhere.locationId = locationId;

    // Get physical inventory
    const inventory = await prisma.inventory.findMany({
      where: inventoryWhere,
      include: {
        SKU: {
          select: { id: true, code: true, name: true },
        },
        Location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Get virtual inventory
    const virtualWhere: Record<string, unknown> = {
      isActive: true,
      OR: [
        { validTo: null },
        { validTo: { gte: new Date() } },
      ],
    };
    if (skuId) virtualWhere.skuId = skuId;
    if (locationId) virtualWhere.locationId = locationId;
    if (channel) virtualWhere.channel = channel;

    const virtualInventory = await prisma.virtualInventory.findMany({
      where: virtualWhere,
    });

    // Calculate available inventory
    const availableInventory: AvailableInventory[] = inventory.map((inv) => {
      const virtualForSku = virtualInventory.filter(
        (vi) => vi.skuId === inv.skuId && vi.locationId === inv.locationId
      );

      const channelReserve = virtualForSku
        .filter((vi) => vi.type === "CHANNEL_RESERVE")
        .reduce((sum, vi) => sum + vi.quantity - vi.allocatedQty, 0);

      const preorder = virtualForSku
        .filter((vi) => vi.type === "PREORDER")
        .reduce((sum, vi) => sum + vi.quantity - vi.allocatedQty, 0);

      const promotional = virtualForSku
        .filter((vi) => vi.type === "PROMOTIONAL")
        .reduce((sum, vi) => sum + vi.quantity - vi.allocatedQty, 0);

      const safetyStock = virtualForSku
        .filter((vi) => vi.type === "SAFETY_STOCK")
        .reduce((sum, vi) => sum + vi.quantity, 0);

      const totalVirtualReserved = channelReserve + preorder + promotional;
      const physicalQty = inv.quantity;
      const reservedQty = inv.reservedQty;
      const availableQty = Math.max(0, physicalQty - reservedQty - totalVirtualReserved - safetyStock);
      const availableToPromise = Math.max(0, physicalQty - reservedQty - safetyStock);

      return {
        skuId: inv.skuId,
        skuCode: inv.SKU.code,
        skuName: inv.SKU.name,
        locationId: inv.locationId,
        locationName: inv.Location.name,
        physicalQty,
        reservedQty,
        virtualReserves: {
          channelReserve,
          preorder,
          promotional,
          safetyStock,
        },
        availableQty,
        availableToPromise,
      };
    });

    // Summary statistics
    const summary = {
      totalPhysical: availableInventory.reduce((sum, i) => sum + i.physicalQty, 0),
      totalReserved: availableInventory.reduce((sum, i) => sum + i.reservedQty, 0),
      totalVirtualReserved: availableInventory.reduce(
        (sum, i) =>
          sum +
          i.virtualReserves.channelReserve +
          i.virtualReserves.preorder +
          i.virtualReserves.promotional,
        0
      ),
      totalSafetyStock: availableInventory.reduce(
        (sum, i) => sum + i.virtualReserves.safetyStock,
        0
      ),
      totalAvailable: availableInventory.reduce((sum, i) => sum + i.availableQty, 0),
      totalATP: availableInventory.reduce((sum, i) => sum + i.availableToPromise, 0),
    };

    return NextResponse.json({
      data: availableInventory,
      summary,
    });
  } catch (error) {
    console.error("Error calculating available inventory:", error);
    return NextResponse.json(
      { error: "Failed to calculate available inventory" },
      { status: 500 }
    );
  }
}
