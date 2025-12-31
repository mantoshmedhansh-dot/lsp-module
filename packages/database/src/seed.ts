import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create demo user for client
  const clientUser = await prisma.user.upsert({
    where: { email: "demo@cjdquick.com" },
    update: {},
    create: {
      email: "demo@cjdquick.com",
      passwordHash: "demo123", // In production, use proper hashing
      name: "Demo User",
      phone: "9876543210",
      role: "CLIENT",
    },
  });
  console.log("✓ Created demo user:", clientUser.email);

  // Create demo client
  const client = await prisma.client.upsert({
    where: { userId: clientUser.id },
    update: {},
    create: {
      userId: clientUser.id,
      companyName: "CJD Quick Retail Pvt Ltd",
      gstNumber: "27AABCU9603R1ZM",
      billingAddress: "123 Business Park, Andheri East, Mumbai 400069",
      creditLimit: 100000,
      currentBalance: 0,
      paymentTermsDays: 15,
      weightCost: 0.4,
      weightSpeed: 0.3,
      weightReliability: 0.3,
      apiKey: "demo-api-key-12345",
    },
  });
  console.log("✓ Created demo client:", client.companyName);

  // Create warehouse staff user
  const staffUser = await prisma.user.upsert({
    where: { email: "staff@cjdquick.com" },
    update: {},
    create: {
      email: "staff@cjdquick.com",
      passwordHash: "staff123",
      name: "Warehouse Staff",
      phone: "9876543211",
      role: "WAREHOUSE_STAFF",
    },
  });
  console.log("✓ Created staff user:", staffUser.email);

  // Create warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { code: "MUM-WH1" },
    update: {},
    create: {
      clientId: client.id,
      name: "Mumbai Central Warehouse",
      code: "MUM-WH1",
      address: "Plot 45, MIDC Industrial Area, Andheri East",
      pincode: "400093",
      city: "Mumbai",
      state: "Maharashtra",
      contactName: "Rajesh Kumar",
      contactPhone: "9876543212",
    },
  });
  console.log("✓ Created warehouse:", warehouse.name);

  // Create warehouse staff
  const staff = await prisma.warehouseStaff.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      userId: staffUser.id,
      warehouseId: warehouse.id,
      employeeCode: "EMP001",
    },
  });
  console.log("✓ Created warehouse staff:", staff.employeeCode);

  // Create logistics partners
  const partners = [
    {
      code: "DELHIVERY",
      name: "Delhivery Limited",
      displayName: "Delhivery",
      apiBaseUrl: "https://track.delhivery.com/api",
      apiKey: "mock-delhivery-key",
      supportsCod: true,
      supportsReverse: true,
      supportsHyperlocal: false,
      settlementCycleDays: 15,
    },
    {
      code: "BLUEDART",
      name: "Blue Dart Express Ltd",
      displayName: "Blue Dart",
      apiBaseUrl: "https://netconnect.bluedart.com",
      apiKey: "mock-bluedart-key",
      supportsCod: true,
      supportsReverse: true,
      supportsHyperlocal: false,
      settlementCycleDays: 30,
    },
    {
      code: "XPRESSBEES",
      name: "XpressBees Logistics",
      displayName: "XpressBees",
      apiBaseUrl: "https://ship.xpressbees.com/api",
      apiKey: "mock-xpressbees-key",
      supportsCod: true,
      supportsReverse: false,
      supportsHyperlocal: false,
      settlementCycleDays: 15,
    },
    {
      code: "ECOMEXPRESS",
      name: "Ecom Express Pvt Ltd",
      displayName: "Ecom Express",
      apiBaseUrl: "https://api.ecomexpress.in",
      apiKey: "mock-ecomexpress-key",
      supportsCod: true,
      supportsReverse: true,
      supportsHyperlocal: false,
      settlementCycleDays: 15,
    },
    {
      code: "SHADOWFAX",
      name: "Shadowfax Technologies",
      displayName: "Shadowfax",
      apiBaseUrl: "https://api.shadowfax.in",
      apiKey: "mock-shadowfax-key",
      supportsCod: true,
      supportsReverse: false,
      supportsHyperlocal: true,
      settlementCycleDays: 7,
    },
  ];

  for (const partnerData of partners) {
    const partner = await prisma.partner.upsert({
      where: { code: partnerData.code },
      update: {},
      create: partnerData,
    });
    console.log("✓ Created partner:", partner.displayName);

    // Create performance record
    await prisma.partnerPerformance.upsert({
      where: {
        partnerId_calculationDate: {
          partnerId: partner.id,
          calculationDate: new Date(),
        },
      },
      update: {},
      create: {
        partnerId: partner.id,
        calculationDate: new Date(),
        totalOrders: 1000,
        deliveredOrders: 950,
        onTimeDeliveries: 900,
        ndrRaised: 50,
        ndrResolved: 40,
        rtoOrders: 30,
        otpPercentage: 94.7,
        ndrResolutionRate: 80,
        rtoPercentage: 3,
        avgRating: 4.2,
        reliabilityScore:
          partnerData.code === "DELHIVERY"
            ? 92
            : partnerData.code === "BLUEDART"
            ? 95
            : partnerData.code === "XPRESSBEES"
            ? 88
            : partnerData.code === "ECOMEXPRESS"
            ? 85
            : 82,
      },
    });
  }

  // Create serviceability data for common routes
  const routes = [
    // Mumbai to major cities
    { origin: "400093", dest: "110001", city: "Delhi" },
    { origin: "400093", dest: "560001", city: "Bangalore" },
    { origin: "400093", dest: "600001", city: "Chennai" },
    { origin: "400093", dest: "500001", city: "Hyderabad" },
    { origin: "400093", dest: "700001", city: "Kolkata" },
    { origin: "400093", dest: "380001", city: "Ahmedabad" },
    { origin: "400093", dest: "411001", city: "Pune" },
    { origin: "400093", dest: "302001", city: "Jaipur" },
    { origin: "400093", dest: "226001", city: "Lucknow" },
    { origin: "400093", dest: "400001", city: "Mumbai" },
  ];

  const allPartners = await prisma.partner.findMany();

  for (const route of routes) {
    for (const partner of allPartners) {
      // Different rates for different partners
      const rateMultiplier =
        partner.code === "BLUEDART"
          ? 1.3
          : partner.code === "DELHIVERY"
          ? 1.0
          : partner.code === "XPRESSBEES"
          ? 0.9
          : partner.code === "ECOMEXPRESS"
          ? 0.95
          : 0.85;

      const tatDays =
        partner.code === "BLUEDART"
          ? 2
          : partner.code === "SHADOWFAX"
          ? 1
          : partner.code === "DELHIVERY"
          ? 3
          : 4;

      await prisma.partnerServiceability.upsert({
        where: {
          partnerId_originPincode_destinationPincode: {
            partnerId: partner.id,
            originPincode: route.origin,
            destinationPincode: route.dest,
          },
        },
        update: {},
        create: {
          partnerId: partner.id,
          originPincode: route.origin,
          destinationPincode: route.dest,
          baseRate: 40 * rateMultiplier,
          ratePerKg: 15 * rateMultiplier,
          codChargePercent: 2,
          codChargeMin: 30,
          estimatedTatDays: tatDays,
        },
      });
    }
  }
  console.log("✓ Created serviceability data for", routes.length, "routes");

  // Create some pincode master data
  const pincodes = [
    { pincode: "400093", city: "Mumbai", state: "Maharashtra", tier: 1 },
    { pincode: "400001", city: "Mumbai", state: "Maharashtra", tier: 1 },
    { pincode: "110001", city: "New Delhi", state: "Delhi", tier: 1 },
    { pincode: "560001", city: "Bangalore", state: "Karnataka", tier: 1 },
    { pincode: "600001", city: "Chennai", state: "Tamil Nadu", tier: 1 },
    { pincode: "500001", city: "Hyderabad", state: "Telangana", tier: 1 },
    { pincode: "700001", city: "Kolkata", state: "West Bengal", tier: 1 },
    { pincode: "380001", city: "Ahmedabad", state: "Gujarat", tier: 1 },
    { pincode: "411001", city: "Pune", state: "Maharashtra", tier: 1 },
    { pincode: "302001", city: "Jaipur", state: "Rajasthan", tier: 2 },
    { pincode: "226001", city: "Lucknow", state: "Uttar Pradesh", tier: 2 },
  ];

  for (const pc of pincodes) {
    await prisma.pincodeMaster.upsert({
      where: { pincode: pc.pincode },
      update: {},
      create: pc,
    });
  }
  console.log("✓ Created pincode master data");

  console.log("\n✅ Seeding complete!\n");
  console.log("Demo credentials:");
  console.log("  Client ID:", client.id);
  console.log("  Staff ID:", staff.id);
  console.log("  Warehouse:", warehouse.code);
  console.log("  Origin Pincode:", warehouse.pincode);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
