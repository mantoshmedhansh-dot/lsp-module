import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default company
  const company = await prisma.company.upsert({
    where: { code: "DEMO" },
    update: {},
    create: {
      code: "DEMO",
      name: "Demo Company",
      legalName: "Demo Company Pvt. Ltd.",
      gst: "27AABCU9603R1ZM",
      pan: "AABCU9603R",
    },
  });

  console.log("Created company:", company.name);

  // Create default warehouse location
  const warehouse = await prisma.location.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "WH-MUM-01",
      },
    },
    update: {},
    create: {
      code: "WH-MUM-01",
      name: "Mumbai Main Warehouse",
      type: "WAREHOUSE",
      address: {
        line1: "123 Industrial Area",
        line2: "Phase 2",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
      contactPerson: "John Doe",
      contactPhone: "+91 9876543210",
      contactEmail: "warehouse@demo.com",
      companyId: company.id,
    },
  });

  console.log("Created warehouse:", warehouse.name);

  // Create default zones
  const zones = [
    { code: "SALEABLE", name: "Saleable Zone", type: "SALEABLE" as const },
    { code: "QC", name: "Quality Check Zone", type: "QC" as const },
    { code: "RETURNS", name: "Returns Zone", type: "RETURNS" as const },
    { code: "DAMAGED", name: "Damaged Zone", type: "DAMAGED" as const },
  ];

  for (const zone of zones) {
    await prisma.zone.upsert({
      where: {
        locationId_code: {
          locationId: warehouse.id,
          code: zone.code,
        },
      },
      update: {},
      create: {
        ...zone,
        locationId: warehouse.id,
      },
    });
  }

  console.log("Created zones");

  // Create default admin user
  const hashedPassword = await hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      password: hashedPassword,
      name: "Admin User",
      phone: "+91 9876543210",
      role: "SUPER_ADMIN",
      companyId: company.id,
      locationAccess: [warehouse.id],
    },
  });

  console.log("Created admin user:", admin.email);

  // Create additional test users
  const testUsers = [
    {
      email: "manager@demo.com",
      name: "Manager User",
      role: "MANAGER" as const,
    },
    {
      email: "operator@demo.com",
      name: "Operator User",
      role: "OPERATOR" as const,
    },
    { email: "picker@demo.com", name: "Picker User", role: "PICKER" as const },
    { email: "packer@demo.com", name: "Packer User", role: "PACKER" as const },
    {
      email: "client@fashionforward.com",
      name: "Fashion Forward Client",
      role: "CLIENT" as const,
    },
  ];

  // Hash for client user (brand123)
  const clientHashedPassword = await hash("brand123", 12);

  for (const user of testUsers) {
    // Use different password for CLIENT role
    const userPassword = user.role === "CLIENT" ? clientHashedPassword : hashedPassword;

    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        password: userPassword,
        name: user.name,
        role: user.role,
        companyId: company.id,
        locationAccess: [warehouse.id],
      },
    });
  }

  console.log("Created test users");

  // Create sample SKUs
  const skus = [
    {
      code: "SKU-001",
      name: "Blue T-Shirt (M)",
      category: "Apparel",
      brand: "DemoBrand",
      mrp: 599,
      sellingPrice: 499,
      weight: 200,
      length: 30,
      width: 25,
      height: 3,
      barcodes: ["8901234567890"],
      companyId: company.id,
    },
    {
      code: "SKU-002",
      name: "Black Jeans (32)",
      category: "Apparel",
      brand: "DemoBrand",
      mrp: 1299,
      sellingPrice: 999,
      weight: 500,
      length: 40,
      width: 30,
      height: 5,
      barcodes: ["8901234567891"],
      companyId: company.id,
    },
    {
      code: "SKU-003",
      name: "Running Shoes (UK9)",
      category: "Footwear",
      brand: "DemoSports",
      mrp: 2999,
      sellingPrice: 2499,
      weight: 800,
      length: 35,
      width: 25,
      height: 15,
      barcodes: ["8901234567892"],
      companyId: company.id,
    },
  ];

  for (const sku of skus) {
    await prisma.sKU.upsert({
      where: { companyId_code: { companyId: company.id, code: sku.code } },
      update: {},
      create: sku,
    });
  }

  console.log("Created sample SKUs");

  // Get SALEABLE zone
  const saleableZone = await prisma.zone.findFirst({
    where: { locationId: warehouse.id, code: "SALEABLE" },
  });

  if (!saleableZone) {
    throw new Error("SALEABLE zone not found");
  }

  // Create bins
  const bins = [
    { code: "A-01-01", name: "Aisle A, Rack 01, Level 01" },
    { code: "A-01-02", name: "Aisle A, Rack 01, Level 02" },
    { code: "A-02-01", name: "Aisle A, Rack 02, Level 01" },
  ];

  const createdBins: { id: string; code: string }[] = [];
  for (const bin of bins) {
    const createdBin = await prisma.bin.upsert({
      where: { zoneId_code: { zoneId: saleableZone.id, code: bin.code } },
      update: {},
      create: {
        ...bin,
        zoneId: saleableZone.id,
      },
    });
    createdBins.push(createdBin);
  }

  console.log("Created bins");

  // Create inventory for SKUs
  const createdSkus = await prisma.sKU.findMany({
    where: { companyId: company.id },
  });

  for (let i = 0; i < createdSkus.length; i++) {
    const sku = createdSkus[i];
    const bin = createdBins[i % createdBins.length];

    // Check if inventory exists
    const existing = await prisma.inventory.findFirst({
      where: { skuId: sku.id, binId: bin.id },
    });

    if (existing) {
      await prisma.inventory.update({
        where: { id: existing.id },
        data: { quantity: 100 },
      });
    } else {
      await prisma.inventory.create({
        data: {
          skuId: sku.id,
          locationId: warehouse.id,
          binId: bin.id,
          quantity: 100,
          reservedQty: 0,
        },
      });
    }
  }

  console.log("Created inventory");

  // Create sample transporter
  await prisma.transporter.upsert({
    where: { code: "DELHIVERY" },
    update: {},
    create: {
      code: "DELHIVERY",
      name: "Delhivery",
      type: "COURIER",
      apiEnabled: true,
    },
  });

  await prisma.transporter.upsert({
    where: { code: "SELF" },
    update: {},
    create: {
      code: "SELF",
      name: "Self Ship",
      type: "SELF",
      apiEnabled: false,
    },
  });

  console.log("Created transporters");

  console.log("Database seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
