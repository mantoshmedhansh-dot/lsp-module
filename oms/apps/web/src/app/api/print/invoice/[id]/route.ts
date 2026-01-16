import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";
import PDFDocument from "pdfkit";

// GET /api/print/invoice/[id] - Generate invoice PDF
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

    // Get order with all details
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          include: {
            SKU: true,
          },
        },
        Location: {
          include: {
            Company: true,
          },
        },
        Delivery: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Generate invoice number if not exists
    const delivery = order.Delivery[0];
    const invoiceNo = delivery?.invoiceNo || `INV-${order.orderNo}`;
    const invoiceDate = delivery?.invoiceDate || new Date();

    // Prepare order data for PDF generation
    const orderDataForPdf = {
      ...order,
      items: order.OrderItem.map(item => ({
        sku: { code: item.SKU.code, name: item.SKU.name, hsn: item.SKU.hsn },
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxAmount: item.taxAmount,
        discount: item.discount,
        totalPrice: item.totalPrice,
      })),
      location: {
        company: {
          name: order.Location.Company.name,
          legalName: order.Location.Company.legalName,
          address: order.Location.Company.address,
          gst: order.Location.Company.gst,
          phone: order.Location.Company.phone,
          email: order.Location.Company.email,
        },
      },
      deliveries: order.Delivery.map(d => ({
        invoiceNo: d.invoiceNo,
        awbNo: d.awbNo,
      })),
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(orderDataForPdf as Parameters<typeof generateInvoicePDF>[0], invoiceNo, invoiceDate);

    // Return PDF - convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice_${invoiceNo}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 }
    );
  }
}

async function generateInvoicePDF(
  order: Awaited<ReturnType<typeof prisma.order.findUnique>> & {
    items: { sku: { code: string; name: string; hsn?: string | null }; quantity: number; unitPrice: { toNumber(): number }; taxAmount: { toNumber(): number }; discount: { toNumber(): number }; totalPrice: { toNumber(): number } }[];
    location: { company: { name: string; legalName?: string | null; address?: unknown; gst?: string | null; phone?: string | null; email?: string | null } };
    deliveries: { invoiceNo?: string | null; awbNo?: string | null }[];
  },
  invoiceNo: string,
  invoiceDate: Date
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const company = order!.location.company;
      const companyAddress = company.address as { city?: string; state?: string; pincode?: string } | null;

      // Header
      doc.fontSize(16).font("Helvetica-Bold").text(company.name, { align: "center" });

      if (company.legalName) {
        doc.fontSize(10).font("Helvetica").text(company.legalName, { align: "center" });
      }

      if (companyAddress) {
        doc
          .fontSize(9)
          .text(
            `${companyAddress.city || ""}, ${companyAddress.state || ""} - ${companyAddress.pincode || ""}`,
            { align: "center" }
          );
      }

      if (company.gst) {
        doc.text(`GSTIN: ${company.gst}`, { align: "center" });
      }

      doc.moveDown();
      doc.fontSize(14).font("Helvetica-Bold").text("TAX INVOICE", { align: "center" });
      doc.moveDown();

      // Invoice details
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`Invoice No: `, { continued: true })
        .font("Helvetica")
        .text(invoiceNo);

      doc
        .font("Helvetica-Bold")
        .text(`Invoice Date: `, { continued: true })
        .font("Helvetica")
        .text(invoiceDate.toLocaleDateString("en-IN"));

      doc
        .font("Helvetica-Bold")
        .text(`Order No: `, { continued: true })
        .font("Helvetica")
        .text(order!.orderNo);

      doc.moveDown();

      // Shipping address
      const shippingAddr = order!.shippingAddress as {
        name?: string;
        phone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        pincode?: string;
      };

      doc.font("Helvetica-Bold").text("Ship To:");
      doc
        .font("Helvetica")
        .text(shippingAddr.name || order!.customerName)
        .text(shippingAddr.addressLine1 || "")
        .text(shippingAddr.addressLine2 || "")
        .text(`${shippingAddr.city || ""}, ${shippingAddr.state || ""} - ${shippingAddr.pincode || ""}`)
        .text(`Phone: ${order!.customerPhone}`);

      doc.moveDown();

      // Items table header
      const tableTop = doc.y;
      const tableLeft = 40;

      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("S.No", tableLeft, tableTop, { width: 30 });
      doc.text("SKU", tableLeft + 35, tableTop, { width: 60 });
      doc.text("Description", tableLeft + 100, tableTop, { width: 150 });
      doc.text("Qty", tableLeft + 255, tableTop, { width: 30, align: "right" });
      doc.text("Rate", tableLeft + 290, tableTop, { width: 50, align: "right" });
      doc.text("Tax", tableLeft + 345, tableTop, { width: 45, align: "right" });
      doc.text("Total", tableLeft + 395, tableTop, { width: 55, align: "right" });

      doc.moveTo(tableLeft, tableTop + 15).lineTo(555, tableTop + 15).stroke();

      // Items
      let y = tableTop + 20;
      doc.font("Helvetica").fontSize(9);

      order!.items.forEach((item, index) => {
        doc.text((index + 1).toString(), tableLeft, y, { width: 30 });
        doc.text(item.sku.code, tableLeft + 35, y, { width: 60 });
        doc.text(item.sku.name.substring(0, 30), tableLeft + 100, y, { width: 150 });
        doc.text(item.quantity.toString(), tableLeft + 255, y, { width: 30, align: "right" });
        doc.text(item.unitPrice.toNumber().toFixed(2), tableLeft + 290, y, { width: 50, align: "right" });
        doc.text(item.taxAmount.toNumber().toFixed(2), tableLeft + 345, y, { width: 45, align: "right" });
        doc.text(item.totalPrice.toNumber().toFixed(2), tableLeft + 395, y, { width: 55, align: "right" });
        y += 15;
      });

      doc.moveTo(tableLeft, y).lineTo(555, y).stroke();

      // Totals
      y += 10;
      const totalsX = 380;

      doc.font("Helvetica").text("Subtotal:", totalsX, y);
      doc.text(order!.subtotal.toNumber().toFixed(2), totalsX + 70, y, { align: "right", width: 70 });

      y += 15;
      doc.text("Tax:", totalsX, y);
      doc.text(order!.taxAmount.toNumber().toFixed(2), totalsX + 70, y, { align: "right", width: 70 });

      if (order!.shippingCharges.toNumber() > 0) {
        y += 15;
        doc.text("Shipping:", totalsX, y);
        doc.text(order!.shippingCharges.toNumber().toFixed(2), totalsX + 70, y, { align: "right", width: 70 });
      }

      if (order!.discount.toNumber() > 0) {
        y += 15;
        doc.text("Discount:", totalsX, y);
        doc.text(`-${order!.discount.toNumber().toFixed(2)}`, totalsX + 70, y, { align: "right", width: 70 });
      }

      y += 15;
      doc.font("Helvetica-Bold").text("Total:", totalsX, y);
      doc.text(order!.totalAmount.toNumber().toFixed(2), totalsX + 70, y, { align: "right", width: 70 });

      // Payment mode
      y += 25;
      doc.font("Helvetica-Bold").text(`Payment Mode: ${order!.paymentMode}`, tableLeft, y);

      if (order!.deliveries[0]?.awbNo) {
        doc.text(`AWB: ${order!.deliveries[0].awbNo}`, tableLeft + 200, y);
      }

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .text("This is a computer generated invoice", 40, 780, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
