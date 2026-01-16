import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default company
  const company = await prisma.company.upsert({
    where: { code: "DEMO" },
    update: { updatedAt: new Date() },
    create: {
      code: "DEMO",
      name: "Demo Company",
      legalName: "Demo Company Pvt. Ltd.",
      gst: "27AABCU9603R1ZM",
      pan: "AABCU9603R",
      updatedAt: new Date(),
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
    update: { updatedAt: new Date() },
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
      updatedAt: new Date(),
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
      update: { updatedAt: new Date() },
      create: {
        ...zone,
        locationId: warehouse.id,
        updatedAt: new Date(),
      },
    });
  }

  console.log("Created zones");

  // Create default admin user
  const hashedPassword = await hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
      password: hashedPassword,  // Always update password on seed
      isActive: true,
      updatedAt: new Date()
    },
    create: {
      email: "admin@demo.com",
      password: hashedPassword,
      name: "Admin User",
      phone: "+91 9876543210",
      role: "SUPER_ADMIN",
      companyId: company.id,
      locationAccess: [warehouse.id],
      updatedAt: new Date(),
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
      update: {
        password: userPassword,  // Always update password on seed
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        email: user.email,
        password: userPassword,
        name: user.name,
        role: user.role,
        companyId: company.id,
        locationAccess: [warehouse.id],
        updatedAt: new Date(),
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
      update: { updatedAt: new Date() },
      create: { ...sku, updatedAt: new Date() },
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
      update: { updatedAt: new Date() },
      create: {
        ...bin,
        zoneId: saleableZone.id,
        updatedAt: new Date(),
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
        data: { quantity: 100, updatedAt: new Date() },
      });
    } else {
      await prisma.inventory.create({
        data: {
          skuId: sku.id,
          locationId: warehouse.id,
          binId: bin.id,
          quantity: 100,
          reservedQty: 0,
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log("Created inventory");

  // Create sample transporter
  await prisma.transporter.upsert({
    where: { code: "DELHIVERY" },
    update: { updatedAt: new Date() },
    create: {
      code: "DELHIVERY",
      name: "Delhivery",
      type: "COURIER",
      apiEnabled: true,
      updatedAt: new Date(),
    },
  });

  await prisma.transporter.upsert({
    where: { code: "SELF" },
    update: { updatedAt: new Date() },
    create: {
      code: "SELF",
      name: "Self Ship",
      type: "SELF",
      apiEnabled: false,
      updatedAt: new Date(),
    },
  });

  console.log("Created transporters");

  // Get transporters for deliveries
  const delhivery = await prisma.transporter.findUnique({ where: { code: "DELHIVERY" } });

  // Create sample orders with deliveries for Control Tower features
  console.log("Creating sample orders and deliveries for Control Tower...");

  const orderData = [
    { orderNo: "ORD-2024-001", customerName: "Rahul Sharma", customerPhone: "+919876543001", customerEmail: "rahul@example.com", city: "Mumbai", pincode: "400001", status: "SHIPPED" as const, paymentMode: "COD" as const },
    { orderNo: "ORD-2024-002", customerName: "Priya Patel", customerPhone: "+919876543002", customerEmail: "priya@example.com", city: "Delhi", pincode: "110001", status: "SHIPPED" as const, paymentMode: "PREPAID" as const },
    { orderNo: "ORD-2024-003", customerName: "Amit Kumar", customerPhone: "+919876543003", customerEmail: "amit@example.com", city: "Bangalore", pincode: "560001", status: "SHIPPED" as const, paymentMode: "COD" as const },
    { orderNo: "ORD-2024-004", customerName: "Sneha Reddy", customerPhone: "+919876543004", customerEmail: "sneha@example.com", city: "Chennai", pincode: "600001", status: "SHIPPED" as const, paymentMode: "PREPAID" as const },
    { orderNo: "ORD-2024-005", customerName: "Vikram Singh", customerPhone: "+919876543005", customerEmail: "vikram@example.com", city: "Hyderabad", pincode: "500001", status: "SHIPPED" as const, paymentMode: "COD" as const },
    { orderNo: "ORD-2024-006", customerName: "Neha Gupta", customerPhone: "+919876543006", customerEmail: "neha@example.com", city: "Pune", pincode: "411001", status: "SHIPPED" as const, paymentMode: "PREPAID" as const },
    { orderNo: "ORD-2024-007", customerName: "Rajesh Verma", customerPhone: "+919876543007", customerEmail: "rajesh@example.com", city: "Kolkata", pincode: "700001", status: "SHIPPED" as const, paymentMode: "COD" as const },
    { orderNo: "ORD-2024-008", customerName: "Anjali Das", customerPhone: "+919876543008", customerEmail: "anjali@example.com", city: "Ahmedabad", pincode: "380001", status: "DELIVERED" as const, paymentMode: "PREPAID" as const },
    { orderNo: "ORD-2024-009", customerName: "Suresh Iyer", customerPhone: "+919876543009", customerEmail: "suresh@example.com", city: "Jaipur", pincode: "302001", status: "SHIPPED" as const, paymentMode: "COD" as const },
    { orderNo: "ORD-2024-010", customerName: "Meera Nair", customerPhone: "+919876543010", customerEmail: "meera@example.com", city: "Lucknow", pincode: "226001", status: "SHIPPED" as const, paymentMode: "PREPAID" as const },
    { orderNo: "ORD-2024-011", customerName: "Kiran Rao", customerPhone: "+919876543011", customerEmail: "kiran@example.com", city: "Chandigarh", pincode: "160001", status: "DELIVERED" as const, paymentMode: "COD" as const },
    { orderNo: "ORD-2024-012", customerName: "Deepak Joshi", customerPhone: "+919876543012", customerEmail: "deepak@example.com", city: "Indore", pincode: "452001", status: "SHIPPED" as const, paymentMode: "PREPAID" as const },
  ];

  const createdOrders: Array<{ id: string; orderNo: string; customerName: string; customerPhone: string; customerEmail: string | null; status: string }> = [];
  const createdDeliveries: Array<{ id: string; orderId: string; awbNo: string; status: string }> = [];

  for (let i = 0; i < orderData.length; i++) {
    const od = orderData[i];
    const totalAmount = Math.floor(Math.random() * 5000) + 500;

    // Create order
    const order = await prisma.order.upsert({
      where: { orderNo: od.orderNo },
      update: { updatedAt: new Date() },
      create: {
        orderNo: od.orderNo,
        externalOrderNo: `EXT-${od.orderNo}`,
        channel: "MANUAL",
        status: od.status,
        customerName: od.customerName,
        customerPhone: od.customerPhone,
        customerEmail: od.customerEmail,
        shippingAddress: {
          line1: `${100 + i} Main Street`,
          city: od.city,
          state: "State",
          pincode: od.pincode,
          country: "India",
        },
        billingAddress: {
          line1: `${100 + i} Main Street`,
          city: od.city,
          state: "State",
          pincode: od.pincode,
          country: "India",
        },
        paymentMode: od.paymentMode,
        subtotal: totalAmount * 0.82,
        taxAmount: totalAmount * 0.18,
        totalAmount,
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        locationId: warehouse.id,
        updatedAt: new Date(),
      },
    });

    createdOrders.push({
      id: order.id,
      orderNo: order.orderNo,
      customerName: od.customerName,
      customerPhone: od.customerPhone,
      customerEmail: od.customerEmail,
      status: od.status,
    });

    // Create delivery for shipped orders
    if (delhivery) {
      const deliveryNo = `DEL-${od.orderNo}`;
      const awbNo = `AWB${String(i + 1).padStart(10, "0")}`;
      const delivery = await prisma.delivery.upsert({
        where: { deliveryNo },
        update: { updatedAt: new Date() },
        create: {
          deliveryNo,
          orderId: order.id,
          awbNo,
          transporterId: delhivery.id,
          status: od.status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT",
          shipDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: od.status === "DELIVERED" ? new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) : null,
          weight: Math.floor(Math.random() * 2000) + 200,
          updatedAt: new Date(),
        },
      });
      createdDeliveries.push({ id: delivery.id, orderId: order.id, awbNo: delivery.awbNo || "", status: delivery.status });
    }
  }

  console.log(`Created ${createdOrders.length} sample orders with deliveries`);

  // Create NDR records for Control Tower
  console.log("Creating NDR records...");

  const ndrReasons: Array<{ reason: "CUSTOMER_NOT_AVAILABLE" | "WRONG_ADDRESS" | "CUSTOMER_REFUSED" | "COD_NOT_READY" | "PHONE_NOT_REACHABLE" | "FUTURE_DELIVERY_REQUESTED" | "OTHER"; carrierRemark: string; confidence: number; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; riskScore: number }> = [
    { reason: "CUSTOMER_NOT_AVAILABLE", carrierRemark: "Customer not available at delivery address", confidence: 0.92, priority: "MEDIUM", riskScore: 45 },
    { reason: "WRONG_ADDRESS", carrierRemark: "Address incomplete, landmark missing", confidence: 0.95, priority: "HIGH", riskScore: 75 },
    { reason: "PHONE_NOT_REACHABLE", carrierRemark: "Customer phone switched off", confidence: 0.90, priority: "HIGH", riskScore: 70 },
    { reason: "CUSTOMER_REFUSED", carrierRemark: "Customer refused to accept delivery", confidence: 0.98, priority: "CRITICAL", riskScore: 95 },
    { reason: "COD_NOT_READY", carrierRemark: "Customer did not have cash for COD", confidence: 0.93, priority: "MEDIUM", riskScore: 40 },
    { reason: "FUTURE_DELIVERY_REQUESTED", carrierRemark: "Customer requested delivery next week", confidence: 0.88, priority: "LOW", riskScore: 25 },
    { reason: "CUSTOMER_NOT_AVAILABLE", carrierRemark: "Office closed, no one to receive", confidence: 0.91, priority: "MEDIUM", riskScore: 50 },
    { reason: "WRONG_ADDRESS", carrierRemark: "Building number does not exist", confidence: 0.96, priority: "CRITICAL", riskScore: 85 },
  ];

  const ndrStatuses: Array<"OPEN" | "OUTREACH_IN_PROGRESS" | "CUSTOMER_RESPONDED" | "REATTEMPT_SCHEDULED" | "RESOLVED" | "ESCALATED" | "RTO_INITIATED"> = [
    "OPEN", "OPEN", "OUTREACH_IN_PROGRESS", "CUSTOMER_RESPONDED", "REATTEMPT_SCHEDULED", "RESOLVED", "ESCALATED", "RTO_INITIATED"
  ];

  const createdNDRs: Array<{ id: string; ndrCode: string; orderId: string; deliveryId: string; status: string; reason: string; createdAt: Date }> = [];

  for (let i = 0; i < Math.min(8, createdDeliveries.length); i++) {
    const delivery = createdDeliveries[i];
    const order = createdOrders.find(o => o.id === delivery.orderId);
    if (!order) continue;

    const ndrData = ndrReasons[i % ndrReasons.length];
    const ndrStatus = ndrStatuses[i % ndrStatuses.length];
    const ndrCode = `NDR-${Date.now().toString(36).toUpperCase()}-${String(i + 1).padStart(3, "0")}`;

    // Create NDR with varied timestamps for realistic data
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000);
    const resolvedAt = ndrStatus === "RESOLVED" ? new Date(createdAt.getTime() + Math.floor(Math.random() * 48) * 60 * 60 * 1000) : null;

    const ndr = await prisma.nDR.create({
      data: {
        ndrCode,
        deliveryId: delivery.id,
        orderId: order.id,
        carrierNDRCode: `CARRIER-NDR-${i + 1}`,
        carrierRemark: ndrData.carrierRemark,
        attemptNumber: Math.floor(Math.random() * 3) + 1,
        attemptDate: createdAt,
        reason: ndrData.reason,
        aiClassification: `AI classified as ${ndrData.reason.replace(/_/g, " ").toLowerCase()}`,
        confidence: ndrData.confidence,
        status: ndrStatus,
        priority: ndrData.priority,
        riskScore: ndrData.riskScore,
        resolutionType: ndrStatus === "RESOLVED" ? "DELIVERED_ON_REATTEMPT" : null,
        resolvedAt,
        companyId: company.id,
        createdAt,
        updatedAt: new Date(),
      },
    });

    createdNDRs.push({
      id: ndr.id,
      ndrCode: ndr.ndrCode,
      orderId: order.id,
      deliveryId: delivery.id,
      status: ndr.status,
      reason: ndr.reason,
      createdAt: ndr.createdAt,
    });

    // Update delivery - NDR is tracked separately, keep delivery status
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "RTO_INITIATED", updatedAt: new Date() },
    });
  }

  console.log(`Created ${createdNDRs.length} NDR records`);

  // Create NDR Outreach records
  console.log("Creating NDR Outreach records...");

  const outreachChannels: Array<"WHATSAPP" | "SMS" | "EMAIL" | "AI_VOICE"> = ["WHATSAPP", "SMS", "EMAIL", "AI_VOICE"];
  const outreachStatuses: Array<"PENDING" | "SENT" | "DELIVERED" | "READ" | "RESPONDED" | "FAILED"> = ["PENDING", "SENT", "DELIVERED", "READ", "RESPONDED", "FAILED"];

  for (const ndr of createdNDRs) {
    const numAttempts = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < numAttempts; j++) {
      const channel = outreachChannels[j % outreachChannels.length];
      const status = outreachStatuses[Math.floor(Math.random() * outreachStatuses.length)];
      const sentAt = status !== "PENDING" ? new Date(ndr.createdAt.getTime() + (j + 1) * 2 * 60 * 60 * 1000) : null;
      const deliveredAt = ["DELIVERED", "READ", "RESPONDED"].includes(status) ? new Date((sentAt?.getTime() || Date.now()) + 5 * 60 * 1000) : null;

      await prisma.nDROutreach.create({
        data: {
          ndrId: ndr.id,
          channel,
          attemptNumber: j + 1,
          templateId: `TMPL-NDR-${channel}`,
          messageContent: `Hi, your order ${ndr.ndrCode} delivery was attempted but unsuccessful. Reason: ${ndr.reason.replace(/_/g, " ")}. Please confirm your availability.`,
          status,
          sentAt,
          deliveredAt,
          readAt: status === "READ" || status === "RESPONDED" ? new Date((deliveredAt?.getTime() || Date.now()) + 10 * 60 * 1000) : null,
          response: status === "RESPONDED" ? "Yes, I will be available tomorrow between 10 AM - 2 PM" : null,
          respondedAt: status === "RESPONDED" ? new Date((deliveredAt?.getTime() || Date.now()) + 30 * 60 * 1000) : null,
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log("Created NDR Outreach records");

  // Create Proactive Communication records
  console.log("Creating Proactive Communication records...");

  const triggers: Array<"ORDER_CONFIRMED" | "ORDER_SHIPPED" | "OUT_FOR_DELIVERY" | "DELAY_PREDICTED" | "SLA_BREACH_RISK" | "DELIVERED" | "FEEDBACK_REQUEST"> = [
    "ORDER_CONFIRMED", "ORDER_SHIPPED", "OUT_FOR_DELIVERY", "DELAY_PREDICTED", "SLA_BREACH_RISK", "DELIVERED", "FEEDBACK_REQUEST"
  ];

  const commStatuses: Array<"SCHEDULED" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "RESPONDED" | "FAILED"> = [
    "SCHEDULED", "QUEUED", "SENT", "DELIVERED", "READ", "RESPONDED", "FAILED"
  ];

  for (let i = 0; i < createdOrders.length; i++) {
    const order = createdOrders[i];
    const delivery = createdDeliveries.find(d => d.orderId === order.id);

    // Create 2-3 communications per order
    const numComms = Math.floor(Math.random() * 2) + 2;
    for (let j = 0; j < numComms; j++) {
      const trigger = triggers[(i + j) % triggers.length];
      const channel = outreachChannels[j % outreachChannels.length];
      const status = commStatuses[Math.floor(Math.random() * commStatuses.length)];
      const createdAt = new Date(Date.now() - (i * 24 + j * 2) * 60 * 60 * 1000);
      const sentAt = !["SCHEDULED", "QUEUED"].includes(status) ? new Date(createdAt.getTime() + 10 * 60 * 1000) : null;
      const deliveredAt = ["DELIVERED", "READ", "RESPONDED"].includes(status) ? new Date((sentAt?.getTime() || Date.now()) + 2 * 60 * 1000) : null;

      await prisma.proactiveCommunication.create({
        data: {
          orderId: order.id,
          deliveryId: delivery?.id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          trigger,
          channel,
          content: getProactiveMessageContent(trigger, order.orderNo, order.customerName),
          variables: { orderNo: order.orderNo, customerName: order.customerName },
          scheduledFor: status === "SCHEDULED" ? new Date(Date.now() + Math.floor(Math.random() * 24) * 60 * 60 * 1000) : null,
          priority: Math.floor(Math.random() * 10) + 1,
          status,
          sentAt,
          deliveredAt,
          readAt: ["READ", "RESPONDED"].includes(status) ? new Date((deliveredAt?.getTime() || Date.now()) + 5 * 60 * 1000) : null,
          responseText: status === "RESPONDED" ? "Thanks for the update!" : null,
          responseAt: status === "RESPONDED" ? new Date((deliveredAt?.getTime() || Date.now()) + 15 * 60 * 1000) : null,
          providerMessageId: sentAt ? `MSG-${Date.now().toString(36)}-${i}-${j}` : null,
          errorMessage: status === "FAILED" ? "Message delivery failed - phone unreachable" : null,
          companyId: company.id,
          createdAt,
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log("Created Proactive Communication records");

  // Create AI Action Log records
  console.log("Creating AI Action Log records...");

  const aiActionTypes: Array<"CARRIER_SWITCH" | "REATTEMPT_SCHEDULE" | "ADDRESS_UPDATE" | "CUSTOMER_NOTIFICATION" | "PRIORITY_CHANGE" | "ESCALATION" | "REFUND_RECOMMENDATION" | "SLA_ALERT"> = [
    "CARRIER_SWITCH", "REATTEMPT_SCHEDULE", "ADDRESS_UPDATE", "CUSTOMER_NOTIFICATION", "PRIORITY_CHANGE", "ESCALATION", "REFUND_RECOMMENDATION", "SLA_ALERT"
  ];

  const aiStatuses: Array<"PENDING_APPROVAL" | "AUTO_APPROVED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED"> = [
    "PENDING_APPROVAL", "AUTO_APPROVED", "APPROVED", "REJECTED", "EXECUTED", "FAILED"
  ];

  const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  // Create AI actions for NDRs
  for (let i = 0; i < createdNDRs.length; i++) {
    const ndr = createdNDRs[i];
    const numActions = Math.floor(Math.random() * 3) + 2;

    for (let j = 0; j < numActions; j++) {
      const actionType = aiActionTypes[(i + j) % aiActionTypes.length];
      const status = aiStatuses[Math.floor(Math.random() * aiStatuses.length)];
      const confidence = 0.7 + Math.random() * 0.28;
      const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
      const createdAt = new Date(ndr.createdAt.getTime() + (j + 1) * 30 * 60 * 1000);

      await prisma.aIActionLog.create({
        data: {
          actionType,
          entityType: "NDR",
          entityId: ndr.id,
          ndrId: ndr.id,
          decision: getAIDecision(actionType, ndr.reason),
          reasoning: getAIReasoning(actionType, ndr.reason, confidence),
          confidence,
          riskLevel,
          impactScore: Math.floor(Math.random() * 100),
          status,
          approvalRequired: !["AUTO_APPROVED", "EXECUTED"].includes(status),
          approvedAt: ["APPROVED", "EXECUTED"].includes(status) ? new Date(createdAt.getTime() + 15 * 60 * 1000) : null,
          executedAt: status === "EXECUTED" ? new Date(createdAt.getTime() + 20 * 60 * 1000) : null,
          executionResult: status === "EXECUTED" ? "Action completed successfully" : null,
          executionError: status === "FAILED" ? "External API timeout" : null,
          recommendations: { suggestedActions: ["Follow up with customer", "Consider alternative delivery slot"] },
          companyId: company.id,
          createdAt,
          updatedAt: new Date(),
        },
      });
    }
  }

  // Create AI actions for Orders (proactive)
  for (let i = 0; i < Math.min(5, createdOrders.length); i++) {
    const order = createdOrders[i];
    const actionType = aiActionTypes[i % aiActionTypes.length];
    const status = aiStatuses[Math.floor(Math.random() * aiStatuses.length)];
    const confidence = 0.75 + Math.random() * 0.23;

    await prisma.aIActionLog.create({
      data: {
        actionType,
        entityType: "Order",
        entityId: order.id,
        decision: `AI recommends ${actionType.replace(/_/g, " ").toLowerCase()} for order ${order.orderNo}`,
        reasoning: `Based on historical patterns and current delivery status, AI confidence: ${(confidence * 100).toFixed(1)}%`,
        confidence,
        riskLevel: riskLevels[Math.floor(Math.random() * riskLevels.length)],
        impactScore: Math.floor(Math.random() * 100),
        status,
        approvalRequired: true,
        recommendations: { suggestedActions: ["Monitor delivery progress", "Prepare backup carrier"] },
        companyId: company.id,
        updatedAt: new Date(),
      },
    });
  }

  console.log("Created AI Action Log records");

  console.log("Database seeding completed!");
}

// Helper functions for generating realistic content
function getProactiveMessageContent(trigger: string, orderNo: string, customerName: string): string {
  const messages: Record<string, string> = {
    ORDER_CONFIRMED: `Hi ${customerName}, your order ${orderNo} has been confirmed! We're preparing it for shipment.`,
    ORDER_SHIPPED: `Great news ${customerName}! Your order ${orderNo} has been shipped and is on its way.`,
    OUT_FOR_DELIVERY: `${customerName}, your order ${orderNo} is out for delivery today! Please keep your phone handy.`,
    DELAY_PREDICTED: `Hi ${customerName}, we noticed a potential delay for your order ${orderNo}. We're working to expedite it.`,
    SLA_BREACH_RISK: `${customerName}, we want to inform you about a slight delay in your order ${orderNo}. Our team is prioritizing it.`,
    DELIVERED: `${customerName}, your order ${orderNo} has been delivered! Thank you for shopping with us.`,
    FEEDBACK_REQUEST: `Hi ${customerName}, we hope you're enjoying your order ${orderNo}! Would you like to share your feedback?`,
  };
  return messages[trigger] || `Update for your order ${orderNo}`;
}

function getAIDecision(actionType: string, reason: string): string {
  const decisions: Record<string, string> = {
    CARRIER_SWITCH: "Switch to backup carrier for faster delivery",
    REATTEMPT_SCHEDULE: `Schedule reattempt based on customer availability analysis`,
    ADDRESS_UPDATE: "Request address verification from customer",
    CUSTOMER_NOTIFICATION: `Send proactive notification about ${reason.replace(/_/g, " ").toLowerCase()}`,
    PRIORITY_CHANGE: "Escalate priority based on risk assessment",
    ESCALATION: "Escalate to supervisor for manual intervention",
    REFUND_RECOMMENDATION: "Initiate refund process based on delivery failure pattern",
    SLA_ALERT: "Alert operations team about potential SLA breach",
  };
  return decisions[actionType] || "Take appropriate action";
}

function getAIReasoning(actionType: string, reason: string, confidence: number): string {
  return `Based on analysis of ${reason.replace(/_/g, " ").toLowerCase()} pattern, historical success rates, and current delivery conditions. AI confidence: ${(confidence * 100).toFixed(1)}%. This recommendation is based on similar cases with ${Math.floor(confidence * 100)}% success rate in past 30 days.`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
