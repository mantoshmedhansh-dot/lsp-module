import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// NIC E-way Bill API (GST Portal)
const EWAY_BILL_API_URL = "https://einvoice1.gst.gov.in";

// Indian state codes for GST
const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar",
  "36": "Telangana",
  "37": "Andhra Pradesh",
};

// GET - List e-way bills
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const shipmentId = searchParams.get("shipmentId");
    const status = searchParams.get("status");
    const ewayBillNumber = searchParams.get("ewayBillNumber");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (shipmentId) where.shipmentId = shipmentId;
    if (status) where.status = status;
    if (ewayBillNumber) where.ewayBillNumber = ewayBillNumber;

    const [ewayBills, total] = await Promise.all([
      prisma.ewayBill.findMany({
        where,
        include: {
          items: true,
          client: {
            select: { id: true, companyName: true, gstNumber: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.ewayBill.count({ where }),
    ]);

    // Get summary by status
    const summary = {
      draft: await prisma.ewayBill.count({ where: { ...where, status: "DRAFT" } }),
      generated: await prisma.ewayBill.count({ where: { ...where, status: "GENERATED" } }),
      active: await prisma.ewayBill.count({ where: { ...where, status: "ACTIVE" } }),
      cancelled: await prisma.ewayBill.count({ where: { ...where, status: "CANCELLED" } }),
      expired: await prisma.ewayBill.count({ where: { ...where, status: "EXPIRED" } }),
    };

    // Check for expiring e-way bills
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiringSoon = await prisma.ewayBill.count({
      where: {
        ...where,
        status: "ACTIVE",
        validUpto: { lte: tomorrow },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        items: ewayBills,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        summary: { ...summary, expiringSoon },
      },
    });
  } catch (error) {
    console.error("E-way Bill GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch e-way bills" },
      { status: 500 }
    );
  }
}

// POST - Create e-way bill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (action === "GENERATE") {
      // Generate e-way bill on NIC portal
      const ewayBill = await prisma.ewayBill.findUnique({
        where: { id: data.id },
        include: { items: true },
      });

      if (!ewayBill) {
        return NextResponse.json(
          { success: false, error: "E-way bill not found" },
          { status: 404 }
        );
      }

      // Simulate NIC API call (in production, call actual GST portal API)
      const ewayBillNumber = `${Math.floor(Math.random() * 9000000000000) + 1000000000000}`;
      const validFrom = new Date();
      const validUpto = new Date();

      // Validity based on distance (as per GST rules)
      const distance = ewayBill.approxDistance || 100;
      if (distance <= 100) {
        validUpto.setDate(validUpto.getDate() + 1);
      } else if (distance <= 300) {
        validUpto.setDate(validUpto.getDate() + 3);
      } else if (distance <= 500) {
        validUpto.setDate(validUpto.getDate() + 5);
      } else if (distance <= 1000) {
        validUpto.setDate(validUpto.getDate() + 10);
      } else {
        validUpto.setDate(validUpto.getDate() + 15);
      }

      const updated = await prisma.ewayBill.update({
        where: { id: data.id },
        data: {
          ewayBillNumber,
          ewayBillDate: new Date(),
          status: "ACTIVE",
          generatedAt: new Date(),
          validFrom,
          validUpto,
          nicEwbNo: ewayBillNumber,
          nicStatus: "GENERATED",
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `E-way Bill ${ewayBillNumber} generated successfully. Valid until ${validUpto.toLocaleDateString()}`,
      });
    }

    // Create new e-way bill draft
    const {
      clientId,
      shipmentId,
      invoiceId,
      docType = "INV",
      docNumber,
      docDate,
      supplierGstin,
      supplierName,
      supplierAddress,
      supplierPlace,
      supplierState,
      supplierPincode,
      recipientGstin,
      recipientName,
      recipientAddress,
      recipientPlace,
      recipientState,
      recipientPincode,
      transporterGstin,
      transporterName,
      awbNumber,
      goodsDescription,
      goodsValue,
      hsnCode,
      quantity,
      unit,
      taxableValue,
      sgstRate,
      cgstRate,
      igstRate,
      cessRate,
      transportMode,
      vehicleNo,
      vehicleType,
      transactionType,
      subSupplyType,
      approxDistance,
      items,
    } = data;

    // Validate required fields
    if (!clientId || !docNumber || !supplierGstin || !recipientName || !goodsValue) {
      return NextResponse.json(
        { success: false, error: "Required fields missing" },
        { status: 400 }
      );
    }

    // Validate goods value (E-way bill required for > Rs 50,000)
    if (goodsValue < 50000) {
      return NextResponse.json(
        { success: false, error: "E-way bill not required for goods value below Rs 50,000" },
        { status: 400 }
      );
    }

    // Calculate tax amounts
    const sgstAmount = taxableValue * (sgstRate || 0) / 100;
    const cgstAmount = taxableValue * (cgstRate || 0) / 100;
    const igstAmount = taxableValue * (igstRate || 0) / 100;
    const cessAmount = taxableValue * (cessRate || 0) / 100;
    const totalGstAmount = sgstAmount + cgstAmount + igstAmount + cessAmount;
    const totalInvoiceValue = taxableValue + totalGstAmount;

    const ewayBill = await prisma.ewayBill.create({
      data: {
        clientId,
        shipmentId,
        invoiceId,
        docType,
        docNumber,
        docDate: new Date(docDate || Date.now()),
        supplierGstin,
        supplierName,
        supplierAddress,
        supplierPlace,
        supplierState,
        supplierPincode,
        recipientGstin,
        recipientName,
        recipientAddress,
        recipientPlace,
        recipientState,
        recipientPincode,
        transporterGstin,
        transporterName,
        awbNumber,
        goodsDescription,
        goodsValue,
        hsnCode,
        quantity,
        unit,
        taxableValue: taxableValue || goodsValue,
        sgstRate: sgstRate || 0,
        cgstRate: cgstRate || 0,
        igstRate: igstRate || 0,
        cessRate: cessRate || 0,
        sgstAmount,
        cgstAmount,
        igstAmount,
        cessAmount,
        totalGstAmount,
        totalInvoiceValue,
        transportMode: transportMode || "ROAD",
        vehicleNo,
        vehicleType,
        transactionType: transactionType || "REGULAR",
        subSupplyType: subSupplyType || "SUPPLY",
        approxDistance,
        status: "DRAFT",
        items: items
          ? {
              create: items.map((item: any, index: number) => ({
                itemNo: index + 1,
                productName: item.productName,
                productDesc: item.productDesc,
                hsnCode: item.hsnCode,
                quantity: item.quantity,
                unit: item.unit,
                taxableValue: item.taxableValue,
                sgstRate: item.sgstRate || 0,
                cgstRate: item.cgstRate || 0,
                igstRate: item.igstRate || 0,
                cessRate: item.cessRate || 0,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });

    return NextResponse.json({
      success: true,
      data: ewayBill,
      message: "E-way bill draft created",
    });
  } catch (error) {
    console.error("E-way Bill POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create e-way bill" },
      { status: 500 }
    );
  }
}

// PATCH - Update e-way bill (Part-B update, cancel, extend)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "E-way bill ID is required" },
        { status: 400 }
      );
    }

    const ewayBill = await prisma.ewayBill.findUnique({
      where: { id },
    });

    if (!ewayBill) {
      return NextResponse.json(
        { success: false, error: "E-way bill not found" },
        { status: 404 }
      );
    }

    if (action === "UPDATE_VEHICLE") {
      // Part-B update - change vehicle
      if (ewayBill.status !== "ACTIVE") {
        return NextResponse.json(
          { success: false, error: "Can only update vehicle for active e-way bills" },
          { status: 400 }
        );
      }

      const { vehicleNo, vehicleType, reason } = data;

      // Store Part-B update history
      const partBUpdates = ewayBill.partBUpdates
        ? JSON.parse(ewayBill.partBUpdates)
        : [];
      partBUpdates.push({
        previousVehicle: ewayBill.vehicleNo,
        newVehicle: vehicleNo,
        reason,
        updatedAt: new Date().toISOString(),
      });

      const updated = await prisma.ewayBill.update({
        where: { id },
        data: {
          vehicleNo,
          vehicleType,
          partBUpdates: JSON.stringify(partBUpdates),
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Vehicle updated successfully (Part-B)",
      });
    }

    if (action === "CANCEL") {
      if (!["DRAFT", "ACTIVE", "GENERATED"].includes(ewayBill.status)) {
        return NextResponse.json(
          { success: false, error: "Cannot cancel this e-way bill" },
          { status: 400 }
        );
      }

      const { reason } = data;

      const updated = await prisma.ewayBill.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
          nicStatus: "CANCELLED",
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "E-way bill cancelled",
      });
    }

    if (action === "EXTEND") {
      if (ewayBill.status !== "ACTIVE") {
        return NextResponse.json(
          { success: false, error: "Can only extend active e-way bills" },
          { status: 400 }
        );
      }

      // Check if within 8 hours of expiry (as per GST rules)
      const hoursToExpiry = ewayBill.validUpto
        ? (ewayBill.validUpto.getTime() - Date.now()) / (1000 * 60 * 60)
        : 0;

      if (hoursToExpiry > 8) {
        return NextResponse.json(
          { success: false, error: "E-way bill can only be extended within 8 hours of expiry" },
          { status: 400 }
        );
      }

      const { reason, extendedHours = 24 } = data;

      const extendedUpto = new Date(
        (ewayBill.validUpto?.getTime() || Date.now()) + extendedHours * 60 * 60 * 1000
      );

      const updated = await prisma.ewayBill.update({
        where: { id },
        data: {
          status: "EXTENDED",
          extendedAt: new Date(),
          extendedUpto,
          extensionReason: reason,
          validUpto: extendedUpto,
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `E-way bill extended until ${extendedUpto.toLocaleDateString()}`,
      });
    }

    // General update for draft e-way bills
    if (ewayBill.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Can only update draft e-way bills" },
        { status: 400 }
      );
    }

    const updated = await prisma.ewayBill.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "E-way bill updated",
    });
  } catch (error) {
    console.error("E-way Bill PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update e-way bill" },
      { status: 500 }
    );
  }
}
