import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// GET - List manifests or get specific manifest
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const manifestId = searchParams.get("manifestId");
    const tripId = searchParams.get("tripId");
    const hubId = searchParams.get("hubId");
    const format = searchParams.get("format") || "json";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    // Get specific trip manifest
    if (tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        return NextResponse.json(
          { success: false, error: "Trip not found" },
          { status: 404 }
        );
      }

      // Get vehicle if vehicleId exists
      const vehicle = trip.vehicleId
        ? await prisma.vehicle.findUnique({
            where: { id: trip.vehicleId },
            select: { registrationNo: true, type: true },
          })
        : null;

      // Get driver if driverId exists
      const driver = trip.driverId
        ? await prisma.driver.findUnique({
            where: { id: trip.driverId },
            select: { name: true, phone: true },
          })
        : null;

      // Get shipments for this trip via legs
      const legs = await prisma.shipmentLeg.findMany({
        where: { tripId },
        select: { shipmentId: true },
      });
      const shipmentIds = legs.map((l) => l.shipmentId);

      const shipments = await prisma.shipment.findMany({
        where: {
          id: { in: shipmentIds },
        },
        select: {
          id: true,
          awbNumber: true,
          clientId: true,
          consigneeName: true,
          consigneeCity: true,
          consigneePincode: true,
          pieces: true,
          actualWeightKg: true,
          paymentMode: true,
          codAmount: true,
          status: true,
        },
      });

      // Get client names
      const clientIds = [...new Set(shipments.map((s) => s.clientId))];
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, companyName: true },
      });
      const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

      // Get origin/destination hubs
      const originHub = trip.originHubId
        ? await prisma.hub.findUnique({
            where: { id: trip.originHubId },
            select: { id: true, code: true, name: true, city: true },
          })
        : null;

      const destHub = trip.destinationHubId
        ? await prisma.hub.findUnique({
            where: { id: trip.destinationHubId },
            select: { id: true, code: true, name: true, city: true },
          })
        : null;

      const manifest = {
        manifestNumber: `MN-${trip.tripNumber}`,
        tripNumber: trip.tripNumber,
        tripId: trip.id,

        // Route
        originHub,
        destinationHub: destHub,

        // Vehicle
        vehicle: vehicle
          ? {
              regNo: vehicle.registrationNo,
              type: vehicle.type,
            }
          : null,

        // Driver
        driverName: driver?.name || null,
        driverPhone: driver?.phone || null,

        // Shipment summary
        totalShipments: shipments.length,
        totalPieces: shipments.reduce((sum, s) => sum + (s.pieces || 1), 0),
        totalWeight: shipments.reduce((sum, s) => sum + (s.actualWeightKg || 0), 0),
        totalCod: shipments
          .filter((s) => s.paymentMode === "COD")
          .reduce((sum, s) => sum + (s.codAmount || 0), 0),
        codShipments: shipments.filter((s) => s.paymentMode === "COD").length,

        // Shipment details
        shipments: shipments.map((s) => ({
          awbNumber: s.awbNumber,
          clientName: clientMap.get(s.clientId) || "",
          consigneeName: s.consigneeName,
          destination: `${s.consigneeCity} - ${s.consigneePincode}`,
          pieces: s.pieces,
          weight: s.actualWeightKg,
          isCod: s.paymentMode === "COD",
          codAmount: s.codAmount,
          status: s.status,
        })),

        // Timestamps
        departureTime: trip.actualDeparture || trip.scheduledDeparture,
        expectedArrival: trip.scheduledArrival,
        generatedAt: new Date().toISOString(),
      };

      if (format === "html") {
        return new NextResponse(generateManifestHtml(manifest), {
          headers: { "Content-Type": "text/html" },
        });
      }

      return NextResponse.json({
        success: true,
        data: manifest,
      });
    }

    // List recent manifests (from trips)
    const where: any = {};
    if (hubId) {
      where.OR = [{ originHubId: hubId }, { destinationHubId: hubId }];
    }

    const trips = await prisma.trip.findMany({
      where: {
        ...where,
        status: { not: "DRAFT" },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    // Get hub info
    const hubIds = [
      ...new Set([
        ...trips.map((t) => t.originHubId).filter(Boolean),
        ...trips.map((t) => t.destinationHubId).filter(Boolean),
      ]),
    ] as string[];

    const hubs = await prisma.hub.findMany({
      where: { id: { in: hubIds } },
      select: { id: true, code: true, name: true },
    });
    const hubMap = new Map(hubs.map((h) => [h.id, h]));

    // Get vehicle and driver info
    const vehicleIds = trips.map((t) => t.vehicleId).filter(Boolean) as string[];
    const driverIds = trips.map((t) => t.driverId).filter(Boolean) as string[];

    const [vehicles, drivers] = await Promise.all([
      prisma.vehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: { id: true, registrationNo: true },
      }),
      prisma.driver.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, name: true },
      }),
    ]);

    const vehicleMap = new Map(vehicles.map((v) => [v.id, v.registrationNo]));
    const driverMap = new Map(drivers.map((d) => [d.id, d.name]));

    const manifests = trips.map((trip) => ({
      manifestNumber: `MN-${trip.tripNumber}`,
      tripId: trip.id,
      tripNumber: trip.tripNumber,
      originHub: trip.originHubId ? hubMap.get(trip.originHubId) : null,
      destinationHub: trip.destinationHubId ? hubMap.get(trip.destinationHubId) : null,
      vehicleRegNo: trip.vehicleId ? vehicleMap.get(trip.vehicleId) : null,
      driverName: trip.driverId ? driverMap.get(trip.driverId) : null,
      status: trip.status,
      departureTime: trip.actualDeparture || trip.scheduledDeparture,
      createdAt: trip.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        manifests,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error("Manifest Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate manifest" },
      { status: 500 }
    );
  }
}

// POST - Generate a new manifest (pickup manifest, delivery manifest, etc.)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, hubId, awbNumbers, driverId, notes } = body;

    if (!type || !awbNumbers || awbNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Type and AWB numbers required" },
        { status: 400 }
      );
    }

    // Find shipments
    const shipments = await prisma.shipment.findMany({
      where: { awbNumber: { in: awbNumbers } },
    });

    if (shipments.length === 0) {
      return NextResponse.json(
        { success: false, error: "No shipments found" },
        { status: 404 }
      );
    }

    // Get hub
    const hub = hubId
      ? await prisma.hub.findUnique({
          where: { id: hubId },
          select: { id: true, code: true, name: true, city: true },
        })
      : null;

    // Get client names
    const clientIds = [...new Set(shipments.map((s) => s.clientId))];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, companyName: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

    // Generate manifest number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    const manifestNumber = `${type.substring(0, 2).toUpperCase()}${dateStr}${random}`;

    const manifest = {
      manifestNumber,
      type, // PICKUP, DELIVERY, INSCAN, OUTSCAN, HANDOVER
      generatedAt: new Date().toISOString(),
      hub,

      // Summary
      totalShipments: shipments.length,
      totalPieces: shipments.reduce((sum, s) => sum + (s.pieces || 1), 0),
      totalWeight: shipments.reduce((sum, s) => sum + (s.actualWeightKg || 0), 0),
      totalCod: shipments
        .filter((s) => s.paymentMode === "COD")
        .reduce((sum, s) => sum + (s.codAmount || 0), 0),

      // Shipments
      shipments: shipments.map((s) => ({
        awbNumber: s.awbNumber,
        clientName: clientMap.get(s.clientId) || "",
        consigneeName: s.consigneeName,
        destination: `${s.consigneeCity} - ${s.consigneePincode}`,
        pieces: s.pieces,
        weight: s.actualWeightKg,
        isCod: s.paymentMode === "COD",
        codAmount: s.codAmount,
      })),

      notes,
    };

    return NextResponse.json({
      success: true,
      data: manifest,
    });
  } catch (error) {
    console.error("Manifest Create Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create manifest" },
      { status: 500 }
    );
  }
}

function generateManifestHtml(manifest: any): string {
  const shipmentsRows = manifest.shipments
    .map(
      (s: any, i: number) => `
    <tr>
      <td style="padding: 5px; border: 1px solid #ddd;">${i + 1}</td>
      <td style="padding: 5px; border: 1px solid #ddd;">${s.awbNumber}</td>
      <td style="padding: 5px; border: 1px solid #ddd;">${s.clientName}</td>
      <td style="padding: 5px; border: 1px solid #ddd;">${s.consigneeName}</td>
      <td style="padding: 5px; border: 1px solid #ddd;">${s.destination}</td>
      <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.pieces}</td>
      <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${s.weight} kg</td>
      <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${s.isCod ? `₹${s.codAmount}` : "-"}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Manifest - ${manifest.manifestNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f5f5f5; padding: 8px; border: 1px solid #ddd; text-align: left; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0;">CJDarcl Quick Logistics</h2>
          <p style="margin: 5px 0;">Trip Manifest</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0;">${manifest.manifestNumber}</h3>
          <p style="margin: 5px 0;">Trip: ${manifest.tripNumber}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <p><strong>Origin:</strong> ${manifest.originHub?.name || "-"} (${manifest.originHub?.code || "-"})</p>
          <p><strong>Destination:</strong> ${manifest.destinationHub?.name || "-"} (${manifest.destinationHub?.code || "-"})</p>
        </div>
        <div>
          <p><strong>Vehicle:</strong> ${manifest.vehicle?.regNo || "-"}</p>
          <p><strong>Driver:</strong> ${manifest.driverName || "-"} (${manifest.driverPhone || "-"})</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f5f5f5; padding: 10px; margin-bottom: 20px;">
        <div><strong>Shipments:</strong> ${manifest.totalShipments}</div>
        <div><strong>Pieces:</strong> ${manifest.totalPieces}</div>
        <div><strong>Weight:</strong> ${manifest.totalWeight.toFixed(2)} kg</div>
        <div><strong>COD:</strong> ₹${manifest.totalCod} (${manifest.codShipments} orders)</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>AWB</th>
            <th>Client</th>
            <th>Consignee</th>
            <th>Destination</th>
            <th>Pcs</th>
            <th>Weight</th>
            <th>COD</th>
          </tr>
        </thead>
        <tbody>
          ${shipmentsRows}
        </tbody>
      </table>

      <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
        <div>
          <p style="border-top: 1px solid #000; padding-top: 10px; margin-top: 40px;">Dispatch Signature</p>
        </div>
        <div>
          <p style="border-top: 1px solid #000; padding-top: 10px; margin-top: 40px;">Driver Signature</p>
        </div>
        <div>
          <p style="border-top: 1px solid #000; padding-top: 10px; margin-top: 40px;">Received By</p>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #666;">
        Generated: ${manifest.generatedAt} | Departure: ${manifest.departureTime || "TBD"}
      </div>
    </body>
    </html>
  `;
}
