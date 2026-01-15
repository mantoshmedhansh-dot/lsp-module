import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";
import PDFDocument from "pdfkit";

// GET /api/print/label/[id] - Generate shipping label PDF (4x6 thermal)
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

    // Get delivery with order details
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        Order: {
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
          },
        },
        Transporter: true,
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    // Prepare delivery data for PDF generation
    const deliveryDataForPdf = {
      id: delivery.id,
      awbNo: delivery.awbNo,
      weight: delivery.weight,
      dimensions: { length: delivery.length, width: delivery.width, height: delivery.height },
      order: {
        orderNo: delivery.Order.orderNo,
        customerName: delivery.Order.customerName,
        customerPhone: delivery.Order.customerPhone,
        shippingAddress: delivery.Order.shippingAddress,
        paymentMode: delivery.Order.paymentMode,
        totalAmount: delivery.Order.totalAmount,
        items: delivery.Order.OrderItem.map(i => ({
          quantity: i.quantity,
          sku: { code: i.SKU.code, name: i.SKU.name },
        })),
        location: {
          name: delivery.Order.Location.name,
          address: delivery.Order.Location.address,
          company: {
            name: delivery.Order.Location.Company.name,
            phone: delivery.Order.Location.Company.phone,
          },
        },
      },
      transporter: delivery.Transporter ? {
        name: delivery.Transporter.name,
        code: delivery.Transporter.code,
      } : null,
    };

    // Generate PDF
    const pdfBuffer = await generateShippingLabel(deliveryDataForPdf);

    // Return PDF - convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label_${delivery.awbNo || delivery.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating shipping label:", error);
    return NextResponse.json(
      { error: "Failed to generate shipping label" },
      { status: 500 }
    );
  }
}

async function generateShippingLabel(
  delivery: {
    id: string;
    awbNo: string | null;
    order: {
      orderNo: string;
      customerName: string;
      customerPhone: string;
      shippingAddress: unknown;
      paymentMode: string;
      totalAmount: { toNumber(): number };
      items: { quantity: number; sku: { code: string; name: string } }[];
      location: {
        name: string;
        address: unknown;
        company: { name: string; phone?: string | null };
      };
    };
    transporter: { name: string; code: string } | null;
    weight?: { toNumber(): number } | null;
    dimensions?: unknown;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // 4x6 inch = 288x432 points (72 points per inch)
      const doc = new PDFDocument({
        size: [288, 432],
        margin: 10,
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const order = delivery.order;
      const shippingAddr = order.shippingAddress as {
        name?: string;
        phone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        pincode?: string;
      };
      const senderAddr = order.location.address as {
        city?: string;
        state?: string;
        pincode?: string;
      };

      const leftMargin = 10;
      const rightMargin = 278;
      let y = 10;

      // Border
      doc.rect(5, 5, 278, 422).stroke();

      // Transporter name
      if (delivery.transporter) {
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(delivery.transporter.name.toUpperCase(), leftMargin, y, {
            align: "center",
            width: 268,
          });
        y += 20;
      }

      // AWB Number (large, scannable)
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(delivery.awbNo || "AWB PENDING", leftMargin, y, {
          align: "center",
          width: 268,
        });
      y += 25;

      // Barcode placeholder (simple text representation)
      doc
        .fontSize(8)
        .font("Helvetica")
        .text("||||| " + (delivery.awbNo || "").replace(/./g, "| ") + " |||||", leftMargin, y, {
          align: "center",
          width: 268,
        });
      y += 15;

      // Divider
      doc.moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
      y += 5;

      // TO (Destination) Section
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("TO:", leftMargin, y);
      y += 12;

      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(shippingAddr.name || order.customerName, leftMargin, y, { width: 200 });
      y += 14;

      doc
        .fontSize(9)
        .font("Helvetica")
        .text(shippingAddr.addressLine1 || "", leftMargin, y, { width: 200 });
      y += 11;

      if (shippingAddr.addressLine2) {
        doc.text(shippingAddr.addressLine2, leftMargin, y, { width: 200 });
        y += 11;
      }

      doc.text(
        `${shippingAddr.city || ""}, ${shippingAddr.state || ""}`,
        leftMargin,
        y,
        { width: 200 }
      );
      y += 11;

      // Large pincode
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(shippingAddr.pincode || "", leftMargin, y);
      y += 20;

      doc
        .fontSize(9)
        .font("Helvetica")
        .text(`Phone: ${order.customerPhone}`, leftMargin, y);
      y += 15;

      // Divider
      doc.moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
      y += 5;

      // FROM (Origin) Section
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("FROM:", leftMargin, y);
      y += 10;

      doc
        .fontSize(8)
        .font("Helvetica")
        .text(order.location.company.name, leftMargin, y, { width: 180 });
      y += 10;

      doc.text(order.location.name, leftMargin, y, { width: 180 });
      y += 10;

      if (senderAddr) {
        doc.text(
          `${senderAddr.city || ""}, ${senderAddr.state || ""} - ${senderAddr.pincode || ""}`,
          leftMargin,
          y
        );
        y += 10;
      }

      if (order.location.company.phone) {
        doc.text(`Ph: ${order.location.company.phone}`, leftMargin, y);
        y += 10;
      }

      y += 5;

      // Divider
      doc.moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
      y += 5;

      // Order details section
      const colWidth = 134;

      // Payment mode box (highlighted for COD)
      if (order.paymentMode === "COD") {
        doc.rect(leftMargin, y, colWidth - 5, 30).fillAndStroke("#ffeb3b", "#000");
        doc
          .fontSize(10)
          .fillColor("#000")
          .font("Helvetica-Bold")
          .text("COD", leftMargin + 5, y + 3);
        doc
          .fontSize(12)
          .text(`Rs. ${order.totalAmount.toNumber().toFixed(0)}`, leftMargin + 5, y + 15);
      } else {
        doc.rect(leftMargin, y, colWidth - 5, 30).stroke();
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("PREPAID", leftMargin + 5, y + 10);
      }

      // Weight/dimensions box
      doc.rect(leftMargin + colWidth, y, colWidth - 5, 30).stroke();
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#000")
        .text("Weight:", leftMargin + colWidth + 5, y + 3);
      doc.text(
        delivery.weight ? `${delivery.weight.toNumber()} kg` : "N/A",
        leftMargin + colWidth + 5,
        y + 15
      );

      y += 35;

      // Order info
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(`Order: ${order.orderNo}`, leftMargin, y);
      y += 10;

      // Items summary
      const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
      const skuList = order.items.map((i) => i.sku.code).join(", ");
      doc.text(`Items: ${itemCount} | SKUs: ${skuList.substring(0, 40)}${skuList.length > 40 ? "..." : ""}`, leftMargin, y);
      y += 15;

      // Footer
      doc.moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
      y += 5;

      doc
        .fontSize(7)
        .font("Helvetica")
        .text(`Printed: ${new Date().toLocaleString("en-IN")}`, leftMargin, y, {
          align: "center",
          width: 268,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
