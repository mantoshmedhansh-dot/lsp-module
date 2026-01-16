import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@oms/database";
import { auth } from "@/lib/auth";
import PDFDocument from "pdfkit";

// GET /api/print/picklist/[id] - Generate picklist PDF
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

    // Get picklist with all details including SKU and Bin relations
    const picklist = await prisma.picklist.findUnique({
      where: { id },
      include: {
        PicklistItem: {
          include: {
            SKU: {
              select: { id: true, code: true, name: true },
            },
            Bin: {
              select: { id: true, code: true, Zone: { select: { code: true } } },
            },
          },
        },
        Order: {
          include: {
            Location: {
              include: {
                Company: true,
              },
            },
          },
        },
      },
    });

    if (!picklist) {
      return NextResponse.json({ error: "Picklist not found" }, { status: 404 });
    }

    // Map items with correct field names (requiredQty -> quantity for PDF)
    const itemsWithDetails = picklist.PicklistItem.map((item) => ({
      id: item.id,
      quantity: item.requiredQty,
      pickedQty: item.pickedQty,
      sku: item.SKU ? { code: item.SKU.code, name: item.SKU.name } : null,
      bin: item.Bin ? { code: item.Bin.code, zone: item.Bin.Zone ? { code: item.Bin.Zone.code } : null } : null,
    }));

    // Generate PDF
    const pdfBuffer = await generatePicklistPDF({
      picklistNo: picklist.picklistNo,
      status: picklist.status,
      createdAt: picklist.createdAt,
      location: {
        name: picklist.Order.Location.name,
        company: { name: picklist.Order.Location.Company.name },
      },
    }, itemsWithDetails);

    // Return PDF - convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="picklist_${picklist.picklistNo}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating picklist:", error);
    return NextResponse.json(
      { error: "Failed to generate picklist" },
      { status: 500 }
    );
  }
}

async function generatePicklistPDF(
  picklist: {
    picklistNo: string;
    status: string;
    createdAt: Date;
    location: {
      name: string;
      company: { name: string };
    };
  },
  items: {
    id: string;
    quantity: number;
    pickedQty: number;
    sku: { code: string; name: string } | null;
    bin: { code: string; zone: { code: string } | null } | null;
  }[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const leftMargin = 40;

      // Header
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(picklist.location.company.name, { align: "center" });
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(picklist.location.name, { align: "center" });

      doc.moveDown();
      doc.fontSize(14).font("Helvetica-Bold").text("PICK LIST", { align: "center" });
      doc.moveDown();

      // Picklist details
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`Pick List No: `, { continued: true })
        .font("Helvetica")
        .text(picklist.picklistNo);

      doc
        .font("Helvetica-Bold")
        .text(`Date: `, { continued: true })
        .font("Helvetica")
        .text(picklist.createdAt.toLocaleDateString("en-IN"));

      doc
        .font("Helvetica-Bold")
        .text(`Status: `, { continued: true })
        .font("Helvetica")
        .text(picklist.status);

      doc
        .font("Helvetica-Bold")
        .text(`Total Items: `, { continued: true })
        .font("Helvetica")
        .text(items.length.toString());

      doc.moveDown();

      // Sort items by zone and bin for efficient picking
      const sortedItems = [...items].sort((a, b) => {
        const zoneA = a.bin?.zone?.code || "ZZZ";
        const zoneB = b.bin?.zone?.code || "ZZZ";
        if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
        const binA = a.bin?.code || "ZZZ";
        const binB = b.bin?.code || "ZZZ";
        return binA.localeCompare(binB);
      });

      // Table header
      const tableTop = doc.y;
      const colWidths = {
        sno: 30,
        zone: 50,
        bin: 70,
        sku: 80,
        name: 150,
        qty: 40,
        picked: 50,
        check: 40,
      };

      doc.font("Helvetica-Bold").fontSize(9);
      let x = leftMargin;

      doc.text("S.No", x, tableTop, { width: colWidths.sno });
      x += colWidths.sno;
      doc.text("Zone", x, tableTop, { width: colWidths.zone });
      x += colWidths.zone;
      doc.text("Bin", x, tableTop, { width: colWidths.bin });
      x += colWidths.bin;
      doc.text("SKU", x, tableTop, { width: colWidths.sku });
      x += colWidths.sku;
      doc.text("Description", x, tableTop, { width: colWidths.name });
      x += colWidths.name;
      doc.text("Qty", x, tableTop, { width: colWidths.qty, align: "right" });
      x += colWidths.qty;
      doc.text("Picked", x, tableTop, { width: colWidths.picked, align: "right" });
      x += colWidths.picked;
      doc.text("Check", x, tableTop, { width: colWidths.check, align: "center" });

      doc.moveTo(leftMargin, tableTop + 15).lineTo(555, tableTop + 15).stroke();

      // Table rows
      let y = tableTop + 20;
      doc.font("Helvetica").fontSize(9);

      sortedItems.forEach((item, index) => {
        // Check for page break
        if (y > 750) {
          doc.addPage();
          y = 40;

          // Repeat header on new page
          doc.font("Helvetica-Bold").fontSize(9);
          x = leftMargin;
          doc.text("S.No", x, y, { width: colWidths.sno });
          x += colWidths.sno;
          doc.text("Zone", x, y, { width: colWidths.zone });
          x += colWidths.zone;
          doc.text("Bin", x, y, { width: colWidths.bin });
          x += colWidths.bin;
          doc.text("SKU", x, y, { width: colWidths.sku });
          x += colWidths.sku;
          doc.text("Description", x, y, { width: colWidths.name });
          x += colWidths.name;
          doc.text("Qty", x, y, { width: colWidths.qty, align: "right" });
          x += colWidths.qty;
          doc.text("Picked", x, y, { width: colWidths.picked, align: "right" });
          x += colWidths.picked;
          doc.text("Check", x, y, { width: colWidths.check, align: "center" });
          doc.moveTo(leftMargin, y + 15).lineTo(555, y + 15).stroke();
          y += 20;
          doc.font("Helvetica").fontSize(9);
        }

        x = leftMargin;
        doc.text((index + 1).toString(), x, y, { width: colWidths.sno });
        x += colWidths.sno;
        doc.text(item.bin?.zone?.code || "-", x, y, { width: colWidths.zone });
        x += colWidths.zone;
        doc.text(item.bin?.code || "-", x, y, { width: colWidths.bin });
        x += colWidths.bin;
        doc.text(item.sku?.code || "-", x, y, { width: colWidths.sku });
        x += colWidths.sku;
        doc.text((item.sku?.name || "-").substring(0, 25), x, y, { width: colWidths.name });
        x += colWidths.name;
        doc.text(item.quantity.toString(), x, y, { width: colWidths.qty, align: "right" });
        x += colWidths.qty;
        doc.text(item.pickedQty.toString(), x, y, { width: colWidths.picked, align: "right" });
        x += colWidths.picked;

        // Checkbox
        doc.rect(x + 12, y - 2, 12, 12).stroke();

        y += 18;
      });

      // Draw bottom line
      doc.moveTo(leftMargin, y).lineTo(555, y).stroke();

      // Summary
      y += 15;
      const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalPicked = items.reduce((sum, i) => sum + i.pickedQty, 0);

      doc.font("Helvetica-Bold");
      doc.text(`Total Quantity: ${totalQty}`, leftMargin, y);
      doc.text(`Total Picked: ${totalPicked}`, leftMargin + 150, y);
      doc.text(`Remaining: ${totalQty - totalPicked}`, leftMargin + 300, y);

      // Signature section
      y += 40;
      doc.font("Helvetica").fontSize(9);
      doc.text("Picked By: ____________________", leftMargin, y);
      doc.text("Verified By: ____________________", leftMargin + 250, y);

      y += 20;
      doc.text("Date: ____________________", leftMargin, y);
      doc.text("Date: ____________________", leftMargin + 250, y);

      // Footer
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(`Printed: ${new Date().toLocaleString("en-IN")}`, 40, 780, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
