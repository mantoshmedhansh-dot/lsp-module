import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import PDFDocument from "pdfkit";

interface PicklistData {
  picklistNo: string;
  status: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  location: {
    name: string;
    code: string;
    address?: string;
  };
  company: {
    name: string;
  };
  assignedTo?: {
    name: string;
    id: string;
  };
  order?: {
    orderNo: string;
    customerName: string;
    channel: string;
    priority?: number;
  };
  items: {
    slNo?: number;
    zone: string;
    bin: string;
    skuCode: string;
    skuName: string;
    batchNo?: string;
    requiredQty: number;
    pickedQty: number;
    serialNumbers?: string[];
  }[];
  totalItems?: number;
  totalQuantity?: number;
  totalPicked?: number;
  notes?: string;
}

async function generatePicklistPDF(data: PicklistData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 80;
      const leftMargin = 40;

      // Sort items by zone and bin for efficient picking
      const sortedItems = [...data.items].sort((a, b) => {
        if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
        return a.bin.localeCompare(b.bin);
      });

      // Add serial numbers to items
      sortedItems.forEach((item, index) => {
        item.slNo = index + 1;
      });

      // Header - Company name
      doc.fontSize(16).font("Helvetica-Bold").text(data.company.name, leftMargin, 40, { align: "center" });

      doc.fontSize(10).font("Helvetica").text(data.location.name, { align: "center" });

      if (data.location.address) {
        doc.fontSize(9).text(data.location.address, { align: "center" });
      }

      // Title
      doc.moveDown(0.5).fontSize(14).font("Helvetica-Bold").text("PICK LIST", { align: "center" });

      doc.moveDown(0.5);

      // Picklist details box
      const detailsY = doc.y;
      doc.rect(leftMargin, detailsY, pageWidth, 60).stroke();

      // Left column
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("Pick List No:", leftMargin + 10, detailsY + 8)
        .font("Helvetica")
        .text(data.picklistNo, leftMargin + 80, detailsY + 8);

      doc
        .font("Helvetica-Bold")
        .text("Date:", leftMargin + 10, detailsY + 22)
        .font("Helvetica")
        .text(new Date(data.createdAt).toLocaleDateString("en-IN"), leftMargin + 80, detailsY + 22);

      doc
        .font("Helvetica-Bold")
        .text("Status:", leftMargin + 10, detailsY + 36)
        .font("Helvetica")
        .text(data.status, leftMargin + 80, detailsY + 36);

      // Right column
      const rightCol = pageWidth / 2 + leftMargin;

      if (data.order) {
        doc
          .font("Helvetica-Bold")
          .text("Order No:", rightCol + 10, detailsY + 8)
          .font("Helvetica")
          .text(data.order.orderNo, rightCol + 80, detailsY + 8);

        doc
          .font("Helvetica-Bold")
          .text("Channel:", rightCol + 10, detailsY + 22)
          .font("Helvetica")
          .text(data.order.channel, rightCol + 80, detailsY + 22);

        doc
          .font("Helvetica-Bold")
          .text("Customer:", rightCol + 10, detailsY + 36)
          .font("Helvetica")
          .text(data.order.customerName.substring(0, 25), rightCol + 80, detailsY + 36);
      } else {
        doc
          .font("Helvetica-Bold")
          .text("Total Items:", rightCol + 10, detailsY + 8)
          .font("Helvetica")
          .text(sortedItems.length.toString(), rightCol + 80, detailsY + 8);

        doc
          .font("Helvetica-Bold")
          .text("Total Qty:", rightCol + 10, detailsY + 22)
          .font("Helvetica")
          .text(
            sortedItems.reduce((sum, i) => sum + i.requiredQty, 0).toString(),
            rightCol + 80,
            detailsY + 22
          );

        if (data.assignedTo) {
          doc
            .font("Helvetica-Bold")
            .text("Assigned To:", rightCol + 10, detailsY + 36)
            .font("Helvetica")
            .text(data.assignedTo.name, rightCol + 80, detailsY + 36);
        }
      }

      // Items table
      const tableY = detailsY + 75;
      const colWidths = {
        sno: 30,
        zone: 50,
        bin: 70,
        sku: 80,
        name: 150,
        batch: 50,
        qty: 40,
        picked: 45,
        check: 35,
      };

      // Table header
      doc.rect(leftMargin, tableY, pageWidth, 18).fill("#f0f0f0").stroke();

      doc.fontSize(8).font("Helvetica-Bold").fillColor("#000");

      let xPos = leftMargin + 3;
      const headers = [
        { text: "S.No", width: colWidths.sno },
        { text: "Zone", width: colWidths.zone },
        { text: "Bin", width: colWidths.bin },
        { text: "SKU", width: colWidths.sku },
        { text: "Description", width: colWidths.name },
        { text: "Batch", width: colWidths.batch },
        { text: "Qty", width: colWidths.qty, align: "right" as const },
        { text: "Picked", width: colWidths.picked, align: "right" as const },
        { text: "Check", width: colWidths.check, align: "center" as const },
      ];

      headers.forEach((header) => {
        doc.text(header.text, xPos, tableY + 5, {
          width: header.width - 5,
          align: header.align || "left",
        });
        xPos += header.width;
      });

      // Table rows
      let rowY = tableY + 18;
      doc.font("Helvetica").fontSize(8);

      sortedItems.forEach((item, index) => {
        // Check for page break
        if (rowY > doc.page.height - 100) {
          doc.addPage();
          rowY = 40;

          // Repeat header on new page
          doc.rect(leftMargin, rowY, pageWidth, 18).fill("#f0f0f0").stroke();

          doc.font("Helvetica-Bold").fillColor("#000");
          xPos = leftMargin + 3;
          headers.forEach((header) => {
            doc.text(header.text, xPos, rowY + 5, {
              width: header.width - 5,
              align: header.align || "left",
            });
            xPos += header.width;
          });

          rowY += 18;
          doc.font("Helvetica");
        }

        const rowHeight = 18;

        // Alternating row background
        if (index % 2 === 1) {
          doc.rect(leftMargin, rowY, pageWidth, rowHeight).fill("#fafafa").fillColor("#000");
        }

        xPos = leftMargin + 3;

        // Row data
        doc.text(item.slNo?.toString() || "", xPos, rowY + 5, { width: colWidths.sno - 5 });
        xPos += colWidths.sno;

        doc.text(item.zone || "-", xPos, rowY + 5, { width: colWidths.zone - 5 });
        xPos += colWidths.zone;

        doc.text(item.bin || "-", xPos, rowY + 5, { width: colWidths.bin - 5 });
        xPos += colWidths.bin;

        doc.text(item.skuCode, xPos, rowY + 5, { width: colWidths.sku - 5 });
        xPos += colWidths.sku;

        doc.text(item.skuName.substring(0, 25), xPos, rowY + 5, { width: colWidths.name - 5 });
        xPos += colWidths.name;

        doc.text(item.batchNo || "-", xPos, rowY + 5, { width: colWidths.batch - 5 });
        xPos += colWidths.batch;

        doc.text(item.requiredQty.toString(), xPos, rowY + 5, {
          width: colWidths.qty - 5,
          align: "right",
        });
        xPos += colWidths.qty;

        doc.text(item.pickedQty.toString(), xPos, rowY + 5, {
          width: colWidths.picked - 5,
          align: "right",
        });
        xPos += colWidths.picked;

        // Checkbox
        doc.rect(xPos + 8, rowY + 3, 12, 12).stroke();

        rowY += rowHeight;
      });

      // Draw table border
      doc.rect(leftMargin, tableY, pageWidth, rowY - tableY).stroke();

      // Summary section
      rowY += 15;
      const totalQty = sortedItems.reduce((sum, i) => sum + i.requiredQty, 0);
      const totalPicked = sortedItems.reduce((sum, i) => sum + i.pickedQty, 0);

      doc.fontSize(10).font("Helvetica-Bold");

      doc.text(`Total Items: ${sortedItems.length}`, leftMargin, rowY);
      doc.text(`Total Quantity: ${totalQty}`, leftMargin + 150, rowY);
      doc.text(`Picked: ${totalPicked}`, leftMargin + 300, rowY);
      doc.text(`Remaining: ${totalQty - totalPicked}`, leftMargin + 420, rowY);

      // Notes section
      if (data.notes) {
        rowY += 25;
        doc.fontSize(9).font("Helvetica-Bold").text("Notes:", leftMargin, rowY);
        doc.font("Helvetica").text(data.notes, leftMargin, rowY + 12, { width: pageWidth });
      }

      // Signature section
      rowY += data.notes ? 50 : 40;

      doc.fontSize(9).font("Helvetica");

      doc.text("Picked By: ____________________", leftMargin, rowY);
      doc.text("Signature: ____________________", leftMargin + 200, rowY);
      doc.text("Date: ____________________", leftMargin + 400, rowY);

      rowY += 25;

      doc.text("Verified By: ____________________", leftMargin, rowY);
      doc.text("Signature: ____________________", leftMargin + 200, rowY);
      doc.text("Date: ____________________", leftMargin + 400, rowY);

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Printed: ${new Date().toLocaleString("en-IN")} | Page ${i + 1} of ${pageCount}`,
            leftMargin,
            doc.page.height - 30,
            { align: "center", width: pageWidth }
          );
      }

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

    const { id: picklistId } = await params;

    // Fetch picklist data from backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://cjdquick-api-vr4w.onrender.com";
    const picklistRes = await fetch(`${backendUrl}/api/v1/waves/${picklistId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user?.id || "",
        "X-User-Role": session.user?.role || "",
        "X-Company-Id": session.user?.companyId || "",
      },
    });

    if (!picklistRes.ok) {
      return NextResponse.json({ error: "Picklist not found" }, { status: 404 });
    }

    const picklist = await picklistRes.json();

    // Fetch location data
    const locationRes = await fetch(`${backendUrl}/api/v1/locations/${picklist.locationId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user?.id || "",
        "X-User-Role": session.user?.role || "",
        "X-Company-Id": session.user?.companyId || "",
      },
    });

    const location = locationRes.ok ? await locationRes.json() : null;

    // Fetch company data
    const companyRes = await fetch(`${backendUrl}/api/v1/companies/${picklist.companyId || session.user?.companyId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": session.user?.id || "",
        "X-User-Role": session.user?.role || "",
        "X-Company-Id": session.user?.companyId || "",
      },
    });

    const company = companyRes.ok ? await companyRes.json() : null;

    // Build picklist data
    const picklistData: PicklistData = {
      picklistNo: picklist.waveNumber || picklist.picklistNumber || picklistId,
      status: picklist.status || "PENDING",
      createdAt: new Date(picklist.createdAt),
      startedAt: picklist.startedAt ? new Date(picklist.startedAt) : undefined,
      completedAt: picklist.completedAt ? new Date(picklist.completedAt) : undefined,
      location: {
        name: location?.name || "Warehouse",
        code: location?.code || "",
        address: location?.address,
      },
      company: {
        name: company?.name || "CJDQuick OMS",
      },
      assignedTo: picklist.assignedUser
        ? {
            name: picklist.assignedUser.name || picklist.assignedUser.email,
            id: picklist.assignedUser.id,
          }
        : undefined,
      order: picklist.order
        ? {
            orderNo: picklist.order.orderNumber,
            customerName: picklist.order.customerName || "Customer",
            channel: picklist.order.channel || "Direct",
            priority: picklist.order.priority,
          }
        : undefined,
      items: (picklist.items || picklist.picklistItems || []).map(
        (item: {
          zone?: { name?: string };
          zoneName?: string;
          bin?: { code?: string };
          binCode?: string;
          sku?: { code?: string; name?: string };
          skuCode?: string;
          skuName?: string;
          batchNo?: string;
          requiredQty?: number;
          quantity?: number;
          pickedQty?: number;
          pickedQuantity?: number;
          serialNumbers?: string[];
        }) => ({
          zone: item.zone?.name || item.zoneName || "-",
          bin: item.bin?.code || item.binCode || "-",
          skuCode: item.sku?.code || item.skuCode || "-",
          skuName: item.sku?.name || item.skuName || "Item",
          batchNo: item.batchNo,
          requiredQty: item.requiredQty || item.quantity || 0,
          pickedQty: item.pickedQty || item.pickedQuantity || 0,
          serialNumbers: item.serialNumbers,
        })
      ),
      notes: picklist.notes,
    };

    const pdfBuffer = await generatePicklistPDF(picklistData);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="picklist-${picklistId}.pdf"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Picklist generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate picklist" },
      { status: 500 }
    );
  }
}
