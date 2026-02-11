import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import PDFDocument from "pdfkit";

interface ShippingLabelData {
  awbNo: string;
  orderNo: string;
  orderDate: Date;
  courierName: string;
  serviceType?: string;
  sender: {
    name: string;
    companyName?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  receiver: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  pieces?: number;
  paymentMode: "PREPAID" | "COD";
  codAmount?: number;
  invoiceValue?: number;
  productDescription?: string;
  invoiceNo?: string;
  routeCode?: string;
  sortCode?: string;
}

async function generateShippingLabelPDF(data: ShippingLabelData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // 4x6 inch label (standard thermal label size)
      const doc = new PDFDocument({
        size: [288, 432], // 4x6 inches at 72 DPI
        margin: 10,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = 268; // 288 - 20 margin
      const leftMargin = 10;

      // Courier header
      doc
        .rect(leftMargin, 10, pageWidth, 35)
        .fill("#000")
        .fillColor("#fff")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(data.courierName.toUpperCase(), leftMargin + 10, 20);

      if (data.serviceType) {
        doc.fontSize(10).text(data.serviceType, leftMargin + 10, 32);
      }

      // AWB Number (large, prominent)
      doc
        .fillColor("#000")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("AWB:", leftMargin, 55)
        .fontSize(18)
        .text(data.awbNo, leftMargin + 40, 52);

      // Barcode placeholder (text representation)
      doc.fontSize(8).font("Helvetica").text(`*${data.awbNo}*`, leftMargin, 75, { align: "center" });

      // Horizontal divider
      doc.moveTo(leftMargin, 90).lineTo(leftMargin + pageWidth, 90).stroke();

      // Destination pincode (large, prominent)
      doc.fontSize(28).font("Helvetica-Bold").text(data.receiver.pincode, leftMargin, 95, { align: "center" });

      if (data.routeCode || data.sortCode) {
        doc.fontSize(10).text(`${data.routeCode || ""} ${data.sortCode || ""}`.trim(), { align: "center" });
      }

      // Horizontal divider
      doc.moveTo(leftMargin, 140).lineTo(leftMargin + pageWidth, 140).stroke();

      // Receiver section
      doc.fontSize(8).font("Helvetica-Bold").text("SHIP TO:", leftMargin, 145);

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(data.receiver.name.toUpperCase(), leftMargin, 155, { width: pageWidth });

      doc
        .fontSize(9)
        .font("Helvetica")
        .text(data.receiver.addressLine1, leftMargin, 168, { width: pageWidth })
        .text(data.receiver.addressLine2 || "", { width: pageWidth })
        .text(`${data.receiver.city}, ${data.receiver.state} - ${data.receiver.pincode}`, { width: pageWidth })
        .font("Helvetica-Bold")
        .text(`Ph: ${data.receiver.phone}`, { width: pageWidth });

      // Horizontal divider
      doc.moveTo(leftMargin, 230).lineTo(leftMargin + pageWidth, 230).stroke();

      // Sender section
      doc.fontSize(8).font("Helvetica-Bold").text("FROM:", leftMargin, 235);

      doc
        .fontSize(9)
        .font("Helvetica")
        .text(data.sender.companyName || data.sender.name, leftMargin, 245, { width: pageWidth })
        .text(data.sender.addressLine1, { width: pageWidth })
        .text(`${data.sender.city}, ${data.sender.state} - ${data.sender.pincode}`, { width: pageWidth })
        .text(`Ph: ${data.sender.phone}`, { width: pageWidth });

      // Horizontal divider
      doc.moveTo(leftMargin, 295).lineTo(leftMargin + pageWidth, 295).stroke();

      // Order details section
      const colWidth = pageWidth / 2;

      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("Order No:", leftMargin, 300)
        .font("Helvetica")
        .text(data.orderNo, leftMargin + 55, 300)
        .font("Helvetica-Bold")
        .text("Date:", leftMargin + colWidth, 300)
        .font("Helvetica")
        .text(new Date(data.orderDate).toLocaleDateString("en-IN"), leftMargin + colWidth + 35, 300);

      doc
        .font("Helvetica-Bold")
        .text("Weight:", leftMargin, 315)
        .font("Helvetica")
        .text(`${data.weight} kg`, leftMargin + 55, 315)
        .font("Helvetica-Bold")
        .text("Pieces:", leftMargin + colWidth, 315)
        .font("Helvetica")
        .text((data.pieces || 1).toString(), leftMargin + colWidth + 35, 315);

      if (data.dimensions) {
        doc
          .font("Helvetica-Bold")
          .text("Dims:", leftMargin, 330)
          .font("Helvetica")
          .text(`${data.dimensions.length}x${data.dimensions.width}x${data.dimensions.height} cm`, leftMargin + 55, 330);
      }

      // Payment mode (prominent for COD)
      doc.moveTo(leftMargin, 350).lineTo(leftMargin + pageWidth, 350).stroke();

      if (data.paymentMode === "COD") {
        doc
          .rect(leftMargin, 355, pageWidth, 30)
          .fill("#ff0000")
          .fillColor("#fff")
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("COD", leftMargin + 10, 362)
          .text(`Rs. ${(data.codAmount || 0).toFixed(2)}`, leftMargin + pageWidth - 100, 362);
      } else {
        doc
          .rect(leftMargin, 355, pageWidth, 30)
          .fill("#00aa00")
          .fillColor("#fff")
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("PREPAID", leftMargin + 10, 362, { align: "center" });
      }

      // Invoice info
      doc
        .fillColor("#000")
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Invoice: ${data.invoiceNo || "-"}  |  Value: Rs. ${(data.invoiceValue || 0).toFixed(2)}`,
          leftMargin,
          390,
          { align: "center" }
        );

      // Product description
      if (data.productDescription) {
        doc.fontSize(7).text(`Contents: ${data.productDescription.substring(0, 50)}`, leftMargin, 405, {
          align: "center",
        });
      }

      // Footer
      doc.fontSize(6).text("If undelivered, please return to sender", leftMargin, 420, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Fetch order data from backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://lsp-oms-api.onrender.com";
    const orderRes = await fetch(`${backendUrl}/api/v1/orders/${orderId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user?.id || "",
        "X-User-Role": session.user?.role || "",
        "X-Company-Id": session.user?.companyId || "",
      },
    });

    if (!orderRes.ok) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = await orderRes.json();

    // Fetch order items if not included
    if (!order.items || order.items.length === 0) {
      const itemsRes = await fetch(`${backendUrl}/api/v1/orders/${orderId}/items`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": session.user?.id || "",
          "X-User-Role": session.user?.role || "",
          "X-Company-Id": session.user?.companyId || "",
        },
      });
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        // Fetch SKU names for items
        order.items = await Promise.all(
          (Array.isArray(itemsData) ? itemsData : []).map(async (item: { skuId?: string; sku?: { name?: string }; name?: string }) => {
            if (item.sku?.name || item.name) return item;
            if (!item.skuId) return { ...item, name: 'Item' };
            try {
              const skuRes = await fetch(`${backendUrl}/api/v1/skus/${item.skuId}`, {
                headers: {
                  "Content-Type": "application/json",
                  "X-User-Id": session.user?.id || "",
                  "X-User-Role": session.user?.role || "",
                  "X-Company-Id": session.user?.companyId || "",
                },
              });
              if (skuRes.ok) {
                const skuData = await skuRes.json();
                return { ...item, name: skuData.name, sku: skuData };
              }
            } catch {
              // SKU fetch failed
            }
            return { ...item, name: 'Item' };
          })
        );
      }
    }

    // Fetch company/location data for sender info
    const locationRes = await fetch(`${backendUrl}/api/v1/locations/${order.locationId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user?.id || "",
        "X-User-Role": session.user?.role || "",
        "X-Company-Id": session.user?.companyId || "",
      },
    });

    const location = locationRes.ok ? await locationRes.json() : null;

    // Fetch company data
    const companyRes = await fetch(`${backendUrl}/api/v1/companies/${order.companyId || session.user?.companyId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user?.id || "",
        "X-User-Role": session.user?.role || "",
        "X-Company-Id": session.user?.companyId || "",
      },
    });

    const company = companyRes.ok ? await companyRes.json() : null;

    // Build label data
    const labelData: ShippingLabelData = {
      awbNo: order.awbNo || order.trackingNumber || `AWB-${orderId.substring(0, 8)}`,
      orderNo: order.orderNo || order.orderNumber || orderId,
      orderDate: new Date(order.orderDate || order.createdAt),
      courierName: order.transporterName || order.transporter?.name || "COURIER",
      serviceType: order.serviceType || "Standard",
      sender: {
        name: location?.contactPerson || company?.name || "Warehouse",
        companyName: company?.name || "CJDQuick OMS",
        addressLine1: location?.address || company?.address || "Address",
        city: location?.city || company?.city || "City",
        state: location?.state || company?.state || "State",
        pincode: location?.pincode || company?.pincode || "000000",
        phone: location?.phone || company?.phone || "0000000000",
      },
      receiver: {
        name: order.shippingAddress?.name || order.customerName || "Customer",
        addressLine1: order.shippingAddress?.line1 || order.shippingAddress?.addressLine1 || order.shippingAddress?.address || "Address",
        addressLine2: order.shippingAddress?.line2 || order.shippingAddress?.addressLine2,
        city: order.shippingAddress?.city || "City",
        state: order.shippingAddress?.state || "State",
        pincode: order.shippingAddress?.pincode || "000000",
        phone: order.customerPhone || order.customer?.phone || "0000000000",
      },
      weight: parseFloat(order.weight || order.totalWeight || 0.5),
      dimensions: order.dimensions,
      pieces: parseInt(order.pieces || 1),
      paymentMode: order.paymentMode === "COD" ? "COD" : "PREPAID",
      codAmount: order.paymentMode === "COD" ? parseFloat(order.totalAmount) : undefined,
      invoiceValue: parseFloat(order.totalAmount || 0),
      productDescription: order.productDescription ||
        (order.items?.map((i: { name?: string; sku?: { name?: string } }) => i.name || i.sku?.name || 'Item').join(", ").substring(0, 50)),
      invoiceNo: `INV-${order.orderNo || order.orderNumber || orderId}`,
      routeCode: order.routeCode,
      sortCode: order.sortCode,
    };

    const pdfBuffer = await generateShippingLabelPDF(labelData);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="label-${orderId}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Label generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate label" },
      { status: 500 }
    );
  }
}
