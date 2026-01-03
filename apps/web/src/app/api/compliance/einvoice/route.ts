import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// IRP (Invoice Registration Portal) API
const IRP_API_URL = "https://einvoice1.gst.gov.in";

// GET - List e-invoices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const invoiceId = searchParams.get("invoiceId");
    const status = searchParams.get("status");
    const irn = searchParams.get("irn");
    const docType = searchParams.get("docType");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;
    if (irn) where.irn = irn;
    if (docType) where.docType = docType;

    if (fromDate || toDate) {
      where.docDate = {};
      if (fromDate) where.docDate.gte = new Date(fromDate);
      if (toDate) where.docDate.lte = new Date(toDate);
    }

    const [einvoices, total] = await Promise.all([
      prisma.eInvoice.findMany({
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
      prisma.eInvoice.count({ where }),
    ]);

    // Get summary
    const summary = {
      draft: await prisma.eInvoice.count({ where: { ...where, status: "DRAFT" } }),
      pending: await prisma.eInvoice.count({ where: { ...where, status: "PENDING" } }),
      generated: await prisma.eInvoice.count({ where: { ...where, status: "GENERATED" } }),
      cancelled: await prisma.eInvoice.count({ where: { ...where, status: "CANCELLED" } }),
      failed: await prisma.eInvoice.count({ where: { ...where, status: "FAILED" } }),
    };

    // Calculate totals
    const totals = await prisma.eInvoice.aggregate({
      where: { ...where, status: "GENERATED" },
      _sum: {
        totalInvoiceValue: true,
        totalCgstValue: true,
        totalSgstValue: true,
        totalIgstValue: true,
      },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        items: einvoices,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        summary,
        totals: {
          invoiceValue: totals._sum.totalInvoiceValue || 0,
          cgst: totals._sum.totalCgstValue || 0,
          sgst: totals._sum.totalSgstValue || 0,
          igst: totals._sum.totalIgstValue || 0,
          count: totals._count,
        },
      },
    });
  } catch (error) {
    console.error("E-Invoice GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch e-invoices" },
      { status: 500 }
    );
  }
}

// POST - Create e-invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (action === "GENERATE_IRN") {
      // Generate IRN from IRP portal
      const einvoice = await prisma.eInvoice.findUnique({
        where: { id: data.id },
        include: { items: true },
      });

      if (!einvoice) {
        return NextResponse.json(
          { success: false, error: "E-invoice not found" },
          { status: 404 }
        );
      }

      if (einvoice.status !== "DRAFT" && einvoice.status !== "PENDING") {
        return NextResponse.json(
          { success: false, error: "E-invoice already processed" },
          { status: 400 }
        );
      }

      // Simulate IRP API call (in production, call actual IRP API)
      // Generate IRN using hash of invoice data
      const irnBase = `${einvoice.supplierGstin}${einvoice.docType}${einvoice.docNumber}${einvoice.docDate.getFullYear()}`;
      const irn = Buffer.from(irnBase).toString("base64").replace(/[^a-zA-Z0-9]/g, "").substring(0, 64);
      const ackNum = Math.floor(Math.random() * 900000000000) + 100000000000;

      // Generate QR code data
      const qrData = JSON.stringify({
        sellerGstin: einvoice.supplierGstin,
        buyerGstin: einvoice.buyerGstin,
        docNo: einvoice.docNumber,
        docDate: einvoice.docDate.toISOString().split("T")[0],
        totInvVal: einvoice.totalInvoiceValue,
        irn,
        ackNum: ackNum.toString(),
        ackDate: new Date().toISOString(),
      });

      const updated = await prisma.eInvoice.update({
        where: { id: data.id },
        data: {
          irn,
          ackNum: ackNum.toString(),
          ackDate: new Date(),
          status: "GENERATED",
          generatedAt: new Date(),
          irpStatus: "GENERATED",
          signedQRCode: qrData,
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `E-Invoice generated. IRN: ${irn}`,
      });
    }

    // Create new e-invoice draft
    const {
      clientId,
      invoiceId,
      docType = "INV",
      docNumber,
      docDate,
      // Supplier details
      supplierGstin,
      supplierLegalName,
      supplierTradeName,
      supplierAddress1,
      supplierAddress2,
      supplierPlace,
      supplierState,
      supplierPincode,
      supplierPhone,
      supplierEmail,
      // Buyer details
      buyerGstin,
      buyerLegalName,
      buyerTradeName,
      buyerAddress1,
      buyerAddress2,
      buyerPlace,
      buyerState,
      buyerPincode,
      buyerPhone,
      buyerEmail,
      buyerPos,
      // Ship to details
      shipToGstin,
      shipToLegalName,
      shipToAddress1,
      shipToAddress2,
      shipToPlace,
      shipToState,
      shipToPincode,
      // Values
      totalAssessableValue,
      totalCgstValue,
      totalSgstValue,
      totalIgstValue,
      totalCessValue,
      discount,
      otherCharges,
      roundOffAmount,
      totalInvoiceValue,
      // Payment
      paymentMode,
      paymentTerms,
      paymentDueDate,
      // Items
      items,
    } = data;

    // Validate required fields
    if (!clientId || !invoiceId || !docNumber || !supplierGstin || !buyerGstin) {
      return NextResponse.json(
        { success: false, error: "Required fields missing (clientId, invoiceId, docNumber, supplierGstin, buyerGstin)" },
        { status: 400 }
      );
    }

    // Validate GSTIN format (15 characters)
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(supplierGstin)) {
      return NextResponse.json(
        { success: false, error: "Invalid supplier GSTIN format" },
        { status: 400 }
      );
    }
    if (!gstinRegex.test(buyerGstin)) {
      return NextResponse.json(
        { success: false, error: "Invalid buyer GSTIN format" },
        { status: 400 }
      );
    }

    // Create e-invoice
    const einvoice = await prisma.eInvoice.create({
      data: {
        clientId,
        invoiceId,
        docType,
        docNumber,
        docDate: new Date(docDate || Date.now()),
        // Supplier
        supplierGstin,
        supplierLegalName,
        supplierTradeName,
        supplierAddress1,
        supplierAddress2,
        supplierPlace,
        supplierState,
        supplierPincode,
        supplierPhone,
        supplierEmail,
        // Buyer
        buyerGstin,
        buyerLegalName,
        buyerTradeName,
        buyerAddress1,
        buyerAddress2,
        buyerPlace,
        buyerState,
        buyerPincode,
        buyerPhone,
        buyerEmail,
        buyerPos,
        // Ship to
        shipToGstin,
        shipToLegalName,
        shipToAddress1,
        shipToAddress2,
        shipToPlace,
        shipToState,
        shipToPincode,
        // Values
        totalAssessableValue: totalAssessableValue || 0,
        totalCgstValue: totalCgstValue || 0,
        totalSgstValue: totalSgstValue || 0,
        totalIgstValue: totalIgstValue || 0,
        totalCessValue: totalCessValue || 0,
        discount: discount || 0,
        otherCharges: otherCharges || 0,
        roundOffAmount: roundOffAmount || 0,
        totalInvoiceValue: totalInvoiceValue || 0,
        // Payment
        paymentMode,
        paymentTerms,
        paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
        status: "DRAFT",
        // Items
        items: items
          ? {
              create: items.map((item: any, index: number) => ({
                slNo: index + 1,
                productDesc: item.productDesc,
                isService: item.isService || false,
                hsnCode: item.hsnCode,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                grossAmount: item.grossAmount || item.quantity * item.unitPrice,
                discount: item.discount || 0,
                preTaxValue: item.preTaxValue || item.grossAmount - (item.discount || 0),
                cgstRate: item.cgstRate || 0,
                sgstRate: item.sgstRate || 0,
                igstRate: item.igstRate || 0,
                cessRate: item.cessRate || 0,
                cgstAmount: item.cgstAmount || 0,
                sgstAmount: item.sgstAmount || 0,
                igstAmount: item.igstAmount || 0,
                cessAmount: item.cessAmount || 0,
                totalItemValue: item.totalItemValue || 0,
                batchNo: item.batchNo,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              })),
            }
          : undefined,
      },
      include: { items: true },
    });

    return NextResponse.json({
      success: true,
      data: einvoice,
      message: "E-invoice draft created",
    });
  } catch (error) {
    console.error("E-Invoice POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create e-invoice" },
      { status: 500 }
    );
  }
}

// PATCH - Update or cancel e-invoice
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "E-invoice ID is required" },
        { status: 400 }
      );
    }

    const einvoice = await prisma.eInvoice.findUnique({
      where: { id },
    });

    if (!einvoice) {
      return NextResponse.json(
        { success: false, error: "E-invoice not found" },
        { status: 404 }
      );
    }

    if (action === "CANCEL") {
      // Can only cancel within 24 hours of generation (as per GST rules)
      if (einvoice.status !== "GENERATED") {
        return NextResponse.json(
          { success: false, error: "Can only cancel generated e-invoices" },
          { status: 400 }
        );
      }

      if (einvoice.generatedAt) {
        const hoursSinceGeneration =
          (Date.now() - einvoice.generatedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceGeneration > 24) {
          return NextResponse.json(
            { success: false, error: "E-invoice can only be cancelled within 24 hours of generation" },
            { status: 400 }
          );
        }
      }

      const { reason } = data;

      const updated = await prisma.eInvoice.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
          irpStatus: "CANCELLED",
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: "E-invoice cancelled",
      });
    }

    // General update for draft e-invoices
    if (einvoice.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Can only update draft e-invoices" },
        { status: 400 }
      );
    }

    const updated = await prisma.eInvoice.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "E-invoice updated",
    });
  } catch (error) {
    console.error("E-Invoice PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update e-invoice" },
      { status: 500 }
    );
  }
}

// DELETE - Delete draft e-invoice
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "E-invoice ID is required" },
        { status: 400 }
      );
    }

    const einvoice = await prisma.eInvoice.findUnique({
      where: { id },
    });

    if (!einvoice) {
      return NextResponse.json(
        { success: false, error: "E-invoice not found" },
        { status: 404 }
      );
    }

    if (einvoice.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: "Can only delete draft e-invoices" },
        { status: 400 }
      );
    }

    await prisma.eInvoice.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "E-invoice deleted",
    });
  } catch (error) {
    console.error("E-Invoice DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete e-invoice" },
      { status: 500 }
    );
  }
}
