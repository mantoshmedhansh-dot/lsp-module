import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@cjdquick/database";

/**
 * POST /api/pincodes/sla/upload
 *
 * Bulk upload pincode-to-pincode SLA from CSV
 *
 * Expected CSV format:
 * origin_pincode,destination_pincode,service_type,tat_days,min_days,max_days,cod_available,reverse_available
 * 110001,400001,STANDARD,3,2,4,true,true
 * 110001,560001,EXPRESS,2,1,3,true,true
 */

interface SlaRow {
  origin_pincode: string;
  destination_pincode: string;
  service_type?: string;
  tat_days: string;
  min_days?: string;
  max_days?: string;
  route_type?: string;
  cod_available?: string;
  reverse_available?: string;
  base_rate?: string;
  rate_per_kg?: string;
  sla_percentage?: string;
}

function parseCSV(csvText: string): SlaRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: SlaRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length < 3) continue;

    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    if (row.origin_pincode && row.destination_pincode && row.tat_days) {
      rows.push(row);
    }
  }

  return rows;
}

function calculateRouteType(originPincode: string, destPincode: string): string {
  // Same first 3 digits = LOCAL
  if (originPincode.substring(0, 3) === destPincode.substring(0, 3)) {
    return "LOCAL";
  }
  // Same first digit = ZONAL
  if (originPincode[0] === destPincode[0]) {
    return "ZONAL";
  }
  // Metro pincodes (1, 2, 4, 5, 6 starting)
  const metros = ["1", "2", "4", "5", "6"];
  if (metros.includes(originPincode[0]) && metros.includes(destPincode[0])) {
    return "METRO";
  }
  return "NATIONAL";
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

    const results = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
      created: 0,
      updated: 0,
    };

    // If replace mode, deactivate all existing SLAs
    if (mode === "replace") {
      await prisma.pincodeToSla.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    // Process each row
    for (const row of rows) {
      try {
        // Validate pincode formats
        if (!/^\d{6}$/.test(row.origin_pincode)) {
          results.failed++;
          results.errors.push(`Invalid origin pincode: ${row.origin_pincode}`);
          continue;
        }

        if (!/^\d{6}$/.test(row.destination_pincode)) {
          results.failed++;
          results.errors.push(`Invalid destination pincode: ${row.destination_pincode}`);
          continue;
        }

        const tatDays = parseInt(row.tat_days);
        if (isNaN(tatDays) || tatDays < 1) {
          results.failed++;
          results.errors.push(`Invalid TAT days for ${row.origin_pincode}-${row.destination_pincode}: ${row.tat_days}`);
          continue;
        }

        const serviceType = row.service_type?.toUpperCase() || "STANDARD";
        if (!["EXPRESS", "STANDARD", "ECONOMY"].includes(serviceType)) {
          results.failed++;
          results.errors.push(`Invalid service type for ${row.origin_pincode}-${row.destination_pincode}: ${row.service_type}`);
          continue;
        }

        const minDays = parseInt(row.min_days || "1") || 1;
        const maxDays = parseInt(row.max_days || String(tatDays + 1)) || tatDays + 1;
        const routeType = row.route_type || calculateRouteType(row.origin_pincode, row.destination_pincode);
        const codAvailable = row.cod_available?.toLowerCase() !== "false";
        const reverseAvailable = row.reverse_available?.toLowerCase() !== "false";
        const baseRate = row.base_rate ? parseFloat(row.base_rate) : null;
        const ratePerKg = row.rate_per_kg ? parseFloat(row.rate_per_kg) : null;
        const slaPercentage = parseFloat(row.sla_percentage || "95") || 95;

        // Upsert the SLA
        const existing = await prisma.pincodeToSla.findFirst({
          where: {
            originPincode: row.origin_pincode,
            destinationPincode: row.destination_pincode,
            serviceType,
          },
        });

        if (existing) {
          await prisma.pincodeToSla.update({
            where: { id: existing.id },
            data: {
              tatDays,
              minDays,
              maxDays,
              routeType,
              codAvailable,
              reverseAvailable,
              baseRate,
              ratePerKg,
              slaPercentage,
              isActive: true,
            },
          });
          results.updated++;
        } else {
          await prisma.pincodeToSla.create({
            data: {
              originPincode: row.origin_pincode,
              destinationPincode: row.destination_pincode,
              serviceType,
              tatDays,
              minDays,
              maxDays,
              routeType,
              codAvailable,
              reverseAvailable,
              baseRate,
              ratePerKg,
              slaPercentage,
            },
          });
          results.created++;
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Error processing ${row.origin_pincode}-${row.destination_pincode}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        errors: results.errors.slice(0, 20),
      },
    });
  } catch (error) {
    console.error("Error uploading SLA data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process upload" },
      { status: 500 }
    );
  }
}

// GET /api/pincodes/sla/upload - Get template info
export async function GET() {
  const template = {
    headers: [
      "origin_pincode",
      "destination_pincode",
      "service_type",
      "tat_days",
      "min_days",
      "max_days",
      "cod_available",
      "reverse_available",
    ],
    description: {
      origin_pincode: "6-digit origin pincode (required)",
      destination_pincode: "6-digit destination pincode (required)",
      service_type: "EXPRESS, STANDARD, or ECONOMY (default: STANDARD)",
      tat_days: "Expected delivery days (required)",
      min_days: "Minimum delivery days (default: 1)",
      max_days: "Maximum delivery days (default: tat_days + 1)",
      cod_available: "COD availability - true/false (default: true)",
      reverse_available: "Reverse pickup available - true/false (default: true)",
    },
    example: [
      { origin_pincode: "110001", destination_pincode: "400001", service_type: "STANDARD", tat_days: "3", min_days: "2", max_days: "4", cod_available: "true", reverse_available: "true" },
      { origin_pincode: "110001", destination_pincode: "560001", service_type: "EXPRESS", tat_days: "2", min_days: "1", max_days: "3", cod_available: "true", reverse_available: "true" },
    ],
    sampleCSV: `origin_pincode,destination_pincode,service_type,tat_days,min_days,max_days,cod_available,reverse_available
110001,400001,STANDARD,3,2,4,true,true
110001,560001,EXPRESS,2,1,3,true,true
110001,302001,STANDARD,2,1,3,true,true
400001,560001,STANDARD,2,2,3,true,true
400001,110001,STANDARD,3,2,4,true,true`,
  };

  return NextResponse.json({ success: true, data: template });
}
