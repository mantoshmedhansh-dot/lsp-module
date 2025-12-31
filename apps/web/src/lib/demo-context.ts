import { getPrisma } from "@cjdquick/database";

// Demo context for local development without authentication
// In production, this would be replaced with proper auth

let cachedDemoClient: { id: string; warehouseId: string; staffId: string } | null = null;

export async function getDemoContext() {
  if (cachedDemoClient) {
    return cachedDemoClient;
  }

  const prisma = await getPrisma();

  // Get the demo client (without include for mock DB compatibility)
  const client = await prisma.client.findFirst({
    where: { companyName: "CJD Quick Retail Pvt Ltd" },
  });

  if (!client) {
    throw new Error("Demo client not found. Visit /api/seed to create demo data");
  }

  // Get warehouse separately
  const warehouse = await prisma.warehouse.findFirst({
    where: { clientId: client.id },
  });

  // Get staff separately
  let staff = null;
  if (warehouse) {
    staff = await prisma.warehouseStaff.findFirst({
      where: { warehouseId: warehouse.id },
    });
  }

  cachedDemoClient = {
    id: client.id,
    warehouseId: warehouse?.id || "",
    staffId: staff?.id || "",
  };

  return cachedDemoClient;
}

export function clearDemoCache() {
  cachedDemoClient = null;
}
