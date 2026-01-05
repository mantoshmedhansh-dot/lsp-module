import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...\n");

  // Clean existing data
  console.log("🧹 Cleaning existing data...");
  await prisma.shipmentScan.deleteMany();
  await prisma.shipmentEvent.deleteMany();
  await prisma.shipmentLeg.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.consignmentBag.deleteMany();
  await prisma.consignment.deleteMany();
  await prisma.journeyPlan.deleteMany();
  await prisma.partnerHandover.deleteMany();
  await prisma.partnerZoneMapping.deleteMany();
  await prisma.tripEvent.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.route.deleteMany();
  await prisma.driverLeave.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicleMaintenance.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.hubStaff.deleteMany();
  await prisma.hubPincodeMapping.deleteMany();
  await prisma.pincodeToSla.deleteMany();
  await prisma.hub.deleteMany();
  await prisma.partnerServiceability.deleteMany();
  await prisma.partnerPerformance.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.session.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  // ============================================
  // MOBILE APP USERS
  // ============================================
  console.log("\n👤 Creating Mobile App Users...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const users = await Promise.all([
    // Pickup Agents
    prisma.user.create({
      data: {
        email: "pickup1@cjdquick.com",
        passwordHash,
        name: "Suresh Pickup Agent",
        phone: "9900110011",
        role: "PICKUP_AGENT",
      },
    }),
    prisma.user.create({
      data: {
        email: "pickup2@cjdquick.com",
        passwordHash,
        name: "Ramesh Pickup Agent",
        phone: "9900110012",
        role: "PICKUP_AGENT",
      },
    }),
    // Delivery Agents
    prisma.user.create({
      data: {
        email: "delivery1@cjdquick.com",
        passwordHash,
        name: "Vikram Delivery Agent",
        phone: "9900110013",
        role: "DELIVERY_AGENT",
      },
    }),
    prisma.user.create({
      data: {
        email: "delivery2@cjdquick.com",
        passwordHash,
        name: "Anil Delivery Agent",
        phone: "9900110014",
        role: "DELIVERY_AGENT",
      },
    }),
    // Hub Operators
    prisma.user.create({
      data: {
        email: "hub1@cjdquick.com",
        passwordHash,
        name: "Priya Hub Operator",
        phone: "9900110015",
        role: "HUB_OPERATOR",
      },
    }),
    prisma.user.create({
      data: {
        email: "hub2@cjdquick.com",
        passwordHash,
        name: "Kavita Hub Operator",
        phone: "9900110016",
        role: "HUB_OPERATOR",
      },
    }),
    // Admin
    prisma.user.create({
      data: {
        email: "admin@cjdquick.com",
        passwordHash,
        name: "Admin User",
        phone: "9900110000",
        role: "ADMIN",
      },
    }),
  ]);

  console.log(`   ✅ Created ${users.length} mobile app users`);

  // ============================================
  // ADMIN PANEL USERS
  // ============================================
  console.log("\n👔 Creating Admin Panel Users...");

  const adminUsers = await Promise.all([
    // Super Admin - access to all hubs
    prisma.user.create({
      data: {
        email: "superadmin@cjdquick.com",
        passwordHash,
        name: "Super Admin",
        phone: "9900000001",
        role: "SUPER_ADMIN",
      },
    }),
  ]);

  console.log(`   ✅ Created ${adminUsers.length} admin panel users`);
  console.log("   📝 Admin Panel Login credentials:");
  console.log("      - Super Admin: superadmin@cjdquick.com / password123");
  console.log("   📝 Mobile App Login credentials:");
  console.log("      - Pickup Agent: pickup1@cjdquick.com / password123");
  console.log("      - Delivery Agent: delivery1@cjdquick.com / password123");
  console.log("      - Hub Operator: hub1@cjdquick.com / password123");
  console.log("      - Admin: admin@cjdquick.com / password123");

  // ============================================
  // PHASE 1: HUB NETWORK
  // ============================================
  console.log("\n📍 Phase 1: Creating Hub Network...");

  const hubs = await Promise.all([
    // Gateway Hubs (Major metros)
    prisma.hub.create({
      data: {
        code: "DEL",
        name: "Delhi Gateway Hub",
        type: "GATEWAY",
        address: "Sector 18, Gurgaon",
        pincode: "122001",
        city: "Gurgaon",
        state: "Haryana",
        latitude: 28.4595,
        longitude: 77.0266,
        totalBays: 30,
        loadingBays: 15,
        unloadingBays: 15,
        sortingCapacity: 5000,
        contactName: "Rajesh Kumar",
        contactPhone: "9876543210",
        contactEmail: "delhi@cjdquick.com",
      },
    }),
    prisma.hub.create({
      data: {
        code: "MUM",
        name: "Mumbai Gateway Hub",
        type: "GATEWAY",
        address: "Bhiwandi, Thane",
        pincode: "421302",
        city: "Mumbai",
        state: "Maharashtra",
        latitude: 19.2813,
        longitude: 73.0483,
        totalBays: 25,
        loadingBays: 12,
        unloadingBays: 13,
        sortingCapacity: 4500,
        contactName: "Amit Sharma",
        contactPhone: "9876543211",
        contactEmail: "mumbai@cjdquick.com",
      },
    }),
    prisma.hub.create({
      data: {
        code: "BLR",
        name: "Bangalore Gateway Hub",
        type: "GATEWAY",
        address: "Hosur Road, Electronic City",
        pincode: "560100",
        city: "Bangalore",
        state: "Karnataka",
        latitude: 12.8352,
        longitude: 77.6455,
        totalBays: 20,
        loadingBays: 10,
        unloadingBays: 10,
        sortingCapacity: 4000,
        contactName: "Suresh Reddy",
        contactPhone: "9876543212",
        contactEmail: "bangalore@cjdquick.com",
      },
    }),
    // Transshipment Hubs
    prisma.hub.create({
      data: {
        code: "JAI",
        name: "Jaipur Hub",
        type: "TRANSSHIPMENT",
        address: "Sitapura Industrial Area",
        pincode: "302022",
        city: "Jaipur",
        state: "Rajasthan",
        latitude: 26.8549,
        longitude: 75.8086,
        totalBays: 15,
        loadingBays: 7,
        unloadingBays: 8,
        sortingCapacity: 2000,
        contactName: "Vikram Singh",
        contactPhone: "9876543213",
        contactEmail: "jaipur@cjdquick.com",
      },
    }),
    prisma.hub.create({
      data: {
        code: "LKO",
        name: "Lucknow Hub",
        type: "TRANSSHIPMENT",
        address: "Amausi Industrial Area",
        pincode: "226008",
        city: "Lucknow",
        state: "Uttar Pradesh",
        latitude: 26.8447,
        longitude: 80.9462,
        totalBays: 12,
        loadingBays: 6,
        unloadingBays: 6,
        sortingCapacity: 1500,
        contactName: "Pradeep Mishra",
        contactPhone: "9876543214",
        contactEmail: "lucknow@cjdquick.com",
      },
    }),
    prisma.hub.create({
      data: {
        code: "CHE",
        name: "Chennai Hub",
        type: "TRANSSHIPMENT",
        address: "Ambattur Industrial Estate",
        pincode: "600058",
        city: "Chennai",
        state: "Tamil Nadu",
        latitude: 13.1150,
        longitude: 80.1580,
        totalBays: 18,
        loadingBays: 9,
        unloadingBays: 9,
        sortingCapacity: 2500,
        contactName: "Murali Krishnan",
        contactPhone: "9876543215",
        contactEmail: "chennai@cjdquick.com",
      },
    }),
    // Spoke Hubs
    prisma.hub.create({
      data: {
        code: "AGR",
        name: "Agra Spoke Hub",
        type: "SPOKE",
        address: "Transport Nagar",
        pincode: "282001",
        city: "Agra",
        state: "Uttar Pradesh",
        latitude: 27.1767,
        longitude: 78.0081,
        totalBays: 8,
        loadingBays: 4,
        unloadingBays: 4,
        sortingCapacity: 800,
        contactName: "Rakesh Verma",
        contactPhone: "9876543216",
        contactEmail: "agra@cjdquick.com",
      },
    }),
    prisma.hub.create({
      data: {
        code: "PUN",
        name: "Pune Spoke Hub",
        type: "SPOKE",
        address: "Chakan Industrial Area",
        pincode: "411501",
        city: "Pune",
        state: "Maharashtra",
        latitude: 18.7610,
        longitude: 73.8380,
        totalBays: 10,
        loadingBays: 5,
        unloadingBays: 5,
        sortingCapacity: 1200,
        contactName: "Santosh Patil",
        contactPhone: "9876543217",
        contactEmail: "pune@cjdquick.com",
      },
    }),
  ]);

  console.log(`   ✅ Created ${hubs.length} hubs`);

  // Create pincode mappings
  const pincodeMappings = [
    // Delhi region
    { hubCode: "DEL", pincodes: ["110001", "110002", "110003", "110004", "110005", "122001", "122002", "122003", "201301", "201302"] },
    // Mumbai region
    { hubCode: "MUM", pincodes: ["400001", "400002", "400003", "400004", "400005", "421302", "421303", "400601", "400602", "400603"] },
    // Bangalore region
    { hubCode: "BLR", pincodes: ["560001", "560002", "560003", "560100", "560101", "560034", "560035", "560036", "560037", "560038"] },
    // Jaipur region
    { hubCode: "JAI", pincodes: ["302001", "302002", "302003", "302004", "302022", "302013", "302014", "302015", "302016", "302017"] },
    // Lucknow region
    { hubCode: "LKO", pincodes: ["226001", "226002", "226003", "226004", "226008", "226010", "226011", "226012", "226013", "226014"] },
    // Chennai region
    { hubCode: "CHE", pincodes: ["600001", "600002", "600003", "600004", "600058", "600032", "600033", "600034", "600035", "600036"] },
    // Agra region
    { hubCode: "AGR", pincodes: ["282001", "282002", "282003", "282004", "282005", "282006", "282007", "282008"] },
    // Pune region
    { hubCode: "PUN", pincodes: ["411001", "411002", "411003", "411004", "411501", "411005", "411006", "411007", "411008", "411009"] },
  ];

  for (const mapping of pincodeMappings) {
    const hub = hubs.find(h => h.code === mapping.hubCode);
    if (hub) {
      for (const pincode of mapping.pincodes) {
        await prisma.hubPincodeMapping.create({
          data: {
            hubId: hub.id,
            pincode,
            type: "BOTH",
            priority: 1,
          },
        });
      }
    }
  }
  console.log(`   ✅ Created pincode mappings for all hubs`);

  // ============================================
  // PINCODE-TO-PINCODE SLA DATA
  // ============================================
  console.log("\n⏱️  Creating Pincode-to-Pincode SLA data...");

  const slaEntries = [
    // Delhi to major metros
    { origin: "110001", dest: "400001", tat: 3, service: "STANDARD", route: "NATIONAL" }, // Delhi -> Mumbai
    { origin: "110001", dest: "400001", tat: 2, service: "EXPRESS", route: "NATIONAL" },
    { origin: "110001", dest: "560001", tat: 4, service: "STANDARD", route: "NATIONAL" }, // Delhi -> Bangalore
    { origin: "110001", dest: "560001", tat: 2, service: "EXPRESS", route: "NATIONAL" },
    { origin: "110001", dest: "600001", tat: 4, service: "STANDARD", route: "NATIONAL" }, // Delhi -> Chennai
    { origin: "110001", dest: "600001", tat: 3, service: "EXPRESS", route: "NATIONAL" },
    // Mumbai to metros
    { origin: "400001", dest: "110001", tat: 3, service: "STANDARD", route: "NATIONAL" }, // Mumbai -> Delhi
    { origin: "400001", dest: "560001", tat: 2, service: "STANDARD", route: "NATIONAL" }, // Mumbai -> Bangalore
    { origin: "400001", dest: "600001", tat: 3, service: "STANDARD", route: "NATIONAL" }, // Mumbai -> Chennai
    { origin: "400001", dest: "411001", tat: 1, service: "STANDARD", route: "ZONAL" },    // Mumbai -> Pune (same zone)
    { origin: "400001", dest: "411001", tat: 1, service: "EXPRESS", route: "ZONAL" },
    // Bangalore routes
    { origin: "560001", dest: "600001", tat: 1, service: "STANDARD", route: "ZONAL" },    // Bangalore -> Chennai
    { origin: "560001", dest: "600001", tat: 1, service: "EXPRESS", route: "ZONAL" },
    { origin: "560001", dest: "110001", tat: 4, service: "STANDARD", route: "NATIONAL" }, // Bangalore -> Delhi
    { origin: "560001", dest: "400001", tat: 2, service: "STANDARD", route: "NATIONAL" }, // Bangalore -> Mumbai
    // Local routes (same city)
    { origin: "110001", dest: "110002", tat: 1, service: "STANDARD", route: "LOCAL" },
    { origin: "110001", dest: "110003", tat: 1, service: "EXPRESS", route: "LOCAL" },
    { origin: "400001", dest: "400002", tat: 1, service: "STANDARD", route: "LOCAL" },
    { origin: "560001", dest: "560002", tat: 1, service: "STANDARD", route: "LOCAL" },
    // Delhi region routes
    { origin: "110001", dest: "302001", tat: 2, service: "STANDARD", route: "ZONAL" },    // Delhi -> Jaipur
    { origin: "110001", dest: "226001", tat: 2, service: "STANDARD", route: "ZONAL" },    // Delhi -> Lucknow
    { origin: "110001", dest: "282001", tat: 2, service: "STANDARD", route: "ZONAL" },    // Delhi -> Agra
    { origin: "302001", dest: "110001", tat: 2, service: "STANDARD", route: "ZONAL" },    // Jaipur -> Delhi
    { origin: "226001", dest: "110001", tat: 2, service: "STANDARD", route: "ZONAL" },    // Lucknow -> Delhi
    { origin: "282001", dest: "110001", tat: 2, service: "STANDARD", route: "ZONAL" },    // Agra -> Delhi
  ];

  for (const sla of slaEntries) {
    await prisma.pincodeToSla.create({
      data: {
        originPincode: sla.origin,
        destinationPincode: sla.dest,
        serviceType: sla.service,
        tatDays: sla.tat,
        minDays: Math.max(1, sla.tat - 1),
        maxDays: sla.tat + 1,
        routeType: sla.route,
        codAvailable: true,
        reverseAvailable: true,
        slaPercentage: sla.service === "EXPRESS" ? 98 : 95,
      },
    });
  }
  console.log(`   ✅ Created ${slaEntries.length} pincode-to-pincode SLA entries`);

  // Update hub hierarchy (set parent hubs)
  console.log("\n📊 Setting up Hub Hierarchy...");

  // Transshipment hubs report to Gateway hubs
  await prisma.hub.update({
    where: { id: hubs[3].id }, // Jaipur -> Delhi
    data: { parentHubId: hubs[0].id },
  });
  await prisma.hub.update({
    where: { id: hubs[4].id }, // Lucknow -> Delhi
    data: { parentHubId: hubs[0].id },
  });
  await prisma.hub.update({
    where: { id: hubs[5].id }, // Chennai -> Bangalore
    data: { parentHubId: hubs[2].id },
  });

  // Spoke hubs report to Gateway/Transshipment hubs
  await prisma.hub.update({
    where: { id: hubs[6].id }, // Agra -> Lucknow
    data: { parentHubId: hubs[4].id },
  });
  await prisma.hub.update({
    where: { id: hubs[7].id }, // Pune -> Mumbai
    data: { parentHubId: hubs[1].id },
  });
  console.log("   ✅ Hub hierarchy configured");

  // Create Hub Managers and Operators with hub assignments
  console.log("\n👔 Creating Hub Managers and Operators...");

  const hubManagersAndOperators = await Promise.all([
    // Hub Managers for Gateway hubs
    prisma.user.create({
      data: {
        email: "manager.delhi@cjdquick.com",
        passwordHash,
        name: "Delhi Hub Manager",
        phone: "9900000010",
        role: "HUB_MANAGER",
        hubId: hubs[0].id, // Delhi Gateway
      },
    }),
    prisma.user.create({
      data: {
        email: "manager.mumbai@cjdquick.com",
        passwordHash,
        name: "Mumbai Hub Manager",
        phone: "9900000011",
        role: "HUB_MANAGER",
        hubId: hubs[1].id, // Mumbai Gateway
      },
    }),
    prisma.user.create({
      data: {
        email: "manager.bangalore@cjdquick.com",
        passwordHash,
        name: "Bangalore Hub Manager",
        phone: "9900000012",
        role: "HUB_MANAGER",
        hubId: hubs[2].id, // Bangalore Gateway
      },
    }),
    // Operators for Spoke hubs
    prisma.user.create({
      data: {
        email: "operator.agra@cjdquick.com",
        passwordHash,
        name: "Agra Spoke Operator",
        phone: "9900000020",
        role: "OPERATOR",
        hubId: hubs[6].id, // Agra Spoke
      },
    }),
    prisma.user.create({
      data: {
        email: "operator.pune@cjdquick.com",
        passwordHash,
        name: "Pune Spoke Operator",
        phone: "9900000021",
        role: "OPERATOR",
        hubId: hubs[7].id, // Pune Spoke
      },
    }),
    // Operators for Transshipment hubs
    prisma.user.create({
      data: {
        email: "operator.jaipur@cjdquick.com",
        passwordHash,
        name: "Jaipur Operator",
        phone: "9900000022",
        role: "OPERATOR",
        hubId: hubs[3].id, // Jaipur Transshipment
      },
    }),
  ]);

  console.log(`   ✅ Created ${hubManagersAndOperators.length} hub managers and operators`);
  console.log("   📝 Hub Manager Login credentials:");
  console.log("      - Delhi Hub Manager: manager.delhi@cjdquick.com / password123");
  console.log("      - Mumbai Hub Manager: manager.mumbai@cjdquick.com / password123");
  console.log("      - Bangalore Hub Manager: manager.bangalore@cjdquick.com / password123");
  console.log("   📝 Operator Login credentials:");
  console.log("      - Agra Operator: operator.agra@cjdquick.com / password123");
  console.log("      - Pune Operator: operator.pune@cjdquick.com / password123");
  console.log("      - Jaipur Operator: operator.jaipur@cjdquick.com / password123");

  // ============================================
  // PHASE 2: FLEET MANAGEMENT
  // ============================================
  console.log("\n🚛 Phase 2: Creating Fleet...");

  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        registrationNo: "DL01AB1234",
        type: "TATA_407",
        capacityTonnage: 2.5,
        capacityVolumeCBM: 14,
        lengthFt: 14,
        widthFt: 6,
        heightFt: 6,
        make: "Tata",
        model: "407",
        year: 2022,
        status: "AVAILABLE",
        currentHubId: hubs[0].id,
        ownershipType: "OWNED",
      },
    }),
    prisma.vehicle.create({
      data: {
        registrationNo: "DL01CD5678",
        type: "EICHER_14FT",
        capacityTonnage: 4,
        capacityVolumeCBM: 24,
        lengthFt: 14,
        widthFt: 7,
        heightFt: 7,
        make: "Eicher",
        model: "Pro 1059",
        year: 2023,
        status: "AVAILABLE",
        currentHubId: hubs[0].id,
        ownershipType: "OWNED",
      },
    }),
    prisma.vehicle.create({
      data: {
        registrationNo: "MH01EF9012",
        type: "TATA_ACE",
        capacityTonnage: 0.75,
        capacityVolumeCBM: 4,
        lengthFt: 7,
        widthFt: 4.5,
        heightFt: 4.5,
        make: "Tata",
        model: "Ace",
        year: 2023,
        status: "AVAILABLE",
        currentHubId: hubs[1].id,
        ownershipType: "OWNED",
      },
    }),
    prisma.vehicle.create({
      data: {
        registrationNo: "MH01GH3456",
        type: "TATA_709",
        capacityTonnage: 7,
        capacityVolumeCBM: 40,
        lengthFt: 17,
        widthFt: 7,
        heightFt: 7,
        make: "Tata",
        model: "LPT 709",
        year: 2021,
        status: "IN_TRANSIT",
        currentHubId: hubs[1].id,
        ownershipType: "LEASED",
      },
    }),
    prisma.vehicle.create({
      data: {
        registrationNo: "KA01IJ7890",
        type: "EICHER_14FT",
        capacityTonnage: 4,
        capacityVolumeCBM: 24,
        lengthFt: 14,
        widthFt: 7,
        heightFt: 7,
        make: "Eicher",
        model: "Pro 1055",
        year: 2022,
        status: "AVAILABLE",
        currentHubId: hubs[2].id,
        ownershipType: "OWNED",
      },
    }),
    prisma.vehicle.create({
      data: {
        registrationNo: "KA01KL1234",
        type: "TATA_407",
        capacityTonnage: 2.5,
        capacityVolumeCBM: 14,
        lengthFt: 14,
        widthFt: 6,
        heightFt: 6,
        make: "Tata",
        model: "407",
        year: 2023,
        status: "MAINTENANCE",
        currentHubId: hubs[2].id,
        ownershipType: "ATTACHED",
      },
    }),
  ]);

  console.log(`   ✅ Created ${vehicles.length} vehicles`);

  const drivers = await Promise.all([
    prisma.driver.create({
      data: {
        employeeCode: "DRV001",
        name: "Ramesh Kumar",
        phone: "9988776655",
        licenseNumber: "DL-1420110012345",
        licenseType: "HMV",
        licenseExpiry: new Date("2027-06-15"),
        status: "AVAILABLE",
        currentHubId: hubs[0].id,
        joiningDate: new Date("2020-03-01"),
        totalTrips: 245,
        totalKm: 45000,
        rating: 4.8,
      },
    }),
    prisma.driver.create({
      data: {
        employeeCode: "DRV002",
        name: "Sunil Yadav",
        phone: "9988776656",
        licenseNumber: "DL-1420110012346",
        licenseType: "HMV",
        licenseExpiry: new Date("2026-09-20"),
        status: "ON_TRIP",
        currentHubId: hubs[0].id,
        joiningDate: new Date("2021-06-15"),
        totalTrips: 180,
        totalKm: 32000,
        rating: 4.5,
      },
    }),
    prisma.driver.create({
      data: {
        employeeCode: "DRV003",
        name: "Manoj Sharma",
        phone: "9988776657",
        licenseNumber: "MH-1420110012347",
        licenseType: "HMV",
        licenseExpiry: new Date("2028-03-10"),
        status: "AVAILABLE",
        currentHubId: hubs[1].id,
        joiningDate: new Date("2019-01-10"),
        totalTrips: 320,
        totalKm: 58000,
        rating: 4.9,
      },
    }),
    prisma.driver.create({
      data: {
        employeeCode: "DRV004",
        name: "Venkatesh Rao",
        phone: "9988776658",
        licenseNumber: "KA-1420110012348",
        licenseType: "HMV",
        licenseExpiry: new Date("2026-12-25"),
        status: "AVAILABLE",
        currentHubId: hubs[2].id,
        joiningDate: new Date("2022-02-20"),
        totalTrips: 95,
        totalKm: 18000,
        rating: 4.6,
      },
    }),
    prisma.driver.create({
      data: {
        employeeCode: "DRV005",
        name: "Arun Singh",
        phone: "9988776659",
        licenseNumber: "RJ-1420110012349",
        licenseType: "LMV",
        licenseExpiry: new Date("2025-08-30"),
        status: "ON_LEAVE",
        currentHubId: hubs[3].id,
        joiningDate: new Date("2021-09-01"),
        totalTrips: 150,
        totalKm: 25000,
        rating: 4.4,
      },
    }),
  ]);

  console.log(`   ✅ Created ${drivers.length} drivers`);

  // ============================================
  // PHASE 3: ROUTES & TRIPS
  // ============================================
  console.log("\n🛣️  Phase 3: Creating Routes & Trips...");

  const routes = await Promise.all([
    prisma.route.create({
      data: {
        code: "DEL-MUM-LH",
        name: "Delhi to Mumbai Line Haul",
        type: "LINE_HAUL",
        originHubId: hubs[0].id,
        destinationHubId: hubs[1].id,
        distanceKm: 1400,
        estimatedDurationMin: 1200,
        departureTime: "18:00",
        arrivalTime: "14:00",
        frequency: "DAILY",
        baseCostPerTrip: 25000,
        fuelCostPerKm: 12,
        tollCost: 3500,
        recommendedVehicle: "TATA_709",
      },
    }),
    prisma.route.create({
      data: {
        code: "DEL-JAI-LH",
        name: "Delhi to Jaipur Line Haul",
        type: "LINE_HAUL",
        originHubId: hubs[0].id,
        destinationHubId: hubs[3].id,
        distanceKm: 280,
        estimatedDurationMin: 300,
        departureTime: "06:00",
        arrivalTime: "11:00",
        frequency: "DAILY",
        baseCostPerTrip: 8000,
        fuelCostPerKm: 10,
        tollCost: 800,
        recommendedVehicle: "TATA_407",
      },
    }),
    prisma.route.create({
      data: {
        code: "MUM-BLR-LH",
        name: "Mumbai to Bangalore Line Haul",
        type: "LINE_HAUL",
        originHubId: hubs[1].id,
        destinationHubId: hubs[2].id,
        distanceKm: 980,
        estimatedDurationMin: 840,
        departureTime: "20:00",
        arrivalTime: "10:00",
        frequency: "DAILY",
        baseCostPerTrip: 18000,
        fuelCostPerKm: 11,
        tollCost: 2200,
        recommendedVehicle: "EICHER_14FT",
      },
    }),
    prisma.route.create({
      data: {
        code: "DEL-MR-PU",
        name: "Delhi Milk Run Pickup",
        type: "MILK_RUN_PICKUP",
        originHubId: hubs[0].id,
        destinationHubId: hubs[0].id,
        distanceKm: 120,
        estimatedDurationMin: 360,
        departureTime: "09:00",
        arrivalTime: "15:00",
        frequency: "DAILY",
        baseCostPerTrip: 4000,
        fuelCostPerKm: 8,
        recommendedVehicle: "TATA_ACE",
        stops: JSON.stringify([
          { pincode: "110001", sequence: 1 },
          { pincode: "110002", sequence: 2 },
          { pincode: "110003", sequence: 3 },
          { pincode: "122001", sequence: 4 },
        ]),
      },
    }),
    prisma.route.create({
      data: {
        code: "BLR-MR-DL",
        name: "Bangalore Milk Run Delivery",
        type: "MILK_RUN_DELIVERY",
        originHubId: hubs[2].id,
        destinationHubId: hubs[2].id,
        distanceKm: 80,
        estimatedDurationMin: 300,
        departureTime: "08:00",
        arrivalTime: "13:00",
        frequency: "DAILY",
        baseCostPerTrip: 3500,
        fuelCostPerKm: 8,
        recommendedVehicle: "TATA_ACE",
        stops: JSON.stringify([
          { pincode: "560001", sequence: 1 },
          { pincode: "560034", sequence: 2 },
          { pincode: "560100", sequence: 3 },
        ]),
      },
    }),
  ]);

  console.log(`   ✅ Created ${routes.length} routes`);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const trips = await Promise.all([
    prisma.trip.create({
      data: {
        tripNumber: "TRP20260101001",
        routeId: routes[0].id,
        vehicleId: vehicles[3].id,
        driverId: drivers[1].id,
        type: "LINE_HAUL",
        originHubId: hubs[0].id,
        destinationHubId: hubs[1].id,
        scheduledDeparture: new Date(today.setHours(18, 0, 0)),
        scheduledArrival: new Date(tomorrow.setHours(14, 0, 0)),
        totalShipments: 45,
        totalWeightKg: 2800,
        totalVolumeCBM: 28,
        fillRateWeight: 70,
        fillRateVolume: 70,
        status: "IN_TRANSIT",
        plannedDistanceKm: 1400,
        estimatedCost: 28500,
        sealNumber: "SEAL-001234",
      },
    }),
    prisma.trip.create({
      data: {
        tripNumber: "TRP20260101002",
        routeId: routes[1].id,
        vehicleId: vehicles[0].id,
        driverId: drivers[0].id,
        type: "LINE_HAUL",
        originHubId: hubs[0].id,
        destinationHubId: hubs[3].id,
        scheduledDeparture: new Date(tomorrow.setHours(6, 0, 0)),
        scheduledArrival: new Date(tomorrow.setHours(11, 0, 0)),
        totalShipments: 25,
        totalWeightKg: 1200,
        totalVolumeCBM: 10,
        fillRateWeight: 48,
        fillRateVolume: 71,
        status: "PLANNED",
        plannedDistanceKm: 280,
        estimatedCost: 8800,
      },
    }),
    prisma.trip.create({
      data: {
        tripNumber: "TRP20260101003",
        routeId: routes[2].id,
        vehicleId: vehicles[4].id,
        driverId: drivers[3].id,
        type: "LINE_HAUL",
        originHubId: hubs[1].id,
        destinationHubId: hubs[2].id,
        scheduledDeparture: new Date(today.setHours(20, 0, 0)),
        scheduledArrival: new Date(tomorrow.setHours(10, 0, 0)),
        status: "LOADING",
        totalShipments: 0,
        totalWeightKg: 0,
        plannedDistanceKm: 980,
        estimatedCost: 20200,
      },
    }),
  ]);

  console.log(`   ✅ Created ${trips.length} trips`);

  // ============================================
  // PARTNERS
  // ============================================
  console.log("\n🤝 Creating Partners...");

  const partners = await Promise.all([
    prisma.partner.create({
      data: {
        code: "DELHIVERY",
        name: "Delhivery Pvt Ltd",
        displayName: "Delhivery",
        apiBaseUrl: "https://api.delhivery.com",
        apiKey: "delhivery_test_key",
        isActive: true,
        supportsCod: true,
        supportsReverse: true,
      },
    }),
    prisma.partner.create({
      data: {
        code: "DTDC",
        name: "DTDC Express Ltd",
        displayName: "DTDC",
        apiBaseUrl: "https://api.dtdc.com",
        apiKey: "dtdc_test_key",
        isActive: true,
        supportsCod: true,
        supportsReverse: false,
      },
    }),
    prisma.partner.create({
      data: {
        code: "BLUEDART",
        name: "Blue Dart Express",
        displayName: "Blue Dart",
        apiBaseUrl: "https://api.bluedart.com",
        apiKey: "bluedart_test_key",
        isActive: true,
        supportsCod: true,
        supportsReverse: true,
      },
    }),
  ]);

  console.log(`   ✅ Created ${partners.length} partners`);

  // Create partner zone mappings
  await Promise.all([
    prisma.partnerZoneMapping.create({
      data: {
        partnerId: partners[0].id,
        zoneName: "North East Region",
        zoneType: "REMOTE",
        pincodes: "781001,781002,781003,781004,781005,781006,781007,781008,781009,781010",
        handoverHubId: hubs[0].id,
        baseRate: 80,
        ratePerKg: 25,
        estimatedTatDays: 5,
      },
    }),
    prisma.partnerZoneMapping.create({
      data: {
        partnerId: partners[1].id,
        zoneName: "Hill Stations",
        zoneType: "LOW_VOLUME",
        pincodes: "173001,173002,173003,173004,173005,175001,175002,175003,175004,175005",
        handoverHubId: hubs[0].id,
        baseRate: 60,
        ratePerKg: 20,
        estimatedTatDays: 4,
      },
    }),
    prisma.partnerZoneMapping.create({
      data: {
        partnerId: partners[2].id,
        zoneName: "Tier 3 Cities",
        zoneType: "LOW_VOLUME",
        pincodes: "584101,584102,584103,584104,584105,585101,585102,585103,585104,585105",
        handoverHubId: hubs[2].id,
        baseRate: 50,
        ratePerKg: 15,
        estimatedTatDays: 3,
      },
    }),
  ]);

  console.log(`   ✅ Created partner zone mappings`);

  // ============================================
  // PHASE 4: SHIPMENTS & CONSIGNMENTS
  // ============================================
  console.log("\n📦 Phase 4: Creating Shipments...");

  // Create journey plans
  const journeyPlans = await Promise.all([
    // OWN_FLEET journey: Delhi to Mumbai
    prisma.journeyPlan.create({
      data: {
        originPincode: "110001",
        originHubId: hubs[0].id,
        destinationPincode: "400001",
        destinationHubId: hubs[1].id,
        totalLegs: 3,
        estimatedTransitDays: 3,
        fulfillmentMode: "OWN_FLEET",
        legs: JSON.stringify([
          { legIndex: 0, type: "FIRST_MILE", fromHub: null, toHub: "DEL", mode: "OWN_FLEET" },
          { legIndex: 1, type: "LINE_HAUL", fromHub: "DEL", toHub: "MUM", mode: "OWN_FLEET" },
          { legIndex: 2, type: "LAST_MILE", fromHub: "MUM", toHub: null, mode: "OWN_FLEET" },
        ]),
      },
    }),
    // HYBRID journey: Delhi to North East (partner last mile)
    prisma.journeyPlan.create({
      data: {
        originPincode: "110002",
        originHubId: hubs[0].id,
        destinationPincode: "781001",
        destinationHubId: hubs[0].id,
        totalLegs: 3,
        estimatedTransitDays: 6,
        fulfillmentMode: "HYBRID",
        partnerHandoverLeg: 2,
        partnerId: partners[0].id,
        legs: JSON.stringify([
          { legIndex: 0, type: "FIRST_MILE", fromHub: null, toHub: "DEL", mode: "OWN_FLEET" },
          { legIndex: 1, type: "LINE_HAUL", fromHub: "DEL", toHub: "DEL", mode: "OWN_FLEET" },
          { legIndex: 2, type: "LAST_MILE", fromHub: "DEL", toHub: null, mode: "PARTNER", partnerId: partners[0].id },
        ]),
      },
    }),
    // OWN_FLEET journey: Mumbai to Bangalore
    prisma.journeyPlan.create({
      data: {
        originPincode: "400002",
        originHubId: hubs[1].id,
        destinationPincode: "560001",
        destinationHubId: hubs[2].id,
        totalLegs: 3,
        estimatedTransitDays: 2,
        fulfillmentMode: "OWN_FLEET",
        legs: JSON.stringify([
          { legIndex: 0, type: "FIRST_MILE", fromHub: null, toHub: "MUM", mode: "OWN_FLEET" },
          { legIndex: 1, type: "LINE_HAUL", fromHub: "MUM", toHub: "BLR", mode: "OWN_FLEET" },
          { legIndex: 2, type: "LAST_MILE", fromHub: "BLR", toHub: null, mode: "OWN_FLEET" },
        ]),
      },
    }),
  ]);

  console.log(`   ✅ Created ${journeyPlans.length} journey plans`);

  // Create shipments with various statuses
  const shipmentData = [
    // OWN_FLEET shipments - Delhi to Mumbai
    { awb: "CJD20260101A001", origin: "110001", dest: "400001", status: "DELIVERED", mode: "OWN_FLEET", plan: 0 },
    { awb: "CJD20260101A002", origin: "110002", dest: "400002", status: "OUT_FOR_DELIVERY", mode: "OWN_FLEET", plan: 0 },
    { awb: "CJD20260101A003", origin: "110003", dest: "400003", status: "IN_TRANSIT", mode: "OWN_FLEET", plan: 0 },
    { awb: "CJD20260101A004", origin: "122001", dest: "400004", status: "IN_HUB", mode: "OWN_FLEET", plan: 0 },
    { awb: "CJD20260101A005", origin: "122002", dest: "400005", status: "PICKED_UP", mode: "OWN_FLEET", plan: 0 },
    // HYBRID shipments - Delhi to North East
    { awb: "CJD20260101B001", origin: "110001", dest: "781001", status: "WITH_PARTNER", mode: "HYBRID", plan: 1 },
    { awb: "CJD20260101B002", origin: "110002", dest: "781002", status: "DELIVERED", mode: "HYBRID", plan: 1 },
    { awb: "CJD20260101B003", origin: "110003", dest: "781003", status: "IN_TRANSIT", mode: "HYBRID", plan: 1 },
    // OWN_FLEET shipments - Mumbai to Bangalore
    { awb: "CJD20260101C001", origin: "400001", dest: "560001", status: "IN_TRANSIT", mode: "OWN_FLEET", plan: 2 },
    { awb: "CJD20260101C002", origin: "400002", dest: "560002", status: "BOOKED", mode: "OWN_FLEET", plan: 2 },
    { awb: "CJD20260101C003", origin: "400003", dest: "560003", status: "IN_HUB", mode: "OWN_FLEET", plan: 2 },
    // More shipments for volume
    { awb: "CJD20260101D001", origin: "302001", dest: "110001", status: "IN_TRANSIT", mode: "OWN_FLEET", plan: 0 },
    { awb: "CJD20260101D002", origin: "302002", dest: "110002", status: "DELIVERED", mode: "OWN_FLEET", plan: 0 },
    { awb: "CJD20260101D003", origin: "226001", dest: "560001", status: "IN_HUB", mode: "OWN_FLEET", plan: 2 },
    { awb: "CJD20260101D004", origin: "600001", dest: "400001", status: "PICKED_UP", mode: "OWN_FLEET", plan: 0 },
  ];

  const names = ["Rahul Sharma", "Priya Patel", "Amit Kumar", "Sneha Gupta", "Vikram Singh", "Anita Roy", "Rajesh Verma", "Meera Nair", "Suresh Reddy", "Kavita Joshi"];
  const cities = { "110": "Delhi", "122": "Gurgaon", "400": "Mumbai", "421": "Thane", "560": "Bangalore", "302": "Jaipur", "226": "Lucknow", "600": "Chennai", "781": "Guwahati" };

  const shipments = [];
  for (let i = 0; i < shipmentData.length; i++) {
    const sd = shipmentData[i];
    const originCity = cities[sd.origin.substring(0, 3) as keyof typeof cities] || "Unknown";
    const destCity = cities[sd.dest.substring(0, 3) as keyof typeof cities] || "Unknown";

    const shipment = await prisma.shipment.create({
      data: {
        awbNumber: sd.awb,
        clientId: "client-demo",
        shipperName: names[i % names.length],
        shipperPhone: `99887${String(i).padStart(5, "0")}`,
        shipperAddress: `${100 + i}, Sector ${10 + i}, ${originCity}`,
        shipperPincode: sd.origin,
        shipperCity: originCity,
        shipperState: originCity === "Delhi" ? "Delhi" : originCity === "Mumbai" ? "Maharashtra" : "Karnataka",
        consigneeName: names[(i + 5) % names.length],
        consigneePhone: `88776${String(i).padStart(5, "0")}`,
        consigneeAddress: `${200 + i}, Main Road, ${destCity}`,
        consigneePincode: sd.dest,
        consigneeCity: destCity,
        consigneeState: destCity === "Delhi" ? "Delhi" : destCity === "Mumbai" ? "Maharashtra" : "Karnataka",
        pieces: 1 + (i % 3),
        actualWeightKg: 1.5 + (i * 0.5),
        chargeableWeightKg: 2 + (i * 0.5),
        contentDescription: "Electronics & Accessories",
        declaredValue: 5000 + (i * 500),
        paymentMode: i % 3 === 0 ? "COD" : "PREPAID",
        codAmount: i % 3 === 0 ? 5000 + (i * 500) : 0,
        fulfillmentMode: sd.mode,
        status: sd.status,
        journeyPlanId: journeyPlans[sd.plan].id,
        currentHubId: sd.status === "IN_HUB" ? hubs[0].id : sd.status === "IN_TRANSIT" ? hubs[0].id : null,
        handedOverToPartner: sd.mode === "HYBRID" && sd.status === "WITH_PARTNER",
        partnerId: sd.mode === "HYBRID" ? partners[0].id : null,
        expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        deliveredAt: sd.status === "DELIVERED" ? new Date() : null,
      },
    });
    shipments.push(shipment);

    // Create shipment legs
    await prisma.shipmentLeg.createMany({
      data: [
        { shipmentId: shipment.id, journeyPlanId: journeyPlans[sd.plan].id, legIndex: 0, legType: "FIRST_MILE", fromLocation: sd.origin, toLocation: "Hub", mode: "OWN_FLEET", status: sd.status === "BOOKED" ? "PENDING" : "COMPLETED" },
        { shipmentId: shipment.id, journeyPlanId: journeyPlans[sd.plan].id, legIndex: 1, legType: "LINE_HAUL", fromLocation: "Origin Hub", toLocation: "Dest Hub", mode: "OWN_FLEET", status: sd.status === "IN_TRANSIT" ? "IN_PROGRESS" : sd.status === "DELIVERED" ? "COMPLETED" : "PENDING" },
        { shipmentId: shipment.id, journeyPlanId: journeyPlans[sd.plan].id, legIndex: 2, legType: "LAST_MILE", fromLocation: "Dest Hub", toLocation: sd.dest, mode: sd.mode === "HYBRID" ? "PARTNER" : "OWN_FLEET", partnerId: sd.mode === "HYBRID" ? partners[0].id : null, status: sd.status === "DELIVERED" ? "COMPLETED" : "PENDING" },
      ],
    });

    // Create events
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType: "BOOKING",
        status: "BOOKED",
        statusText: "Shipment booked successfully",
        source: "SYSTEM",
        eventTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });

    if (sd.status !== "BOOKED") {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: "PICKUP",
          status: "PICKED_UP",
          statusText: "Shipment picked up from shipper",
          source: "HUB_SCAN",
          eventTime: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
        },
      });
    }

    if (["IN_HUB", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "WITH_PARTNER"].includes(sd.status)) {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: "INSCAN",
          status: "IN_HUB",
          statusText: "Shipment arrived at origin hub",
          hubId: hubs[0].id,
          location: "Delhi Gateway Hub",
          source: "HUB_SCAN",
          eventTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      });
    }

    if (sd.status === "DELIVERED") {
      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          eventType: "DELIVERY",
          status: "DELIVERED",
          statusText: "Shipment delivered successfully",
          location: destCity,
          source: "DELIVERY_AGENT",
          eventTime: new Date(),
        },
      });
    }
  }

  console.log(`   ✅ Created ${shipments.length} shipments with events`);

  // Create consignments
  const consignments = await Promise.all([
    prisma.consignment.create({
      data: {
        consignmentNumber: "CN20260101DEL001",
        originHubId: hubs[0].id,
        destinationHubId: hubs[1].id,
        shipmentCount: 5,
        totalWeightKg: 25.5,
        totalVolumeCBM: 0.5,
        status: "IN_TRANSIT",
        tripId: trips[0].id,
        dispatchedAt: new Date(),
      },
    }),
    prisma.consignment.create({
      data: {
        consignmentNumber: "CN20260101DEL002",
        originHubId: hubs[0].id,
        destinationHubId: hubs[3].id,
        shipmentCount: 3,
        totalWeightKg: 12.0,
        totalVolumeCBM: 0.3,
        status: "OPEN",
      },
    }),
    prisma.consignment.create({
      data: {
        consignmentNumber: "CN20260101MUM001",
        originHubId: hubs[1].id,
        destinationHubId: hubs[2].id,
        shipmentCount: 4,
        totalWeightKg: 18.0,
        totalVolumeCBM: 0.4,
        status: "CLOSED",
        closedAt: new Date(),
      },
    }),
  ]);

  console.log(`   ✅ Created ${consignments.length} consignments`);

  // Create partner handovers
  const handovers = await Promise.all([
    prisma.partnerHandover.create({
      data: {
        handoverNumber: "HO20260101DEL001",
        partnerId: partners[0].id,
        handoverHubId: hubs[0].id,
        shipmentCount: 2,
        totalWeightKg: 8.5,
        shipmentIds: JSON.stringify([shipments[5].id, shipments[6].id]),
        status: "ACKNOWLEDGED",
        handedOverBy: "HUB_OPERATOR",
        handedOverAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        acknowledgedAt: new Date(),
      },
    }),
    prisma.partnerHandover.create({
      data: {
        handoverNumber: "HO20260101DEL002",
        partnerId: partners[0].id,
        handoverHubId: hubs[0].id,
        shipmentCount: 1,
        totalWeightKg: 4.0,
        shipmentIds: JSON.stringify([shipments[7].id]),
        status: "PENDING",
      },
    }),
  ]);

  console.log(`   ✅ Created ${handovers.length} partner handovers`);

  // Create some scans
  for (const shipment of shipments.slice(0, 5)) {
    await prisma.shipmentScan.create({
      data: {
        shipmentId: shipment.id,
        scanType: "PICKUP_SCAN",
        scanCode: shipment.awbNumber,
        hubId: hubs[0].id,
        scannedBy: "PICKUP_AGENT",
        scanTime: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.shipmentScan.create({
      data: {
        shipmentId: shipment.id,
        scanType: "INSCAN",
        scanCode: shipment.awbNumber,
        hubId: hubs[0].id,
        location: "Delhi Gateway Hub",
        scannedBy: "HUB_OPERATOR",
        scanTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`   ✅ Created shipment scans`);

  console.log("\n✨ Seed completed successfully!\n");
  console.log("Summary:");
  console.log(`   • ${users.length} Mobile Users`);
  console.log(`   • ${adminUsers.length + hubManagersAndOperators.length} Admin Panel Users (1 Super Admin, 3 Hub Managers, 3 Operators)`);
  console.log(`   • ${hubs.length} Hubs (with hierarchy)`);
  console.log(`   • ${vehicles.length} Vehicles`);
  console.log(`   • ${drivers.length} Drivers`);
  console.log(`   • ${routes.length} Routes`);
  console.log(`   • ${trips.length} Trips`);
  console.log(`   • ${partners.length} Partners`);
  console.log(`   • ${shipments.length} Shipments`);
  console.log(`   • ${consignments.length} Consignments`);
  console.log(`   • ${handovers.length} Partner Handovers`);
  console.log(`   • ${slaEntries.length} Pincode-to-Pincode SLA entries`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
