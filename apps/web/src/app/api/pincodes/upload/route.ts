import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";

/**
 * POST /api/pincodes/upload
 *
 * Bulk upload pincode serviceability from CSV
 *
 * Expected CSV format:
 * pincode,hub_code,service_type,priority,cod_available
 * 110001,DEL,BOTH,1,true
 * 110002,DEL,PICKUP,1,true
 * 400001,MUM,DELIVERY,1,true
 *
 * service_type: PICKUP, DELIVERY, BOTH
 */

interface UploadRow {
  pincode: string;
  hub_code: string;
  service_type: string;
  priority?: string;
  cod_available?: string;
}

function parseCSV(csvText: string): UploadRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: UploadRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length < 2) continue;

    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    if (row.pincode && row.hub_code) {
      rows.push(row);
    }
  }

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mode = formData.get("mode") as string || "merge"; // merge or replace

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Get all hub codes for validation
    const hubs = await prisma.hub.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    });
    const hubCodeMap = new Map(hubs.map((h) => [h.code.toUpperCase(), h.id]));

    const results = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
      created: 0,
      updated: 0,
    };

    // If replace mode, delete existing mappings for the hubs in the CSV
    if (mode === "replace") {
      const uniqueHubCodes = [...new Set(rows.map((r) => r.hub_code.toUpperCase()))];
      const hubIdsToClean = uniqueHubCodes
        .map((code) => hubCodeMap.get(code))
        .filter(Boolean) as string[];

      if (hubIdsToClean.length > 0) {
        await prisma.hubPincodeMapping.deleteMany({
          where: { hubId: { in: hubIdsToClean } },
        });
      }
    }

    // Process each row
    for (const row of rows) {
      try {
        // Validate pincode format
        if (!/^\d{6}$/.test(row.pincode)) {
          results.failed++;
          results.errors.push(`Invalid pincode: ${row.pincode}`);
          continue;
        }

        // Validate hub code
        const hubId = hubCodeMap.get(row.hub_code.toUpperCase());
        if (!hubId) {
          results.failed++;
          results.errors.push(`Hub not found: ${row.hub_code}`);
          continue;
        }

        // Validate service type
        const serviceType = row.service_type?.toUpperCase() || "DELIVERY";
        if (!["PICKUP", "DELIVERY", "BOTH"].includes(serviceType)) {
          results.failed++;
          results.errors.push(`Invalid service_type for ${row.pincode}: ${row.service_type}`);
          continue;
        }

        const priority = parseInt(row.priority || "1") || 1;

        // Upsert the mapping
        const existing = await prisma.hubPincodeMapping.findFirst({
          where: {
            hubId,
            pincode: row.pincode,
            type: serviceType,
          },
        });

        if (existing) {
          await prisma.hubPincodeMapping.update({
            where: { id: existing.id },
            data: { priority },
          });
          results.updated++;
        } else {
          await prisma.hubPincodeMapping.create({
            data: {
              hubId,
              pincode: row.pincode,
              type: serviceType,
              priority,
            },
          });
          results.created++;
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Error processing ${row.pincode}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        errors: results.errors.slice(0, 20), // Limit errors to first 20
      },
    });
  } catch (error) {
    console.error("Error uploading pincodes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

// GET /api/pincodes/upload - Get template info
export async function GET() {
  const template = {
    headers: ["pincode", "hub_code", "service_type", "priority"],
    description: {
      pincode: "6-digit pincode (required)",
      hub_code: "Hub code like DEL, MUM, BLR (required)",
      service_type: "PICKUP, DELIVERY, or BOTH (default: DELIVERY)",
      priority: "Priority number, lower = higher priority (default: 1)",
    },
    example: [
      { pincode: "110001", hub_code: "DEL", service_type: "BOTH", priority: "1" },
      { pincode: "110002", hub_code: "DEL", service_type: "PICKUP", priority: "1" },
      { pincode: "400001", hub_code: "MUM", service_type: "DELIVERY", priority: "1" },
    ],
    sampleCSV: `pincode,hub_code,service_type,priority
110001,DEL,BOTH,1
110002,DEL,PICKUP,1
110003,DEL,DELIVERY,1
400001,MUM,BOTH,1
400002,MUM,DELIVERY,1`,
  };

  return NextResponse.json({ success: true, data: template });
}
