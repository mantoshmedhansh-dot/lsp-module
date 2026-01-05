import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// GET - Generate label data for shipment(s)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const awb = searchParams.get("awb");
    const awbList = searchParams.get("awbList"); // Comma-separated for bulk
    const shipmentId = searchParams.get("shipmentId");
    const format = searchParams.get("format") || "json"; // json, html

    let shipments: any[] = [];

    if (awb) {
      const shipment = await prisma.shipment.findUnique({
        where: { awbNumber: awb },
      });
      if (shipment) shipments = [shipment];
    } else if (awbList) {
      const awbNumbers = awbList.split(",").map((a) => a.trim());
      shipments = await prisma.shipment.findMany({
        where: { awbNumber: { in: awbNumbers } },
      });
    } else if (shipmentId) {
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
      });
      if (shipment) shipments = [shipment];
    } else {
      return NextResponse.json(
        { success: false, error: "AWB or shipmentId required" },
        { status: 400 }
      );
    }

    if (shipments.length === 0) {
      return NextResponse.json(
        { success: false, error: "No shipments found" },
        { status: 404 }
      );
    }

    // Get client info
    const clientIds = [...new Set(shipments.map((s) => s.clientId))];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, companyName: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

    // Generate label data
    const labels = shipments.map((shipment) => ({
      // AWB & Barcodes
      awbNumber: shipment.awbNumber,
      barcodeData: shipment.awbNumber,
      qrData: JSON.stringify({
        awb: shipment.awbNumber,
        dest: shipment.consigneePincode,
        cod: shipment.paymentMode === "COD" ? shipment.codAmount : 0,
      }),

      // Client
      clientName: clientMap.get(shipment.clientId) || "",
      orderRef: shipment.clientOrderRef,

      // Shipper
      shipper: {
        name: shipment.shipperName,
        address: shipment.shipperAddress,
        city: shipment.shipperCity,
        state: shipment.shipperState,
        pincode: shipment.shipperPincode,
        phone: shipment.shipperPhone,
      },

      // Consignee
      consignee: {
        name: shipment.consigneeName,
        address: shipment.consigneeAddress,
        city: shipment.consigneeCity,
        state: shipment.consigneeState,
        pincode: shipment.consigneePincode,
        phone: shipment.consigneePhone,
      },

      // Shipment details
      pieces: shipment.numberOfPieces,
      weight: shipment.actualWeightKg,
      volumetricWeight: shipment.volumetricWeightKg,
      chargeableWeight: shipment.chargeableWeightKg,
      dimensions: shipment.dimensions,

      // Payment
      paymentMode: shipment.paymentMode,
      codAmount: shipment.codAmount,
      isCod: shipment.paymentMode === "COD",

      // Product & Service
      productType: shipment.productType,
      contentType: shipment.contentType,
      contentDescription: shipment.contentDescription,
      declaredValue: shipment.declaredValue,

      // Routing
      routeCode: generateRouteCode(shipment.consigneePincode),
      zoneCode: getZoneCode(shipment.shipperPincode, shipment.consigneePincode),
      sortCode: shipment.consigneePincode?.substring(0, 3),

      // Dates
      bookedAt: shipment.bookedAt,
      expectedDelivery: shipment.expectedDeliveryDate,

      // Special handling
      isFragile: shipment.isFragile || false,
      requiresSignature: true,

      // Label metadata
      printedAt: new Date().toISOString(),
      labelVersion: "v2.0",
    }));

    if (format === "html") {
      // Return HTML label for printing
      const html = generateLabelHtml(labels);
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        labels,
        count: labels.length,
      },
    });
  } catch (error) {
    console.error("Label Generate Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate labels" },
      { status: 500 }
    );
  }
}

// Helper functions
function generateRouteCode(pincode: string | null): string {
  if (!pincode) return "XXX";
  // Simple route code based on pincode
  const prefix = pincode.substring(0, 3);
  const zone = pincode.substring(0, 1);
  return `R${zone}-${prefix}`;
}

function getZoneCode(originPin: string | null, destPin: string | null): string {
  if (!originPin || !destPin) return "ROI";
  const originZone = originPin.substring(0, 1);
  const destZone = destPin.substring(0, 1);

  if (originZone === destZone) {
    if (originPin.substring(0, 3) === destPin.substring(0, 3)) return "LOCAL";
    return "REGIONAL";
  }

  const metros = ["1", "2", "4", "5", "6"]; // Delhi, Mumbai, Chennai, etc.
  if (metros.includes(destZone)) return "METRO";

  return "ROI";
}

function generateLabelHtml(labels: any[]): string {
  const labelsHtml = labels
    .map(
      (label) => `
    <div class="label" style="page-break-after: always; width: 4in; height: 6in; padding: 10px; border: 1px solid #000; font-family: Arial, sans-serif; font-size: 10px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px;">
        <div style="font-weight: bold; font-size: 14px;">CJDarcl Quick</div>
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: bold;">${label.zoneCode}</div>
          <div style="font-size: 10px;">${label.routeCode}</div>
        </div>
      </div>

      <!-- AWB Barcode -->
      <div style="text-align: center; padding: 10px 0; border-bottom: 1px dashed #000;">
        <div style="font-size: 8px; letter-spacing: 2px;">${label.awbNumber}</div>
        <div style="font-family: 'Libre Barcode 128', monospace; font-size: 48px; line-height: 1;">${label.awbNumber}</div>
      </div>

      <!-- Consignee -->
      <div style="padding: 8px 0; border-bottom: 1px dashed #000;">
        <div style="font-weight: bold; font-size: 12px;">TO:</div>
        <div style="font-weight: bold; font-size: 11px;">${label.consignee.name}</div>
        <div>${label.consignee.address}</div>
        <div>${label.consignee.city}, ${label.consignee.state} - ${label.consignee.pincode}</div>
        <div>Ph: ${label.consignee.phone}</div>
      </div>

      <!-- Shipper -->
      <div style="padding: 8px 0; border-bottom: 1px dashed #000;">
        <div style="font-weight: bold;">FROM: ${label.shipper.name}</div>
        <div>${label.shipper.city} - ${label.shipper.pincode}</div>
      </div>

      <!-- Details Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; padding: 8px 0; border-bottom: 1px dashed #000;">
        <div><span style="font-weight: bold;">Pcs:</span> ${label.pieces}</div>
        <div><span style="font-weight: bold;">Wt:</span> ${label.weight} kg</div>
        <div><span style="font-weight: bold;">Mode:</span> ${label.paymentMode}</div>
        ${label.isCod ? `<div style="font-weight: bold; color: red;">COD: ₹${label.codAmount}</div>` : "<div></div>"}
      </div>

      <!-- Order Ref -->
      <div style="padding: 5px 0;">
        <div><span style="font-weight: bold;">Ref:</span> ${label.orderRef || "-"}</div>
        <div><span style="font-weight: bold;">Content:</span> ${label.contentDescription || "-"}</div>
      </div>

      <!-- Sort Code -->
      <div style="text-align: center; padding: 10px 0; background: #000; color: #fff; font-size: 24px; font-weight: bold; margin-top: 10px;">
        ${label.sortCode}
      </div>

      <!-- Footer -->
      <div style="text-align: center; font-size: 8px; padding-top: 5px;">
        Printed: ${new Date().toLocaleString()} | ${label.labelVersion}
      </div>
    </div>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Shipping Labels</title>
      <style>
        @media print {
          body { margin: 0; }
          .label { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${labelsHtml}
    </body>
    </html>
  `;
}
