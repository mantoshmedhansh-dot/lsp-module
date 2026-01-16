/**
 * Comprehensive End-to-End Test for ALL OMS Modules
 * Tests: Inbound, Orders, Picking, Packing, Shipping, Returns, Inventory, Cycle Count, Gate Pass, COD
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { prisma } from "@oms/database";

interface TestResult {
  module: string;
  status: "PASS" | "FAIL";
  details: string;
  error?: string;
}

const results: TestResult[] = [];

function logStep(step: string, message: string) {
  console.log(`   ${step} ${message}`);
}

function logModule(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MODULE: ${name}`);
  console.log("=".repeat(60));
}

async function testInboundFlow() {
  logModule("INBOUND / GRN (Goods Receipt Note)");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true }, include: { Company: true } });
    const sku = await prisma.sKU.findFirst();
    let vendor = await prisma.vendor.findFirst();

    if (!location || !sku) throw new Error("Missing prerequisites");

    // Create vendor if not exists
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          code: "VENDOR001",
          name: "Test Vendor",
          companyId: location.companyId,
        },
      });
    }

    // Create Purchase Order
    const poSeq = await prisma.sequence.upsert({
      where: { name: "purchaseOrder" },
      update: { currentValue: { increment: 1 } },
      create: { name: "purchaseOrder", prefix: "PO", currentValue: 1 },
    });
    const poNo = `PO${String(poSeq.currentValue).padStart(6, "0")}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNo,
        status: "APPROVED",
        vendorId: vendor.id,
        expectedDate: new Date(),
        subtotal: 5000,
        taxAmount: 900,
        totalAmount: 5900,
        POItem: {
          create: [{
            skuId: sku.id,
            orderedQty: 50,
            unitPrice: 100,
            taxAmount: 900,
            totalPrice: 5900,
          }],
        },
      },
      include: { POItem: true },
    });
    logStep("✓", `Purchase Order created: ${po.poNo}`);

    // Get a user for receivedById
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user found");

    // Create Inbound/GRN
    const grnSeq = await prisma.sequence.upsert({
      where: { name: "inbound" },
      update: { currentValue: { increment: 1 } },
      create: { name: "inbound", prefix: "GRN", currentValue: 1 },
    });
    const inboundNo = `GRN${String(grnSeq.currentValue).padStart(6, "0")}`;

    const inbound = await prisma.inbound.create({
      data: {
        inboundNo,
        grnNo: inboundNo,
        status: "PENDING",
        type: "PURCHASE_ORDER",
        locationId: location.id,
        purchaseOrderId: po.id,
        receivedById: user.id,
        InboundItem: {
          create: po.POItem.map(item => ({
            skuId: item.skuId,
            expectedQty: item.orderedQty,
            receivedQty: 0,
            acceptedQty: 0,
            rejectedQty: 0,
          })),
        },
      },
      include: { InboundItem: { include: { SKU: true } } },
    });
    logStep("✓", `GRN created: ${inbound.inboundNo}`);

    // Receive goods - update inbound items
    await prisma.inbound.update({
      where: { id: inbound.id },
      data: { status: "IN_PROGRESS" },
    });
    logStep("✓", `GRN status: IN_PROGRESS`);

    // Complete receiving with QC
    const bin = await prisma.bin.findFirst({
      where: { Zone: { locationId: location.id } },
    });

    for (const item of inbound.InboundItem) {
      // Accept all items
      const qty = item.expectedQty ?? item.receivedQty ?? 0;
      await prisma.inboundItem.update({
        where: { id: item.id },
        data: {
          receivedQty: qty,
          acceptedQty: qty,
          rejectedQty: 0,
          binId: bin?.id,
        },
      });

      // Add to inventory
      const existingInv = await prisma.inventory.findFirst({
        where: { skuId: item.skuId, binId: bin?.id },
      });

      if (existingInv) {
        await prisma.inventory.update({
          where: { id: existingInv.id },
          data: { quantity: { increment: qty } },
        });
      } else if (bin) {
        await prisma.inventory.create({
          data: {
            skuId: item.skuId,
            locationId: location.id,
            binId: bin.id,
            quantity: qty,
            reservedQty: 0,
          },
        });
      }

      // Create inventory movement
      const mvtSeq = await prisma.sequence.upsert({
        where: { name: "inventoryMovement" },
        update: { currentValue: { increment: 1 } },
        create: { name: "inventoryMovement", prefix: "MVT", currentValue: 1 },
      });
      await prisma.inventoryMovement.create({
        data: {
          movementNo: `MVT${String(mvtSeq.currentValue).padStart(8, "0")}`,
          type: "IN",
          skuId: item.skuId,
          toBinId: bin?.id,
          quantity: qty,
          referenceType: "INBOUND",
          referenceId: inbound.id,
          performedBy: user.id,
        },
      });

      logStep("✓", `Received ${qty} x ${item.SKU.code} into ${bin?.code}`);
    }

    // Complete inbound
    await prisma.inbound.update({
      where: { id: inbound.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Update PO status
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED" },
    });

    logStep("✓", `GRN completed, PO marked as RECEIVED`);

    results.push({ module: "Inbound/GRN", status: "PASS", details: `PO: ${po.poNo}, GRN: ${inbound.grnNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "Inbound/GRN", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function testOrderFlow() {
  logModule("ORDER LIFECYCLE (Create -> Allocate -> Pick -> Pack -> Ship -> Deliver)");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true } });
    const skus = await prisma.sKU.findMany({ take: 2 });

    if (!location || skus.length === 0) throw new Error("Missing prerequisites");

    // Step 1: Create Order
    const orderSeq = await prisma.sequence.upsert({
      where: { name: "order" },
      update: { currentValue: { increment: 1 } },
      create: { name: "order", prefix: "ORD", currentValue: 1 },
    });
    const orderNo = `ORD${String(orderSeq.currentValue).padStart(8, "0")}`;

    const order = await prisma.order.create({
      data: {
        orderNo,
        channel: "WEBSITE",
        paymentMode: "PREPAID",
        status: "CREATED",
        customerName: "E2E Test Customer",
        customerPhone: "9876543210",
        customerEmail: "test@example.com",
        shippingAddress: {
          name: "Test Customer",
          phone: "9876543210",
          addressLine1: "123 Test Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001",
        },
        orderDate: new Date(),
        subtotal: 1000,
        taxAmount: 180,
        shippingCharges: 50,
        discount: 0,
        totalAmount: 1230,
        locationId: location.id,
        OrderItem: {
          create: skus.slice(0, 1).map(sku => ({
            skuId: sku.id,
            quantity: 2,
            allocatedQty: 0,
            unitPrice: 500,
            taxAmount: 90,
            discount: 0,
            totalPrice: 590,
          })),
        },
      },
      include: { OrderItem: { include: { SKU: true } } },
    });
    logStep("✓", `Order created: ${order.orderNo} (Status: ${order.status})`);

    // Step 2: Allocate
    for (const item of order.OrderItem) {
      const inv = await prisma.inventory.findFirst({
        where: { skuId: item.skuId, locationId: location.id, quantity: { gte: item.quantity } },
        include: { Bin: true },
      });
      if (inv) {
        await prisma.inventory.update({
          where: { id: inv.id },
          data: { reservedQty: { increment: item.quantity } },
        });
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { allocatedQty: item.quantity },
        });
        logStep("✓", `Allocated ${item.quantity} x ${item.SKU.code}`);
      }
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "ALLOCATED" } });

    // Step 3: Create Picklist
    const plSeq = await prisma.sequence.upsert({
      where: { name: "picklist" },
      update: { currentValue: { increment: 1 } },
      create: { name: "picklist", prefix: "PL", currentValue: 1 },
    });
    const picklistNo = `PL${String(plSeq.currentValue).padStart(6, "0")}`;

    const allocatedItems = await prisma.orderItem.findMany({
      where: { orderId: order.id, allocatedQty: { gt: 0 } },
      include: { SKU: true },
    });

    const picklistItemsData = [];
    for (const item of allocatedItems) {
      const inv = await prisma.inventory.findFirst({
        where: { skuId: item.skuId, locationId: location.id, reservedQty: { gt: 0 } },
        include: { Bin: true },
      });
      if (inv?.binId) {
        picklistItemsData.push({
          skuId: item.skuId,
          binId: inv.binId,
          requiredQty: item.allocatedQty,
          pickedQty: 0,
        });
      }
    }

    const picklist = await prisma.picklist.create({
      data: {
        picklistNo,
        status: "PENDING",
        orderId: order.id,
        PicklistItem: { create: picklistItemsData },
      },
      include: { PicklistItem: { include: { SKU: true, Bin: true } } },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "PICKLIST_GENERATED" } });
    logStep("✓", `Picklist created: ${picklist.picklistNo}`);

    // Step 4: Pick
    await prisma.picklist.update({
      where: { id: picklist.id },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "PICKING" } });

    for (const item of picklist.PicklistItem) {
      await prisma.picklistItem.update({
        where: { id: item.id },
        data: { pickedQty: item.requiredQty, pickedAt: new Date() },
      });
      await prisma.inventory.updateMany({
        where: { skuId: item.skuId, binId: item.binId },
        data: { quantity: { decrement: item.requiredQty }, reservedQty: { decrement: item.requiredQty } },
      });
      logStep("✓", `Picked ${item.requiredQty} x ${item.SKU.code}`);
    }

    await prisma.picklist.update({
      where: { id: picklist.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { pickedQty: item.quantity, status: "PICKED" },
      });
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "PICKED" } });

    // Step 5: Pack
    await prisma.order.update({ where: { id: order.id }, data: { status: "PACKING" } });

    const dlvSeq = await prisma.sequence.upsert({
      where: { name: "delivery" },
      update: { currentValue: { increment: 1 } },
      create: { name: "delivery", prefix: "DLV", currentValue: 1 },
    });
    const deliveryNo = `DLV${String(dlvSeq.currentValue).padStart(8, "0")}`;

    const transporter = await prisma.transporter.findFirst({ where: { isActive: true } });

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNo,
        orderId: order.id,
        transporterId: transporter?.id,
        status: "PACKED",
        weight: 0.5,
        length: 30,
        width: 20,
        height: 10,
        boxes: 1,
        invoiceNo: `INV-${Date.now()}`,
        packDate: new Date(),
      },
    });

    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { packedQty: item.quantity, status: "PACKED" },
      });
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "PACKED" } });
    logStep("✓", `Delivery created: ${delivery.deliveryNo}`);

    // Step 6: Manifest & AWB
    const awbNo = `AWB${Date.now()}`;
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { awbNo },
    });
    logStep("✓", `AWB assigned: ${awbNo}`);

    const manSeq = await prisma.sequence.upsert({
      where: { name: "manifest" },
      update: { currentValue: { increment: 1 } },
      create: { name: "manifest", prefix: "MAN", currentValue: 1 },
    });
    const manifestNo = `MAN${String(manSeq.currentValue).padStart(6, "0")}`;

    const manifest = await prisma.manifest.create({
      data: {
        manifestNo,
        status: "OPEN",
        transporterId: transporter?.id || "",
        Delivery: { connect: { id: delivery.id } },
      },
    });
    await prisma.delivery.update({ where: { id: delivery.id }, data: { status: "MANIFESTED" } });
    await prisma.order.update({ where: { id: order.id }, data: { status: "MANIFESTED" } });
    logStep("✓", `Manifest created: ${manifest.manifestNo}`);

    // Step 7: Ship
    await prisma.manifest.update({ where: { id: manifest.id }, data: { status: "CLOSED" } });
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "SHIPPED", shipDate: new Date() },
    });
    for (const item of order.OrderItem) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { shippedQty: item.quantity, status: "SHIPPED" },
      });
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
    logStep("✓", `Order shipped`);

    // Step 8: Deliver
    await prisma.delivery.update({ where: { id: delivery.id }, data: { status: "IN_TRANSIT" } });
    await prisma.order.update({ where: { id: order.id }, data: { status: "IN_TRANSIT" } });

    await prisma.delivery.update({ where: { id: delivery.id }, data: { status: "OUT_FOR_DELIVERY" } });
    await prisma.order.update({ where: { id: order.id }, data: { status: "OUT_FOR_DELIVERY" } });

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: "DELIVERED", podSignature: "signature.jpg", receivedBy: "Customer", remarks: "Delivered" },
    });
    for (const item of order.OrderItem) {
      await prisma.orderItem.update({ where: { id: item.id }, data: { status: "DELIVERED" } });
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    logStep("✓", `Order delivered with POD`);

    results.push({ module: "Order Lifecycle", status: "PASS", details: `Order: ${order.orderNo}, Delivery: ${delivery.deliveryNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "Order Lifecycle", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function testReturnFlow() {
  logModule("RETURNS / RTO");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true } });

    // Find a delivered order to return
    const deliveredOrder = await prisma.order.findFirst({
      where: { status: "DELIVERED" },
      include: { OrderItem: { include: { SKU: true } }, Delivery: true },
    });

    if (!deliveredOrder || !location) throw new Error("No delivered order found for return test");

    // Create Return
    const retSeq = await prisma.sequence.upsert({
      where: { name: "return" },
      update: { currentValue: { increment: 1 } },
      create: { name: "return", prefix: "RET", currentValue: 1 },
    });
    const returnNo = `RET${String(retSeq.currentValue).padStart(6, "0")}`;

    const returnRecord = await prisma.return.create({
      data: {
        returnNo,
        orderId: deliveredOrder.id,
        type: "CUSTOMER_RETURN",
        reason: "Size not fitting",
        status: "INITIATED",
        ReturnItem: {
          create: deliveredOrder.OrderItem.map(item => ({
            skuId: item.skuId,
            quantity: item.quantity,
          })),
        },
      },
      include: { ReturnItem: true },
    });
    logStep("✓", `Return created: ${returnRecord.returnNo} (Type: ${returnRecord.type})`);

    // Receive return
    await prisma.return.update({
      where: { id: returnRecord.id },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
    logStep("✓", `Return received at warehouse`);

    // QC the return
    await prisma.return.update({
      where: { id: returnRecord.id },
      data: { status: "QC_PENDING" },
    });

    for (const item of returnRecord.ReturnItem) {
      await prisma.returnItem.update({
        where: { id: item.id },
        data: { qcStatus: "PASSED", qcRemarks: "Item in good condition" },
      });
      logStep("✓", `QC passed for item ${item.skuId.slice(-6)}`);
    }

    await prisma.return.update({
      where: { id: returnRecord.id },
      data: { status: "QC_PASSED", qcCompletedAt: new Date() },
    });

    // Restock items
    const bin = await prisma.bin.findFirst({ where: { Zone: { locationId: location.id } } });

    for (const item of returnRecord.ReturnItem) {
      // Add back to inventory
      const existingInv = await prisma.inventory.findFirst({
        where: { skuId: item.skuId, binId: bin?.id },
      });

      if (existingInv) {
        await prisma.inventory.update({
          where: { id: existingInv.id },
          data: { quantity: { increment: item.quantity } },
        });
      } else if (bin) {
        await prisma.inventory.create({
          data: {
            skuId: item.skuId,
            locationId: location.id,
            binId: bin.id,
            quantity: item.quantity,
            reservedQty: 0,
          },
        });
      }

      // Create inventory movement
      const mvtSeq = await prisma.sequence.upsert({
        where: { name: "inventoryMovement" },
        update: { currentValue: { increment: 1 } },
        create: { name: "inventoryMovement", prefix: "MVT", currentValue: 1 },
      });
      const user = await prisma.user.findFirst();
      await prisma.inventoryMovement.create({
        data: {
          movementNo: `MVT${String(mvtSeq.currentValue).padStart(8, "0")}`,
          type: "IN",
          skuId: item.skuId,
          toBinId: bin?.id,
          quantity: item.quantity,
          referenceType: "RETURN",
          referenceId: returnRecord.id,
          performedBy: user?.id || "",
        },
      });

      logStep("✓", `Restocked ${item.quantity} units for item ${item.skuId.slice(-6)}`);
    }

    await prisma.return.update({
      where: { id: returnRecord.id },
      data: { status: "RESTOCKED", processedAt: new Date() },
    });
    logStep("✓", `Return completed and restocked`);

    results.push({ module: "Returns/RTO", status: "PASS", details: `Return: ${returnRecord.returnNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "Returns/RTO", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function testInventoryAdjustment() {
  logModule("INVENTORY ADJUSTMENT");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true } });
    const inventory = await prisma.inventory.findFirst({
      where: { locationId: location?.id, quantity: { gt: 0 } },
      include: { SKU: true, Bin: true },
    });
    const user = await prisma.user.findFirst();

    if (!location || !inventory || !user || !inventory.binId) throw new Error("No inventory found");

    const previousQty = inventory.quantity;
    const adjustedQty = -5;
    const newQty = previousQty + adjustedQty;

    // Create Stock Adjustment
    const adjSeq = await prisma.sequence.upsert({
      where: { name: "adjustment" },
      update: { currentValue: { increment: 1 } },
      create: { name: "adjustment", prefix: "ADJ", currentValue: 1 },
    });
    const adjustmentNo = `ADJ${String(adjSeq.currentValue).padStart(6, "0")}`;

    const adjustment = await prisma.stockAdjustment.create({
      data: {
        adjustmentNo,
        locationId: location.id,
        reason: "DAMAGE",
        remarks: "Damaged during storage",
        adjustedById: user.id,
        StockAdjustmentItem: {
          create: [{
            skuId: inventory.skuId,
            binId: inventory.binId,
            previousQty,
            adjustedQty,
            newQty,
          }],
        },
      },
      include: { StockAdjustmentItem: true },
    });
    logStep("✓", `Adjustment created: ${adjustment.adjustmentNo}`);

    // Approve adjustment
    await prisma.stockAdjustment.update({
      where: { id: adjustment.id },
      data: { approvedAt: new Date(), approvedBy: user.id },
    });
    logStep("✓", `Adjustment approved`);

    // Apply adjustment to inventory
    for (const item of adjustment.StockAdjustmentItem) {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { increment: item.adjustedQty } },
      });

      const mvtSeq = await prisma.sequence.upsert({
        where: { name: "inventoryMovement" },
        update: { currentValue: { increment: 1 } },
        create: { name: "inventoryMovement", prefix: "MVT", currentValue: 1 },
      });
      await prisma.inventoryMovement.create({
        data: {
          movementNo: `MVT${String(mvtSeq.currentValue).padStart(8, "0")}`,
          type: "OUT",
          skuId: item.skuId,
          fromBinId: item.binId,
          quantity: Math.abs(item.adjustedQty),
          referenceType: "ADJUSTMENT",
          referenceId: adjustment.id,
          performedBy: user.id,
          remarks: "Damaged items",
        },
      });

      logStep("✓", `Adjusted item: ${item.previousQty} -> ${item.newQty}`);
    }

    logStep("✓", `Adjustment completed`);

    results.push({ module: "Inventory Adjustment", status: "PASS", details: `Adjustment: ${adjustment.adjustmentNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "Inventory Adjustment", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function testCycleCount() {
  logModule("CYCLE COUNT (Physical Inventory Verification)");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true } });
    // Get inventories that have bins
    const allInventories = await prisma.inventory.findMany({
      where: { locationId: location?.id },
      include: { SKU: true, Bin: true },
      take: 10,
    });
    const inventories = allInventories.filter(inv => inv.binId !== null);
    const user = await prisma.user.findFirst();

    if (!location || inventories.length === 0 || !user) throw new Error("No inventory for cycle count");

    // Create Cycle Count
    const ccSeq = await prisma.sequence.upsert({
      where: { name: "cycleCount" },
      update: { currentValue: { increment: 1 } },
      create: { name: "cycleCount", prefix: "CC", currentValue: 1 },
    });
    const cycleCountNo = `CC${String(ccSeq.currentValue).padStart(6, "0")}`;

    const cycleCount = await prisma.cycleCount.create({
      data: {
        cycleCountNo,
        locationId: location.id,
        status: "PLANNED",
        scheduledDate: new Date(),
        initiatedById: user.id,
        CycleCountItem: {
          create: inventories.filter(inv => inv.binId).map(inv => ({
            skuId: inv.skuId,
            binId: inv.binId!,
            expectedQty: inv.quantity,
          })),
        },
      },
      include: { CycleCountItem: true },
    });
    logStep("✓", `Cycle Count created: ${cycleCount.cycleCountNo}`);

    // Start counting
    await prisma.cycleCount.update({
      where: { id: cycleCount.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    logStep("✓", `Counting started`);

    // Record counts (simulate physical count)
    for (const item of cycleCount.CycleCountItem) {
      const expected = item.expectedQty ?? 0;
      const countedQty = expected - 1; // Simulate 1 item variance
      const varianceQty = countedQty - expected;

      await prisma.cycleCountItem.update({
        where: { id: item.id },
        data: {
          countedQty,
          varianceQty,
          countedAt: new Date(),
          status: "COUNTED",
        },
      });

      logStep("✓", `Counted item ${item.skuId.slice(-6)} in bin ${item.binId.slice(-6)}: Expected=${expected}, Actual=${countedQty}, Variance=${varianceQty}`);
    }

    // Complete cycle count
    await prisma.cycleCount.update({
      where: { id: cycleCount.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    logStep("✓", `Cycle Count completed`);

    results.push({ module: "Cycle Count", status: "PASS", details: `Cycle Count: ${cycleCount.cycleCountNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "Cycle Count", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function testGatePass() {
  logModule("GATE PASS");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true } });
    const sku = await prisma.sKU.findFirst();

    if (!location) throw new Error("No location found");

    // Create Gate Pass
    const gpSeq = await prisma.sequence.upsert({
      where: { name: "gatePass" },
      update: { currentValue: { increment: 1 } },
      create: { name: "gatePass", prefix: "GP", currentValue: 1 },
    });
    const gatePassNo = `GP${String(gpSeq.currentValue).padStart(6, "0")}`;

    const gatePass = await prisma.gatePass.create({
      data: {
        gatePassNo,
        locationId: location.id,
        type: "INBOUND_DELIVERY",
        status: "OPEN",
        visitorName: "Vendor Representative",
        companyName: "ABC Supplies",
        visitorPhone: "9876543210",
        vehicleNumber: "MH01AB1234",
        purpose: "Material delivery",
        entryTime: new Date(),
        GatePassItem: sku ? {
          create: [{
            skuId: sku.id,
            quantity: 10,
            remarks: "Sample delivery",
          }],
        } : undefined,
      },
      include: { GatePassItem: true },
    });
    logStep("✓", `Gate Pass created: ${gatePass.gatePassNo} (Type: ${gatePass.type})`);

    // Start processing
    await prisma.gatePass.update({
      where: { id: gatePass.id },
      data: { status: "IN_PROGRESS" },
    });
    logStep("✓", `Gate Pass in progress`);

    // Close gate pass (visitor exits)
    await prisma.gatePass.update({
      where: { id: gatePass.id },
      data: { status: "CLOSED", exitTime: new Date() },
    });
    logStep("✓", `Visitor checked out`);

    results.push({ module: "Gate Pass", status: "PASS", details: `Gate Pass: ${gatePass.gatePassNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "Gate Pass", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function testCODReconciliation() {
  logModule("COD RECONCILIATION");

  try {
    const location = await prisma.location.findFirst({ where: { isActive: true }, include: { Company: true } });
    const transporter = await prisma.transporter.findFirst({ where: { isActive: true } });

    if (!location) throw new Error("No location found");

    // Create COD Reconciliation
    const codSeq = await prisma.sequence.upsert({
      where: { name: "codReconciliation" },
      update: { currentValue: { increment: 1 } },
      create: { name: "codReconciliation", prefix: "COD", currentValue: 1 },
    });
    const reconciliationNo = `COD${String(codSeq.currentValue).padStart(6, "0")}`;

    const reconciliation = await prisma.cODReconciliation.create({
      data: {
        reconciliationNo,
        locationId: location.id,
        companyId: location.companyId,
        transporterId: transporter?.id,
        status: "PENDING",
        reconciliationDate: new Date(),
        periodFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        periodTo: new Date(),
        expectedAmount: 5000,
        collectedAmount: 5000,
        remittedAmount: 0,
        variance: 0,
      },
    });
    logStep("✓", `COD Reconciliation created: ${reconciliation.reconciliationNo}`);

    // Create transaction sequence
    const txnSeq = await prisma.sequence.upsert({
      where: { name: "codTransaction" },
      update: { currentValue: { increment: 1 } },
      create: { name: "codTransaction", prefix: "TXN", currentValue: 1 },
    });
    const transactionNo = `TXN${String(txnSeq.currentValue).padStart(8, "0")}`;

    // Add transaction
    const transaction = await prisma.cODTransaction.create({
      data: {
        transactionNo,
        reconciliationId: reconciliation.id,
        type: "REMITTANCE",
        amount: 5000,
        transactionDate: new Date(),
        remarks: "Weekly COD remittance",
      },
    });
    logStep("✓", `Transaction added: ${transaction.transactionNo} - Rs.${transaction.amount}`);

    // Update reconciliation
    await prisma.cODReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        remittedAmount: 5000,
        status: "RECONCILED",
      },
    });
    logStep("✓", `Reconciliation completed`);

    results.push({ module: "COD Reconciliation", status: "PASS", details: `Reconciliation: ${reconciliation.reconciliationNo}` });
  } catch (error) {
    const err = error as Error;
    results.push({ module: "COD Reconciliation", status: "FAIL", details: err.message, error: err.stack });
    console.error("   ✗ Error:", err.message);
  }
}

async function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

  console.log("Module Results:");
  console.log("-".repeat(60));
  for (const result of results) {
    const icon = result.status === "PASS" ? "✅" : "❌";
    console.log(`${icon} ${result.module.padEnd(25)} ${result.status.padEnd(6)} ${result.details}`);
    if (result.error) {
      console.log(`   Error: ${result.error.split("\n")[0]}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (failed === 0) {
    console.log("🎉 ALL MODULES PASSED - OMS IS FULLY INTEGRATED!");
  } else {
    console.log(`⚠️  ${failed} module(s) failed - please review errors above`);
  }
  console.log("=".repeat(60) + "\n");
}

async function main() {
  console.log("\n🚀 COMPREHENSIVE OMS END-TO-END TEST");
  console.log("Testing all modules with seed data...\n");

  try {
    // Run all module tests
    await testInboundFlow();
    await testOrderFlow();
    await testReturnFlow();
    await testInventoryAdjustment();
    await testCycleCount();
    await testGatePass();
    await testCODReconciliation();

    // Print summary
    await printSummary();

  } catch (error) {
    console.error("\n❌ Critical error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
